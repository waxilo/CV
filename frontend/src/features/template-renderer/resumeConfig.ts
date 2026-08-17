/**
 * 简历模板配置解析（快照优先）
 *
 * 统一「一份简历用哪份模板配置」的决策链，供预览 / 导出 / 打印 / 首页缩略图共用：
 *
 *   显式传入 → 简历模板快照（metadata.templateConfig，完全固化）
 *   → 模板中心列表 → 详情接口 → 同名内置模板 → 默认模板（minimal）
 *
 * 快照是用户可编辑的数据（简历内嵌编辑器 / MCP 都可能写入），
 * normalizeTemplateConfig 对任意输入宽容降级，不会 throw。
 */

import type { IResumeData } from '/@/types/resume';
import type { ITemplate, ITemplateConfig } from '/@/types/template';
import { getBuiltinTemplate } from '@cv/template-schema';
import { normalizeTemplateConfig } from './migrate';

/** 模板 store 的最小接口（不依赖 pinia，便于单测与多端复用） */
export interface ITemplateStoreLike {
  list: readonly ITemplate[];
  getById(templateId: string): ITemplate | undefined;
  fetchList(): Promise<void>;
  loadDetail(templateId: string): Promise<ITemplate | null>;
}

/**
 * 同步优先链：显式配置 → 快照 → store 列表。
 * 找不到时返回 null（网络层或内置兜底由调用方决定）。
 */
export function pickResumeTemplateConfig(
  data: IResumeData,
  store: ITemplateStoreLike,
  explicitConfig?: unknown
): ITemplateConfig | null {
  if (explicitConfig) return normalizeTemplateConfig(explicitConfig);

  const snapshot = data.metadata?.templateConfig;
  if (snapshot) return normalizeTemplateConfig(snapshot);

  const templateId = data.metadata?.templateId || 'modern';
  const found = store.getById(templateId);
  if (found) return normalizeTemplateConfig(found.config);

  return null;
}

/** 内置模板兜底：同名内置 → minimal 默认模板 */
export function builtinTemplateFallback(templateId?: string): ITemplateConfig | null {
  const builtin =
    getBuiltinTemplate(templateId || '') || getBuiltinTemplate('minimal');
  return builtin ? normalizeTemplateConfig(builtin.config) : null;
}

/**
 * 完整解析链（含网络回退）：
 * 显式配置 → 快照 → store（必要时 fetchList）→ 详情接口 → 内置兜底。
 */
export async function resolveResumeTemplateConfig(
  data: IResumeData,
  store: ITemplateStoreLike,
  explicitConfig?: unknown
): Promise<ITemplateConfig | null> {
  const picked = pickResumeTemplateConfig(data, store, explicitConfig);
  if (picked) return picked;

  const templateId = data.metadata?.templateId || 'modern';
  if (!store.list.length) {
    await store.fetchList();
  }
  const found = store.getById(templateId);
  if (found) return normalizeTemplateConfig(found.config);

  try {
    const detail = await store.loadDetail(templateId);
    if (detail) return normalizeTemplateConfig(detail.config);
  } catch {
    // 接口不可用时走内置兜底
  }

  return builtinTemplateFallback(templateId);
}
