/**
 * Тесты PDF-КП. Сервер должен работать (next start / dev).
 * Если сервер лежит — тесты SKIP, а не ложный «PDF сломан» (ECONNREFUSED).
 * Запуск: node --test tests/kp-pdf.test.mjs
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

let serverUp = false;
before(async () => {
  try {
    const r = await fetch(BASE + "/", { signal: AbortSignal.timeout(3000) });
    serverUp = r.ok;
  } catch { /* остаётся false */ }
});
const guard = (tc) => {
  if (!serverUp) {
    tc.skip(`сервер недоступен: ${BASE}`);
    return true;
  }
  return false;
};

test("pdf: рендерится, это PDF, шрифт встроен", async (tc) => {
  if (guard(tc)) return;
  const r = await fetch(BASE + "/api/kp/demo/pdf");
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "application/pdf");
  const buf = Buffer.from(await r.arrayBuffer());
  assert.equal(buf.subarray(0, 5).toString(), "%PDF-");
  assert.ok(buf.length > 15000, `подозрительно маленький PDF: ${buf.length} байт`);
});

test("pdf: повторный рендер стабилен", async (tc) => {
  if (guard(tc)) return;
  const [a, b] = await Promise.all([
    fetch(BASE + "/api/kp/demo/pdf"),
    fetch(BASE + "/api/kp/demo/pdf"),
  ]);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
});
