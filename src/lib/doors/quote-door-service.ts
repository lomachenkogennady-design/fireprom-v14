// Сервис: заказ двери как позиция КП, одной транзакцией.
// Создаёт quotes + quote_items (item_type=door) + door_orders + audit.
import { db } from "@/db";
import {
  quotes,
  quoteItems,
  doorOrders,
  doorOrderHardware,
  doorOrderServices,
  auditLogs,
} from "@/db/schema";
import { sql } from "drizzle-orm";
import { quoteNumber } from "@/lib/pricing";
import {
  computeDoorPrice,
  type DoorConfig,
  type CalcLine,
} from "./DoorPriceCalculator";

export class QuoteDoorError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

export interface CreateQuoteWithDoorInput {
  config: DoorConfig;
  customerName: string;
  clientId?: number | null;
  comment?: string | null;
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

export async function createQuoteWithDoor(input: CreateQuoteWithDoorInput) {
  if (!input.customerName || input.customerName.trim().length === 0) {
    throw new QuoteDoorError("customerName is required", "INVALID_CUSTOMER");
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
    // 1. Счётчик КП
    const [{ c }] = await tx
      .select({ c: sql<number>`count(*)::int` })
      .from(quotes);
    const number = quoteNumber((c ?? 0) + 1);

    // 2. quotes — subtotal БЕЗ НДС, total С НДС
    const [quote] = await tx
      .insert(quotes)
      .values({
        number,
        clientId: input.clientId ?? null,
        discountPct: "0.00",
        vatPct: vatRate.toFixed(2),
        comment: input.comment ?? null,
        subtotal: calc.subtotal.toFixed(2),
        total: totalPrice.toFixed(2),
      })
      .returning();

    // 3. quote_items — позиция типа "door"
    const doorName = `Дверь ${input.config.doorWidth}×${input.config.doorHeight} (${input.customerName.trim()})`;
    const [quoteItem] = await tx
      .insert(quoteItems)
      .values({
        quoteId: quote.id,
        name: doorName,
        material: "door",
        itemType: "door",
        tech: "door",
        thickness: 0,
        len: input.config.doorWidth,
        wid: input.config.doorHeight,
        qty: 1,
        bends: 0,
        cutLen: 0,
        pierces: 0,
        paint: false,
        unitPrice: calc.subtotal.toFixed(2),
        totalPrice: calc.subtotal.toFixed(2),
        breakdown: { door_order_id: null },
      })
      .returning();

    // 4. door_orders — с quote_id + quote_item_id
    const [order] = await tx
      .insert(doorOrders)
      .values({
        quoteId: quote.id,
        quoteItemId: quoteItem.id,
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
        createdBy: input.actorId ?? null,
      })
      .returning();

    // 5. hardware
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

    // 6. services
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

    // 7. Обновить breakdown у quote_items — теперь знаем order.id
    await tx
      .update(quoteItems)
      .set({ breakdown: { door_order_id: order.id } })
      .where(sql`${quoteItems.id} = ${quoteItem.id}`);

    // 8. audit
    await tx.insert(auditLogs).values({
      userId: input.actorId ?? null,
      action: "create",
      entityType: "door_order_with_quote",
      entityId: order.id,
      newValue: {
        quote_id: quote.id,
        quote_item_id: quoteItem.id,
        customer: order.customerName,
        subtotal: calc.subtotal,
        total: totalPrice,
      },
    });

    return { quote, quoteItem, order };
  });
}
