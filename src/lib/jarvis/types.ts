import type { MaterialKey } from "@/lib/materials";
import type { TechKey } from "@/lib/pricing";

/** Снимок живого состояния модуля — то, что Jarvis «видит» на экране */

export interface MachineSnapshot {
  model: string;
  status: "ok" | "warn" | "fail";
  dieLabel: string;
  daylight: number;
  checks: {
    id: string;
    label: string;
    status: "ok" | "warn" | "fail";
    value: string;
    limit: string;
    detail: string;
  }[];
}

export interface BendingSnapshot {
  kind: "bending";
  name: string;
  /** результат проверки на прессе цеха */
  machine?: MachineSnapshot;
  material: MaterialKey;
  thickness: number;
  width: number;
  flanges: number[];
  bends: { angle: number; dir: 1 | -1 }[];
  holes: { x: number; y: number; d: number }[];
  results: {
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
    bends: { angle: number; dir: 1 | -1; ba: number; bd: number; ossb: number; position: number }[];
  };
}

export interface QuoteSnapshotItem {
  name: string;
  material: MaterialKey;
  tech: TechKey;
  thickness: number;
  len: number;
  wid: number;
  qty: number;
  bends: number;
  paint: boolean;
  scrap: boolean;
  mass: number;
  materialCost: number;
  cutCost: number;
  bendCost: number;
  paintCost: number;
  qtyFactor: number;
  scrapCredit: number;
  unitPrice: number;
  totalPrice: number;
}

/** Сводка раскроя по группе «материал + толщина» */
export interface NestSnapshot {
  material: MaterialKey;
  thickness: number;
  sheetLabel: string;
  sheetCount: number;
  utilization: number;
  grossMass: number;
  netMass: number;
  grossCost: number;
  estimateCost: number;
  wasteArea: number;
  remnantArea: number;
  remnantCredit: number;
  oversized: string[];
}

export interface QuoteSnapshot {
  kind: "quote";
  clientName: string | null;
  discountPct: number;
  vatPct: number;
  nesting: NestSnapshot[];
  items: QuoteSnapshotItem[];
  totals: {
    subtotal: number;
    discount: number;
    vat: number;
    total: number;
    totalClient: number;
    minOrderApplied: boolean;
    totalMass: number;
  };
}

export interface IdleSnapshot {
  kind: "idle";
  page: string;
}

export type JarvisSnapshot = BendingSnapshot | QuoteSnapshot | IdleSnapshot;

export interface JarvisMessage {
  role: "user" | "assistant";
  content: string;
  /** откуда пришёл ответ: расчёт / языковая модель / заглушка */
  source?: "expert" | "llm" | "fallback";
}
