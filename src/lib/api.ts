import { NextResponse } from "next/server";

/**
 * Единый ответ на сбой БД: отличает «не настроена» (503) от «недоступна» (500),
 * чтобы на телефоне и в облаке было сразу понятно, что чинить.
 */
export function dbErrorResponse(e: unknown): NextResponse {
  const message = e instanceof Error ? e.message : "Ошибка базы данных";
  const unconfigured = message.includes("DATABASE_URL");
  return NextResponse.json(
    {
      error: unconfigured ? "База данных не настроена" : message,
      db: unconfigured ? "unconfigured" : "error",
      hint: unconfigured
        ? "Укажите DATABASE_URL в .env, затем выполните: npx drizzle-kit push"
        : undefined,
    },
    { status: unconfigured ? 503 : 500 }
  );
}
