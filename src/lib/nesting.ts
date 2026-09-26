import { MATERIALS, type MaterialKey } from "./materials";
import { SCRAP_RATES, type TechKey } from "./pricing";

/**
 * Раскрой листа (nesting).
 *
 * Заменяет грубый коэффициент отхода ×1.25 фактическим расчётом: сколько
 * листов реально уйдёт, какой процент использования, что останется деловым
 * остатком. Алгоритм — полочный FFDH (First Fit Decreasing Height) с
 * поворотом на 90°, это стандартная быстрая эвристика для прямоугольного
 * раскроя. Она даёт результат на 3–7% хуже промышленного nesting-ядра,
 * поэтому считается консервативно — в пользу цеха, а не клиента.
 */

export interface SheetFormat {
  key: string;
  w: number;
  h: number;
  label: string;
}

/**
 * Форматы листа, которые реально проходят на станке.
 *
 * Поле раскроя лазера — 2490 × 1240 мм, поэтому листы 1500 × 3000 и длиннее
 * физически не режутся: они здесь не значатся. Стандарт цеха — 2500 × 1250,
 * остальное это карты из обрезков.
 */
export const SHEETS: SheetFormat[] = [
  { key: "1250x2500", w: 1250, h: 2500, label: "1250 × 2500 (стандарт)" },
  { key: "1000x2000", w: 1000, h: 2000, label: "1000 × 2000" },
  { key: "1250x1250", w: 1250, h: 1250, label: "1250 × 1250 (половина)" },
  { key: "1000x1000", w: 1000, h: 1000, label: "1000 × 1000 (карта)" },
];

export const DEFAULT_SHEET = "1250x2500";

/** Ширина реза, мм — зависит от технологии и толщины */
export function kerfWidth(tech: TechKey, thickness: number): number {
  if (tech === "plasma") return Math.min(1.2 + thickness * 0.15, 3.5);
  if (tech === "waterjet") return 0.8 + thickness * 0.02;
  return thickness <= 3 ? 0.2 : thickness <= 8 ? 0.35 : 0.5;
}

/** Минимальная площадь делового остатка, м² — меньше идёт в лом */
export const REMNANT_MIN_AREA = 0.12;
/** Минимальная сторона делового остатка, мм */
export const REMNANT_MIN_SIDE = 150;

export interface NestPart {
  id: string;
  name: string;
  /** габарит детали, мм */
  w: number;
  h: number;
  qty: number;
  /** запрет поворота — например, для направленного проката или рисунка */
  noRotate?: boolean;
}

export interface PlacedPart {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
  /** порядковый номер экземпляра детали */
  copy: number;
}

export interface NestedSheet {
  parts: PlacedPart[];
  /** полезная площадь деталей на листе, мм² */
  usedArea: number;
  utilization: number;
  /** свободная полоса сверху: потенциальный деловой остаток */
  remnant: { w: number; h: number; area: number; usable: boolean } | null;
}

export interface NestResult {
  material: MaterialKey;
  thickness: number;
  sheet: SheetFormat;
  kerf: number;
  margin: number;
  gap: number;
  sheets: NestedSheet[];
  sheetCount: number;
  /** суммарная площадь деталей, м² */
  partArea: number;
  /** суммарная площадь листов, м² */
  sheetArea: number;
  utilization: number;
  /** отход в лом, м² */
  wasteArea: number;
  /** деловой остаток, м² */
  remnantArea: number;
  /** масса всех листов, кг */
  grossMass: number;
  /** масса деталей, кг */
  netMass: number;
  /** стоимость металла по факту раскроя, ₽ */
  grossCost: number;
  /** стоимость по старой оценке (масса деталей × 1.25), ₽ */
  estimateCost: number;
  /** возврат за деловой остаток по цене лома, ₽ */
  remnantCredit: number;
  /** детали, не влезающие в лист */
  oversized: string[];
}

interface Shelf {
  y: number;
  h: number;
  cursorX: number;
}

/**
 * Полочная укладка с поворотом.
 * Детали сортируются по убыванию большей стороны, каждая кладётся в первую
 * подходящую полку; не влезла — открывается новая полка, кончился лист —
 * новый лист.
 */
export function nest(
  parts: NestPart[],
  opts: {
    material: MaterialKey;
    thickness: number;
    tech: TechKey;
    sheet: SheetFormat;
    /** отступ от кромки листа, мм */
    margin?: number;
  }
): NestResult {
  // лист 2500 × 1250 при поле реза 2490 × 1240 → технологический отступ 5 мм
  const margin = opts.margin ?? 5;
  const kerf = kerfWidth(opts.tech, opts.thickness);
  // зазор между деталями: рез + технологический припуск
  const gap = Math.max(kerf + 2, 4);

  const fieldW = opts.sheet.w - margin * 2;
  const fieldH = opts.sheet.h - margin * 2;

  // разворачиваем в список экземпляров
  interface Inst extends NestPart {
    copy: number;
  }
  const instances: Inst[] = [];
  const oversized: string[] = [];

  for (const p of parts) {
    const fits =
      (p.w <= fieldW && p.h <= fieldH) ||
      (!p.noRotate && p.h <= fieldW && p.w <= fieldH);
    if (!fits) {
      oversized.push(p.name);
      continue;
    }
    for (let i = 0; i < Math.max(1, p.qty); i++) {
      instances.push({ ...p, copy: i + 1 });
    }
  }

  // сортировка по убыванию большей стороны — ключ к плотной укладке
  instances.sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h));

  const sheets: NestedSheet[] = [];
  let cur: { parts: PlacedPart[]; shelves: Shelf[]; nextY: number } | null = null;

  const openSheet = () => {
    cur = { parts: [], shelves: [], nextY: 0 };
  };

  const closeSheet = () => {
    if (!cur) return;
    const usedArea = cur.parts.reduce((s, p) => s + p.w * p.h, 0);
    // свободная полоса под последней полкой
    const freeH = fieldH - cur.nextY;
    const remnantArea = (freeH * fieldW) / 1e6;
    const usable =
      freeH >= REMNANT_MIN_SIDE &&
      fieldW >= REMNANT_MIN_SIDE &&
      remnantArea >= REMNANT_MIN_AREA;
    sheets.push({
      parts: cur.parts,
      usedArea,
      utilization: usedArea / (opts.sheet.w * opts.sheet.h),
      remnant: freeH > 0 ? { w: fieldW, h: freeH, area: remnantArea, usable } : null,
    });
    cur = null;
  };

  for (const inst of instances) {
    if (!cur) openSheet();
    let placed = false;

    // два варианта ориентации
    const orients: { w: number; h: number; rot: boolean }[] = inst.noRotate
      ? [{ w: inst.w, h: inst.h, rot: false }]
      : [
          { w: inst.w, h: inst.h, rot: false },
          { w: inst.h, h: inst.w, rot: true },
        ];

    // 1. пробуем существующие полки
    for (const shelf of cur!.shelves) {
      for (const o of orients) {
        if (o.h <= shelf.h && shelf.cursorX + o.w <= fieldW) {
          cur!.parts.push({
            id: inst.id,
            name: inst.name,
            x: margin + shelf.cursorX,
            y: margin + shelf.y,
            w: o.w,
            h: o.h,
            rotated: o.rot,
            copy: inst.copy,
          });
          shelf.cursorX += o.w + gap;
          placed = true;
          break;
        }
      }
      if (placed) break;
    }

    // 2. новая полка на текущем листе
    if (!placed) {
      // выбираем ориентацию с меньшей высотой полки, лишь бы влезла по ширине
      const cands = orients
        .filter((o) => o.w <= fieldW)
        .sort((a, b) => a.h - b.h);
      for (const o of cands) {
        if (cur!.nextY + o.h <= fieldH) {
          const shelf: Shelf = { y: cur!.nextY, h: o.h, cursorX: o.w + gap };
          cur!.shelves.push(shelf);
          cur!.parts.push({
            id: inst.id,
            name: inst.name,
            x: margin,
            y: margin + cur!.nextY,
            w: o.w,
            h: o.h,
            rotated: o.rot,
            copy: inst.copy,
          });
          cur!.nextY += o.h + gap;
          placed = true;
          break;
        }
      }
    }

    // 3. новый лист
    if (!placed) {
      closeSheet();
      openSheet();
      const o =
        orients.filter((x) => x.w <= fieldW && x.h <= fieldH).sort((a, b) => a.h - b.h)[0] ??
        orients[0];
      cur!.shelves.push({ y: 0, h: o.h, cursorX: o.w + gap });
      cur!.parts.push({
        id: inst.id,
        name: inst.name,
        x: margin,
        y: margin,
        w: o.w,
        h: o.h,
        rotated: o.rot,
        copy: inst.copy,
      });
      cur!.nextY = o.h + gap;
    }
  }
  closeSheet();

  const mat = MATERIALS[opts.material];
  const sheetAreaOne = (opts.sheet.w * opts.sheet.h) / 1e6;
  const sheetCount = sheets.length;
  const partArea = sheets.reduce((s, sh) => s + sh.usedArea, 0) / 1e6;
  const sheetArea = sheetAreaOne * sheetCount;
  const remnantArea = sheets.reduce(
    (s, sh) => s + (sh.remnant?.usable ? sh.remnant.area : 0),
    0
  );
  const wasteArea = Math.max(sheetArea - partArea - remnantArea, 0);

  const kgPerM2 = (opts.thickness / 1000) * mat.density;
  const grossMass = sheetArea * kgPerM2;
  const netMass = partArea * kgPerM2;

  const grossCost = grossMass * mat.pricePerKg;
  const estimateCost = netMass * 1.25 * mat.pricePerKg;
  const remnantCredit = remnantArea * kgPerM2 * SCRAP_RATES[opts.material];

  return {
    material: opts.material,
    thickness: opts.thickness,
    sheet: opts.sheet,
    kerf: Math.round(kerf * 100) / 100,
    margin,
    gap: Math.round(gap * 10) / 10,
    sheets,
    sheetCount,
    partArea: Math.round(partArea * 1000) / 1000,
    sheetArea: Math.round(sheetArea * 1000) / 1000,
    utilization: sheetArea > 0 ? partArea / sheetArea : 0,
    wasteArea: Math.round(wasteArea * 1000) / 1000,
    remnantArea: Math.round(remnantArea * 1000) / 1000,
    grossMass: Math.round(grossMass * 100) / 100,
    netMass: Math.round(netMass * 100) / 100,
    grossCost: Math.round(grossCost),
    estimateCost: Math.round(estimateCost),
    remnantCredit: Math.round(remnantCredit),
    oversized: Array.from(new Set(oversized)),
  };
}

/** Оценка качества раскроя — для подсказок в интерфейсе */
export function nestVerdict(u: number): { label: string; tone: "ok" | "warn" | "bad" } {
  if (u >= 0.75) return { label: "отличный раскрой", tone: "ok" };
  if (u >= 0.6) return { label: "нормальный раскрой", tone: "ok" };
  if (u >= 0.45) return { label: "много отхода", tone: "warn" };
  return { label: "раскрой невыгоден", tone: "bad" };
}

/**
 * Подбор формата листа.
 *
 * Критерий — стоимость металла, а не число листов: два листа 1500×6000 (18 м²)
 * обходятся дороже трёх листов 1500×3000 (13.5 м²), хотя «листов меньше».
 * Деловой остаток вычитается по цене лома — он возвращается на склад.
 */
export function bestSheet(
  parts: NestPart[],
  opts: { material: MaterialKey; thickness: number; tech: TechKey }
): { sheet: SheetFormat; result: NestResult; netCost: number }[] {
  return SHEETS.map((sheet) => {
    const result = nest(parts, { ...opts, sheet });
    return { sheet, result, netCost: result.grossCost - result.remnantCredit };
  })
    .filter((r) => r.result.sheetCount > 0 && r.result.oversized.length === 0)
    .sort((a, b) => {
      // разница до 2% считается несущественной — тогда берём плотнее раскрой
      const rel = Math.abs(a.netCost - b.netCost) / Math.max(a.netCost, b.netCost, 1);
      if (rel > 0.02) return a.netCost - b.netCost;
      return b.result.utilization - a.result.utilization;
    });
}
