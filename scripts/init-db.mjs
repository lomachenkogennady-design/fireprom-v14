#!/usr/bin/env node
/**
 * Идемпотентная инициализация схемы PostgreSQL.
 *
 * Зачем не drizzle-kit: он devDependency, в production-образе его нет.
 * Здесь только `pg`, который и так в зависимостях приложения.
 *
 * Запускается при старте контейнера (CMD в Dockerfile) и вручную:
 *   node scripts/init-db.mjs
 *
 * Никогда не роняет старт приложения: при недоступной БД печатает
 * предупреждение и выходит с кодом 0 — сервер поднимется и отдаст
 * понятную 503 на /api/health.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const RETRIES = Number(process.env.DB_INIT_RETRIES ?? 10);
const DELAY_MS = Number(process.env.DB_INIT_DELAY_MS ?? 3000);

const log = (icon, msg) => console.log(`[init-db] ${icon} ${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isLocal(url) {
  try {
    const h = new URL(url).hostname;
    return h === "localhost" || h === "127.0.0.1" || h === "::1";
  } catch {
    return true;
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    log("!", "DATABASE_URL не задан — схема не применена.");
    log("!", "Приложение запустится, но сохранение работать не будет.");
    return;
  }

  const sql = await readFile(join(here, "sql", "001_init.sql"), "utf8");

  // БД-контейнер может подниматься дольше приложения — ждём его
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    const client = new pg.Client({
      connectionString: url,
      ssl: isLocal(url) ? undefined : { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
    });
    try {
      await client.connect();
      await client.query(sql);
      const { rows } = await client.query(
        `select count(*)::int as n from information_schema.tables
          where table_schema = 'public'
            and table_name in ('clients','bending_calculations','quotes','quote_items')`
      );
      log("✓", `схема готова, таблиц: ${rows[0].n}/4`);
      await client.end();
      return;
    } catch (e) {
      await client.end().catch(() => {});
      const last = attempt === RETRIES;
      log(last ? "✗" : "…", `попытка ${attempt}/${RETRIES}: ${e.message}`);
      if (last) {
        log("!", "Схема не применена — проверьте DATABASE_URL и доступность БД.");
        return;
      }
      await sleep(DELAY_MS);
    }
  }
}

main().catch((e) => {
  log("✗", e?.message ?? String(e));
  // Осознанно не валим старт контейнера
  process.exit(0);
});
