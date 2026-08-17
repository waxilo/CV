/**
 * 注册 CV Builder MCP 工具。
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CvApiClient } from '../api/client.js';
import {
  isResumeDataShape,
  isTemplateConfigShape,
  type IResumeBasics,
  type IResumeData,
  type IResumeSection,
  type ITemplateConfig,
} from '../api/types.js';
import { errorResult, textResult } from './result.js';

const resumeIdSchema = z.string().uuid().describe('简历 ID（UUID）');

/**
 * 将工具挂到 MCP Server。
 */
export function registerTools(server: McpServer, api: CvApiClient): void {
  server.tool(
    'list_resumes',
    '列出当前账号下的所有简历（摘要：id、标题、模板、是否锁定、更新时间；不含完整正文）。改简历前先调用此工具拿到 resume_id。账号为空时请先 create_resume。若原件已锁定或希望降低风险，请先 duplicate_resume 再改副本。',
    {},
    async () => {
      try {
        const list = await api.listResumes();
        const summaries = list.map((item) => ({
          resume_id: item.resume_id,
          title: item.title,
          slug: item.slug,
          template_id: item.template_id,
          is_public: item.is_public,
          is_locked: Boolean(item.is_locked),
          name: item.data?.basics?.name ?? '',
          headline: item.data?.basics?.headline ?? '',
          updated_at: item.updated_at,
        }));
        return textResult({ count: summaries.length, resumes: summaries });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'create_resume',
    '从零新建一份简历。新用户 / 账号无简历 / 迁移旧简历时用此工具。可选传入完整 data 一次性写入内容；不传则创建空壳，再 update_*。内置模板：modern / classic / minimal / technical / business。',
    {
      title: z
        .string()
        .min(1)
        .max(100)
        .optional()
        .describe('简历标题，默认「未命名简历」'),
      template_id: z
        .string()
        .min(1)
        .max(64)
        .optional()
        .describe('模板 ID，默认 modern；可选 classic / minimal / technical / business'),
      data: z
        .record(z.unknown())
        .optional()
        .describe(
          '可选：完整 IResumeData（basics / sections / metadata）。迁移旧简历时直接传入，创建后立即写回。'
        ),
    },
    async ({ title, template_id, data }) => {
      try {
        if (data !== undefined && !isResumeDataShape(data)) {
          return errorResult(
            'data 结构不完整：需包含 basics、sections、metadata.templateId、metadata.theme'
          );
        }

        const created = await api.createResume({
          title,
          template_id,
        });

        if (!data) {
          return textResult({
            ok: true,
            message:
              '已创建空简历。可用 update_resume / update_basics / update_section 写入内容；迁移旧简历也可再次 create_resume 并带上 data。',
            resume_id: created.resume_id,
            title: created.title,
            slug: created.slug,
            template_id: created.template_id,
            data: created.data,
          });
        }

        // 与所选模板对齐：优先用调用方 metadata.templateId，否则用创建时的模板
        const nextData: IResumeData = {
          ...data,
          metadata: {
            ...data.metadata,
            templateId: data.metadata.templateId || created.template_id,
          },
        };

        const updated = await api.updateResume({
          resume_id: created.resume_id,
          data: nextData,
          template_id: nextData.metadata.templateId,
          title,
        });

        return textResult({
          ok: true,
          message: '已创建简历并写入内容。后续改动请用返回的 resume_id。',
          resume_id: created.resume_id,
          title: title || created.title,
          slug: created.slug,
          template_id: nextData.metadata.templateId,
          is_public: updated.is_public,
          share_token: updated.share_token,
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'get_resume',
    '按 resume_id 拉取完整简历 JSON（basics / sections / metadata）。修改前必须先读取最新数据。若 is_locked=true，只能先 duplicate_resume 再改副本。',
    { resume_id: resumeIdSchema },
    async ({ resume_id }) => {
      try {
        const detail = await api.getResume(resume_id);
        return textResult({
          resume_id: detail.resume_id,
          title: detail.title,
          slug: detail.slug,
          template_id: detail.template_id,
          is_public: detail.is_public,
          is_locked: Boolean(detail.is_locked),
          updated_at: detail.updated_at,
          data: detail.data,
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'duplicate_resume',
    '【推荐】深拷贝一份简历再改，避免直接改原件。锁定中的原件也可复制；副本默认未锁定。返回新 resume_id，后续 update_* 请只用新 ID。',
    {
      resume_id: resumeIdSchema.describe('要复制的源简历 ID'),
      title: z
        .string()
        .min(1)
        .max(100)
        .optional()
        .describe('可选：副本标题；默认「原标题 副本」'),
    },
    async ({ resume_id, title }) => {
      try {
        const cloned = await api.cloneResume({ resume_id, title });
        return textResult({
          ok: true,
          message:
            '已创建副本。请用返回的 resume_id 继续 get_resume / update_*；不要再写回 source_resume_id。',
          ...cloned,
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'update_resume',
    '用完整 IResumeData 覆盖写回简历。必须保留 basics、sections、metadata（含 templateId 与 theme）。适合大范围改写后一次性保存。建议先 duplicate_resume，再对本工具传入副本 resume_id。',
    {
      resume_id: resumeIdSchema,
      data: z
        .record(z.unknown())
        .describe('完整简历 JSON：{ basics, sections, metadata }'),
      title: z.string().min(1).max(100).optional().describe('可选：同时更新简历标题'),
    },
    async ({ resume_id, data, title }) => {
      try {
        if (!isResumeDataShape(data)) {
          return errorResult(
            'data 结构不完整：需包含 basics、sections、metadata.templateId、metadata.theme'
          );
        }
        const result = await api.updateResume({
          resume_id,
          data,
          title,
        });
        return textResult({ ok: true, ...result });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'update_basics',
    '仅更新 basics 中给出的字段（合并写入，未传字段保持原值）。例如改 headline、联系方式、工作年限。建议先 duplicate_resume 再改副本。',
    {
      resume_id: resumeIdSchema,
      basics: z
        .record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
        .describe('要合并的 basics 字段，如 { headline, email, phone, workYears }'),
    },
    async ({ resume_id, basics }) => {
      try {
        const detail = await api.getResume(resume_id);
        const nextBasics = {
          ...detail.data.basics,
          ...sanitizeBasicsPatch(basics),
        } as IResumeBasics;
        const nextData: IResumeData = {
          ...detail.data,
          basics: nextBasics,
        };
        const result = await api.updateResume({ resume_id, data: nextData });
        return textResult({ ok: true, basics: nextBasics, ...result });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'update_section',
    '按 section id 或 type 替换/合并某一模块。传入 section 对象时以传入字段为准合并；传入 items/content 可改条目与富文本。建议先 duplicate_resume 再改副本。',
    {
      resume_id: resumeIdSchema,
      section_id: z.string().optional().describe('模块 id（优先）'),
      section_type: z
        .string()
        .optional()
        .describe('模块 type，如 experience / education / skills / projects / summary'),
      section: z
        .record(z.unknown())
        .describe('要合并的 section 字段，如 { name, content, items, visible }'),
    },
    async ({ resume_id, section_id, section_type, section }) => {
      try {
        if (!section_id && !section_type) {
          return errorResult('必须提供 section_id 或 section_type');
        }
        const detail = await api.getResume(resume_id);
        const index = detail.data.sections.findIndex((s) =>
          section_id ? s.id === section_id : s.type === section_type
        );
        if (index < 0) {
          return errorResult(
            `未找到模块：${section_id ? `id=${section_id}` : `type=${section_type}`}`
          );
        }

        const current = detail.data.sections[index] as IResumeSection;
        const nextSection = mergeSection(current, section);
        const sections = detail.data.sections.slice();
        sections[index] = nextSection;
        const nextData: IResumeData = { ...detail.data, sections };
        const result = await api.updateResume({ resume_id, data: nextData });
        return textResult({
          ok: true,
          section: nextSection,
          ...result,
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'validate_resume_data',
    '校验一段 JSON 是否具备可写回的 IResumeData 结构（basics / sections / metadata）。写回前可用。',
    {
      data: z.record(z.unknown()).describe('待校验的简历 JSON'),
    },
    async ({ data }) => {
      const valid = isResumeDataShape(data);
      if (!valid) {
        return textResult({
          valid: false,
          errors: ['缺少 basics / sections / metadata.templateId / metadata.theme'],
        });
      }
      return textResult({
        valid: true,
        section_count: data.sections.length,
        section_types: data.sections.map((s) => s.type),
        template_id: data.metadata.templateId,
        name: data.basics.name,
      });
    }
  );

  server.tool(
    'get_resume_template',
    '读取简历当前使用的模板：HTML/CSS 源码、变量声明、页面设置与用户调参。调整模板前先调用。has_snapshot=true 表示这份简历持有固化模板副本（独立于模板中心）；false 表示仍跟随模板中心，update_resume_template 首次修改时会自动固化。',
    { resume_id: resumeIdSchema },
    async ({ resume_id }) => {
      try {
        const detail = await api.getResume(resume_id);
        const config = detail.data.metadata?.templateConfig;
        if (!config || !isTemplateConfigShape(config)) {
          return textResult({
            resume_id,
            title: detail.title,
            template_id: detail.data.metadata.templateId,
            has_snapshot: false,
            message:
              '该简历未固化模板快照，渲染跟随模板中心。可用 update_resume_template 调整，首次保存会自动以模板中心当前配置为基线固化。',
          });
        }
        return textResult({
          resume_id,
          title: detail.title,
          template_id: detail.data.metadata.templateId,
          has_snapshot: true,
          engine: config.engine,
          meta: config.meta || {},
          page: config.page || {},
          variables: config.variables || [],
          source: config.source || {},
          // 用户在编辑页调整过的变量值（渲染优先级最高）
          user_vars: detail.data.metadata.templateVars || {},
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'update_resume_template',
    '调整简历的模板：整体替换 HTML 源码（html）、CSS（css）、变量声明（variables）或页边距（margin）。只改模板，不动简历内容，保存后立即生效。该简历此前未固化模板时，会自动以模板中心当前配置为基线固化再应用修改。仅支持 html 引擎模板；建议先 duplicate_resume 再改副本。',
    {
      resume_id: resumeIdSchema,
      html: z
        .string()
        .optional()
        .describe('整体替换模板 HTML 源码（engine=html 时生效；禁止 script 与事件属性）'),
      css: z
        .string()
        .optional()
        .describe('整体替换模板 CSS（作用域自动限制在 .cv-root 内）'),
      variables: z
        .array(
          z.object({
            key: z.string().min(1).max(64),
            label: z.string().max(64).optional(),
            type: z
              .enum(['color', 'number', 'length', 'text', 'select', 'boolean'])
              .optional(),
            default: z.union([z.string(), z.number(), z.boolean()]).optional(),
            options: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
            min: z.number().optional(),
            max: z.number().optional(),
            step: z.number().optional(),
            unit: z.string().optional(),
            cssVar: z.string().optional(),
            group: z.string().optional(),
          })
        )
        .optional()
        .describe('整体替换变量声明数组（变量 key 需与模板代码中 vars.* 使用一致）'),
      margin: z
        .object({
          top: z.number().min(0).max(50).optional(),
          right: z.number().min(0).max(50).optional(),
          bottom: z.number().min(0).max(50).optional(),
          left: z.number().min(0).max(50).optional(),
        })
        .optional()
        .describe('页边距（毫米），只传需要改的边，其余保持原值'),
    },
    async ({ resume_id, html, css, variables, margin }) => {
      try {
        if (html === undefined && css === undefined && variables === undefined && margin === undefined) {
          return errorResult('未提供任何修改项：html / css / variables / margin 至少传一个');
        }

        const detail = await api.getResume(resume_id);
        const metadata = detail.data.metadata;
        const hadSnapshot = Boolean(metadata?.templateConfig);

        let config: ITemplateConfig | null = null;
        if (metadata?.templateConfig && isTemplateConfigShape(metadata.templateConfig)) {
          config = metadata.templateConfig;
        } else {
          // 未固化：以模板中心当前配置为基线
          const templates = await api.listTemplates();
          const found = templates.find((t) => t.template_id === metadata.templateId);
          if (found && isTemplateConfigShape(found.config)) {
            config = found.config;
          }
        }
        if (!config) {
          return errorResult('找不到该简历的模板配置，无法调整');
        }
        if (config.engine !== 'html') {
          return errorResult(`模板引擎为 ${config.engine}，仅支持调整 html 引擎模板`);
        }

        const changed: string[] = [];
        if (html !== undefined) {
          config.source = { ...config.source, html };
          changed.push('html');
        }
        if (css !== undefined) {
          config.source = { ...config.source, css };
          changed.push('css');
        }
        if (variables !== undefined) {
          config.variables = variables;
          changed.push('variables');
        }
        if (margin !== undefined) {
          config.page = {
            ...config.page,
            margin: { ...config.page.margin, ...margin },
          };
          changed.push('margin');
        }

        // 深拷贝写回：整份 data 提交，后端会保留其余字段
        const nextData: IResumeData = {
          ...detail.data,
          metadata: {
            ...metadata,
            templateConfig: JSON.parse(JSON.stringify(config)) as ITemplateConfig,
          },
        };
        const result = await api.updateResume({ resume_id, data: nextData });

        return textResult({
          ok: true,
          ...result,
          changed,
          has_snapshot: true,
          engine: config.engine,
          note: hadSnapshot
            ? '已更新该简历固化的模板快照（模板中心与其他简历不受影响）'
            : '该简历此前未固化模板，已以模板中心当前配置为基线固化并应用修改',
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}

function sanitizeBasicsPatch(
  patch: Record<string, string | number | boolean | null>
): Partial<IResumeBasics> {
  const allowed = new Set([
    'name',
    'headline',
    'email',
    'phone',
    'location',
    'url',
    'avatarUrl',
    'birthDate',
    'graduationDate',
    'gender',
    'age',
    'workYears',
    'wechat',
  ]);
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (!allowed.has(key) || value === null || value === undefined) continue;
    next[key] = String(value);
  }
  return next as Partial<IResumeBasics>;
}

function mergeSection(
  current: IResumeSection,
  patch: Record<string, unknown>
): IResumeSection {
  const next: IResumeSection = { ...current };

  if (typeof patch.name === 'string') next.name = patch.name;
  if (typeof patch.visible === 'boolean') next.visible = patch.visible;
  if (typeof patch.order === 'number') next.order = patch.order;
  if (typeof patch.content === 'string') next.content = patch.content;
  if (Array.isArray(patch.items)) {
    next.items = patch.items as Record<string, unknown>[];
  }

  // 禁止改 id/type，避免破坏模板绑定
  return next;
}
