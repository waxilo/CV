/**
 * 把 MCP Server 及其依赖（@modelcontextprotocol/sdk、zod）打成单文件 dist/cv-mcp.mjs。
 * 产物只依赖 Node 18+，通过 GitHub Release 分发：`node /path/to/cv-mcp.mjs`。
 */
import { build } from 'esbuild';
import { chmodSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const outfile = join(root, 'dist', 'cv-mcp.mjs');

await build({
  entryPoints: [join(root, 'src', 'index.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  minify: false,
  legalComments: 'none',
  define: { __CV_MCP_VERSION__: JSON.stringify(version) },
  // shebang 由 src/index.ts 首行提供，esbuild 会把它保留在产物第 1 行，banner 不要重复写。
  // 依赖里有 CJS 模块会调用 require，ESM 产物里需要补一个
  banner: {
    js: [
      "import { createRequire as __cvCreateRequire } from 'node:module';",
      'const require = __cvCreateRequire(import.meta.url);',
    ].join('\n'),
  },
  logLevel: 'info',
});

chmodSync(outfile, 0o755);
console.log(`[cv-mcp] built v${version} → ${outfile}`);
