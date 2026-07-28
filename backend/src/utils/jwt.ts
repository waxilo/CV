import { SignJWT, jwtVerify } from 'jose';

export interface IJwtPayload {
  sub: string;
  email: string;
  username: string;
}

function getSecretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signToken(
  payload: IJwtPayload,
  secret: string,
  expiresIn = '7d'
): Promise<string> {
  return new SignJWT({ email: payload.email, username: payload.username })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecretKey(secret));
}

export async function verifyToken(token: string, secret: string): Promise<IJwtPayload> {
  const { payload } = await jwtVerify(token, getSecretKey(secret));
  return {
    sub: payload.sub as string,
    email: payload.email as string,
    username: payload.username as string,
  };
}

export function generateId(): string {
  return crypto.randomUUID();
}
