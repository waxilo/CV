/**
 * MCP 版本号：构建时由 esbuild 从 package.json 注入；`npm run dev`（tsx 直跑）时为 dev。
 */
declare const __CV_MCP_VERSION__: string | undefined;

export const MCP_VERSION: string =
  typeof __CV_MCP_VERSION__ === 'string' ? __CV_MCP_VERSION__ : '0.0.0-dev';
