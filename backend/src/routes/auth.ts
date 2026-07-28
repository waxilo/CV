import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { createDb, users } from '../db';
import { hashPassword, verifyPassword } from '../utils/password';
import { signToken, generateId } from '../utils/jwt';
import { authMiddleware, type AuthVariables } from '../middleware/auth';

const registerSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  username: z
    .string()
    .min(3, '用户名至少 3 个字符')
    .max(32)
    .regex(/^[a-zA-Z0-9_]+$/, '用户名仅支持字母数字下划线'),
  password: z.string().min(6, '密码至少 6 位'),
  display_name: z.string().max(64).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

/** POST /api/auth-service/v1/register */
authRoutes.post('/register', async (c) => {
  const body = await c.req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { success: false, code: 'COMMON_PARAM_invalidRequest', message: parsed.error.errors[0].message },
      400
    );
  }

  const { email, username, password, display_name } = parsed.data;
  const db = createDb(c.env.DB);

  const existing = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), eq(users.isDeleted, false)))
    .limit(1);

  if (existing.length > 0) {
    return c.json(
      { success: false, code: 'USER_ACCOUNT_emailExists', message: '该邮箱已注册' },
      409
    );
  }

  const usernameTaken = await db
    .select()
    .from(users)
    .where(and(eq(users.username, username), eq(users.isDeleted, false)))
    .limit(1);

  if (usernameTaken.length > 0) {
    return c.json(
      { success: false, code: 'USER_ACCOUNT_usernameExists', message: '用户名已被占用' },
      409
    );
  }

  const id = generateId();
  const passwordHash = await hashPassword(password);

  await db.insert(users).values({
    id,
    email,
    username,
    passwordHash,
    displayName: display_name || username,
  });

  const secret = c.env.JWT_SECRET || 'dev-secret-change-me';
  const token = await signToken(
    { sub: id, email, username },
    secret,
    c.env.JWT_EXPIRES_IN || '7d'
  );

  return c.json({
    success: true,
    code: '0',
    message: '注册成功',
    data: {
      token,
      user: { id, email, username, display_name: display_name || username },
    },
  });
});

/** POST /api/auth-service/v1/login */
authRoutes.post('/login', async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { success: false, code: 'COMMON_PARAM_invalidRequest', message: '参数错误' },
      400
    );
  }

  const { email, password } = parsed.data;
  const db = createDb(c.env.DB);

  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), eq(users.isDeleted, false)))
    .limit(1);

  const user = rows[0];
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return c.json(
      { success: false, code: 'USER_AUTH_invalidCredentials', message: '邮箱或密码错误' },
      401
    );
  }

  const secret = c.env.JWT_SECRET || 'dev-secret-change-me';
  const token = await signToken(
    { sub: user.id, email: user.email, username: user.username },
    secret,
    c.env.JWT_EXPIRES_IN || '7d'
  );

  return c.json({
    success: true,
    code: '0',
    message: '登录成功',
    data: {
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        display_name: user.displayName,
        avatar_url: user.avatarUrl,
      },
    },
  });
});

/** POST /api/auth-service/v1/get-profile */
authRoutes.post('/get-profile', authMiddleware, async (c) => {
  const authUser = c.get('user');
  const db = createDb(c.env.DB);

  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.id, authUser.sub), eq(users.isDeleted, false)))
    .limit(1);

  const user = rows[0];
  if (!user) {
    return c.json(
      { success: false, code: 'USER_ACCOUNT_userNotFound', message: '用户不存在' },
      404
    );
  }

  return c.json({
    success: true,
    code: '0',
    message: 'Success',
    data: {
      id: user.id,
      email: user.email,
      username: user.username,
      display_name: user.displayName,
      avatar_url: user.avatarUrl,
      created_at: user.createdAt,
    },
  });
});
