"use client";

import { useMemo } from "react";
import type { BendResult, HoleSpec } from "@/lib/geometry";

interface Props {
  flanges: number[];
  bends: BendResult[];
  flatLength: number;
  width: number;
  thickness: number;
  view: "profile" | "flat";
  holes?: HoleSpec[];
}

const rad = (d: number) => (d * Math.PI) / 180;

interface Pt {
  x: number;
  y: number;
}

/** Сторонний профиль детали: ломаная со скруглёнными гибами */
function useProfileSvg(flanges: number[], bends: BendResult[]) {
  return useMemo(() => {
    const pts: Pt[] = [{ x: 0, y: 0 }];
    let alpha = 0;
    for (let i = 0; i < bends.length; i++) {
      const last = pts[pts.length - 1];
      pts.push({
        x: last.x + Math.cos(rad(alpha)) * (flanges[i] ?? 0),
        y: last.y + Math.sin(rad(alpha)) * (flanges[i] ?? 0),
      });
      alpha += bends[i].dir * bends[i].angle;
    }
    const last = pts[pts.length - 1];
    pts.push({
      x: last.x + Math.cos(rad(alpha)) * (flanges[bends.length] ?? 0),
      y: last.y + Math.sin(rad(alpha)) * (flanges[bends.length] ?? 0),
    });

    // сглаженный путь с квадратичными углами
    let d = `M ${pts[0].x} ${-pts[0].y}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const a = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      const b = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const t = Math.min(a, b) * 0.3;
      const inPt = {
        x: p1.x - ((p1.x - p0.x) / a) * t,
        y: p1.y - ((p1.y - p0.y) / a) * t,
      };
      const outPt = {
        x: p1.x + ((p2.x - p1.x) / b) * t,
        y: p1.y + ((p2.y - p1.y) / b) * t,
      };
      d += ` L ${inPt.x} ${-inPt.y} Q ${p1.x} ${-p1.y} ${outPt.x} ${-outPt.y}`;
    }
    d += ` L ${pts[pts.length - 1].x} ${-pts[pts.length - 1].y}`;

    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => -p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const w = Math.max(maxX - minX, 1);
    const h = Math.max(maxY - minY, 1);
    const pad = 34;

    // подписи полок
    const labels = pts.slice(0, -1).map((p, i) => {
      const q = pts[i + 1];
      return {
        x: (p.x + q.x) / 2,
        y: (-p.y + -q.y) / 2,
        text: `${Math.round(Math.hypot(q.x - p.x, q.y - p.y))}`,
      };
    });

    const bendMarks = pts.slice(1, -1).map((p, i) => ({
      x: p.x,
      y: -p.y,
      angle: bends[i]?.angle ?? 0,
      dir: bends[i]?.dir ?? 1,
    }));

    return {
      d,
      vb: `${minX - pad} ${minY - pad} ${w + pad * 2} ${h + pad * 2}`,
      labels,
      bendMarks,
      endPts: [pts[0], pts[pts.length - 1]].map((p) => ({ x: p.x, y: -p.y })),
    };
  }, [flanges, bends]);
}

export function PartPreview({ flanges, bends, flatLength, width, view, holes = [] }: Props) {
  const p = useProfileSvg(flanges, bends);
  const flatH = Math.max(width, 1);

  if (view === "profile") {
    return (
      <svg
        viewBox={p.vb}
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* базовая линия */}
        <path
          d={p.d}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          style={{ filter: "drop-shadow(0 0 6px color-mix(in srgb, var(--color-accent) 45%, transparent))" }}
        />
        {p.endPts.map((e, i) => (
          <circle key={i} cx={e.x} cy={e.y} r="3" fill="var(--color-accent)" />
        ))}
        {p.bendMarks.map((b, i) => (
          <g key={`b${i}`}>
            <circle cx={b.x} cy={b.y} r="3.4" fill="var(--color-bg)" stroke="var(--color-amber)" strokeWidth="1.4" />
          </g>
        ))}
        {p.labels.map((l, i) => (
          <text
            key={`l${i}`}
            x={l.x}
            y={l.y - 8}
            textAnchor="middle"
            fontSize="11"
            fill="var(--color-steel)"
            fontFamily="var(--font-jbm), monospace"
          >
            {l.text}
          </text>
        ))}
        {p.bendMarks.map((b, i) => (
          <text
            key={`a${i}`}
            x={b.x}
            y={b.y + 20}
            textAnchor="middle"
            fontSize="10"
            fill="var(--color-amber)"
            fontFamily="var(--font-jbm), monospace"
          >
            {`${Math.round(b.angle)}°${b.dir > 0 ? "↑" : "↓"}`}
          </text>
        ))}
      </svg>
    );
  }

  // ---------- развёртка ----------
  const W = Math.max(flatLength, 1);
  const padX = 40;
  const padY = 44;
  const vb = `${-padX} ${-padY} ${W + padX * 2} ${flatH + padY * 2}`;
  const fontSize = Math.max(9, Math.min(13, W / 40));

  return (
    <svg viewBox={vb} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
      <rect
        x="0"
        y="0"
        width={W}
        height={flatH}
        fill="color-mix(in srgb, var(--color-ink) 4%, transparent)"
        stroke="var(--color-ghost)"
        strokeWidth="1.6"
        vectorEffect="non-scaling-stroke"
      />
      {bends.map((b, i) => {
        const x = b.position;
        const zone = Math.max(b.ba, 0.2);
        return (
          <g key={i}>
            <rect x={x} y="0" width={zone} height={flatH} fill="color-mix(in srgb, var(--color-amber) 12%, transparent)" />
            <line
              x1={x}
              y1="0"
              x2={x}
              y2={flatH}
              stroke="var(--color-accent)"
              strokeWidth="1.2"
              strokeDasharray="6 4"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={x + zone / 2}
              y={flatH / 2}
              textAnchor="middle"
              fontSize={fontSize}
              fill="var(--color-amber)"
              fontFamily="var(--font-jbm), monospace"
              transform={`rotate(-90 ${x + zone / 2} ${flatH / 2})`}
            >
              {`B${i + 1} · ${Math.round(b.angle)}° ${b.dir > 0 ? "↑" : "↓"}`}
            </text>
          </g>
        );
      })}
      {holes.map((h, i) => (
        <g key={`h${i}`}>
          <circle
            cx={h.x}
            cy={flatH - h.y}
            r={Math.max(h.d / 2, 0.5)}
            fill="color-mix(in srgb, var(--color-ok) 10%, transparent)"
            stroke="var(--color-ok)"
            strokeWidth="1.1"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={h.x - h.d * 0.35}
            y1={flatH - h.y}
            x2={h.x + h.d * 0.35}
            y2={flatH - h.y}
            stroke="var(--color-ok)"
            strokeWidth="0.7"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={h.x}
            y1={flatH - h.y - h.d * 0.35}
            x2={h.x}
            y2={flatH - h.y + h.d * 0.35}
            stroke="var(--color-ok)"
            strokeWidth="0.7"
            vectorEffect="non-scaling-stroke"
          />
          <text
            x={h.x + h.d / 2 + 4}
            y={flatH - h.y - h.d / 2 - 2}
            fontSize={fontSize - 1}
            fill="var(--color-ok)"
            fontFamily="var(--font-jbm), monospace"
          >
            {`Ø${h.d}`}
          </text>
        </g>
      ))}
      <text
        x={W / 2}
        y={-14}
        textAnchor="middle"
        fontSize={fontSize + 1}
        fill="var(--color-steel)"
        fontFamily="var(--font-jbm), monospace"
      >
        {`${Math.round(W)} мм`}
      </text>
      <text
        x={-16}
        y={flatH / 2}
        textAnchor="middle"
        fontSize={fontSize + 1}
        fill="var(--color-steel)"
        fontFamily="var(--font-jbm), monospace"
        transform={`rotate(-90 ${-16} ${flatH / 2})`}
      >
        {`${Math.round(flatH)} мм`}
      </text>
    </svg>
  );
}
