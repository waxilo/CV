import { describe, expect, it } from 'vitest';
import {
  LEGACY_NPM_PACKAGE,
  MCP_DOWNLOAD_URL,
  SCRIPT_PATH_EXAMPLE,
  buildInstallPrompt,
  buildMcpConfig,
  buildUpdatePrompt,
  detectClientOs,
} from '../prompts';

const API_BASE = 'https://cv.example.com';
const TOKEN = 'cvk_test_token';

/** 提取提示词里的 JSON 配置块 */
function extractConfig(prompt: string) {
  const start = prompt.indexOf('{\n  "mcpServers"');
  const end = prompt.indexOf('\n}', start) + 2;
  return JSON.parse(prompt.slice(start, end));
}

describe('buildMcpConfig', () => {
  it('用 node + 脚本路径启动，不再走 npx', () => {
    const config = buildMcpConfig({ apiBase: API_BASE, token: TOKEN, scriptPath: '/a/cv-mcp.mjs' });
    expect(config.mcpServers['cv-builder']).toEqual({
      command: 'node',
      args: ['/a/cv-mcp.mjs'],
      env: { CV_API_BASE: API_BASE, CV_API_TOKEN: TOKEN },
    });
  });
});

describe('buildInstallPrompt', () => {
  const prompt = buildInstallPrompt(API_BASE, TOKEN);

  it('包含 Release 下载地址与两种系统的下载命令', () => {
    expect(prompt).toContain(MCP_DOWNLOAD_URL);
    expect(prompt).toContain('curl -fL');
    expect(prompt).toContain('Invoke-WebRequest');
  });

  it('配置块是合法 JSON，且带上 apiBase 与密钥', () => {
    const server = extractConfig(prompt).mcpServers['cv-builder'];
    expect(server.command).toBe('node');
    expect(server.env).toEqual({ CV_API_BASE: API_BASE, CV_API_TOKEN: TOKEN });
  });

  it('不再引导使用 npx 启动', () => {
    expect(prompt).not.toMatch(/"command":\s*"npx"/);
  });
});

describe('buildUpdatePrompt', () => {
  it('引导把旧 npx 配置迁移为脚本方式', () => {
    const prompt = buildUpdatePrompt(API_BASE);
    expect(prompt).toContain(LEGACY_NPM_PACKAGE);
    expect(prompt).toContain(MCP_DOWNLOAD_URL);
    expect(extractConfig(prompt).mcpServers['cv-builder'].command).toBe('node');
  });

  it('无新密钥时要求保留现有密钥，有新密钥时带上轮换说明', () => {
    expect(buildUpdatePrompt(API_BASE)).toContain('保留现有 env.CV_API_TOKEN');
    expect(buildUpdatePrompt(API_BASE, TOKEN)).toContain(`更新为：${TOKEN}`);
  });
});

describe('detectClientOs', () => {
  it('按 userAgent 选择路径示例', () => {
    expect(detectClientOs('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('windows');
    expect(detectClientOs('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)')).toBe('unix');
    expect(SCRIPT_PATH_EXAMPLE.windows).toMatch(/\\\.cv-mcp\\cv-mcp\.mjs$/);
  });
});
