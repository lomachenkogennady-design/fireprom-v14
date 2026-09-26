import { NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { quotes, quoteItems, clients } from "@/db/schema";
import { calcItem, calcQuote, quoteNumber, type TechKey } from "@/lib/pricing";
import type { MaterialKey } from "@/lib/materials";
import { dbErrorResponse } from "@/lib/api";

export async function GET() {
  try {
    const rows = await db
      .select({
        id: quotes.id,
        number: quotes.number,
        discountPct: quotes.discountPct,
        vatPct: quotes.vatPct,
        subtotal: quotes.subtotal,
        total: quotes.total,
        createdAt: quotes.createdAt,
        clientName: clients.name,
        itemCount: sql<number>`(select count(*) from ${quoteItems} where ${quoteItems.quoteId} = ${quotes.id})`,
      })
      .from(quotes)
      .leftJoin(clients, eq(quotes.clientId, clients.id))
      .orderBy(desc(quotes.createdAt))
      .limit(100);
    return NextResponse.json(rows);
  } catch (e) {
    return dbErrorResponse(e);
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  const rawItems: unknown[] = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0) {
    return NextResponse.json({ error: "В КП нет ни одной позиции" }, { status: 400 });
  }

  // Цены пересчитываются на сервере — клиентским суммам не доверяем.
  const items = rawItems.map((raw) => {
    const b = raw as Record<string, unknown>;
    return calcItem({
      name: String(b.name ?? "Деталь"),
      material: (b.material as MaterialKey) ?? "steel",
      tech: (b.tech as TechKey) ?? "laser",
      thickness: Number(b.thickness) || 1,
      len: Number(b.len) || 100,
      wid: Number(b.wid) || 100,
      qty: Math.max(1, Number(b.qty) || 1),
      bends: Math.max(0, Number(b.bends) || 0),
      cutLen: b.cutLen ? Number(b.cutLen) : null,
      pierces: b.pierces ? Number(b.pierces) : null,
      paint: Boolean(b.paint),
      scrap: Boolean(b.scrap),
    });
  });

  const discountPct = Math.min(Math.max(Number(body.discountPct) || 0, 0), 90);
  const vatPct = Math.min(Math.max(Number(body.vatPct) || 0, 0), 30);
  const totals = calcQuote(items, discountPct, vatPct);

  try {
    const result = await db.transaction(async (tx) => {
      const [{ c }] = await tx
        .select({ c: sql<number>`count(*)::int` })
        .from(quotes);
      const number = quoteNumber((c ?? 0) + 1);

      const [quote] = await tx
        .insert(quotes)
        .values({
          number,
          clientId: body.clientId ? Number(body.clientId) : null,
          discountPct,
          vatPct,
          comment: body.comment ? String(body.comment) : null,
          subtotal: totals.afterDiscount,
          total: totals.totalClient,
        })
        .returning();

      await tx.insert(quoteItems).values(
        items.map((i) => ({
          quoteId: quote.id,
          name: i.name,
          material: i.material,
          tech: i.tech,
          thickness: i.thickness,
          len: i.len,
          wid: i.wid,
          qty: i.qty,
          bends: i.bends,
          cutLen: i.effCutLen,
          pierces: i.effPierces,
          paint: i.paint,
          unitPrice: i.unitPrice,
          totalPrice: i.totalPrice,
          breakdown: {
            mass: i.mass,
            materialCost: i.materialCost,
            cutCost: i.cutCost,
            bendCost: i.bendCost,
            paintCost: i.paintCost,
            qtyFactor: i.qtyFactor,
            scrapCredit: i.scrapCredit,
            scrap: i.scrap,
          },
        }))
      );

      return quote;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return dbErrorResponse(e);
  }
}
