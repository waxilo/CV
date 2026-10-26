/**
 * MCP 接入页的提示词 / 配置构造（纯函数，不依赖 Vue）。
 *
 * 分发方式：单文件脚本 cv-mcp.mjs 托管在 GitHub Release，
 * 本地固定放到 ~/.cv-mcp/cv-mcp.mjs，用 `node <绝对路径>` 启动（需 Node 18+）。
 */

export const MCP_SERVER_NAME = 'cv-builder';
export const MCP_RELEASE_PAGE = 'https://github.com/waxilo/CV/releases/latest';
export const MCP_DOWNLOAD_URL = 'https://github.com/waxilo/CV/releases/latest/download/cv-mcp.mjs';
/** 旧版 npm 分发的包名，仅用于在更新提示词里识别并替换旧配置 */
export const LEGACY_NPM_PACKAGE = '@waxilo/cv-mcp';

export type ClientOs = 'windows' | 'unix';

/** 手动配置 JSON 里展示的脚本路径示例（Agent 会按实际用户目录替换为绝对路径） */
export const SCRIPT_PATH_EXAMPLE: Record<ClientOs, string> = {
  windows: 'C:\\Users\\你的用户名\\.cv-mcp\\cv-mcp.mjs',
  unix: '/Users/你的用户名/.cv-mcp/cv-mcp.mjs',
};

const DOWNLOAD_COMMANDS = `   - macOS / Linux：
     mkdir -p ~/.cv-mcp && curl -fL -o ~/.cv-mcp/cv-mcp.mjs ${MCP_DOWNLOAD_URL}
   - Windows（PowerShell）：
     New-Item -ItemType Directory -Force "$HOME\\.cv-mcp" | Out-Null; Invoke-WebRequest -Uri ${MCP_DOWNLOAD_URL} -OutFile "$HOME\\.cv-mcp\\cv-mcp.mjs"`;

/** 从 userAgent 粗略判断客户端系统，仅用于选择路径示例 */
export function detectClientOs(userAgent: string): ClientOs {
  return /windows/i.test(userAgent) ? 'windows' : 'unix';
}

export interface IMcpConfigInput {
  apiBase: string;
  token: string;
  scriptPath: string;
}

/** 生成 mcpServers 配置对象 */
export function buildMcpConfig({ apiBase, token, scriptPath }: IMcpConfigInput) {
  return {
    mcpServers: {
      [MCP_SERVER_NAME]: {
        command: 'node',
        args: [scriptPath],
        env: {
          CV_API_BASE: apiBase,
          CV_API_TOKEN: token,
        },
      },
    },
  };
}

function configBlock(apiBase: string, token: string): string {
  return JSON.stringify(
    buildMcpConfig({ apiBase, token, scriptPath: '<cv-mcp.mjs 的绝对路径>' }),
    null,
    2
  );
}

/** 贴进 Cursor / Claude 等 Agent 的安装提示词 */
export function buildInstallPrompt(apiBase: string, token: string): string {
  return `请帮我在当前 AI 客户端中全局安装并启用 CV Builder MCP（用于读写我的在线简历）。

【必须完成】
1. 确认本机已安装 Node.js 18 及以上（node -v）；没有的话先提示我安装，不要继续。
2. 从 GitHub Release 下载单文件脚本 cv-mcp.mjs 到用户目录下的 .cv-mcp 文件夹（已存在则覆盖）：
${DOWNLOAD_COMMANDS}
3. 写入全局 MCP 配置，服务器名称：${MCP_SERVER_NAME}。args 必须填 cv-mcp.mjs 的绝对路径（展开 ~ / $HOME，Windows 路径在 JSON 里用 \\\\ 转义）：

${configBlock(apiBase, token)}

4. 若客户端使用 mcp.json / Claude Desktop 的 claude_desktop_config.json / Cursor 的 MCP 设置，请写入对应文件并保存。
5. 配置完成后提示我刷新或重启 MCP；可用工具 list_resumes 验证是否连通。
6. 若账号还没有简历：用 create_resume 从零新建（迁移旧简历时可带上完整 data）；已有简历则默认先 duplicate_resume 再改副本，不要直接改原件。

【注意】
- CV_API_TOKEN 是我的私密密钥，不要提交到 git，不要发到公开场合。
- 不要改用 npx / npm 包（${LEGACY_NPM_PACKAGE} 已停止更新），也不要改成本地仓库或 tsx 路径。
- 只改 MCP 配置和 ~/.cv-mcp 目录，不要改我的业务代码（除非我另行要求）。`;
}

/**
 * 已装过 MCP 时的更新提示词：重新下载覆盖脚本并重启。
 * @param rotatedToken 本页刚创建 / 轮换的密钥；没有则要求保留现有密钥
 */
export function buildUpdatePrompt(apiBase: string, rotatedToken?: string | null): string {
  const tokenLine = rotatedToken
    ? `- 若需轮换密钥，将 env.CV_API_TOKEN 更新为：${rotatedToken}`
    : '- 保留现有 env.CV_API_TOKEN（除非我另行提供新 Key）；不要删除或清空密钥。';

  return `请帮我把当前 AI 客户端里已安装的 CV Builder MCP（${MCP_SERVER_NAME}）更新到最新版本。

【必须完成】
1. 重新下载最新 cv-mcp.mjs，覆盖用户目录下 .cv-mcp 里的旧文件：
${DOWNLOAD_COMMANDS}
2. 检查全局 MCP 配置里的 ${MCP_SERVER_NAME}：
   - 若仍是旧方式（command 为 npx、args 含 ${LEGACY_NPM_PACKAGE}），改成下面的 node + 脚本绝对路径方式；
   - 已是 node 方式则只需确认 args 指向刚覆盖的文件。

${configBlock(apiBase, '（保留我现有的密钥，不要改成占位符）')}

3. 保存 MCP 配置后，提示我刷新 / 重启 MCP（Cursor：Settings → MCP 开关或 Reload）。
4. 用 list_resumes 验证连通；若返回 RESUME_LOCKED，说明该简历已锁定，需我在网页解锁后再改原件，或先 duplicate_resume 再改副本。空账号可用 create_resume 从零新建（可带 data 迁移）。
${tokenLine}

【改简历约定】
- 无简历时用 create_resume；已有简历默认先 duplicate_resume 再 update_* 副本，不要直接改正式原件（除非我明确要求）。
- 不要改回 npx / npm 包，也不要改成本地仓库 / tsx 路径。
- 不要把 CV_API_TOKEN 提交到 git 或发到公开场合。
- 只更新 MCP 配置与 ~/.cv-mcp 下的脚本，不要改我的业务代码（除非我另行要求）。`;
}
