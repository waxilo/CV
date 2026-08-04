import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { createDb, resumes, templates } from '../db';
import { getBuiltinTemplate, normalizeForRead } from '../template/schema';
import type { IResumeData } from '../types/resume';

/**
 * 公开分享接口（无需登录）。
 * 通过 share_token 访问；每次开启分享会轮换令牌，旧链接立即失效。
 * 读的是库里最新 data，简历保存后分享页自动更新。
 */
export const shareRoutes = new Hono<{ Bindings: Env }>();

const getSharedSchema = z.object({
  share_token: z.string().uuid(),
});

async function resolveTemplateConfig(
  db: ReturnType<typeof createDb>,
  templateId: string
): Promise<unknown> {
  const builtin = getBuiltinTemplate(templateId);
  if (builtin) return builtin.config;

  const rows = await db
    .select({ config: templates.config })
    .from(templates)
    .where(and(eq(templates.id, templateId), eq(templates.isDeleted, false)))
    .limit(1);

  if (rows[0]) return normalizeForRead(rows[0].config);

  return getBuiltinTemplate('minimal')?.config ?? getBuiltinTemplate('modern')?.config ?? null;
}

/** POST /api/share-service/v1/get-resume */
shareRoutes.post('/get-resume', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = getSharedSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { success: false, code: 'COMMON_PARAM_invalidRequest', message: 'share_token 无效' },
      400
    );
  }

  const db = createDb(c.env.DB);
  const rows = await db
    .select()
    .from(resumes)
    .where(
      and(
        eq(resumes.shareToken, parsed.data.share_token),
        eq(resumes.isPublic, true),
        eq(resumes.isDeleted, false)
      )
    )
    .limit(1);

  const resume = rows[0];
  if (!resume) {
    return c.json(
      { success: false, code: 'RESUME_SHARE_notFound', message: '分享不存在或已关闭' },
      404
    );
  }

  const templateConfig = await resolveTemplateConfig(db, resume.templateId);
  if (!templateConfig) {
    return c.json(
      { success: false, code: 'TEMPLATE_NOT_FOUND', message: '简历模板不可用' },
      404
    );
  }

  return c.json({
    success: true,
    code: '0',
    message: 'Success',
    data: {
      resume_id: resume.id,
      title: resume.title,
      slug: resume.slug,
      template_id: resume.templateId,
      data: resume.data as IResumeData,
      template_config: templateConfig,
      updated_at: resume.updatedAt,
    },
  });
});
