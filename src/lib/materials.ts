/** Справочник материалов: общий для гибки и для КП */
export type MaterialKey =
  | "steel"
  | "stainless"
  | "aluminum"
  | "galvanized"
  | "copper"
  | "brass";

export interface MaterialSpec {
  key: MaterialKey;
  label: string;
  short: string;
  /** плотность, кг/м³ */
  density: number;
  /** закупочная цена листа, ₽/кг */
  pricePerKg: number;
  /** рекомендуемый раскрыв матрицы: V = vFactor * T */
  vFactor: number;
  /** внутренний радиус = rRatio * V (воздушная гибка) */
  rRatio: number;
  /** множитель усилия гибки относительно стали */
  forceFactor: number;
  /** пружинение */
  springback: string;
  /** цвет для 3D-превью */
  color3d: string;
}

export const MATERIALS: Record<MaterialKey, MaterialSpec> = {
  steel: {
    key: "steel",
    label: "Сталь Ст3 / 08кп",
    short: "Ст3",
    density: 7850,
    pricePerKg: 95,
    vFactor: 8,
    rRatio: 0.16,
    forceFactor: 1,
    springback: "низкое (1–2°)",
    color3d: "#9aa3b0",
  },
  stainless: {
    key: "stainless",
    label: "Нержавейка AISI 304",
    short: "304",
    density: 7900,
    pricePerKg: 480,
    vFactor: 10,
    rRatio: 0.17,
    forceFactor: 1.5,
    springback: "высокое (3–5°), гнуть с перегибом",
    color3d: "#cfd4dd",
  },
  aluminum: {
    key: "aluminum",
    label: "Алюминий АМг2",
    short: "АМг2",
    density: 2700,
    pricePerKg: 520,
    vFactor: 6,
    rRatio: 0.16,
    forceFactor: 0.55,
    springback: "среднее (2–3°)",
    color3d: "#d9dade",
  },
  galvanized: {
    key: "galvanized",
    label: "Оцинковка 08пс",
    short: "ОЦ",
    density: 7850,
    pricePerKg: 118,
    vFactor: 8,
    rRatio: 0.16,
    forceFactor: 1,
    springback: "низкое (1–2°)",
    color3d: "#aab4c0",
  },
  copper: {
    key: "copper",
    label: "Медь М1",
    short: "М1",
    density: 8900,
    pricePerKg: 1150,
    vFactor: 6,
    rRatio: 0.16,
    forceFactor: 0.75,
    springback: "среднее (2–4°)",
    color3d: "#c97e4e",
  },
  brass: {
    key: "brass",
    label: "Латунь Л63",
    short: "Л63",
    density: 8500,
    pricePerKg: 950,
    vFactor: 6,
    rRatio: 0.16,
    forceFactor: 0.8,
    springback: "низкое–среднее (1–3°)",
    color3d: "#cfa855",
  },
};

export const MATERIAL_KEYS = Object.keys(MATERIALS) as MaterialKey[];

export const THICKNESSES = [
  0.5, 0.7, 0.8, 1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12,
];
