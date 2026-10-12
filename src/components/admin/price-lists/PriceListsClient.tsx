"use client";

import { useEffect, useState } from "react";

interface PriceListVersion {
  id: number;
  name: string;
  comment: string | null;
  status: "draft" | "published";
  createdAt: string;
}

interface PriceListItem {
  id: number;
  catalogItemId: number;
  price: string;
  unitOverride: string | null;
  catalogType?: string;
  catalogKey?: string;
  catalogName?: string;
  catalogUnit?: string;
}

interface ActiveResponse {
  version: PriceListVersion;
  items: PriceListItem[];
}

interface ListResponse {
  versions: PriceListVersion[];
  activeVersionId: number | null;
}

export function PriceListsClient() {
  const [list, setList] = useState<ListResponse | null>(null);
  const [active, setActive] = useState<ActiveResponse | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedData, setExpandedData] = useState<ActiveResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setError(null);
    try {
      const [r1, r2] = await Promise.all([
        fetch("/api/admin/price-lists"),
        fetch("/api/admin/price-lists/active"),
      ]);
      if (!r1.ok) throw new Error("list: HTTP " + r1.status);
      setList(await r1.json());
      setActive(r2.ok ? await r2.json() : null);
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => { load(); }, []);

  async function action(id: number, kind: "publish" | "activate") {
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/admin/price-lists/" + id + "/" + kind, { method: "POST" });
      if (!r.ok) {
        const b = await r.json().catch(() => ({}));
        throw new Error(b.message || ("HTTP " + r.status));
      }
      await load();
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }

  async function expand(id: number) {
    if (expandedId === id) { setExpandedId(null); setExpandedData(null); return; }
    setExpandedId(id); setExpandedData(null);
    try {
      const r = await fetch("/api/admin/price-lists/" + id);
      if (r.ok) setExpandedData(await r.json());
    } catch {}
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Прайс-листы</h1>
          <p className="text-sm text-neutral-500 mt-1">Активная версия используется для расчёта КП и дверей</p>
        </div>
        <button onClick={load} className="text-xs px-3 py-1 border border-neutral-400">Обновить</button>
      </div>

      {error && (
        <div className="border border-red-500 bg-red-50 text-red-900 p-3 mb-4 text-sm">{error}</div>
      )}

      {active && (
        <div className="border border-green-600 bg-green-50 text-green-900 p-3 mb-6 text-sm">
          <strong>Активный:</strong> {active.version.name} (id={active.version.id}) · {active.items.length} позиций
        </div>
      )}

      {!active && !error && list && (
        <div className="border border-yellow-500 bg-yellow-50 text-yellow-900 p-3 mb-6 text-sm">Активного прайса нет. Опубликуйте и активируйте версию.</div>
      )}

      <h2 className="text-lg font-bold mb-3">Версии</h2>

      {!list && <p className="text-sm text-neutral-500">Загрузка…</p>}
      {list && list.versions.length === 0 && <p className="text-sm text-neutral-500">Нет ни одной версии</p>}

      <div className="space-y-2">
        {list?.versions.map((v) => (
          <div key={v.id} className="border border-neutral-300 p-3">
            <div className="flex items-center gap-3">
              <button onClick={() => expand(v.id)} className="text-left flex-1">
                <div className="font-bold">
                  {v.name}{" "}
                  <span className={"text-xs font-normal px-2 py-0.5 border " + (v.status === "published" ? "border-green-600 text-green-700" : "border-neutral-500 text-neutral-700")}>{v.status}</span>
                  {list.activeVersionId === v.id && <span className="text-xs font-normal px-2 py-0.5 border border-blue-600 text-blue-700 ml-2">active</span>}
                </div>
                {v.comment && <div className="text-xs text-neutral-500 mt-1">{v.comment}</div>}
              </button>
              <div className="flex gap-2">
                {v.status === "draft" && <button onClick={() => action(v.id, "publish")} disabled={busy} className="px-3 py-1 text-xs border border-black bg-black text-white disabled:opacity-50">Опубликовать</button>}
                {v.status === "published" && list.activeVersionId !== v.id && <button onClick={() => action(v.id, "activate")} disabled={busy} className="px-3 py-1 text-xs border border-blue-600 text-blue-700 disabled:opacity-50">Активировать</button>}
              </div>
            </div>

            {expandedId === v.id && (
              <div className="mt-3 pt-3 border-t border-neutral-200 text-sm">
                {!expandedData && <p className="text-neutral-500">Загрузка…</p>}
                {expandedData && expandedData.items.length === 0 && <p className="text-neutral-500">Нет позиций</p>}
                {expandedData && expandedData.items.length > 0 && (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left border-b">
                        <th className="py-1">Код</th>
                        <th>Название</th>
                        <th>Тип</th>
                        <th className="text-right">Цена</th>
                        <th>Ед.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expandedData.items.map((it) => (
                        <tr key={it.id} className="border-b border-neutral-100">
                          <td className="py-1 font-mono">{it.catalogKey ?? "—"}</td>
                          <td>{it.catalogName ?? ("#" + it.catalogItemId)}</td>
                          <td className="text-neutral-500">{it.catalogType ?? "—"}</td>
                          <td className="text-right font-mono">{it.price}</td>
                          <td className="text-neutral-500">{it.unitOverride ?? it.catalogUnit ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
