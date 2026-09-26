import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/**
 * Ленивая инициализация БД.
 *
 * Next.js при сборке импортирует каждый route-модуль, чтобы собрать метаданные.
 * Если создавать Pool (или бросать исключение) на верхнем уровне модуля,
 * `next build` падает с "DATABASE_URL is required" на машине без БД —
 * например на Termux или в CI. Поэтому соединение создаётся только при
 * первом реальном обращении к `db`.
 */

type DrizzleDb = ReturnType<typeof drizzle>;

function isLocal(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return true;
  }
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __arenaNextJsDrizzle?: DrizzleDb;
};

export function getPool(): Pool {
  if (globalForDb.__arenaNextJsPostgresqlPool) {
    return globalForDb.__arenaNextJsPostgresqlPool;
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL не задан. Укажите строку подключения в .env (локально) " +
        "или в Environment Variables (Vercel). Шаблон — в .env.example."
    );
  }

  const local = isLocal(url);
  const pool = new Pool({
    connectionString: url,
    // Управляемые провайдеры (Supabase, Neon, RDS) требуют TLS и отдают
    // собственные сертификаты — цепочку не проверяем.
    ssl: local ? undefined : { rejectUnauthorized: false },
    // На serverless соединения быстро кончаются — держим пул узким.
    max: local ? 10 : 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  globalForDb.__arenaNextJsPostgresqlPool = pool;
  return pool;
}

function getDb(): DrizzleDb {
  if (!globalForDb.__arenaNextJsDrizzle) {
    globalForDb.__arenaNextJsDrizzle = drizzle(getPool());
  }
  return globalForDb.__arenaNextJsDrizzle;
}

/**
 * Прокси: `db.select()`, `db.insert()`, `db.transaction()` и т.п. поднимают
 * соединение при первом вызове. Методы биндятся к реальному инстансу drizzle —
 * иначе внутри них `this` указывал бы на прокси и ломались бы транзакции.
 */
export const db: DrizzleDb = new Proxy({} as DrizzleDb, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? value.bind(real) : value;
  },
  has(_target, prop) {
    return prop in (getDb() as unknown as object);
  },
});

/** Готова ли БД к работе (без падения на этапе импорта) */
export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
