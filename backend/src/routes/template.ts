import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and, or } from 'drizzle-orm';
import { createDb, templates } from '../db';
import { generateId } from '../utils/jwt';
import { authMiddleware, type AuthVariables } from '../middleware/auth';
import { normalizeIncomingConfig, templateConfigSchema } from '../template/schema';

const metaSchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().max(256).optional(),
  thumbnail_url: z.string().url().optional().or(z.literal('')),
});

const createTemplateSchema = metaSchema.extend({
  config: z.unknown(),
});

const updateTemplateSchema = z.object({
  template_id: z.string().min(1),
  name: z.string().min(1).max(64).optional(),
  description: z.string().max(256).optional(),
  thumbnail_url: z.string().url().optional().or(z.literal('')),
  config: z.unknown().optional(),
});

const idSchema = z.object({
  template_id: z.string().min(1),
});

function parseConfig(raw: unknown) {
  const normalized = normalizeIncomingConfig(raw);
  return templateConfigSchema.safeParse(normalized);
}

function mapTemplate(t: typeof templates.$inferSelect) {
  const parsed = parseConfig(t.config);
  return {
    template_id: t.id,
    name: t.name,
    description: t.description,
    thumbnail_url: t.thumbnailUrl,
    config: parsed.success ? parsed.data : normalizeIncomingConfig(t.config),
    is_builtin: t.isBuiltin,
  };
}

async function optionalUserId(c: {
  req: { header: (name: string) => string | undefined };
  env: Env;
}): Promise<string | null> {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const { verifyToken } = await import('../utils/jwt');
    const secret = c.env.JWT_SECRET || 'dev-secret-change-me';
    const user = await verifyToken(header.slice(7), secret);
    return user.sub;
  } catch {
    return null;
  }
}

export const templateRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

/** POST /api/template-service/v1/list-templates */
templateRoutes.post('/list-templates', async (c) => {
  const db = createDb(c.env.DB);
  const userId = await optionalUserId(c);

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
    data: rows.map(mapTemplate),
  });
});

/** POST /api/template-service/v1/create-template */
templateRoutes.post('/create-template', authMiddleware, async (c) => {
  const body = await c.req.json();
  const parsed = createTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { success: false, code: 'COMMON_PARAM_invalidRequest', message: parsed.error.errors[0].message },
      400
    );
  }

  const configParsed = parseConfig(parsed.data.config);
  if (!configParsed.success) {
    return c.json(
      {
        success: false,
        code: 'COMMON_PARAM_invalidRequest',
        message: configParsed.error.errors[0]?.message || '模板配置无效',
      },
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
    config: configParsed.data,
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

/** POST /api/template-service/v1/update-template */
templateRoutes.post('/update-template', authMiddleware, async (c) => {
  const body = await c.req.json();
  const parsed = updateTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { success: false, code: 'COMMON_PARAM_invalidRequest', message: parsed.error.errors[0].message },
      400
    );
  }

  const user = c.get('user');
  const db = createDb(c.env.DB);
  const rows = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, parsed.data.template_id), eq(templates.isDeleted, false)))
    .limit(1);

  const tpl = rows[0];
  if (!tpl) {
    return c.json({ success: false, code: 'TEMPLATE_NOT_FOUND', message: '模板不存在' }, 404);
  }
  if (tpl.isBuiltin) {
    return c.json(
      { success: false, code: 'TEMPLATE_BUILTIN_readonly', message: '内置模板不可修改，请先复制' },
      403
    );
  }
  if (tpl.userId !== user.sub) {
    return c.json({ success: false, code: 'COMMON_AUTH_forbidden', message: '无权修改此模板' }, 403);
  }

  const patch: Partial<typeof templates.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  };
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.description !== undefined) patch.description = parsed.data.description;
  if (parsed.data.thumbnail_url !== undefined) patch.thumbnailUrl = parsed.data.thumbnail_url || null;

  if (parsed.data.config !== undefined) {
    const configParsed = parseConfig(parsed.data.config);
    if (!configParsed.success) {
      return c.json(
        {
          success: false,
          code: 'COMMON_PARAM_invalidRequest',
          message: configParsed.error.errors[0]?.message || '模板配置无效',
        },
        400
      );
    }
    patch.config = configParsed.data;
  }

  await db.update(templates).set(patch).where(eq(templates.id, parsed.data.template_id));

  return c.json({
    success: true,
    code: '0',
    message: '更新成功',
    data: { template_id: parsed.data.template_id },
  });
});

/** POST /api/template-service/v1/delete-template */
templateRoutes.post('/delete-template', authMiddleware, async (c) => {
  const body = await c.req.json();
  const parsed = idSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { success: false, code: 'COMMON_PARAM_invalidRequest', message: 'template_id 无效' },
      400
    );
  }

  const user = c.get('user');
  const db = createDb(c.env.DB);
  const rows = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, parsed.data.template_id), eq(templates.isDeleted, false)))
    .limit(1);

  const tpl = rows[0];
  if (!tpl) {
    return c.json({ success: false, code: 'TEMPLATE_NOT_FOUND', message: '模板不存在' }, 404);
  }
  if (tpl.isBuiltin) {
    return c.json(
      { success: false, code: 'TEMPLATE_BUILTIN_readonly', message: '内置模板不可删除' },
      403
    );
  }
  if (tpl.userId !== user.sub) {
    return c.json({ success: false, code: 'COMMON_AUTH_forbidden', message: '无权删除此模板' }, 403);
  }

  await db
    .update(templates)
    .set({
      isDeleted: true,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(templates.id, parsed.data.template_id));

  return c.json({ success: true, code: '0', message: '删除成功' });
});

/** POST /api/template-service/v1/clone-template */
templateRoutes.post('/clone-template', authMiddleware, async (c) => {
  const body = await c.req.json();
  const parsed = idSchema
    .extend({
      name: z.string().min(1).max(64).optional(),
    })
    .safeParse(body);
  if (!parsed.success) {
    return c.json(
      { success: false, code: 'COMMON_PARAM_invalidRequest', message: '参数无效' },
      400
    );
  }

  const user = c.get('user');
  const db = createDb(c.env.DB);
  const rows = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, parsed.data.template_id), eq(templates.isDeleted, false)))
    .limit(1);

  const tpl = rows[0];
  if (!tpl) {
    return c.json({ success: false, code: 'TEMPLATE_NOT_FOUND', message: '模板不存在' }, 404);
  }
  if (!tpl.isBuiltin && tpl.userId !== user.sub) {
    return c.json({ success: false, code: 'COMMON_AUTH_forbidden', message: '无权复制此模板' }, 403);
  }

  const configParsed = parseConfig(tpl.config);
  const id = generateId();
  await db.insert(templates).values({
    id,
    name: parsed.data.name || `${tpl.name} 副本`,
    description: tpl.description,
    thumbnailUrl: tpl.thumbnailUrl,
    config: configParsed.success ? configParsed.data : normalizeIncomingConfig(tpl.config),
    isBuiltin: false,
    userId: user.sub,
  });

  return c.json({
    success: true,
    code: '0',
    message: '复制成功',
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
  const userId = await optionalUserId(c);
  const rows = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, templateId.data), eq(templates.isDeleted, false)))
    .limit(1);

  const t = rows[0];
  if (!t) {
    return c.json({ success: false, code: 'TEMPLATE_NOT_FOUND', message: '模板不存在' }, 404);
  }
  if (!t.isBuiltin && t.userId !== userId) {
    return c.json({ success: false, code: 'COMMON_AUTH_forbidden', message: '无权查看此模板' }, 403);
  }

  return c.json({
    success: true,
    code: '0',
    message: 'Success',
    data: mapTemplate(t),
  });
});
