"use client";

import { useEffect, useState } from "react";

type DoorType = "profiles" | "fillings" | "finishes" | "hardware" | "services";

const TABS: { key: DoorType; label: string; countKey: string }[] = [
  { key: "profiles", label: "Профили", countKey: "door_profile" },
  { key: "fillings", label: "Наполнения", countKey: "door_filling" },
  { key: "finishes", label: "Отделки", countKey: "door_finish" },
  { key: "hardware", label: "Фурнитура", countKey: "door_hardware" },
  { key: "services", label: "Услуги", countKey: "door_service" },
];

interface Row {
  catalogId: number;
  key: string;
  name: string;
  unit: string;
  isActive: boolean;
  [k: string]: unknown;
}

export function DoorsCatalogClient() {
  const [tab, setTab] = useState<DoorType>("profiles");
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadCounts() {
    try {
      const r = await fetch("/api/admin/doors");
      if (r.ok) {
        const j = await r.json();
        setCounts(j.counts ?? {});
      }
    } catch {}
  }

  async function load(t: DoorType) {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/doors/" + t);
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      setRows(j[t] ?? []);
    } catch (e) {
      setError(String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadCounts(); }, []);
  useEffect(() => { load(tab); }, [tab]);

  async function toggleActive(catalogId: number, isActive: boolean) {
    try {
      const r = await fetch("/api/admin/doors/catalog-item/" + catalogId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      await load(tab);
      await loadCounts();
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Каталог дверей</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Справочники профилей, наполнений, отделок, фурнитуры и услуг
          </p>
        </div>
        <button
          onClick={() => load(tab)}
          className="text-xs px-3 py-1 border border-neutral-400"
        >
          Обновить
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map((t) => {
          const count = counts[t.countKey] ?? 0;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={
                "px-4 py-2 text-sm border " +
                (active
                  ? "border-black bg-black text-white"
                  : "border-neutral-400 hover:border-black")
              }
            >
              {t.label}
              <span className="ml-2 text-xs opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="border border-red-500 bg-red-50 text-red-900 p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {loading && <p className="text-sm text-neutral-500">Загрузка…</p>}

      {!loading && rows.length === 0 && (
        <p className="text-sm text-neutral-500">Нет записей</p>
      )}

      {!loading && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-neutral-300">
                <th className="py-2 pr-4">Код</th>
                <th className="pr-4">Название</th>
                <th className="pr-4">Ед.</th>
                <th className="pr-4">Характеристики</th>
                <th className="pr-4">Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const excluded = ["catalogId", "key", "name", "unit", "isActive"];
                const specs = Object.entries(r)
                  .filter(([k]) => !excluded.includes(k))
                  .filter(([, v]) => v != null)
                  .slice(0, 4)
                  .map(([k, v]) => {
                    const label = k.replace(/([A-Z])/g, " $1").toLowerCase();
                    return label + "=" + String(v);
                  })
                  .join(", ");
                return (
                  <tr key={r.catalogId} className="border-b border-neutral-100">
                    <td className="py-2 pr-4 font-mono text-xs">{r.key}</td>
                    <td className="pr-4">{r.name}</td>
                    <td className="pr-4 text-neutral-500">{r.unit}</td>
                    <td className="pr-4 text-xs text-neutral-500">{specs}</td>
                    <td className="pr-4">
                      <span
                        className={
                          "text-xs px-2 py-0.5 border " +
                          (r.isActive
                            ? "border-green-600 text-green-700"
                            : "border-neutral-400 text-neutral-500")
                        }
                      >
                        {r.isActive ? "active" : "inactive"}
                      </span>
                    </td>
                    <td className="pr-2">
                      <button
                        onClick={() => toggleActive(r.catalogId, !r.isActive)}
                        className="text-xs px-2 py-1 border border-neutral-400 hover:border-black"
                      >
                        {r.isActive ? "Скрыть" : "Показать"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
