import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serveStatic } from '@hono/node-server/serve-static';
import { authRoutes } from './routes/auth';
import { apiKeyRoutes } from './routes/apiKey';
import { resumeRoutes } from './routes/resume';
import { shareRoutes } from './routes/share';
import { templateRoutes } from './routes/template';
import { type AuthVariables } from './middleware/auth';
import { getDb } from './db';
import { config } from './env';

const app = new Hono<{ Variables: AuthVariables }>();

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: (origin) => origin || '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Device-Id', 'X-App-Version', 'X-Platform'],
    exposeHeaders: ['X-Request-Id'],
    maxAge: 86400,
  })
);

// /health 真的探库：进程活着但连不上 MySQL 要能被看出来（compose 健康检查用它）。
app.get('/health', async (c) => {
  try {
    await getDb().execute('SELECT 1');
    return c.json({ success: true, code: '0', message: 'ok' });
  } catch {
    return c.json({ success: false, code: 'COMMON_SYSTEM_dbUnreachable', message: 'db unreachable' }, 503);
  }
});

app.route('/api/auth-service/v1', authRoutes);
app.route('/api/auth-service/v1', apiKeyRoutes);
app.route('/api/share-service/v1', shareRoutes);
app.route('/api/resume-service/v1', resumeRoutes);
app.route('/api/template-service/v1', templateRoutes);

// 前端构建产物（容器内 public/）：静态文件优先，SPA 路由回退 index.html。
// /api 前缀不参与静态与回退：接口全部是 POST，GET /api/* 一律 JSON 404。
const notFoundJson = (c: Context) =>
  c.json({ success: false, code: 'COMMON_SYSTEM_notFound', message: '接口不存在' }, 404);
app.get('/api/*', notFoundJson);
app.get('*', serveStatic({ root: config.staticDir }));
app.get('*', serveStatic({ path: `${config.staticDir}/index.html` }));

app.notFound(notFoundJson);

app.onError((err, c) => {
  console.error(err);
  const status = 'status' in err ? (err as { status: number }).status : 500;
  const message = err.message || 'Internal server error';
  return c.json(
    {
      success: false,
      code: status === 401 ? 'COMMON_AUTH_unauthorized' : 'COMMON_SYSTEM_internalError',
      message,
    },
    status as 500
  );
});

export default app;
