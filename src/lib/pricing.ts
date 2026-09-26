import { MATERIALS, type MaterialKey } from "./materials";

/** ---------- Технологии резки ---------- */
export type TechKey = "laser" | "plasma" | "waterjet";

export const TECH: Record<
  TechKey,
  { label: string; short: string; factor: number; pierceFactor: number; minT: number }
> = {
  laser: { label: "Лазерная резка", short: "Лазер", factor: 1, pierceFactor: 1, minT: 0.5 },
  plasma: { label: "Плазменная резка", short: "Плазма", factor: 0.55, pierceFactor: 0.8, minT: 3 },
  waterjet: {
    label: "Гидроабразивная резка",
    short: "ГАР",
    factor: 2.9,
    pierceFactor: 2.2,
    minT: 0.5,
  },
};

export const TECH_KEYS = Object.keys(TECH) as TechKey[];

/** Тариф лазерной резки ₽/м по толщине (включительно до maxT), ₽/м */
type RateRow = { maxT: number } & Record<MaterialKey, number>;

const RATES: RateRow[] = [
  { maxT: 1, steel: 30, stainless: 45, aluminum: 48, galvanized: 32, copper: 95, brass: 85 },
  { maxT: 2, steel: 38, stainless: 58, aluminum: 62, galvanized: 40, copper: 120, brass: 110 },
  { maxT: 3, steel: 48, stainless: 75, aluminum: 85, galvanized: 52, copper: 150, brass: 135 },
  { maxT: 4, steel: 60, stainless: 95, aluminum: 110, galvanized: 65, copper: 190, brass: 170 },
  { maxT: 5, steel: 75, stainless: 120, aluminum: 140, galvanized: 80, copper: 225, brass: 200 },
  { maxT: 6, steel: 90, stainless: 145, aluminum: 170, galvanized: 95, copper: 260, brass: 235 },
  { maxT: 8, steel: 125, stainless: 210, aluminum: 250, galvanized: 130, copper: 340, brass: 300 },
  { maxT: 10, steel: 165, stainless: 280, aluminum: 340, galvanized: 170, copper: 420, brass: 380 },
  { maxT: 12, steel: 210, stainless: 350, aluminum: 440, galvanized: 215, copper: 520, brass: 480 },
];

/** Цена врезки ₽/шт (лазер) по материалу */
const PIERCE_RATES: Record<MaterialKey, number> = {
  steel: 2,
  stainless: 3,
  aluminum: 3,
  galvanized: 2,
  copper: 6,
  brass: 5,
};

/** Зачёт делового остатка — цена лома, ₽/кг */
export const SCRAP_RATES: Record<MaterialKey, number> = {
  steel: 18,
  stainless: 80,
  aluminum: 95,
  galvanized: 18,
  copper: 560,
  brass: 460,
};

/** Цена одного гиба ₽ (до 1000 мм длины, дальше ×1.5) */
const BEND_RATES: { maxT: number; price: number }[] = [
  { maxT: 1, price: 60 },
  { maxT: 2, price: 70 },
  { maxT: 3, price: 90 },
  { maxT: 4, price: 110 },
  { maxT: 6, price: 140 },
  { maxT: 8, price: 190 },
  { maxT: 10, price: 250 },
  { maxT: 12, price: 320 },
];

/** Серийные коэффициенты к обработке (не к металлу) */
export const VOLUME_TIERS: { minQty: number; factor: number }[] = [
  { minQty: 100, factor: 0.72 },
  { minQty: 50, factor: 0.8 },
  { minQty: 20, factor: 0.9 },
];

/** порошковая покраска, ₽/м² (двусторонняя) */
export const PAINT_RATE = 950;
/** коэффициент отхода при раскрое */
export const WASTE_FACTOR = 1.25;
/** минимальная стоимость заказа, ₽ */
export const MIN_ORDER = 1000;

export function laserRate(material: MaterialKey, thickness: number): number {
  const row = RATES.find((r) => thickness <= r.maxT) ?? RATES[RATES.length - 1];
  return row[material];
}

export function cutRate(material: MaterialKey, thickness: number, tech: TechKey): number {
  return laserRate(material, thickness) * TECH[tech].factor;
}

export function pierceRate(material: MaterialKey, tech: TechKey): number {
  return PIERCE_RATES[material] * TECH[tech].pierceFactor;
}

export function bendRate(thickness: number, width: number): number {
  const row =
    BEND_RATES.find((r) => thickness <= r.maxT) ?? BEND_RATES[BEND_RATES.length - 1];
  return row.price * (width > 1000 ? 1.5 : 1);
}

export function volumeFactor(qty: number): number {
  for (const t of VOLUME_TIERS) {
    if (qty >= t.minQty) return t.factor;
  }
  return 1;
}

export interface QuoteItemInput {
  name: string;
  material: MaterialKey;
  tech: TechKey;
  thickness: number;
  /** габарит детали, мм */
  len: number;
  wid: number;
  qty: number;
  bends: number;
  /** длина реза, м — если не задана, считается от периметра */
  cutLen: number | null;
  /** врезки — если не заданы, оцениваются */
  pierces: number | null;
  paint: boolean;
  /** зачёт делового остатка по цене лома */
  scrap: boolean;
}

export interface QuoteItemCalc extends QuoteItemInput {
  area: number;
  mass: number;
  autoCutLen: number;
  autoPierces: number;
  effCutLen: number;
  effPierces: number;
  ratePerM: number;
  materialCost: number;
  cutCost: number;
  bendCost: number;
  paintCost: number;
  qtyFactor: number;
  scrapCredit: number;
  unitPrice: number;
  totalPrice: number;
  techError: string | null;
}

export function calcItem(input: QuoteItemInput): QuoteItemCalc {
  const mat = MATERIALS[input.material];
  const tech = TECH[input.tech] ?? TECH.laser;
  const area = (input.len * input.wid) / 1e6; // м²
  const mass = area * input.thickness * (mat.density / 1000); // кг
  const perimeter = (2 * (input.len + input.wid)) / 1000; // м
  // внутренние контуры/заводские допуски — ×1.35 к периметру
  const autoCutLen = Math.max(Math.round(perimeter * 1.35 * 100) / 100, 0.1);
  const autoPierces = Math.ceil((autoCutLen * 1000) / 400) + 4;

  const effCutLen = input.cutLen && input.cutLen > 0 ? input.cutLen : autoCutLen;
  const effPierces = input.pierces && input.pierces > 0 ? input.pierces : autoPierces;

  const ratePerM = cutRate(input.material, input.thickness, input.tech);
  const materialCost = mass * WASTE_FACTOR * mat.pricePerKg;
  const cutCost = effCutLen * ratePerM + effPierces * pierceRate(input.material, input.tech);
  const bendCost = input.bends * bendRate(input.thickness, Math.max(input.len, input.wid));
  const paintCost = input.paint ? area * 2 * PAINT_RATE : 0;

  // серийный коэффициент — только на обработку
  const qtyFactor = volumeFactor(input.qty);
  const processing = (cutCost + bendCost + paintCost) * qtyFactor;

  // зачёт делового остатка: отход раскроя × цена лома
  const scrapCredit = input.scrap
    ? mass * (WASTE_FACTOR - 1) * SCRAP_RATES[input.material]
    : 0;

  const unitPrice = Math.max(Math.round(materialCost + processing - scrapCredit), 0);
  const totalPrice = unitPrice * Math.max(input.qty, 1);

  const techError =
    input.tech !== "laser" && input.thickness < tech.minT
      ? `${tech.short}: минимальная толщина ${tech.minT} мм — применён тариф лазера`
      : null;

  return {
    ...input,
    area,
    mass: Math.round(mass * 1000) / 1000,
    autoCutLen,
    autoPierces,
    effCutLen,
    effPierces,
    ratePerM: Math.round(ratePerM * 10) / 10,
    materialCost: Math.round(materialCost),
    cutCost: Math.round(cutCost),
    bendCost: Math.round(bendCost),
    paintCost: Math.round(paintCost),
    qtyFactor,
    scrapCredit: Math.round(scrapCredit),
    unitPrice,
    totalPrice,
    techError,
  };
}

export interface QuoteTotals {
  subtotal: number;
  discount: number;
  afterDiscount: number;
  vat: number;
  total: number;
  /** с учётом минимальной стоимости заказа */
  totalClient: number;
  minOrderApplied: boolean;
  totalMass: number;
}

export function calcQuote(
  items: QuoteItemCalc[],
  discountPct: number,
  vatPct: number
): QuoteTotals {
  const subtotal = items.reduce((s, i) => s + i.totalPrice, 0);
  const discount = Math.round((subtotal * discountPct) / 100);
  const afterDiscount = subtotal - discount;
  const vat = Math.round((afterDiscount * vatPct) / 100);
  const total = afterDiscount + vat;
  const minOrderApplied = subtotal > 0 && total < MIN_ORDER;
  const totalClient = minOrderApplied ? MIN_ORDER : total;
  const totalMass = items.reduce((s, i) => s + i.mass * i.qty, 0);
  return {
    subtotal,
    discount,
    afterDiscount,
    vat,
    total,
    totalClient,
    minOrderApplied,
    totalMass: Math.round(totalMass * 10) / 10,
  };
}

/** Автономер КП: КП-260214-03 */
export function quoteNumber(seq: number, date = new Date()): string {
  const yy = String(date.getFullYear()).slice(2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `КП-${yy}${mm}${dd}-${String(seq).padStart(2, "0")}`;
}
