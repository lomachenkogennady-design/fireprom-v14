import { MATERIALS, type MaterialKey } from "./materials";
import { BEND } from "./shop";

export interface BendSpec {
  /** угол гиба, градусы (90 = стандартный прямой угол) */
  angle: number;
  /** направление гиба: вверх / вниз */
  dir: 1 | -1;
}

export interface BendingInput {
  material: MaterialKey;
  /** толщина T, мм */
  thickness: number;
  /** ширина детали по оси гибки, мм */
  width: number;
  /** длины прямых участков (полок) между касательными точками гибов, шт = гибов + 1 */
  flanges: number[];
  bends: BendSpec[];
  /**
   * Раскрыв ручья наличной матрицы, мм. Если задан — расчёт идёт по реальной
   * оснастке цеха, а не по теоретическому подбору V = vFactor·s.
   */
  vDie?: number;
  /** радиус наконечника пуансона, мм: формируемый радиус не может быть меньше */
  punchRadius?: number;
  /**
   * Явный внутренний радиус, мм. Регламент цеха задаёт R = t, что отличается
   * от радиуса воздушной гибки (0.16·V). Совпадают около t = 2 мм.
   */
  radius?: number;
}

export interface BendResult extends BendSpec {
  /** Bend Allowance — длина нейтрального слоя в зоне гиба, мм */
  ba: number;
  /** Bend Deduction, мм */
  bd: number;
  /** Outside Setback, мм */
  ossb: number;
  /** позиция начала зоны гиба на развёртке от левого края, мм */
  position: number;
}

export interface BendingResult {
  kFactor: number;
  radius: number;
  vDie: number;
  minFlange: number;
  flatLength: number;
  weight: number;
  tonnagePerM: number;
  tonnageTotal: number;
  springback: string;
  warnings: string[];
  bends: BendResult[];
}

const rad = (deg: number) => (deg * Math.PI) / 180;

/** K-фактор по DIN 6935: таблица по отношению R/t */
const K_TABLE: [maxRt: number, k: number][] = [
  [0.5, 0.28],
  [1, 0.33],
  [1.5, 0.36],
  [2, 0.38],
  [3, 0.42],
  [4, 0.46],
  [5, 0.48],
  [Infinity, 0.5],
];

export function computeKFactor(radius: number, thickness: number): number {
  const rt = radius / Math.max(thickness, 0.01);
  for (const [maxRt, k] of K_TABLE) {
    if (rt < maxRt) return k;
  }
  return 0.5;
}

export interface Pt {
  x: number;
  y: number;
}

/** Осевые точки стороннего профиля (координаты в мм, y вверх) */
export function profilePoints(flanges: number[], bends: BendSpec[]): Pt[] {
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
  return pts;
}

/** Отверстие на развёртке (координаты от левого нижнего угла, мм) */
export interface HoleSpec {
  x: number;
  y: number;
  d: number;
}

export function computeBending(input: BendingInput): BendingResult {
  const mat = MATERIALS[input.material];
  const T = Math.max(input.thickness, 0.1);
  const vDie = input.vDie && input.vDie > 0 ? input.vDie : mat.vFactor * T;
  // при воздушной гибке радиус задаётся раскрывом, но не может быть острее наконечника
  const airRadius = Math.max(mat.rRatio * vDie, input.punchRadius ?? 0, 0.3);
  const radius =
    input.radius && input.radius > 0
      ? Math.max(input.radius, input.punchRadius ?? 0, 0.2)
      : airRadius;
  const k = computeKFactor(radius, T);
  // 0.7·V по оснастке, но не ниже регламентного минимума цеха (11 мм)
  const minFlange = Math.max(Math.round(vDie * 0.7 * 10) / 10, BEND.minFlange);

  const warnings: string[] = [];
  const bends: BendResult[] = [];

  let position = 0;
  input.bends.forEach((b, i) => {
    const a = Math.min(Math.max(b.angle, 5), 175);
    const ba = rad(a) * (radius + k * T);
    const ossb = (radius + T) * Math.tan(rad(a) / 2);
    const bd = 2 * ossb - ba;
    position += input.flanges[i] ?? 0;
    bends.push({ angle: a, dir: b.dir, ba, bd, ossb, position });
    position += ba;
  });

  const sumFlanges = input.flanges.reduce((s, f) => s + (f || 0), 0);
  const sumBa = bends.reduce((s, b) => s + b.ba, 0);
  const flatLength = sumFlanges + sumBa;

  input.flanges.forEach((f, i) => {
    if (f > 0 && f < minFlange) {
      warnings.push(
        `Полка №${i + 1} (${f} мм) короче минимальной (${minFlange} мм при V=${vDie}) — деталь провалится в матрицу`
      );
    }
  });

  // масса заготовки: площадь развёртки × толщина × плотность
  const weight =
    ((flatLength * input.width * T) / 1e9) * mat.density; // мм³ → м³ → кг

  // усилие воздушной гибки P = 650·T²/V (кН/м для σb≈450 МПа) × коэф. материала
  const tonnagePerM = ((650 * T * T) / vDie / 9.80665) * mat.forceFactor; // → тс/м
  const tonnageTotal = tonnagePerM * (input.width / 1000);

  return {
    kFactor: Math.round(k * 1000) / 1000,
    radius: Math.round(radius * 10) / 10,
    vDie,
    minFlange,
    flatLength: Math.round(flatLength * 100) / 100,
    weight: Math.round(weight * 1000) / 1000,
    tonnagePerM: Math.round(tonnagePerM * 10) / 10,
    tonnageTotal: Math.round(tonnageTotal * 10) / 10,
    springback: mat.springback,
    warnings,
    bends,
  };
}

/** Преобразование результата в структуру для сохранения в БД */
export function bendingResultsToJson(r: BendingResult) {
  return {
    flatLength: r.flatLength,
    kFactor: r.kFactor,
    radius: r.radius,
    vDie: r.vDie,
    minFlange: r.minFlange,
    weight: r.weight,
    tonnageTotal: r.tonnageTotal,
    bends: r.bends.map((b) => ({
      angle: b.angle,
      dir: b.dir,
      ba: Math.round(b.ba * 100) / 100,
      bd: Math.round(b.bd * 100) / 100,
      position: Math.round(b.position * 100) / 100,
    })),
  };
}
