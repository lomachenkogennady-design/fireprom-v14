// Калькулятор стоимости двери.
// Ищет цены в активном прайсе. Не сохраняет заказ — только считает.
import { getActivePriceList } from "@/lib/pricing/price-list-service";
import {
  doorProfiles,
  doorFillings,
  doorFinishes,
  doorHardware,
  doorServices,
  catalogItems,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { db } from "@/db";

export class DoorCalcError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

export interface DoorConfig {
  // Основные параметры
  profileCatalogId: number;
  fillingCatalogId: number;
  externalFinishCatalogId: number | null;
  internalFinishCatalogId: number | null;
  hardwareCatalogIds: number[];
  serviceCatalogIds: number[];

  // Габариты (мм)
  doorWidth: number;
  doorHeight: number;
  hingeCount: 2 | 3 | 4;
}

export interface PriceItem {
  catalogItemId: number;
  price: string;
  unit: string;
  type: string;
  name: string;
  key: string;
}

export interface CalcLine {
  kind: "profile" | "filling" | "external_finish" | "internal_finish" | "hardware" | "service";
  catalogId: number;
  name: string;
  qty: number;
  unit: string;
  price: number;
  sum: number;
}

export interface CalcResult {
  subtotal: number;         // без НДС, без скидки — скидка применяется на уровне КП
  lines: CalcLine[];
  perimeterMm: number;
  areaM2: number;
  pricingVersionId: number;
  calculatedAt: string;
}

// ─── Валидация ───────────────────────────────────────

export async function validateConfig(config: DoorConfig) {
  const [profile] = await db
    .select()
    .from(doorProfiles)
    .where(eq(doorProfiles.catalogItemId, config.profileCatalogId))
    .limit(1);

  if (!profile) {
    throw new DoorCalcError(
      `profile ${config.profileCatalogId} not found`,
      "PROFILE_NOT_FOUND",
    );
  }

  if (
    config.doorWidth < profile.minDoorWidth ||
    config.doorWidth > profile.maxDoorWidth
  ) {
    throw new DoorCalcError(
      `door_width ${config.doorWidth} out of profile range [${profile.minDoorWidth}..${profile.maxDoorWidth}]`,
      "WIDTH_OUT_OF_RANGE",
    );
  }

  if (
    config.doorHeight < profile.minDoorHeight ||
    config.doorHeight > profile.maxDoorHeight
  ) {
    throw new DoorCalcError(
      `door_height ${config.doorHeight} out of profile range [${profile.minDoorHeight}..${profile.maxDoorHeight}]`,
      "HEIGHT_OUT_OF_RANGE",
    );
  }

  if (![2, 3, 4].includes(config.hingeCount)) {
    throw new DoorCalcError(
      `hingeCount must be 2, 3 or 4, got ${config.hingeCount}`,
      "INVALID_HINGE_COUNT",
    );
  }

  if (config.hardwareCatalogIds.length === 0) {
    throw new DoorCalcError(
      "at least one hardware item is required",
      "NO_HARDWARE",
    );
  }

  return { profile };
}

// ─── Расчёт ──────────────────────────────────────────

function findPrice(
  items: Array<{ catalogItemId: number; price: string; unitOverride: string | null }>,
  catalogId: number,
): number | null {
  const found = items.find((i) => i.catalogItemId === catalogId);
  if (!found) return null;
  const n = Number(found.price);
  return Number.isFinite(n) ? n : null;
}

export async function computeDoorPrice(config: DoorConfig): Promise<CalcResult> {
  // 1. Валидация конфигурации
  await validateConfig(config);

  // 2. Активный прайс
  const { version, items: priceItems } = await getActivePriceList();
  if (!version || priceItems.length === 0) {
    throw new DoorCalcError(
      "active price list is empty",
      "EMPTY_PRICE_LIST",
    );
  }

  // 3. Метаданные всех позиций каталога (тип, единица, имя)
  const metaRows = await db
    .select({
      catalogId: catalogItems.id,
      key: catalogItems.key,
      name: catalogItems.name,
      type: catalogItems.type,
      unit: catalogItems.unit,
    })
    .from(catalogItems)
    .where(eq(catalogItems.isActive, true));

  const meta = new Map(metaRows.map((m) => [m.catalogId, m]));

  const lines: CalcLine[] = [];

  // ── 3.1 Профиль: периметр × цена за метр ──
  const perimeterMm = 2 * (config.doorWidth + config.doorHeight);
  const perimeterM = perimeterMm / 1000;

  const profilePrice = findPrice(priceItems, config.profileCatalogId);
  if (profilePrice == null) {
    throw new DoorCalcError(
      `profile ${config.profileCatalogId} has no price in active list`,
      "PRICE_MISSING",
    );
  }
  const profileMeta = meta.get(config.profileCatalogId);
  lines.push({
    kind: "profile",
    catalogId: config.profileCatalogId,
    name: profileMeta?.name ?? `#${config.profileCatalogId}`,
    qty: Math.round(perimeterM * 1000) / 1000,
    unit: "м",
    price: profilePrice,
    sum: Math.round(perimeterM * profilePrice * 100) / 100,
  });

  // ── 3.2 Наполнение: площадь × цена за м² ──
  const areaM2 = (config.doorWidth * config.doorHeight) / 1_000_000;
  const fillingPrice = findPrice(priceItems, config.fillingCatalogId);
  if (fillingPrice == null) {
    throw new DoorCalcError(
      `filling ${config.fillingCatalogId} has no price in active list`,
      "PRICE_MISSING",
    );
  }
  const fillingMeta = meta.get(config.fillingCatalogId);
  lines.push({
    kind: "filling",
    catalogId: config.fillingCatalogId,
    name: fillingMeta?.name ?? `#${config.fillingCatalogId}`,
    qty: Math.round(areaM2 * 1000) / 1000,
    unit: "м²",
    price: fillingPrice,
    sum: Math.round(areaM2 * fillingPrice * 100) / 100,
  });

  // ── 3.3 Отделки: если одинаковые — одна строка ×2, иначе две строки ──
  const extId = config.externalFinishCatalogId;
  const intId = config.internalFinishCatalogId;

  if (extId != null && intId != null && extId === intId) {
    const p = findPrice(priceItems, extId);
    if (p == null) {
      throw new DoorCalcError(
        `finish ${extId} has no price in active list`,
        "PRICE_MISSING",
      );
    }
    const m = meta.get(extId);
    lines.push({
      kind: "external_finish",
      catalogId: extId,
      name: (m?.name ?? `#${extId}`) + " (обе стороны)",
      qty: Math.round(areaM2 * 2 * 1000) / 1000,
      unit: "м²",
      price: p,
      sum: Math.round(areaM2 * 2 * p * 100) / 100,
    });
  } else {
    if (extId != null) {
      const p = findPrice(priceItems, extId);
      if (p == null) throw new DoorCalcError(`finish ${extId} has no price`, "PRICE_MISSING");
      const m = meta.get(extId);
      lines.push({
        kind: "external_finish",
        catalogId: extId,
        name: (m?.name ?? `#${extId}`) + " (наружная)",
        qty: Math.round(areaM2 * 1000) / 1000,
        unit: "м²",
        price: p,
        sum: Math.round(areaM2 * p * 100) / 100,
      });
    }
    if (intId != null) {
      const p = findPrice(priceItems, intId);
      if (p == null) throw new DoorCalcError(`finish ${intId} has no price`, "PRICE_MISSING");
      const m = meta.get(intId);
      lines.push({
        kind: "internal_finish",
        catalogId: intId,
        name: (m?.name ?? `#${intId}`) + " (внутренняя)",
        qty: Math.round(areaM2 * 1000) / 1000,
        unit: "м²",
        price: p,
        sum: Math.round(areaM2 * p * 100) / 100,
      });
    }
  }

  // ── 3.4 Фурнитура: петли × hingeCount, остальное × 1 ──
  for (const hwId of config.hardwareCatalogIds) {
    const p = findPrice(priceItems, hwId);
    if (p == null) {
      throw new DoorCalcError(`hardware ${hwId} has no price`, "PRICE_MISSING");
    }
    const m = meta.get(hwId);

    // Определяем тип: петля или нет — по таблице door_hardware
    const [hw] = await db
      .select({ hardwareType: doorHardware.hardwareType })
      .from(doorHardware)
      .where(eq(doorHardware.catalogItemId, hwId))
      .limit(1);

    const qty = hw?.hardwareType === "hinge" ? config.hingeCount : 1;
    lines.push({
      kind: "hardware",
      catalogId: hwId,
      name: m?.name ?? `#${hwId}`,
      qty,
      unit: "шт",
      price: p,
      sum: Math.round(qty * p * 100) / 100,
    });
  }

  // ── 3.5 Услуги: из price_list_items или из formula (free → 0) ──
  for (const svcId of config.serviceCatalogIds) {
    const m = meta.get(svcId);
    const p = findPrice(priceItems, svcId);

    // Если в прайсе нет цены — смотрим в formula door_services
    let price = p;
    if (price == null) {
      const [svc] = await db
        .select({ isFree: doorServices.isFree, formula: doorServices.formula })
        .from(doorServices)
        .where(eq(doorServices.catalogItemId, svcId))
        .limit(1);
      if (svc?.isFree) {
        price = 0;
      } else if (svc?.formula && typeof svc.formula === "object" && svc.formula !== null) {
        const f = svc.formula as { type?: string; price?: number };
        if (f.type === "fixed" && typeof f.price === "number") {
          price = f.price;
        }
      }
    }
    if (price == null) {
      throw new DoorCalcError(`service ${svcId} has no price`, "PRICE_MISSING");
    }

    lines.push({
      kind: "service",
      catalogId: svcId,
      name: m?.name ?? `#${svcId}`,
      qty: 1,
      unit: "шт",
      price,
      sum: Math.round(price * 100) / 100,
    });
  }

  // ── 4. Итог ──
  const subtotal = Math.round(
    lines.reduce((s, l) => s + l.sum, 0) * 100,
  ) / 100;

  return {
    subtotal,
    lines,
    perimeterMm,
    areaM2: Math.round(areaM2 * 1000) / 1000,
    pricingVersionId: version.id,
    calculatedAt: new Date().toISOString(),
  };
}
