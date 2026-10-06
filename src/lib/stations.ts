import type { ThemeKey } from "./theme";

export type StationKey = "laser" | "press" | "weld" | "paint" | "pack";

export interface StationSpec {
  key: StationKey;
  machineId: string;
  title: string;
  subtitle: string;
  metaFields?: { key: string; label: string; unit?: string }[];
  scrapLabel?: string;
}

export const STATIONS: Record<StationKey, StationSpec> = {
  laser: {
    key: "laser", machineId: "laser-01",
    title: "Лазер 01", subtitle: "Раскрой листа",
    metaFields: [
      { key: "material",  label: "Материал" },
      { key: "thickness", label: "Толщина", unit: "мм" },
      { key: "cutLen",    label: "Рез",     unit: "мм" },
    ],
  },
  press: {
    key: "press", machineId: "press-01",
    title: "Пресс 01", subtitle: "Гибка",
    metaFields: [
      { key: "tonnage", label: "Усилие", unit: "т" },
      { key: "bends",   label: "Гибов",  unit: "шт" },
      { key: "vDie",    label: "Матрица V" },
    ],
  },
  weld: {
    key: "weld", machineId: "weld-01",
    title: "Сварка 01", subtitle: "MIG/TIG",
    metaFields: [
      { key: "seamLen", label: "Шов", unit: "мм" },
      { key: "wire",    label: "Проволока" },
    ],
  },
  paint: {
    key: "paint", machineId: "paint-01",
    title: "Покраска", subtitle: "Порошок / жидкость",
    metaFields: [
      { key: "ral",     label: "RAL" },
      { key: "coating", label: "Тип" },
    ],
  },
  pack: {
    key: "pack", machineId: "pack-01",
    title: "Упаковка", subtitle: "Отгрузка",
    metaFields: [
      { key: "places", label: "Мест", unit: "шт" },
      { key: "weight", label: "Вес",  unit: "кг" },
    ],
    scrapLabel: "БОЙ",
  },
};

export type { ThemeKey };
