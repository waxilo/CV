import { serve } from '@hono/node-server';
import app from './index';
import { closeDb } from './db';
import { config } from './env';

const server = serve({ fetch: app.fetch, port: config.port, hostname: '0.0.0.0' }, () => {
  console.log(`cv (web + api) listening on :${config.port} (static: ${config.staticDir})`);
});

// docker stop / compose 重建走这条路：先停接单，等在途请求收尾，再关连接池。
let closing = false;
function shutdown(signal: string) {
  if (closing) return;
  closing = true;
  console.log(`${signal}: draining requests…`);
  server.close(() => {
    closeDb().finally(() => process.exit(0));
  });
  // 兜底：10s 内没收尾完就硬退出，避免卡死在 drain。
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
