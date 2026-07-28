import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authRoutes } from './routes/auth';
import { resumeRoutes } from './routes/resume';
import { templateRoutes } from './routes/template';
import type { AuthVariables } from './middleware/auth';

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

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

app.get('/', (c) =>
  c.json({
    success: true,
    code: '0',
    message: 'CV Builder API',
    data: { name: c.env.APP_NAME || 'CV Builder', version: '1.0.0' },
  })
);

app.get('/health', (c) => c.json({ success: true, code: '0', message: 'ok' }));

app.route('/api/auth-service/v1', authRoutes);
app.route('/api/resume-service/v1', resumeRoutes);
app.route('/api/template-service/v1', templateRoutes);

app.notFound((c) =>
  c.json({ success: false, code: 'COMMON_SYSTEM_notFound', message: '接口不存在' }, 404)
);

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
