/**
 * Лёгкий парсер DXF: оценка длины реза, числа врезок и габарита файла.
 * Поддерживает LINE, LWPOLYLINE, POLYLINE/VERTEX, ARC, CIRCLE, ELLIPSE, SPLINE (по точкам).
 */

export interface DxfScan {
  ok: boolean;
  lengthMm: number;
  pierces: number;
  holes: number;
  widthMm: number;
  heightMm: number;
  entities: {
    lines: number;
    polylines: number;
    circles: number;
    arcs: number;
    ellipses: number;
    splines: number;
  };
}

type Pairs = [string, string][];

function readPairs(text: string): Pairs {
  const lines = text.split(/\r\n|\r|\n/);
  const out: Pairs = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    out.push([lines[i].trim(), lines[i + 1]]);
  }
  return out;
}

const UNIT_SCALE: Record<string, number> = {
  "1": 25.4, // дюймы
  "2": 304.8, // футы
  "3": 1609344, // мили (экзотика)
  "4": 1, // мм
  "5": 10, // см
  "6": 1000, // м
  "7": 1e6, // км
};

export function scanDxf(text: string): DxfScan {
  const pairs = readPairs(text);
  const nums = (e: Map<string, number[]>, code: string) => e.get(code) ?? [];
  const num1 = (e: Map<string, number[]>, code: string, def = 0) =>
    (e.get(code) ?? [def])[0] ?? def;

  // масштаб из $INSUNITS
  let scale = 1;
  for (let i = 0; i < pairs.length; i++) {
    if (pairs[i][1].trim() === "$INSUNITS" && i + 1 < pairs.length) {
      scale = UNIT_SCALE[pairs[i + 1][1].trim()] ?? 1;
      break;
    }
  }

  interface Ent {
    type: string;
    m: Map<string, number[]>;
  }

  const entities: Ent[] = [];
  let inEntities = false;
  let cur: Ent | null = null;
  let polyline: Ent | null = null;
  const push = (code: string, val: string) => {
    if (!cur) return;
    const f = Number.parseFloat(val);
    if (!Number.isFinite(f)) return;
    const arr = cur.m.get(code) ?? [];
    arr.push(f);
    cur.m.set(code, arr);
  };

  for (const [code, rawVal] of pairs) {
    const val = rawVal.trim();
    if (code === "2" && val === "ENTITIES") {
      inEntities = true;
      continue;
    }
    if (!inEntities) continue;
    if (code !== "0") {
      push(code, val);
      continue;
    }
    // новая сущность
    if (val === "VERTEX" && polyline) {
      cur = polyline; // координаты вершины дописываем в полилинию
      continue;
    }
    if (val === "SEQEND" && polyline) {
      entities.push(polyline);
      polyline = null;
      cur = null;
      continue;
    }
    cur = null;
    if (["LINE", "LWPOLYLINE", "ARC", "CIRCLE", "ELLIPSE", "SPLINE"].includes(val)) {
      cur = { type: val, m: new Map() };
      entities.push(cur);
    } else if (val === "POLYLINE") {
      // старая POLYLINE: вершины придут сущностями VERTEX до SEQEND
      polyline = { type: "POLYLINE", m: new Map() };
      polyline.m.set("_pl", [1]);
      cur = polyline;
    }
  }
  if (polyline) entities.push(polyline);

  let length = 0;
  let holes = 0;
  let closedCount = 0;
  let openSeen = false;
  const stats = { lines: 0, polylines: 0, circles: 0, arcs: 0, ellipses: 0, splines: 0 };
  const xs: number[] = [];
  const ys: number[] = [];
  const pt = (x: number, y: number) => {
    xs.push(x);
    ys.push(y);
  };

  for (const e of entities) {
    const { type, m } = e;
    if (type === "LINE") {
      stats.lines++;
      const x1 = num1(m, "10"), y1 = num1(m, "20"), x2 = num1(m, "11"), y2 = num1(m, "21");
      length += Math.hypot(x2 - x1, y2 - y1);
      pt(x1, y1);
      pt(x2, y2);
      openSeen = true;
    } else if (type === "LWPOLYLINE" || type === "POLYLINE") {
      stats.polylines++;
      const vx = nums(m, "10");
      const vy = nums(m, "20");
      const closed = (num1(m, "70") & 1) === 1;
      const cnt = Math.min(vx.length, vy.length);
      let pl = 0;
      for (let i = 0; i + 1 < cnt; i++) {
        pl += Math.hypot(vx[i + 1] - vx[i], vy[i + 1] - vy[i]);
        pt(vx[i], vy[i]);
      }
      if (cnt > 0) pt(vx[cnt - 1], vy[cnt - 1]);
      if (closed && cnt > 2) {
        pl += Math.hypot(vx[0] - vx[cnt - 1], vy[0] - vy[cnt - 1]);
        closedCount++;
      } else if (cnt > 1) {
        openSeen = true;
      }
      length += pl;
    } else if (type === "ARC") {
      stats.arcs++;
      const cx = num1(m, "10"), cy = num1(m, "20"), r = num1(m, "40");
      let a1 = num1(m, "50"), a2 = num1(m, "51");
      if (a2 <= a1) a2 += 360;
      length += r * ((a2 - a1) * Math.PI) / 180;
      pt(cx - r, cy - r);
      pt(cx + r, cy + r);
      openSeen = true;
    } else if (type === "CIRCLE") {
      stats.circles++;
      const cx = num1(m, "10"), cy = num1(m, "20"), r = num1(m, "40");
      length += 2 * Math.PI * r;
      pt(cx - r, cy - r);
      pt(cx + r, cy + r);
      holes++;
    } else if (type === "ELLIPSE") {
      stats.ellipses++;
      const cx = num1(m, "10"), cy = num1(m, "20");
      const ax = num1(m, "11"), ay = num1(m, "21");
      const a = Math.hypot(ax, ay);
      const b = a * num1(m, "40", 1);
      const h = ((a - b) / (a + b)) ** 2;
      const circ = Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
      const p1 = m.has("41") ? num1(m, "41") : 0;
      const p2 = m.has("42") ? num1(m, "42") : Math.PI * 2;
      const frac = Math.abs(p2 - p1) / (Math.PI * 2);
      length += circ * (frac >= 0.999 ? 1 : frac);
      pt(cx - a, cy - b);
      pt(cx + a, cy + b);
      if (frac >= 0.999) holes++;
      else openSeen = true;
    } else if (type === "SPLINE") {
      stats.splines++;
      const vx = nums(m, "10");
      const vy = nums(m, "20");
      const cnt = Math.min(vx.length, vy.length);
      let pl = 0;
      for (let i = 0; i + 1 < cnt; i++) {
        pl += Math.hypot(vx[i + 1] - vx[i], vy[i + 1] - vy[i]);
        pt(vx[i], vy[i]);
      }
      length += pl;
      if (cnt > 1) openSeen = true;
    }
  }

  const total = stats.lines + stats.polylines + stats.circles + stats.arcs + stats.ellipses + stats.splines;
  if (total === 0) {
    return {
      ok: false,
      lengthMm: 0,
      pierces: 0,
      holes: 0,
      widthMm: 0,
      heightMm: 0,
      entities: stats,
    };
  }

  let pierces = holes + closedCount + (openSeen ? 1 : 0);
  if (pierces === 0 && length > 0) pierces = 1;

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    ok: true,
    lengthMm: Math.round(length * scale * 10) / 10,
    pierces,
    holes,
    widthMm: Math.round((maxX - minX) * scale * 10) / 10,
    heightMm: Math.round((maxY - minY) * scale * 10) / 10,
    entities: stats,
  };
}
