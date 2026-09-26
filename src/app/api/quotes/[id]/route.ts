import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { quotes, quoteItems, clients } from "@/db/schema";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [quote] = await db
    .select({
      id: quotes.id,
      number: quotes.number,
      clientId: quotes.clientId,
      discountPct: quotes.discountPct,
      vatPct: quotes.vatPct,
      comment: quotes.comment,
      subtotal: quotes.subtotal,
      total: quotes.total,
      createdAt: quotes.createdAt,
      clientName: clients.name,
    })
    .from(quotes)
    .leftJoin(clients, eq(quotes.clientId, clients.id))
    .where(eq(quotes.id, Number(id)));

  if (!quote) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

  const items = await db
    .select()
    .from(quoteItems)
    .where(eq(quoteItems.quoteId, quote.id))
    .orderBy(asc(quoteItems.id));

  return NextResponse.json({ ...quote, items });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.delete(quotes).where(eq(quotes.id, Number(id)));
  return NextResponse.json({ ok: true });
}
