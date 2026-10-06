// Автотесты MES-модуля FireProM v14
// Запуск: cd ~/fireprom-v14 && node --test tests/mes.test.mjs
//
// Требует:
//   - запущенный прод на http://127.0.0.1:3000
//   - DATABASE_URL в .env (или дефолт ниже)
//
// Тесты создают ВРЕМЕННЫЕ задания и удаляют их после себя.

import { test, before, after, describe } from "node:test";
import { strict as assert } from "node:assert";
import pg from "pg";

const BASE = process.env.TEST_BASE || "http://127.0.0.1:3000";
const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://u0_a304@127.0.0.1:5432/app_db";

const createdIds = [];
let db;

function url(path) {
  return BASE + path;
}

async function api(path, opts) {
  const r = await fetch(url(path), opts);
  const text = await r.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: r.status, body };
}

async function createTask(station, qty) {
  const name =
    "TEST_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
  const { rows } = await db.query(
    "INSERT INTO machine_tasks (machine_id, station, part_name, qty) " +
      "VALUES ($1,$2,$3,$4) RETURNING id",
    [station + "-01", station, name, qty]
  );
  createdIds.push(rows[0].id);
  return rows[0].id;
}

async function report(id, payload) {
  return await api("/api/mes/tasks/" + id + "/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function start(id) {
  return await api("/api/mes/tasks/" + id + "/start", { method: "POST" });
}

before(async () => {
  db = new pg.Client({ connectionString: DATABASE_URL });
  await db.connect();
  const h = await api("/api/health");
  if (h.status !== 200) {
    throw new Error("Прод не отвечает: " + JSON.stringify(h));
  }
  console.log("\n✓ Прод жив: " + JSON.stringify(h.body) + "\n");
});

after(async () => {
  if (createdIds.length > 0) {
    await db.query("DELETE FROM machine_tasks WHERE id = ANY($1::int[])", [
      createdIds,
    ]);
    console.log("\n✓ Удалено тестовых заданий: " + createdIds.length + "\n");
  }
  await db.end();
});

describe("Health", () => {
  test("GET /api/health → ok + db connected", async () => {
    const r = await api("/api/health");
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.db, "connected");
  });
});

describe("MES: GET /api/mes/tasks", () => {
  test("без station → 400", async () => {
    const r = await api("/api/mes/tasks");
    assert.equal(r.status, 400);
  });

  test("station=laser → массив", async () => {
    const r = await api("/api/mes/tasks?station=laser");
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.body));
  });

  test("station=unknown_xyz → пустой массив", async () => {
    const r = await api("/api/mes/tasks?station=nonexistent_xyz");
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.body));
    assert.equal(r.body.length, 0);
  });

  test("новое задание появляется в очереди", async () => {
    const id = await createTask("laser", 10);
    const r = await api("/api/mes/tasks?station=laser");
    const found = r.body.find((t) => t.id === id);
    assert.ok(found, "Задание не найдено");
    assert.equal(found.qty, 10);
    assert.equal(found.done, 0);
    assert.equal(found.status, "queued");
  });
});

describe("MES: POST /api/mes/tasks/:id/start", () => {
  test("старт меняет статус на running", async () => {
    const id = await createTask("press", 5);
    const r = await start(id);
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.task.status, "running");
    assert.ok(r.body.task.startedAt);
  });

  test("несуществующий id → 404", async () => {
    const r = await api("/api/mes/tasks/999999999/start", { method: "POST" });
    assert.equal(r.status, 404);
  });

  test("невалидный id → 400", async () => {
    const r = await api("/api/mes/tasks/abc/start", { method: "POST" });
    assert.equal(r.status, 400);
  });
});

describe("MES: POST /api/mes/tasks/:id/report", () => {
  test("+1 увеличивает done", async () => {
    const id = await createTask("laser", 20);
    await start(id);
    const r = await report(id, { done: 1 });
    assert.equal(r.status, 200);
    assert.equal(r.body.task.done, 1);
  });

  test("scrap увеличивает scrap", async () => {
    const id = await createTask("laser", 20);
    await start(id);
    const r = await report(id, { scrap: 1 });
    assert.equal(r.status, 200);
    assert.equal(r.body.task.scrap, 1);
  });

  test("пустой payload → 400", async () => {
    const id = await createTask("laser", 5);
    const r = await report(id, {});
    assert.equal(r.status, 400);
  });

  test("автозакрытие: done >= qty → status=done", async () => {
    const id = await createTask("weld", 3);
    await start(id);
    for (let i = 0; i < 3; i++) {
      await report(id, { done: 1 });
    }
    const r = await api("/api/mes/tasks?station=weld");
    const found = r.body.find((t) => t.id === id);
    assert.ok(found);
    assert.equal(found.done, 3);
    assert.equal(found.status, "done");
  });
});

describe("MES: PATCH /api/mes/tasks/:id", () => {
  test("перенос machineId", async () => {
    const id = await createTask("laser", 5);
    const r = await api("/api/mes/tasks/" + id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ machineId: "press-99" }),
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.task.machineId, "press-99");
  });

  test("пустой PATCH → 400", async () => {
    const id = await createTask("laser", 5);
    const r = await api("/api/mes/tasks/" + id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(r.status, 400);
  });
});

describe("MES: GET /api/mes/queue", () => {
  test("завершённые задания не попадают в очередь", async () => {
    const id = await createTask("paint", 1);
    await start(id);
    await report(id, { done: 1 });
    const r = await api("/api/mes/queue");
    assert.equal(r.status, 200);
    const inQueue = r.body.find((t) => t.id === id);
    assert.equal(inQueue, undefined, "Завершённое не должно быть в очереди");
  });
});

describe("Jarvis MES", () => {
  async function ask(q) {
    return await api("/api/jarvis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q }),
    });
  }

  test('"что в очереди" → mes.queue', async () => {
    const r = await ask("что в очереди");
    assert.equal(r.status, 200);
    assert.equal(r.body.intent, "mes.queue");
    assert.equal(r.body.source, "expert");
  });

  test('"что на лазере" → mes.machine', async () => {
    const r = await ask("что на лазере");
    assert.equal(r.body.intent, "mes.machine");
  });

  test('"что на прессе" → mes.machine', async () => {
    const r = await ask("что на прессе");
    assert.equal(r.body.intent, "mes.machine");
  });

  test('"брак за смену" → mes.scrap', async () => {
    const r = await ask("брак за смену");
    assert.equal(r.body.intent, "mes.scrap");
  });

  test('"какой брак сегодня" → mes.scrap', async () => {
    const r = await ask("какой брак сегодня");
    assert.equal(r.body.intent, "mes.scrap");
  });

  test('"привет" → не MES-интент', async () => {
    const r = await ask("привет");
    const intents = ["mes.queue", "mes.machine", "mes.scrap"];
    assert.equal(intents.includes(r.body.intent), false);
  });
});

describe("MES-страницы отдают HTTP 200", () => {
  const pages = ["/laser", "/press", "/weld", "/paint", "/pack", "/mes/queue"];
  for (const p of pages) {
    test("GET " + p + " → 200", async () => {
      const r = await fetch(url(p));
      assert.equal(r.status, 200);
    });
  }
});
