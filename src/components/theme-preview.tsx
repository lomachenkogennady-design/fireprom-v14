"use client";

import { DraftingCompass, Check } from "lucide-react";
import type { ThemeKey } from "@/lib/theme";

/**
 * Живая миниатюра интерфейса в заданной теме.
 *
 * Селекторы тем в globals.css — атрибутные ([data-theme="x"]), поэтому
 * работают на любом элементе, а не только на <html>. Это позволяет
 * показать все варианты одновременно на одной странице.
 */
export function ThemePreview({ theme }: { theme: ThemeKey }) {
  return (
    <div
      data-theme={theme}
      className="pointer-events-none select-none overflow-hidden"
      style={{ background: "var(--color-bg)" }}
    >
      {/* шапка */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ borderBottom: "1px solid var(--color-line)" }}
      >
        <span className="h-2.5 w-2.5" style={{ background: "var(--color-accent)" }} />
        <span className="font-display text-[10px] font-semibold" style={{ color: "var(--color-ink)" }}>
          ФАЙЕРПРОМ
        </span>
        <span className="micro ml-auto">технологу</span>
      </div>

      <div className="space-y-2 p-3">
        {/* строка показателей */}
        <div className="grid grid-cols-3 gap-2">
          {[
            ["Развёртка", "208.3"],
            ["K-фактор", "0.420"],
            ["Усилие", "5.0 тс"],
          ].map(([label, value], i) => (
            <div key={label} className="panel px-2 py-1.5">
              <p className="micro truncate">{label}</p>
              <p
                className="num mt-0.5 truncate text-[13px]"
                style={{ color: i === 0 ? "var(--color-accent)" : "var(--color-ink)" }}
              >
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* превью детали */}
        <div className="panel corner relative h-[68px] overflow-hidden">
          <svg viewBox="0 0 200 60" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
            <path
              d="M30 45 L30 22 Q30 15 38 15 L162 15 Q170 15 170 22 L170 45"
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx="30" cy="22" r="2.5" fill="var(--color-amber)" />
            <circle cx="170" cy="22" r="2.5" fill="var(--color-amber)" />
            <text x="100" y="10" textAnchor="middle" fontSize="7" fill="var(--color-steel)" fontFamily="var(--font-jbm)">
              90 мм
            </text>
          </svg>
        </div>

        {/* мини-таблица */}
        <div className="panel px-2 py-1">
          <table className="tbl">
            <thead>
              <tr>
                <th className="py-1!">Гиб</th>
                <th className="py-1!">Угол</th>
                <th className="py-1!">BA</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["B1", "90°", "8.35"],
                ["B2", "90°", "8.35"],
              ].map((r) => (
                <tr key={r[0]}>
                  {r.map((c, i) => (
                    <td key={i} className="num py-1!" style={{ color: "var(--color-ghost)" }}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* элементы управления */}
        <div className="flex items-center gap-2">
          <span className="btn btn-primary flex-1 justify-center">
            <DraftingCompass size={11} /> Расчёт
          </span>
          <span className="btn btn-outline">DXF</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="chip">
            <Check size={9} /> Ст3
          </span>
          <span className="chip">s=3</span>
          <span className="micro ml-auto">V=24</span>
        </div>
      </div>
    </div>
  );
}
