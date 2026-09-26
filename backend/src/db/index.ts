import { drizzle } from 'drizzle-orm/mysql2';
import mysql, { type Pool } from 'mysql2/promise';
import * as schema from './schema';
import { config } from '../env';

let pool: Pool | undefined;
let db: ReturnType<typeof drizzle> | undefined;

/** 共享连接池：进程内单例，容器起来时不建连，首个查询才建。 */
export function getPool(): Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: config.dbHost,
      port: config.dbPort,
      user: config.dbUser,
      password: config.dbPassword,
      database: config.dbName,
      waitForConnections: true,
      connectionLimit: 10,
      charset: 'utf8mb4_unicode_ci',
    });
  }
  return pool;
}

export function getDb() {
  if (!db) {
    db = drizzle(getPool(), { schema, mode: 'default' });
  }
  return db;
}

export type Database = ReturnType<typeof getDb>;

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
    db = undefined;
  }
}

export * from './schema';
