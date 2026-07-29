import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { createDb, templates } from '../db';
import { generateId } from '../utils/jwt';
import { authMiddleware, type AuthVariables } from '../middleware/auth';
import {
  BUILTIN_TEMPLATES,
  getBuiltinTemplate,
  normalizeForRead,
  parseTemplateConfig,
} from '../template/schema';
import type { ITemplateConfigV2 } from '../template/schema';

/* ============================================================
 * 入参
 * ============================================================ */

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

/* ============================================================
 * 序列化
 * ============================================================ */

type TTrust = 'trusted' | 'owned' | 'foreign';

interface ITemplateDto {
  template_id: string;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  config: ITemplateConfigV2;
  is_builtin: boolean;
  trust: TTrust;
}

/**
 * 内置模板不入库，直接从代码提供。
 * 这样改内置模板不需要写 migration，也能被类型检查覆盖。
 */
function builtinToDto(id: string): ITemplateDto | null {
  const builtin = getBuiltinTemplate(id);
  if (!builtin) return null;
  return {
    template_id: builtin.id,
    name: builtin.name,
    description: builtin.description,
    thumbnail_url: null,
    config: builtin.config,
    is_builtin: true,
    trust: 'trusted',
  };
}

function listBuiltinDtos(): ITemplateDto[] {
  return BUILTIN_TEMPLATES.map((t) => ({
    template_id: t.id,
    name: t.name,
    description: t.description,
    thumbnail_url: null,
    config: t.config,
    is_builtin: true,
    trust: 'trusted' as const,
  }));
}

function rowToDto(row: typeof templates.$inferSelect, viewerId: string | null): ITemplateDto {
  return {
    template_id: row.id,
    name: row.name,
    description: row.description,
    thumbnail_url: row.thumbnailUrl,
    // 宽松解析：历史脏数据不能让整个列表接口失败
    config: normalizeForRead(row.config),
    is_builtin: row.isBuiltin,
    trust: row.isBuiltin ? 'trusted' : row.userId && row.userId === viewerId ? 'owned' : 'foreign',
  };
}

/* ============================================================
 * 工具
 * ============================================================ */

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

function invalidParam(message: string) {
  return { success: false, code: 'COMMON_PARAM_invalidRequest', message } as const;
}

export const templateRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

/* ============================================================
 * 列表
 * ============================================================ */

/** POST /api/template-service/v1/list-templates */
templateRoutes.post('/list-templates', async (c) => {
  const db = createDb(c.env.DB);
  const userId = await optionalUserId(c);

  // 内置模板来自代码，自定义模板来自 DB
  const customRows = userId
    ? await db
        .select()
        .from(templates)
        .where(
          and(
            eq(templates.isDeleted, false),
            eq(templates.isBuiltin, false),
            eq(templates.userId, userId)
          )
        )
    : [];

  return c.json({
    success: true,
    code: '0',
    message: 'Success',
    data: [...listBuiltinDtos(), ...customRows.map((r) => rowToDto(r, userId))],
  });
});

/* ============================================================
 * 创建
 * ============================================================ */

/** POST /api/template-service/v1/create-template */
templateRoutes.post('/create-template', authMiddleware, async (c) => {
  const body = await c.req.json();
  const parsed = createTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(invalidParam(parsed.error.errors[0].message), 400);
  }

  const configParsed = parseTemplateConfig(parsed.data.config);
  if (!configParsed.success) {
    return c.json(invalidParam(configParsed.error), 400);
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
    engine: configParsed.engine,
    schemaVersion: configParsed.schemaVersion,
    isBuiltin: false,
    userId: user.sub,
  });

  return c.json({
    success: true,
    code: '0',
    message: '模板创建成功',
    data: { template_id: id, warnings: configParsed.warnings },
  });
});

/* ============================================================
 * 更新
 * ============================================================ */

/** POST /api/template-service/v1/update-template */
templateRoutes.post('/update-template', authMiddleware, async (c) => {
  const body = await c.req.json();
  const parsed = updateTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(invalidParam(parsed.error.errors[0].message), 400);
  }

  if (getBuiltinTemplate(parsed.data.template_id)) {
    return c.json(
      { success: false, code: 'TEMPLATE_BUILTIN_readonly', message: '内置模板不可修改，请先复制' },
      403
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

  let warnings: string[] = [];
  if (parsed.data.config !== undefined) {
    const configParsed = parseTemplateConfig(parsed.data.config);
    if (!configParsed.success) {
      return c.json(invalidParam(configParsed.error), 400);
    }
    patch.config = configParsed.data;
    patch.engine = configParsed.engine;
    patch.schemaVersion = configParsed.schemaVersion;
    warnings = configParsed.warnings;
  }

  await db.update(templates).set(patch).where(eq(templates.id, parsed.data.template_id));

  return c.json({
    success: true,
    code: '0',
    message: '更新成功',
    data: { template_id: parsed.data.template_id, warnings },
  });
});

/* ============================================================
 * 删除
 * ============================================================ */

/** POST /api/template-service/v1/delete-template */
templateRoutes.post('/delete-template', authMiddleware, async (c) => {
  const body = await c.req.json();
  const parsed = idSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(invalidParam('template_id 无效'), 400);
  }

  if (getBuiltinTemplate(parsed.data.template_id)) {
    return c.json(
      { success: false, code: 'TEMPLATE_BUILTIN_readonly', message: '内置模板不可删除' },
      403
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

/* ============================================================
 * 复制
 * ============================================================ */

/** POST /api/template-service/v1/clone-template */
templateRoutes.post('/clone-template', authMiddleware, async (c) => {
  const body = await c.req.json();
  const parsed = idSchema.extend({ name: z.string().min(1).max(64).optional() }).safeParse(body);
  if (!parsed.success) {
    return c.json(invalidParam('参数无效'), 400);
  }

  const user = c.get('user');
  const db = createDb(c.env.DB);

  // 先看是不是内置模板
  let sourceName: string;
  let sourceDescription: string | null;
  let sourceThumbnail: string | null;
  let sourceConfig: unknown;

  const builtin = getBuiltinTemplate(parsed.data.template_id);
  if (builtin) {
    sourceName = builtin.name;
    sourceDescription = builtin.description;
    sourceThumbnail = null;
    sourceConfig = builtin.config;
  } else {
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
    sourceName = tpl.name;
    sourceDescription = tpl.description;
    sourceThumbnail = tpl.thumbnailUrl;
    sourceConfig = tpl.config;
  }

  const configParsed = parseTemplateConfig(sourceConfig);
  if (!configParsed.success) {
    return c.json(invalidParam(`源模板配置无效：${configParsed.error}`), 400);
  }

  const id = generateId();
  await db.insert(templates).values({
    id,
    name: parsed.data.name || `${sourceName} 副本`,
    description: sourceDescription,
    thumbnailUrl: sourceThumbnail,
    config: configParsed.data,
    engine: configParsed.engine,
    schemaVersion: configParsed.schemaVersion,
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

/* ============================================================
 * 详情
 * ============================================================ */

/** POST /api/template-service/v1/get-detail */
templateRoutes.post('/get-detail', async (c) => {
  const body = await c.req.json();
  const templateId = z.string().min(1).safeParse(body.template_id);
  if (!templateId.success) {
    return c.json(invalidParam('template_id 无效'), 400);
  }

  const builtinDto = builtinToDto(templateId.data);
  if (builtinDto) {
    return c.json({ success: true, code: '0', message: 'Success', data: builtinDto });
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

  return c.json({ success: true, code: '0', message: 'Success', data: rowToDto(t, userId) });
});
