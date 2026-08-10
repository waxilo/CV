/**
 * 从环境变量读取 MCP 运行配置。
 * 勿向 stdout 打印（stdio 协议占用）；调试用 stderr。
 */

export interface IMcpConfig {
  apiBase: string;
  apiToken: string;
}

const DEFAULT_API_BASE = 'https://cv-api.sloan.dpdns.org';

/**
 * 解析并校验运行所需环境变量。
 * @throws {Error} 缺少 token 时抛出
 */
export function loadConfig(): IMcpConfig {
  const apiBase = (process.env.CV_API_BASE || DEFAULT_API_BASE).replace(/\/$/, '');
  const apiToken = (process.env.CV_API_TOKEN || process.env.CV_TOKEN || '').trim();

  if (!apiToken) {
    throw new Error(
      '缺少 CV_API_TOKEN（或 CV_TOKEN）。请在 CV Builder「MCP 接入」页创建 API Key 后填入。'
    );
  }

  return { apiBase, apiToken };
}
