/**
 * API Key CRUD：创建 / 列表 / 获取 / 轮换 / 吊销
 * 管理接口仅允许网页 JWT，禁止用 API Key 自管密钥。
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { createDb, apiKeys } from '../db';
import { generateId } from '../utils/jwt';
import {
  decryptApiKey,
  encryptApiKey,
  generateApiKeyPlaintext,
  hashApiKey,
} from '../utils/apiKey';
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

const apiKeyIdSchema = z.object({
  api_key_id: z.string().uuid('api_key_id 无效'),
});

export const apiKeyRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

async function recoverApiKey(
  encryptedKey: string,
  keyHash: string,
  currentSecret: string,
  previousSecret?: string
): Promise<{ plaintext: string; usedPreviousSecret: boolean } | null> {
  const secrets = [currentSecret, previousSecret].filter(
    (secret, index, values): secret is string => Boolean(secret) && values.indexOf(secret) === index
  );

  for (const secret of secrets) {
    try {
      const plaintext = await decryptApiKey(encryptedKey, secret);
      if ((await hashApiKey(plaintext)) === keyHash) {
        return { plaintext, usedPreviousSecret: secret !== currentSecret };
      }
    } catch {
      // 尝试下一个已配置的加密密钥
    }
  }

  return null;
}

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
    .where(eq(apiKeys.userId, user.sub));

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
  const [keyHash, encryptedKey] = await Promise.all([
    hashApiKey(plaintext),
    encryptApiKey(plaintext, c.env.API_KEY_ENCRYPTION_SECRET),
  ]);
  const createdAt = new Date().toISOString();

  await db.insert(apiKeys).values({
    id,
    userId: user.sub,
    name: parsed.data.name,
    keyPrefix: prefix,
    keyHash,
    encryptedKey,
    createdAt,
  });

  c.header('Cache-Control', 'no-store');
  return c.json({
    success: true,
    code: '0',
    message: '创建成功',
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
      encryptedKey: apiKeys.encryptedKey,
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
      can_copy: Boolean(row.encryptedKey),
    })),
  });
});

/** POST /api/auth-service/v1/get-api-key */
apiKeyRoutes.post('/get-api-key', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = apiKeyIdSchema.safeParse(body);
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
  const rows = await db
    .select({ encryptedKey: apiKeys.encryptedKey, keyHash: apiKeys.keyHash })
    .from(apiKeys)
    .where(and(eq(apiKeys.id, parsed.data.api_key_id), eq(apiKeys.userId, user.sub)))
    .limit(1);
  const row = rows[0];

  if (!row) {
    return c.json(
      { success: false, code: 'USER_APIKEY_notFound', message: 'API Key 不存在' },
      404
    );
  }
  if (!row.encryptedKey) {
    return c.json(
      { success: false, code: 'USER_APIKEY_rotationRequired', message: '旧 API Key 需先轮换' },
      409
    );
  }

  const recovered = await recoverApiKey(
    row.encryptedKey,
    row.keyHash,
    c.env.API_KEY_ENCRYPTION_SECRET,
    c.env.API_KEY_ENCRYPTION_SECRET_PREVIOUS
  );
  if (!recovered) {
    return c.json(
      {
        success: false,
        code: 'USER_APIKEY_rotationRequired',
        message: 'API Key 无法解密，需确认轮换后再复制',
      },
      409
    );
  }

  if (recovered.usedPreviousSecret) {
    const encryptedKey = await encryptApiKey(
      recovered.plaintext,
      c.env.API_KEY_ENCRYPTION_SECRET
    );
    await db
      .update(apiKeys)
      .set({ encryptedKey })
      .where(
        and(
          eq(apiKeys.id, parsed.data.api_key_id),
          eq(apiKeys.userId, user.sub),
          eq(apiKeys.encryptedKey, row.encryptedKey)
        )
      );
  }

  c.header('Cache-Control', 'no-store');
  return c.json({
    success: true,
    code: '0',
    message: 'Success',
    data: { api_key_id: parsed.data.api_key_id, api_key: recovered.plaintext },
  });
});

/** POST /api/auth-service/v1/rotate-api-key */
apiKeyRoutes.post('/rotate-api-key', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = apiKeyIdSchema.safeParse(body);
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
  const rows = await db
    .select({ keyHash: apiKeys.keyHash })
    .from(apiKeys)
    .where(and(eq(apiKeys.id, parsed.data.api_key_id), eq(apiKeys.userId, user.sub)))
    .limit(1);
  const row = rows[0];

  if (!row) {
    return c.json(
      { success: false, code: 'USER_APIKEY_notFound', message: 'API Key 不存在' },
      404
    );
  }

  const { plaintext, prefix } = generateApiKeyPlaintext();
  const [keyHash, encryptedKey] = await Promise.all([
    hashApiKey(plaintext),
    encryptApiKey(plaintext, c.env.API_KEY_ENCRYPTION_SECRET),
  ]);
  const updated = await db
    .update(apiKeys)
    .set({ keyPrefix: prefix, keyHash, encryptedKey, lastUsedAt: null })
    .where(
      and(
        eq(apiKeys.id, parsed.data.api_key_id),
        eq(apiKeys.userId, user.sub),
        eq(apiKeys.keyHash, row.keyHash)
      )
    )
    .returning({ id: apiKeys.id });

  if (!updated[0]) {
    return c.json(
      { success: false, code: 'USER_APIKEY_conflict', message: 'API Key 已发生变化，请刷新后重试' },
      409
    );
  }

  c.header('Cache-Control', 'no-store');
  return c.json({
    success: true,
    code: '0',
    message: '已轮换',
    data: { api_key_id: parsed.data.api_key_id, api_key: plaintext },
  });
});

/** POST /api/auth-service/v1/revoke-api-key */
apiKeyRoutes.post('/revoke-api-key', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = apiKeyIdSchema.safeParse(body);
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

  const deleted = await db
    .delete(apiKeys)
    .where(and(eq(apiKeys.id, api_key_id), eq(apiKeys.userId, user.sub)))
    .returning({ id: apiKeys.id });

  if (!deleted[0]) {
    return c.json(
      { success: false, code: 'USER_APIKEY_notFound', message: 'API Key 不存在' },
      404
    );
  }

  return c.json({
    success: true,
    code: '0',
    message: '已吊销',
    data: { api_key_id },
  });
});
