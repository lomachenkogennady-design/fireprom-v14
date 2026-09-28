"use client";

import { useMemo, useState } from "react";
import CuttingNestingView from "./cutting-nesting-view";
import CuttingStockView from "./cutting-stock-view";
import { calculateCuttingPrice, type CuttingPart, type StockPart } from "@/lib/cutting";
import { MATERIALS, type MaterialKey } from "@/lib/materials";
import { TECH, TECH_KEYS, type TechKey } from "@/lib/pricing";

type SubTab = "sheets" | "stocks";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function CuttingCalculator() {
  const [sub, setSub] = useState<SubTab>("sheets");

  const [material, setMaterial] = useState<MaterialKey>("steel");
  const [thickness, setThickness] = useState(2);
  const [tech, setTech] = useState<TechKey>("laser");
  const [allowRotate, setAllowRotate] = useState(true);

  const [sheetParts, setSheetParts] = useState<CuttingPart[]>([]);
  const [stockParts, setStockParts] = useState<StockPart[]>([]);

  // ── Работа с листовыми деталями ──
  const addSheetPart = () => {
    setSheetParts((prev) => [
      ...prev,
      { id: uid(), title: "Деталь", width: 100, height: 100, qty: 1, allowRotate },
    ]);
  };

  const updateSheetPart = (id: string, patch: Partial<CuttingPart>) => {
    setSheetParts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const removeSheetPart = (id: string) => {
    setSheetParts((prev) => prev.filter((p) => p.id !== id));
  };

  // ── Работа с хлыстами ──
  const addStockPart = () => {
    setStockParts((prev) => [...prev, { id: uid(), title: "Заготовка", length: 500, qty: 1 }]);
  };

  const updateStockPart = (id: string, patch: Partial<StockPart>) => {
    setStockParts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const removeStockPart = (id: string) => {
    setStockParts((prev) => prev.filter((p) => p.id !== id));
  };

  // ── Расчёт цены ──
  const pricing = useMemo(
    () => calculateCuttingPrice(sheetParts, material, thickness, tech),
    [sheetParts, material, thickness, tech],
  );

  const rub = (v: number) => Math.round(v).toLocaleString("ru-RU") + " ₽";

  return (
    <div className="space-y-6">
      {/* Переключатель подмодуля */}
      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setSub("sheets")}
          className={`rounded-lg px-4 py-2 text-[13px] font-bold transition ${sub === "sheets" ? "bg-amber-500 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
        >
          📄 Листы
        </button>
        <button
          type="button"
          onClick={() => setSub("stocks")}
          className={`rounded-lg px-4 py-2 text-[13px] font-bold transition ${sub === "stocks" ? "bg-amber-500 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
        >
          📏 Хлысты 6 м
        </button>
      </div>

      {/* Общие настройки — только для листов */}
      {sub === "sheets" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Материал</span>
            <select
              value={material}
              onChange={(e) => setMaterial(e.target.value as MaterialKey)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px]"
            >
              {Object.values(MATERIALS).map((m) => (
                <option key={m.key} value={m.key}>{m.short}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Толщина, мм</span>
            <input
              type="number"
              step="0.5"
              min="0.5"
              max="20"
              value={thickness}
              onChange={(e) => setThickness(Number(e.target.value) || 1)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px]"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Технология</span>
            <select
              value={tech}
              onChange={(e) => setTech(e.target.value as TechKey)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px]"
            >
              {TECH_KEYS.map((k) => (
                <option key={k} value={k}>{TECH[k].short}</option>
              ))}
            </select>
          </label>
          <label className="flex items-end gap-2">
            <input
              type="checkbox"
              checked={allowRotate}
              onChange={(e) => setAllowRotate(e.target.checked)}
              className="mb-3"
            />
            <span className="mb-2.5 text-[12px] text-slate-700">Поворот деталей</span>
          </label>
        </div>
      )}

      {/* Контент */}
      {sub === "sheets" ? (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-bold uppercase tracking-wider text-slate-500">Детали</h3>
              <button
                type="button"
                onClick={addSheetPart}
                className="rounded-lg bg-amber-500 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-amber-600"
              >
                + Добавить
              </button>
            </div>
            {sheetParts.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-[12px] text-slate-500">
                Нет деталей. Нажмите «Добавить».
              </div>
            )}
            {sheetParts.map((p) => (
              <div key={p.id} className="grid grid-cols-12 gap-2 rounded-lg border border-slate-200 bg-white p-2">
                <input
                  type="text"
                  value={p.title}
                  onChange={(e) => updateSheetPart(p.id, { title: e.target.value })}
                  className="col-span-4 rounded border border-slate-200 px-2 py-1 text-[13px]"
                  placeholder="Название"
                />
                <input
                  type="number"
                  value={p.width}
                  onChange={(e) => updateSheetPart(p.id, { width: Number(e.target.value) || 0 })}
                  className="col-span-2 rounded border border-slate-200 px-2 py-1 text-[13px]"
                  placeholder="X"
                />
                <input
                  type="number"
                  value={p.height}
                  onChange={(e) => updateSheetPart(p.id, { height: Number(e.target.value) || 0 })}
                  className="col-span-2 rounded border border-slate-200 px-2 py-1 text-[13px]"
                  placeholder="Y"
                />
                <input
                  type="number"
                  value={p.qty}
                  onChange={(e) => updateSheetPart(p.id, { qty: Math.max(1, Number(e.target.value) || 1) })}
                  className="col-span-2 rounded border border-slate-200 px-2 py-1 text-[13px]"
                  placeholder="Кол-во"
                />
                <button
                  type="button"
                  onClick={() => removeSheetPart(p.id)}
                  className="col-span-2 rounded bg-red-50 text-[12px] font-bold text-red-700 hover:bg-red-100"
                >
                  Удалить
                </button>
              </div>
            ))}
          </div>

          <CuttingNestingView parts={sheetParts} thickness={thickness} allowRotate={allowRotate} />

          {sheetParts.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
              <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wider text-amber-900">Стоимость резки</h3>
              <div className="grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-3">
                <div><span className="text-slate-600">Длина реза:</span> <b>{(pricing.totalCutLength / 1000).toFixed(2)} м</b></div>
                <div><span className="text-slate-600">Врезок:</span> <b>{pricing.totalPierces}</b></div>
                <div><span className="text-slate-600">Масса:</span> <b>{pricing.totalMass.toFixed(2)} кг</b></div>
                <div><span className="text-slate-600">Материал:</span> <b>{rub(pricing.materialCost)}</b></div>
                <div><span className="text-slate-600">Резка:</span> <b>{rub(pricing.cutCost)}</b></div>
                <div><span className="text-slate-600">Врезки:</span> <b>{rub(pricing.pierceCost)}</b></div>
              </div>
              <div className="mt-3 border-t border-amber-300 pt-3 text-[15px]">
                <span className="text-slate-700">Итого:</span> <b className="text-amber-900">{rub(pricing.total)}</b>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-bold uppercase tracking-wider text-slate-500">Профильные заготовки</h3>
              <button
                type="button"
                onClick={addStockPart}
                className="rounded-lg bg-amber-500 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-amber-600"
              >
                + Добавить
              </button>
            </div>
            {stockParts.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-[12px] text-slate-500">
                Нет заготовок. Нажмите «Добавить».
              </div>
            )}
            {stockParts.map((p) => (
              <div key={p.id} className="grid grid-cols-12 gap-2 rounded-lg border border-slate-200 bg-white p-2">
                <input
                  type="text"
                  value={p.title}
                  onChange={(e) => updateStockPart(p.id, { title: e.target.value })}
                  className="col-span-6 rounded border border-slate-200 px-2 py-1 text-[13px]"
                  placeholder="Название"
                />
                <input
                  type="number"
                  value={p.length}
                  onChange={(e) => updateStockPart(p.id, { length: Number(e.target.value) || 0 })}
                  className="col-span-2 rounded border border-slate-200 px-2 py-1 text-[13px]"
                  placeholder="мм"
                />
                <input
                  type="number"
                  value={p.qty}
                  onChange={(e) => updateStockPart(p.id, { qty: Math.max(1, Number(e.target.value) || 1) })}
                  className="col-span-2 rounded border border-slate-200 px-2 py-1 text-[13px]"
                  placeholder="Кол-во"
                />
                <button
                  type="button"
                  onClick={() => removeStockPart(p.id)}
                  className="col-span-2 rounded bg-red-50 text-[12px] font-bold text-red-700 hover:bg-red-100"
                >
                  Удалить
                </button>
              </div>
            ))}
          </div>

          <CuttingStockView parts={stockParts} />
        </>
      )}
    </div>
  );
}
