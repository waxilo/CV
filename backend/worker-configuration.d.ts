interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  API_KEY_ENCRYPTION_SECRET: string;
  API_KEY_ENCRYPTION_SECRET_PREVIOUS?: string;
  JWT_EXPIRES_IN: string;
  APP_NAME: string;
}
