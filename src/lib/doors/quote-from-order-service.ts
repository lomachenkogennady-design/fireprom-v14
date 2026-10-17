// Сервис: прикрепить существующий door_order к новому КП.
// Создаёт quotes + quote_items (item_type=door), обновляет door_orders.quote_id/quote_item_id.
// Идемпотентно: если у заказа уже есть quote_id — возвращает существующий КП.
import { db } from "@/db";
import { quotes, quoteItems, doorOrders, auditLogs } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { quoteNumber } from "@/lib/pricing";

export class QuoteFromOrderError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

export interface CreateQuoteFromOrderInput {
  orderId: number;
  actorId?: string | null;
}

export interface CreateQuoteFromOrderResult {
  quoteId: number;
  quoteItemId: number;
  created: boolean;
}

export async function createQuoteFromExistingOrder(
  input: CreateQuoteFromOrderInput,
): Promise<CreateQuoteFromOrderResult> {
  const { orderId, actorId = null } = input;

  return await db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(doorOrders)
      .where(eq(doorOrders.id, orderId))
      .limit(1);

    if (!order) {
      throw new QuoteFromOrderError(
        "door_order " + orderId + " not found",
        "ORDER_NOT_FOUND",
      );
    }

    if (order.quoteId && order.quoteItemId) {
      return {
        quoteId: order.quoteId,
        quoteItemId: order.quoteItemId,
        created: false,
      };
    }

    const [{ c }] = await tx
      .select({ c: sql<number>`count(*)::int` })
      .from(quotes);
    const number = quoteNumber((c ?? 0) + 1);

    const [quote] = await tx
      .insert(quotes)
      .values({
        number,
        clientId: null,
        discountPct: "0.00",
        vatPct: order.vatRate,
        comment: "Из заказа №" + order.id,
        subtotal: order.subtotal,
        total: order.totalPrice,
      })
      .returning();

    const doorName = "Дверь " + order.doorWidth + "×" + order.doorHeight + " (" + order.customerName + ")";
    const [quoteItem] = await tx
      .insert(quoteItems)
      .values({
        quoteId: quote.id,
        name: doorName,
        material: "door",
        itemType: "door",
        tech: "door",
        thickness: 0,
        len: order.doorWidth,
        wid: order.doorHeight,
        qty: 1,
        bends: 0,
        cutLen: 0,
        pierces: 0,
        paint: false,
        unitPrice: order.subtotal,
        totalPrice: order.subtotal,
        breakdown: { door_order_id: order.id },
      })
      .returning();

    await tx
      .update(doorOrders)
      .set({ quoteId: quote.id, quoteItemId: quoteItem.id })
      .where(eq(doorOrders.id, order.id));

    await tx.insert(auditLogs).values({
      userId: actorId,
      action: "attach_to_quote",
      entityType: "door_order",
      entityId: order.id,
      newValue: {
        quote_id: quote.id,
        quote_item_id: quoteItem.id,
        customer: order.customerName,
        subtotal: Number(order.subtotal),
        total: Number(order.totalPrice),
      },
    });

    return {
      quoteId: quote.id,
      quoteItemId: quoteItem.id,
      created: true,
    };
  });
}
