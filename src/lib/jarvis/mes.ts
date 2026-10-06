import { db } from "@/db";
import { sql } from "drizzle-orm";

/**
 * MES-интенты Jarvis — вопросы про производство, требуют БД.
 *
 * Отдельно от expert.ts, потому что тот синхронный и работает только
 * с числами калькулятора. Здесь — живая очередь станков.
 */

interface MesResult {
  answer: string;
  intent: string;
}

const STATION_MAP: Record<string, { key: string; title: string }> = {
  лазер: { key: "laser", title: "Лазер 01" },
  пресс: { key: "press", title: "Пресс 01" },
  сварк: { key: "weld",  title: "Сварка 01" },
  покрас: { key: "paint", title: "Покраска" },
  упаков: { key: "pack",  title: "Упаковка" },
};

const plural = (n: number, f: [string, string, string]): string => {
  const n100 = Math.abs(n) % 100;
  const n10  = n100 % 10;
  if (n100 > 10 && n100 < 20) return f[2];
  if (n10 > 1 && n10 < 5) return f[1];
  if (n10 === 1) return f[0];
  return f[2];
};
const pcs = (n: number) => `${n} ${plural(n, ["шт", "шт", "шт"])}`;
const tasksWord = (n: number) => `${n} ${plural(n, ["задание", "задания", "заданий"])}`;

/**
 * 1. «Что в очереди», «загрузка станков»
 */
async function queueOverview(): Promise<MesResult> {
  const _r1 = await db.execute(sql`
    SELECT station,
           count(*)::int                AS n,
           sum(qty - done)::int         AS remaining,
           sum(done)::int               AS done_total
    FROM machine_tasks
    WHERE status IN ('queued','running','paused')
    GROUP BY station
    ORDER BY station
  `);
  const rows = (_r1 as unknown as { rows: Array<{ station: string; n: number; remaining: number; done_total: number }> }).rows;

  if (rows.length === 0) {
    return {
      answer: "Очередь пуста — все станки свободны.",
      intent: "mes.queue",
    };
  }

  const lines = ["Очередь по станкам:"];
  for (const r of rows) {
    const spec = Object.values(STATION_MAP).find((s) => s.key === r.station);
    const title = spec?.title ?? r.station;
    lines.push(`• ${title}: ${tasksWord(r.n)}, остаток ${pcs(r.remaining)}, готово ${r.done_total}`);
  }
  return { answer: lines.join("\n"), intent: "mes.queue" };
}

/**
 * 2. «Что на лазере / прессе / …»
 */
async function stationStatus(stationKey: string, title: string): Promise<MesResult> {
  const _r2 = await db.execute(sql`
    SELECT id, part_name, qty, done, scrap, status
    FROM machine_tasks
    WHERE station = ${stationKey}
      AND status IN ('queued','running','paused')
    ORDER BY
      CASE status WHEN 'running' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END,
      created_at ASC
    LIMIT 5
  `);
  const rows = (_r2 as unknown as { rows: Array<{
    id: number; part_name: string; qty: number; done: number;
    scrap: number; status: string;
  }> }).rows;

  if (rows.length === 0) {
    return {
      answer: `На «${title}» сейчас нет активных заданий.`,
      intent: "mes.machine",
    };
  }

  const running = rows.find((r) => r.status === "running");
  const lines: string[] = [];
  if (running) {
    lines.push(`Сейчас на «${title}»: ${running.part_name} — ${running.done}/${running.qty} шт`);
    if (running.scrap > 0) lines.push(`Брак: ${running.scrap} шт`);
  } else {
    lines.push(`На «${title}» ничего не запущено, но есть очередь:`);
  }
  const queued = rows.filter((r) => r.status === "queued");
  if (queued.length > 0) {
    lines.push(`В очереди (${queued.length}):`);
    for (const q of queued) lines.push(`• ${q.part_name} — ${q.qty} шт`);
  }
  return { answer: lines.join("\n"), intent: "mes.machine" };
}

/**
 * 3. «Брак за смену / за сегодня»
 */
async function scrapToday(): Promise<MesResult> {
  const _r3 = await db.execute(sql`
    SELECT coalesce(sum((payload->>'scrap')::int), 0)::int  AS total,
           count(DISTINCT task_id)::int                     AS tasks
    FROM machine_events
    WHERE kind = 'scrap'
      AND created_at >= date_trunc('day', now())
  `);
  const [_row] = (_r3 as unknown as { rows: Array<{ total: number; tasks: number }> }).rows;
  const row = _row;

  if (!row || row.total === 0) {
    return {
      answer: "Брак за сегодня: 0 шт. Чисто.",
      intent: "mes.scrap",
    };
  }
  return {
    answer: `Брак за сегодня: ${row.total} шт, зафиксирован в ${tasksWord(row.tasks)}.`,
    intent: "mes.scrap",
  };
}

/**
 * Точка входа. Возвращает ответ или null (пропускаем к expert/LLM).
 */
export async function askMes(question: string): Promise<MesResult | null> {
  const q = question.toLowerCase().replace(/ё/g, "е");

  // 1. Брак
  if (/(брак|бой|испорч|перепорт)/.test(q)) {
    try { return await scrapToday(); } catch (e) {
      console.error("[jarvis.mes] scrapToday failed:", e);
      return null;
    }
  }

  // 2. Очередь / загрузка
  if (/(очеред|загрузк|занят|занято|что\s+делать|сколько\s+заданий)/.test(q)) {
    try { return await queueOverview(); } catch (e) {
      console.error("[jarvis.mes] queueOverview failed:", e);
      return null;
    }
  }

  // 3. Станок по названию
  for (const [needle, spec] of Object.entries(STATION_MAP)) {
    if (q.includes(needle)) {
      try { return await stationStatus(spec.key, spec.title); } catch (e) {
        console.error("[jarvis.mes] stationStatus failed:", e);
        return null;
      }
    }
  }

  return null;
}
