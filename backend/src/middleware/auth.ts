import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { and, eq } from 'drizzle-orm';
import { createDb, apiKeys, users } from '../db';
import { verifyToken, type IJwtPayload } from '../utils/jwt';
import { hashApiKey, isApiKeyToken } from '../utils/apiKey';

export type AuthType = 'jwt' | 'api_key';

export type AuthVariables = {
  user: IJwtPayload;
  authType: AuthType;
};

/**
 * 用 API Key 明文解析到用户（并刷新 last_used_at）。
 */
async function resolveUserFromApiKey(
  db: ReturnType<typeof createDb>,
  token: string
): Promise<IJwtPayload | null> {
  const keyHash = await hashApiKey(token);
  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      username: users.username,
      keyId: apiKeys.id,
      isDeleted: users.isDeleted,
    })
    .from(apiKeys)
    .innerJoin(users, eq(apiKeys.userId, users.id))
    .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isRevoked, false)))
    .limit(1);

  const row = rows[0];
  if (!row || row.isDeleted) return null;

  void db
    .update(apiKeys)
    .set({ lastUsedAt: new Date().toISOString() })
    .where(eq(apiKeys.id, row.keyId));

  return {
    sub: row.userId,
    email: row.email,
    username: row.username,
  };
}

/**
 * 同时支持网页 JWT 与 MCP API Key（Bearer）。
 * - JWT：登录会话
 * - cvk_…：API Key → 关联账号，可读写该用户简历
 */
export const authMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: AuthVariables;
}>(async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: '未登录或令牌无效' });
  }

  const token = header.slice(7).trim();
  if (!token) {
    throw new HTTPException(401, { message: '未登录或令牌无效' });
  }

  if (isApiKeyToken(token)) {
    const db = createDb(c.env.DB);
    const user = await resolveUserFromApiKey(db, token);
    if (!user) {
      throw new HTTPException(401, { message: 'API Key 无效或已吊销' });
    }
    c.set('user', user);
    c.set('authType', 'api_key');
    await next();
    return;
  }

  const secret = c.env.JWT_SECRET || 'dev-secret-change-me';
  try {
    const user = await verifyToken(token, secret);
    c.set('user', user);
    c.set('authType', 'jwt');
    await next();
  } catch {
    throw new HTTPException(401, { message: '令牌已过期或无效' });
  }
});

/**
 * 仅允许网页 JWT（管理 API Key 等敏感操作）。
 */
export const jwtOnlyMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: AuthVariables;
}>(async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: '未登录或令牌无效' });
  }

  const token = header.slice(7).trim();
  if (!token) {
    throw new HTTPException(401, { message: '未登录或令牌无效' });
  }

  if (isApiKeyToken(token)) {
    throw new HTTPException(403, { message: '请使用网页登录管理 API Key' });
  }

  const secret = c.env.JWT_SECRET || 'dev-secret-change-me';
  try {
    const user = await verifyToken(token, secret);
    c.set('user', user);
    c.set('authType', 'jwt');
    await next();
  } catch {
    throw new HTTPException(401, { message: '令牌已过期或无效' });
  }
});
