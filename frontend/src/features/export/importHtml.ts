/**
 * 从 CV Builder 导出的 HTML 中解析 #cv-data 简历 JSON。
 */

import type { IResumeData } from '/@/types/resume';
import { CV_DATA_SCRIPT_ID } from './cvPayload';

export class ImportHtmlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportHtmlError';
  }
}

/**
 * 粗校验：必须具备 basics / sections / metadata。
 */
export function isResumeDataShape(value: unknown): value is IResumeData {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  if (!record.basics || typeof record.basics !== 'object') return false;
  if (!Array.isArray(record.sections)) return false;
  if (!record.metadata || typeof record.metadata !== 'object') return false;
  const metadata = record.metadata as Record<string, unknown>;
  if (typeof metadata.templateId !== 'string' || !metadata.templateId.trim()) return false;
  if (!metadata.theme || typeof metadata.theme !== 'object') return false;
  return true;
}

/**
 * 从 HTML 字符串提取并校验简历数据。
 */
export function parseResumeDataFromHtml(html: string): IResumeData {
  const source = String(html || '').trim();
  if (!source) {
    throw new ImportHtmlError('文件内容为空');
  }

  let rawJson = '';

  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(source, 'text/html');
    const node =
      doc.getElementById(CV_DATA_SCRIPT_ID) ||
      doc.querySelector(`script#${CV_DATA_SCRIPT_ID}[type="application/json"]`);
    rawJson = (node?.textContent || '').trim();
  }

  if (!rawJson) {
    // 无 DOM 或解析失败时的兜底正则（测试环境 / 极端损坏文档）
    const matched = source.match(
      new RegExp(
        `<script[^>]*\\bid=["']${CV_DATA_SCRIPT_ID}["'][^>]*>([\\s\\S]*?)<\\/script>`,
        'i'
      )
    );
    rawJson = (matched?.[1] || '').trim();
  }

  if (!rawJson) {
    throw new ImportHtmlError(
      `未找到简历数据（#${CV_DATA_SCRIPT_ID}）。请使用本工具导出的 HTML，并确认 AI 未删除该区块。`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new ImportHtmlError('简历 JSON 无法解析，请检查 #cv-data 是否仍为合法 JSON');
  }

  if (!isResumeDataShape(parsed)) {
    throw new ImportHtmlError('简历 JSON 结构不完整，需包含 basics、sections、metadata');
  }

  // 深拷贝，避免外部引用污染 store
  return JSON.parse(JSON.stringify(parsed)) as IResumeData;
}

/**
 * 读取本地 HTML 文件并解析为简历数据。
 */
export async function importResumeFromHtmlFile(file: File): Promise<IResumeData> {
  const text = await file.text();
  return parseResumeDataFromHtml(text);
}
