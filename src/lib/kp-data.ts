import { db } from "@/db";
import { quotes, quoteItems, clients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { COMPANY } from "./company";
import type { KpData, KpItem } from "./kp-pdf";

/**
 * Маппер: строки quotes + quote_items + clients → KpData для PDF-рендера.
 *
 * Единственное место, где колонки БД встречаются с полями PDF.
 * Если схема БД изменится — правится только эта функция.
 *
 * Особенности нашей схемы:
 *  • customer вычисляется из clients.name + clients.inn (у нас FK, не текст)
 *  • unit у нас нет — ставим "шт" (для услуг — "усл", по слову в name)
 *  • validUntil у нас нет — оставляем undefined
 *  • note → comment
 */

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

/** Услуги (доставка, монтаж) — единица "усл", остальное "шт" */
function guessUnit(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("доставка") || n.includes("монтаж") || n.includes("услуг")) {
    return "усл";
  }
  return "шт";
}

export async function loadKpData(id: number): Promise<KpData | null> {
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, id));
  if (!quote) return null;

  const items = await db
    .select()
    .from(quoteItems)
    .where(eq(quoteItems.quoteId, id));
  if (items.length === 0) return null;

  // Заказчик: имя + ИНН из клиента
  let customer = "—";
  if (quote.clientId) {
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, quote.clientId));
    if (client) {
      customer = client.name;
      if (client.inn) customer += `, ИНН ${client.inn}`;
    }
  }

  const kpItems: KpItem[] = items.map((it) => ({
    name: it.name,
    qty: it.qty,
    unit: guessUnit(it.name),
    price: it.unitPrice,
  }));

  // Контроль: рендер должен сойтись с сохранённым total.
  // Порог 1 руб — в quote-builder округление до целого.
  const grossSum = kpItems.reduce((s, i) => s + i.qty * i.price, 0);
  const discountPct = quote.discountPct ?? 0;
  const vatRate = quote.vatPct || 22;
  const computed =
    ((grossSum * (100 - discountPct)) / 100) * (1 + vatRate / 100);
  if (quote.total != null && Math.abs(computed - Number(quote.total)) > 1) {
    console.warn(
      `[kp-data] КП ${id}: PDF ${computed.toFixed(2)} ≠ total ${quote.total}`,
    );
  }

  return {
    number: quote.number,
    date: fmtDate(quote.createdAt),
    company: {
      name: COMPANY.name,
      inn: COMPANY.tax.inn,
      phone: COMPANY.contacts.phone,
      email: COMPANY.contacts.email,
    },
    customer,
    items: kpItems,
    discountPct,
    // vatPct хранится в БД как real (0 = ещё не задан) — тогда дефолт 22
    vatRate,
    note: quote.comment ?? undefined,
    manager: COMPANY.signatory.short,
  };
}
