"use client";
import { useEffect, useState } from "react";
import type { StationSpec } from "@/lib/stations";

export interface MesTask {
  id: number;
  machineId: string;
  station: string;
  quoteId: number | null;
  partName: string;
  qty: number;
  done: number;
  scrap: number;
  status: "queued" | "running" | "paused" | "done" | "failed";
  note: string | null;
  meta: Record<string, unknown> | null;
}

export function StationShell({ spec }: { spec: StationSpec }) {
  const [tasks, setTasks]     = useState<MesTask[]>([]);
  const [current, setCurrent] = useState<MesTask | null>(null);
  const [busy, setBusy]       = useState(false);

  async function load() {
    const r = await fetch(`/api/mes/tasks?station=${spec.key}`, { cache: "no-store" });
    if (!r.ok) return;
    const list: MesTask[] = await r.json();
    setTasks(list);
    const running = list.find((t) => t.status === "running");
    if (running) setCurrent(running);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [spec.key]);

  async function start(t: MesTask) {
    if (busy) return;
    setBusy(true);
    try {
      await fetch(`/api/mes/tasks/${t.id}/start`, { method: "POST" });
      setCurrent({ ...t, status: "running" });
    } finally { setBusy(false); }
  }

  async function report(done = 0, scrap = 0) {
    if (!current || busy) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/mes/tasks/${current.id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done, scrap }),
      });
      const { task } = await r.json();
      setCurrent(task);
    } finally { setBusy(false); }
  }

  const queued = tasks.filter((t) => t.status === "queued");

  return (
    <main className="min-h-screen p-6 select-none"
          style={{ background: "var(--bg)", color: "var(--ink)" }}>
      <header className="flex justify-between items-baseline mb-6">
        <div>
          <h1 className="text-4xl font-bold">{spec.title}</h1>
          <div className="opacity-60">{spec.subtitle}</div>
        </div>
        <span className="opacity-60 text-lg">{queued.length} в очереди</span>
      </header>
      {current
        ? <TaskCard task={current} spec={spec} onReport={report} disabled={busy} />
        : <Queue tasks={queued} onStart={start} disabled={busy} />}
    </main>
  );
}

function TaskCard({ task, spec, onReport, disabled }: {
  task: MesTask; spec: StationSpec;
  onReport: (done: number, scrap: number) => void;
  disabled: boolean;
}) {
  return (
    <section className="rounded-2xl p-6"
             style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
      {task.quoteId && <div className="opacity-60 mb-1">КП №{task.quoteId}</div>}
      <h2 className="text-5xl font-bold mb-4">{task.partName}</h2>
      {spec.metaFields && task.meta && (
        <div className="flex flex-wrap gap-4 mb-6 opacity-80">
          {spec.metaFields.map((f) => {
            const v = task.meta?.[f.key];
            if (v == null) return null;
            return (
              <div key={f.key} className="text-sm">
                <span className="opacity-60">{f.label}: </span>
                <span className="font-semibold">{String(v)}{f.unit ? ` ${f.unit}` : ""}</span>
              </div>
            );
          })}
        </div>
      )}
      {task.note && (
        <div className="rounded-lg p-3 mb-6 text-sm"
             style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
          📌 {task.note}
        </div>
      )}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Stat label="План"   value={task.qty} />
        <Stat label="Готово" value={task.done}  accent />
        <Stat label="Брак"   value={task.scrap} danger />
      </div>
      <div className="flex gap-3">
        <button onClick={() => onReport(1, 0)} disabled={disabled}
          className="flex-1 h-32 text-3xl font-bold rounded-2xl active:brightness-90 disabled:opacity-50"
          style={{ background: "var(--accent)", color: "#000" }}>
          +1 ГОТОВО
        </button>
        <button onClick={() => onReport(0, 1)} disabled={disabled}
          className="w-44 h-32 text-2xl font-bold rounded-2xl active:brightness-90 disabled:opacity-50"
          style={{ background: "#7f1d1d", color: "#fff" }}>
          {spec.scrapLabel ?? "БРАК"}
        </button>
      </div>
    </section>
  );
}

function Queue({ tasks, onStart, disabled }: {
  tasks: MesTask[]; onStart: (t: MesTask) => void; disabled: boolean;
}) {
  if (tasks.length === 0) {
    return <div className="text-center opacity-50 py-20 text-xl">Очередь пуста</div>;
  }
  return (
    <ul className="space-y-3">
      {tasks.map((t) => (
        <li key={t.id}>
          <button onClick={() => onStart(t)} disabled={disabled}
            className="w-full text-left rounded-xl p-6 active:brightness-125 disabled:opacity-50"
            style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
            <div className="flex justify-between items-center">
              <div>
                <div className="opacity-50 text-sm">{t.quoteId ? `КП №${t.quoteId}` : "—"}</div>
                <div className="text-3xl font-semibold">{t.partName}</div>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold">{t.qty}</div>
                <div className="opacity-50 text-xs">шт</div>
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Stat({ label, value, accent, danger }: {
  label: string; value: number; accent?: boolean; danger?: boolean;
}) {
  const color = accent ? "#4ade80" : danger ? "#f87171" : "var(--ink)";
  return (
    <div className="rounded-xl p-4 text-center" style={{ background: "var(--bg)" }}>
      <div className="text-xs uppercase opacity-50">{label}</div>
      <div className="text-5xl font-bold" style={{ color }}>{value}</div>
    </div>
  );
}
