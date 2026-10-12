// Сохранение заказа двери с pricing_snapshot и нормализованными
// фурнитурой/услугами. Всё в одной транзакции с аудитом.
import { db } from "@/db";
import {
  doorOrders,
  doorOrderHardware,
  doorOrderServices,
  auditLogs,
  catalogItems,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  computeDoorPrice,
  type DoorConfig,
  type CalcLine,
} from "./DoorPriceCalculator";

export class DoorOrderError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

export interface CreateDoorOrderInput {
  config: DoorConfig;
  customerName: string;
  quoteId?: number | null;
  quoteItemId?: number | null;
  note?: string | null;
  actorId?: string | null;
}

const PRICING_ENGINE_VERSION = "2026-10-12.1";
const PRICING_FORMAT_VERSION = "1.0";

function buildSnapshot(
  lines: CalcLine[],
  subtotal: number,
  pricingVersionId: number,
  config: DoorConfig,
) {
  return {
    format_version: PRICING_FORMAT_VERSION,
    pricing_engine_version: PRICING_ENGINE_VERSION,
    price_list_version_id: pricingVersionId,
    currency: "RUB",
    rounding: { vat: "half_up", total: "half_up" },
    configuration: {
      profile_catalog_id: config.profileCatalogId,
      filling_catalog_id: config.fillingCatalogId,
      external_finish_catalog_id: config.externalFinishCatalogId,
      internal_finish_catalog_id: config.internalFinishCatalogId,
      hardware_catalog_ids: config.hardwareCatalogIds,
      service_catalog_ids: config.serviceCatalogIds,
      door_width: config.doorWidth,
      door_height: config.doorHeight,
      hinge_count: config.hingeCount,
    },
    items: lines.map((l) => ({
      kind: l.kind,
      catalog_id: l.catalogId,
      name: l.name,
      qty: l.qty,
      unit: l.unit,
      price: l.price,
      sum: l.sum,
    })),
    subtotal,
    calculated_at: new Date().toISOString(),
  };
}

export async function createDoorOrder(input: CreateDoorOrderInput) {
  if (!input.customerName || input.customerName.trim().length === 0) {
    throw new DoorOrderError("customerName is required", "INVALID_CUSTOMER");
  }

  const calc = await computeDoorPrice(input.config);

  const vatRate = 22.0;
  const vatAmount = Math.round(calc.subtotal * vatRate) / 100;
  const totalPrice = Math.round((calc.subtotal + vatAmount) * 100) / 100;

  const snapshot = buildSnapshot(
    calc.lines,
    calc.subtotal,
    calc.pricingVersionId,
    input.config,
  );

  return await db.transaction(async (tx) => {
    const [order] = await tx
      .insert(doorOrders)
      .values({
        quoteId: input.quoteId ?? null,
        quoteItemId: input.quoteItemId ?? null,
        customerName: input.customerName.trim(),
        profileCatalogId: input.config.profileCatalogId,
        fillingCatalogId: input.config.fillingCatalogId,
        externalFinishCatalogId: input.config.externalFinishCatalogId,
        internalFinishCatalogId: input.config.internalFinishCatalogId,
        doorWidth: input.config.doorWidth,
        doorHeight: input.config.doorHeight,
        hingeCount: input.config.hingeCount,
        priceListVersionId: calc.pricingVersionId,
        pricingSnapshot: snapshot,
        subtotal: calc.subtotal.toFixed(2),
        vatRate: vatRate.toFixed(2),
        vatAmount: vatAmount.toFixed(2),
        totalPrice: totalPrice.toFixed(2),
        status: "draft",
        note: input.note ?? null,
        createdBy: input.actorId ?? null,
      })
      .returning();

    const hardwareLines = calc.lines.filter((l) => l.kind === "hardware");
    if (hardwareLines.length > 0) {
      await tx.insert(doorOrderHardware).values(
        hardwareLines.map((l) => ({
          orderId: order.id,
          hardwareCatalogId: l.catalogId,
          quantity: l.qty,
          priceAtOrder: l.price.toFixed(2),
        })),
      );
    }

    const serviceLines = calc.lines.filter((l) => l.kind === "service");
    if (serviceLines.length > 0) {
      await tx.insert(doorOrderServices).values(
        serviceLines.map((l) => ({
          orderId: order.id,
          serviceCatalogId: l.catalogId,
          priceAtOrder: l.price.toFixed(2),
        })),
      );
    }

    await tx.insert(auditLogs).values({
      userId: input.actorId ?? null,
      action: "create",
      entityType: "door_order",
      entityId: order.id,
      newValue: {
        customer: order.customerName,
        subtotal: calc.subtotal,
        total: totalPrice,
        pricingVersion: calc.pricingVersionId,
      },
    });

    return order;
  });
}

export async function getDoorOrder(orderId: number) {
  const [order] = await db
    .select()
    .from(doorOrders)
    .where(eq(doorOrders.id, orderId))
    .limit(1);

  if (!order) {
    throw new DoorOrderError(`door order ${orderId} not found`, "NOT_FOUND");
  }

  const hardware = await db
    .select({
      catalogId: doorOrderHardware.hardwareCatalogId,
      quantity: doorOrderHardware.quantity,
      priceAtOrder: doorOrderHardware.priceAtOrder,
      name: catalogItems.name,
      key: catalogItems.key,
    })
    .from(doorOrderHardware)
    .innerJoin(catalogItems, eq(catalogItems.id, doorOrderHardware.hardwareCatalogId))
    .where(eq(doorOrderHardware.orderId, orderId));

  const services = await db
    .select({
      catalogId: doorOrderServices.serviceCatalogId,
      priceAtOrder: doorOrderServices.priceAtOrder,
      name: catalogItems.name,
      key: catalogItems.key,
    })
    .from(doorOrderServices)
    .innerJoin(catalogItems, eq(catalogItems.id, doorOrderServices.serviceCatalogId))
    .where(eq(doorOrderServices.orderId, orderId));

  return { order, hardware, services };
}

export async function listDoorOrders(limit = 50) {
  const rows = await db
    .select({
      id: doorOrders.id,
      customerName: doorOrders.customerName,
      subtotal: doorOrders.subtotal,
      totalPrice: doorOrders.totalPrice,
      status: doorOrders.status,
      quoteId: doorOrders.quoteId,
      createdAt: doorOrders.createdAt,
    })
    .from(doorOrders)
    .limit(limit);
  return rows;
}
