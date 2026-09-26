/**
 * 运行时配置：全部来自环境变量（容器里由 .env 注入）。
 * 缺失的密钥在启动时快速失败，而不是等首个请求才报 500。
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`缺少环境变量 ${name}`);
  }
  return value;
}

export const config = {
  dbHost: process.env.DB_HOST ?? 'mysql',
  dbPort: Number(process.env.DB_PORT ?? 3306),
  dbUser: requireEnv('DB_USER'),
  dbPassword: requireEnv('DB_PASSWORD'),
  dbName: requireEnv('DB_NAME'),
  jwtSecret: requireEnv('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  appName: process.env.APP_NAME ?? 'CV Builder',
  apiKeyEncryptionSecret: requireEnv('API_KEY_ENCRYPTION_SECRET'),
  apiKeyEncryptionSecretPrevious: process.env.API_KEY_ENCRYPTION_SECRET_PREVIOUS,
  port: Number(process.env.APP_PORT_INTERNAL ?? process.env.PORT ?? 8787),
  staticDir: process.env.STATIC_DIR ?? 'public',
};
