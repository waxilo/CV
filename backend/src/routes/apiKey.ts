/**
 * API Key CRUD：创建 / 列表 / 吊销
 * 管理接口仅允许网页 JWT，禁止用 API Key 自管密钥。
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { createDb, apiKeys } from '../db';
import { generateId } from '../utils/jwt';
import { generateApiKeyPlaintext, hashApiKey } from '../utils/apiKey';
import { jwtOnlyMiddleware, type AuthVariables } from '../middleware/auth';

const MAX_ACTIVE_KEYS = 10;

const createSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, '名称不能为空')
    .max(64, '名称最多 64 字')
    .default('Cursor MCP'),
});

const revokeSchema = z.object({
  api_key_id: z.string().uuid('api_key_id 无效'),
});

export const apiKeyRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

apiKeyRoutes.use('*', jwtOnlyMiddleware);

/** POST /api/auth-service/v1/create-api-key */
apiKeyRoutes.post('/create-api-key', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        code: 'COMMON_PARAM_invalidRequest',
        message: parsed.error.errors[0]?.message || '参数错误',
      },
      400
    );
  }

  const user = c.get('user');
  const db = createDb(c.env.DB);

  const active = await db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, user.sub), eq(apiKeys.isRevoked, false)));

  if (active.length >= MAX_ACTIVE_KEYS) {
    return c.json(
      {
        success: false,
        code: 'USER_APIKEY_limitExceeded',
        message: `最多保留 ${MAX_ACTIVE_KEYS} 个有效 API Key，请先吊销不用的密钥`,
      },
      400
    );
  }

  const id = generateId();
  const { plaintext, prefix } = generateApiKeyPlaintext();
  const keyHash = await hashApiKey(plaintext);
  const createdAt = new Date().toISOString();

  await db.insert(apiKeys).values({
    id,
    userId: user.sub,
    name: parsed.data.name,
    keyPrefix: prefix,
    keyHash,
    createdAt,
    isRevoked: false,
  });

  return c.json({
    success: true,
    code: '0',
    message: '创建成功，请立即复制保存，明文仅显示一次',
    data: {
      api_key_id: id,
      name: parsed.data.name,
      key_prefix: prefix,
      api_key: plaintext,
      created_at: createdAt,
    },
  });
});

/** POST /api/auth-service/v1/list-api-keys */
apiKeyRoutes.post('/list-api-keys', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);

  const rows = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
      isRevoked: apiKeys.isRevoked,
      revokedAt: apiKeys.revokedAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, user.sub))
    .orderBy(desc(apiKeys.createdAt));

  return c.json({
    success: true,
    code: '0',
    message: 'Success',
    data: rows.map((row) => ({
      api_key_id: row.id,
      name: row.name,
      key_prefix: row.keyPrefix,
      last_used_at: row.lastUsedAt,
      created_at: row.createdAt,
      is_revoked: row.isRevoked,
      revoked_at: row.revokedAt,
    })),
  });
});

/** POST /api/auth-service/v1/revoke-api-key */
apiKeyRoutes.post('/revoke-api-key', async (c) => {
  const body = await c.req.json();
  const parsed = revokeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        code: 'COMMON_PARAM_invalidRequest',
        message: parsed.error.errors[0]?.message || '参数错误',
      },
      400
    );
  }

  const user = c.get('user');
  const db = createDb(c.env.DB);
  const { api_key_id } = parsed.data;

  const rows = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.id, api_key_id), eq(apiKeys.userId, user.sub)))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return c.json(
      { success: false, code: 'USER_APIKEY_notFound', message: 'API Key 不存在' },
      404
    );
  }

  if (row.isRevoked) {
    return c.json({
      success: true,
      code: '0',
      message: '该密钥已吊销',
      data: { api_key_id },
    });
  }

  await db
    .update(apiKeys)
    .set({
      isRevoked: true,
      revokedAt: new Date().toISOString(),
    })
    .where(eq(apiKeys.id, api_key_id));

  return c.json({
    success: true,
    code: '0',
    message: '已吊销',
    data: { api_key_id },
  });
});
