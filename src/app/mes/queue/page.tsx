"use client";
import { useEffect, useState } from "react";
import type { MesTask } from "@/components/StationShell";
import { STATIONS, type StationKey } from "@/lib/stations";

const STATION_COLS: StationKey[] = ["laser", "press", "weld", "paint", "pack"];

export default function MesQueue() {
  const [tasks, setTasks] = useState<MesTask[]>([]);
  async function load() {
    const r = await fetch("/api/mes/queue", { cache: "no-store" });
    if (r.ok) setTasks(await r.json());
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);
  async function move(taskId: number, station: StationKey) {
    const spec = STATIONS[station];
    await fetch(`/api/mes/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ machineId: spec.machineId }),
    });
    load();
  }
  return (
    <main className="min-h-screen p-6"
          style={{ background: "var(--bg)", color: "var(--ink)" }}>
      <h1 className="text-3xl font-bold mb-6">Очередь производства</h1>
      <div className="grid grid-cols-5 gap-4">
        {STATION_COLS.map((key) => {
          const spec = STATIONS[key];
          const col  = tasks.filter((t) => t.station === key);
          return (
            <div key={key} className="rounded-2xl p-3"
                 style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
              <h2 className="font-bold mb-3 text-lg">{spec.title}</h2>
              <ul className="space-y-2">
                {col.map((t) => (
                  <li key={t.id} className="rounded-lg p-3"
                      style={{
                        background: "var(--bg)",
                        borderLeft: `4px solid ${t.status === "running" ? "var(--accent)" : "var(--line)"}`,
                      }}>
                    <div className="font-semibold">{t.partName}</div>
                    <div className="text-xs opacity-60 mt-1">
                      {t.done}/{t.qty}{t.scrap > 0 && ` · брак ${t.scrap}`}
                    </div>
                    <select value={key} onChange={(e) => move(t.id, e.target.value as StationKey)}
                      className="mt-2 text-xs w-full rounded p-1"
                      style={{ background: "var(--panel)", color: "var(--ink)", border: "1px solid var(--line)" }}>
                      {STATION_COLS.map((k) => (
                        <option key={k} value={k}>→ {STATIONS[k].title}</option>
                      ))}
                    </select>
                  </li>
                ))}
                {col.length === 0 && <li className="opacity-40 text-sm py-4 text-center">—</li>}
              </ul>
            </div>
          );
        })}
      </div>
    </main>
  );
}
