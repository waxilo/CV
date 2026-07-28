import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { verifyToken, type IJwtPayload } from '../utils/jwt';

export type AuthVariables = {
  user: IJwtPayload;
};

export const authMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: AuthVariables;
}>(async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: '未登录或令牌无效' });
  }

  const token = header.slice(7);
  const secret = c.env.JWT_SECRET || 'dev-secret-change-me';

  try {
    const user = await verifyToken(token, secret);
    c.set('user', user);
    await next();
  } catch {
    throw new HTTPException(401, { message: '令牌已过期或无效' });
  }
});
