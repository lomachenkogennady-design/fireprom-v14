"use client";

import { useMemo, useState } from "react";
import { Layers, Wand2, TriangleAlert, Recycle, Info } from "lucide-react";
import {
  nest,
  bestSheet,
  nestVerdict,
  SHEETS,
  DEFAULT_SHEET,
  type NestPart,
  type NestResult,
} from "@/lib/nesting";
import { MATERIALS, type MaterialKey } from "@/lib/materials";
import { TECH, type TechKey } from "@/lib/pricing";
import { rub, clsx } from "@/lib/format";

export interface NestGroupInput {
  material: MaterialKey;
  thickness: number;
  tech: TechKey;
  parts: NestPart[];
}

const nf = (v: number, d = 1) =>
  v.toLocaleString("ru-RU", { maximumFractionDigits: d });

/** Палитра деталей — устойчивый цвет по индексу, читаемый в любой теме */
const HUES = [18, 200, 145, 280, 42, 330, 95, 255];
const partFill = (i: number) => `hsl(${HUES[i % HUES.length]} 70% 55% / 0.30)`;
const partStroke = (i: number) => `hsl(${HUES[i % HUES.length]} 75% 62%)`;

function SheetSvg({
  result,
  sheetIndex,
  idColors,
}: {
  result: NestResult;
  sheetIndex: number;
  idColors: Map<string, number>;
}) {
  const sh = result.sheets[sheetIndex];
  const { w, h } = result.sheet;
  if (!sh) return null;

  // лист рисуем «лёжа», если он длинный — так экономнее по месту
  const landscape = h > w;
  const vbW = landscape ? h : w;
  const vbH = landscape ? w : h;
  const pad = Math.max(vbW, vbH) * 0.04;
  const fontBase = Math.max(vbW, vbH) * 0.022;

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${vbW + pad * 2} ${vbH + pad * 2}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <g transform={landscape ? `rotate(-90) translate(${-h} 0)` : undefined}>
        {/* лист */}
        <rect
          x="0"
          y="0"
          width={w}
          height={h}
          fill="color-mix(in srgb, var(--color-ink) 4%, transparent)"
          stroke="var(--color-ghost)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
        {/* поле раскроя */}
        <rect
          x={result.margin}
          y={result.margin}
          width={w - result.margin * 2}
          height={h - result.margin * 2}
          fill="none"
          stroke="var(--color-steel)"
          strokeWidth="1"
          strokeDasharray="8 6"
          opacity="0.5"
          vectorEffect="non-scaling-stroke"
        />

        {/* деловой остаток */}
        {sh.remnant && sh.remnant.usable && (
          <g>
            <rect
              x={result.margin}
              y={h - result.margin - sh.remnant.h}
              width={sh.remnant.w}
              height={sh.remnant.h}
              fill="color-mix(in srgb, var(--color-ok) 12%, transparent)"
              stroke="var(--color-ok)"
              strokeWidth="1.2"
              strokeDasharray="10 6"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={result.margin + sh.remnant.w / 2}
              y={h - result.margin - sh.remnant.h / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={fontBase}
              fill="var(--color-ok)"
              fontFamily="var(--font-jbm), monospace"
              transform={
                landscape
                  ? `rotate(90 ${result.margin + sh.remnant.w / 2} ${h - result.margin - sh.remnant.h / 2})`
                  : undefined
              }
            >
              остаток {nf(sh.remnant.area, 2)} м²
            </text>
          </g>
        )}

        {/* детали */}
        {sh.parts.map((p, i) => {
          const ci = idColors.get(p.id) ?? 0;
          const cx = p.x + p.w / 2;
          const cy = p.y + p.h / 2;
          const fits = Math.min(p.w, p.h) > fontBase * 2.4;
          return (
            <g key={i}>
              <rect
                x={p.x}
                y={p.y}
                width={p.w}
                height={p.h}
                fill={partFill(ci)}
                stroke={partStroke(ci)}
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
              {fits && (
                <text
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={fontBase}
                  fill="var(--color-ink)"
                  fontFamily="var(--font-jbm), monospace"
                  transform={landscape ? `rotate(90 ${cx} ${cy})` : undefined}
                >
                  {p.name.slice(0, 14)}
                  {p.rotated ? " ↻" : ""}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export function NestingView({ groups }: { groups: NestGroupInput[] }) {
  const [sheetKey, setSheetKey] = useState<string>(DEFAULT_SHEET);
  const [auto, setAuto] = useState(true);
  const [groupIdx, setGroupIdx] = useState(0);
  const [sheetIdx, setSheetIdx] = useState(0);

  const group = groups[Math.min(groupIdx, Math.max(groups.length - 1, 0))];

  const result = useMemo<NestResult | null>(() => {
    if (!group || group.parts.length === 0) return null;
    if (auto) {
      const ranked = bestSheet(group.parts, {
        material: group.material,
        thickness: group.thickness,
        tech: group.tech,
      });
      if (ranked[0]) return ranked[0].result;
    }
    const sheet = SHEETS.find((s) => s.key === sheetKey) ?? SHEETS[1];
    return nest(group.parts, {
      material: group.material,
      thickness: group.thickness,
      tech: group.tech,
      sheet,
    });
  }, [group, auto, sheetKey]);

  const idColors = useMemo(() => {
    const m = new Map<string, number>();
    group?.parts.forEach((p, i) => m.set(p.id, i));
    return m;
  }, [group]);

  if (!group || !result) {
    return (
      <div className="panel panel-pad">
        <p className="micro">Раскрой на листе</p>
        <p className="mt-3 text-sm text-steel">
          Добавьте позиции в КП — покажу карту раскроя, число листов и реальный
          процент использования металла.
        </p>
      </div>
    );
  }

  const mat = MATERIALS[group.material];
  const verdict = nestVerdict(result.utilization);
  const delta = result.grossCost - result.estimateCost;
  const safeSheet = Math.min(sheetIdx, result.sheetCount - 1);

  const stats: { label: string; value: string; tone?: "ok" | "warn" | "bad" }[] = [
    { label: "Листов", value: `${result.sheetCount} шт` },
    {
      label: "Использование",
      value: `${nf(result.utilization * 100)} %`,
      tone: verdict.tone,
    },
    { label: "Масса листов", value: `${nf(result.grossMass, 1)} кг` },
    { label: "В деталях", value: `${nf(result.netMass, 1)} кг` },
    { label: "Отход в лом", value: `${nf(result.wasteArea, 2)} м²`, tone: "warn" },
    {
      label: "Деловой остаток",
      value: `${nf(result.remnantArea, 2)} м²`,
      tone: result.remnantArea > 0 ? "ok" : undefined,
    },
  ];

  return (
    <div className="panel panel-pad space-y-4">
      {/* заголовок */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Layers size={15} className="text-accent" />
          <p className="micro">Раскрой на листе</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setAuto((v) => !v)}
            className={clsx("chip transition-colors", auto && "border-accent/70! text-accent!")}
            title="Подобрать формат листа с минимальным числом листов"
          >
            <Wand2 size={10} /> авто-формат
          </button>
          <select
            className="field w-[150px]!"
            value={auto ? result.sheet.key : sheetKey}
            disabled={auto}
            onChange={(e) => {
              setSheetKey(e.target.value);
              setSheetIdx(0);
            }}
          >
            {SHEETS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* группы материал+толщина */}
      {groups.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {groups.map((g, i) => (
            <button
              key={`${g.material}-${g.thickness}`}
              onClick={() => {
                setGroupIdx(i);
                setSheetIdx(0);
              }}
              className={clsx(
                "chip transition-colors",
                i === groupIdx ? "border-accent/70! text-accent!" : "hover:text-ink"
              )}
            >
              {MATERIALS[g.material].short} · s={nf(g.thickness)}
            </button>
          ))}
        </div>
      )}

      {/* карта листа */}
      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <div className="panel corner relative h-[340px] overflow-hidden p-4">
          <SheetSvg result={result} sheetIndex={safeSheet} idColors={idColors} />
          <div className="absolute left-3 top-3">
            <span className="chip">
              лист {safeSheet + 1} / {result.sheetCount}
            </span>
          </div>
          <div className="absolute right-3 top-3 text-right">
            <p className="micro">{result.sheet.label} мм</p>
            <p className="micro mt-1">
              {mat.short} · s={nf(group.thickness)}
            </p>
          </div>
          {result.sheetCount > 1 && (
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1">
              {result.sheets.slice(0, 12).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSheetIdx(i)}
                  className={clsx(
                    "h-1.5 w-6 transition-colors",
                    i === safeSheet ? "bg-accent" : "bg-steel/40 hover:bg-steel"
                  )}
                  title={`Лист ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* показатели */}
        <div className="space-y-2">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center justify-between border-b border-line/50 pb-2">
              <span className="micro">{s.label}</span>
              <span
                className={clsx(
                  "num text-[13px]",
                  s.tone === "ok" && "text-ok",
                  s.tone === "warn" && "text-warn",
                  s.tone === "bad" && "text-bad",
                  !s.tone && "text-ink"
                )}
              >
                {s.value}
              </span>
            </div>
          ))}
          <div className="pt-1">
            <p className="micro">Металл по факту раскроя</p>
            <p className="num mt-1 text-2xl text-accent">{rub(result.grossCost)}</p>
            <p
              className={clsx(
                "num mt-1 text-[11px]",
                delta > 0 ? "text-warn" : "text-ok"
              )}
            >
              {delta > 0 ? "+" : ""}
              {rub(delta)} к оценке ×1.25
            </p>
          </div>
        </div>
      </div>

      {/* пояснения */}
      <div className="grid gap-2 sm:grid-cols-2">
        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-steel">
          <Info size={12} className="mt-0.5 shrink-0" />
          Рез {TECH[group.tech].short.toLowerCase()} {nf(result.kerf, 2)} мм, зазор между
          деталями {nf(result.gap)} мм, отступ от кромки {result.margin} мм. Поворот на 90°
          разрешён (отмечен ↻).
        </p>
        {result.remnantArea > 0 ? (
          <p className="flex items-start gap-2 text-[11px] leading-relaxed text-ok">
            <Recycle size={12} className="mt-0.5 shrink-0" />
            Деловой остаток {nf(result.remnantArea, 2)} м² — можно вернуть на склад или
            зачесть клиенту {rub(result.remnantCredit)} по цене лома.
          </p>
        ) : (
          <p className="flex items-start gap-2 text-[11px] leading-relaxed text-steel">
            <Recycle size={12} className="mt-0.5 shrink-0" />
            Делового остатка нет: обрезки мельче {nf(0.12, 2)} м² идут в лом.
          </p>
        )}
      </div>

      {result.utilization < 0.6 && (
        <p className="flex items-start gap-2 border border-warn/40 px-3 py-2 text-[11px] leading-relaxed text-warn">
          <TriangleAlert size={12} className="mt-0.5 shrink-0" />
          Использование {nf(result.utilization * 100)}% — {verdict.label}. Попробуйте
          другой формат листа, увеличьте тираж до кратного или добавьте в раскрой
          мелкие детали из соседних заказов.
        </p>
      )}

      {result.oversized.length > 0 && (
        <p className="flex items-start gap-2 border border-bad/40 px-3 py-2 text-[11px] leading-relaxed text-bad">
          <TriangleAlert size={12} className="mt-0.5 shrink-0" />
          Не помещаются в лист {result.sheet.label}: {result.oversized.join(", ")}. Нужен
          формат больше или деталь придётся сваривать из частей.
        </p>
      )}
    </div>
  );
}
