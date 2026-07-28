import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and, or } from 'drizzle-orm';
import { createDb, templates } from '../db';
import { generateId } from '../utils/jwt';
import { authMiddleware, type AuthVariables } from '../middleware/auth';

const createTemplateSchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().max(256).optional(),
  thumbnail_url: z.string().url().optional().or(z.literal('')),
  config: z.object({
    layout: z.enum(['sidebar-left', 'sidebar-right', 'single-column', 'two-column']),
    primaryColor: z.string(),
    fontFamily: z.string(),
    fontSize: z.number().min(10).max(20),
    spacing: z.number().min(0.8).max(2),
  }),
});

export const templateRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

/** POST /api/template-service/v1/list-templates — 公开可读 */
templateRoutes.post('/list-templates', async (c) => {
  const db = createDb(c.env.DB);

  // 可选鉴权：登录用户可看到自己的自定义模板
  let userId: string | null = null;
  const header = c.req.header('Authorization');
  if (header?.startsWith('Bearer ')) {
    try {
      const { verifyToken } = await import('../utils/jwt');
      const secret = c.env.JWT_SECRET || 'dev-secret-change-me';
      const user = await verifyToken(header.slice(7), secret);
      userId = user.sub;
    } catch {
      // ignore
    }
  }

  const rows = await db
    .select()
    .from(templates)
    .where(
      and(
        eq(templates.isDeleted, false),
        userId
          ? or(eq(templates.isBuiltin, true), eq(templates.userId, userId))
          : eq(templates.isBuiltin, true)
      )
    );

  return c.json({
    success: true,
    code: '0',
    message: 'Success',
    data: rows.map((t) => ({
      template_id: t.id,
      name: t.name,
      description: t.description,
      thumbnail_url: t.thumbnailUrl,
      config: t.config,
      is_builtin: t.isBuiltin,
    })),
  });
});

/** POST /api/template-service/v1/create-template — 扩展自定义模板 */
templateRoutes.post('/create-template', authMiddleware, async (c) => {
  const body = await c.req.json();
  const parsed = createTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { success: false, code: 'COMMON_PARAM_invalidRequest', message: parsed.error.errors[0].message },
      400
    );
  }

  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = generateId();

  await db.insert(templates).values({
    id,
    name: parsed.data.name,
    description: parsed.data.description || '',
    thumbnailUrl: parsed.data.thumbnail_url || null,
    config: parsed.data.config,
    isBuiltin: false,
    userId: user.sub,
  });

  return c.json({
    success: true,
    code: '0',
    message: '模板创建成功',
    data: { template_id: id },
  });
});

/** POST /api/template-service/v1/get-detail */
templateRoutes.post('/get-detail', async (c) => {
  const body = await c.req.json();
  const templateId = z.string().min(1).safeParse(body.template_id);
  if (!templateId.success) {
    return c.json(
      { success: false, code: 'COMMON_PARAM_invalidRequest', message: 'template_id 无效' },
      400
    );
  }

  const db = createDb(c.env.DB);
  const rows = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, templateId.data), eq(templates.isDeleted, false)))
    .limit(1);

  const t = rows[0];
  if (!t) {
    return c.json(
      { success: false, code: 'TEMPLATE_NOT_FOUND', message: '模板不存在' },
      404
    );
  }

  return c.json({
    success: true,
    code: '0',
    message: 'Success',
    data: {
      template_id: t.id,
      name: t.name,
      description: t.description,
      thumbnail_url: t.thumbnailUrl,
      config: t.config,
      is_builtin: t.isBuiltin,
    },
  });
});
