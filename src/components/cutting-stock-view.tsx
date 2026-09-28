"use client";

import { useMemo } from "react";
import { stockCutting, type StockPart } from "@/lib/cutting";

interface Props {
  parts: StockPart[];
}

const COLORS = ["#f59e0b","#ef4444","#3b82f6","#10b981","#8b5cf6","#ec4899","#06b6d4","#84cc16","#f97316","#6366f1"];

export default function CuttingStockView({ parts }: Props) {
  const result = useMemo(() => stockCutting(parts), [parts]);

  if (parts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
        Добавьте профильные заготовки — покажу раскрой хлыстов 6 м
      </div>
    );
  }

  const scale = 0.1;
  const partIds = Array.from(new Set(parts.map((p) => p.id)));
  const colorOf = (id: string) => COLORS[partIds.indexOf(id) % COLORS.length];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800/70">Хлыстов</div>
          <div className="mt-0.5 font-mono text-[22px] font-bold text-amber-900">{result.barCount}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Использование</div>
          <div className="mt-0.5 font-mono text-[22px] font-bold text-emerald-700">{(result.utilization * 100).toFixed(1)}%</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Заготовок</div>
          <div className="mt-0.5 font-mono text-[22px] font-bold text-slate-900">{parts.reduce((s, p) => s + p.qty, 0)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Отход</div>
          <div className="mt-0.5 font-mono text-[14px] font-bold text-slate-900">{result.totalWaste} мм</div>
        </div>
      </div>

      <div className="space-y-2">
        {result.bars.map((bar) => (
          <div key={bar.index} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Хлыст {bar.index} / {result.barCount}
              </div>
              <div className="font-mono text-[10px] text-slate-400">
                {bar.usedLength} / {result.stockLength} мм · отход {bar.waste} мм
              </div>
            </div>
            <div
              className="relative rounded bg-slate-100"
              style={{ width: result.stockLength * scale, height: 30, border: "1px solid #cbd5e1" }}
            >
              {bar.pieces.map((piece, i) => (
                <div
                  key={i}
                  className="absolute flex items-center justify-center rounded-[2px] text-[9px] font-bold text-white"
                  style={{
                    left: piece.offset * scale, top: 1,
                    width: Math.max(2, piece.length * scale - 1), height: 26,
                    backgroundColor: colorOf(piece.partId),
                    border: "1px solid rgba(0,0,0,0.15)",
                    overflow: "hidden",
                  }}
                  title={`${piece.title} · ${piece.length} мм @ ${piece.offset}`}
                >
                  {piece.length * scale > 30 ? piece.title.slice(0, 8) : ""}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
