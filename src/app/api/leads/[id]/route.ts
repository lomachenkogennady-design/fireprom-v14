import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { leadEvents, notifications } from "@/db/schema-studio";
import { eq, desc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** GET /api/leads/:id → { lead, events, notifications } */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = Number((await params).id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const [lead] = await db.select().from(leads).where(eq(leads.id, id));
  if (!lead) return NextResponse.json({ error: "not found" }, { status: 404 });

  const events = await db
    .select()
    .from(leadEvents)
    .where(eq(leadEvents.leadId, id))
    .orderBy(desc(leadEvents.createdAt))
    .limit(50);

  const notifs = await db
    .select()
    .from(notifications)
    .where(eq(notifications.leadId, id))
    .orderBy(desc(notifications.createdAt))
    .limit(20);

  return NextResponse.json({ lead, events, notifications: notifs });
}

/** PATCH /api/leads/:id — status, priority, amount, manager, note */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = Number((await params).id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const body = await req.json().catch(() => ({}));

  const patch: Record<string, unknown> = { updatedAt: sql`now()` };
  const log: string[] = [];

  if (typeof body.status === "string") {
    patch.status = body.status;
    log.push(`Статус → ${body.status}`);
  }
  if (typeof body.priority === "string") {
    patch.priority = body.priority;
    log.push(`Приоритет → ${body.priority}`);
  }
  if (body.amount !== undefined) {
    patch.amount = body.amount == null ? null : Number(body.amount);
    log.push(`Сумма → ${body.amount ?? "—"}`);
  }
  if (typeof body.manager === "string") {
    patch.manager = body.manager;
    log.push(`Менеджер → ${body.manager || "—"}`);
  }

  if (Object.keys(patch).length > 1) {
    await db.update(leads).set(patch).where(eq(leads.id, id));
  }

  if (log.length > 0) {
    await db.insert(leadEvents).values({
      leadId: id,
      type: "status",
      text: log.join(" · "),
      author: "менеджер",
    });
  }

  if (typeof body.note === "string" && body.note.trim()) {
    await db.insert(leadEvents).values({
      leadId: id,
      type: "note",
      text: body.note.trim(),
      author: "менеджер",
    });
  }

  const [fresh] = await db.select().from(leads).where(eq(leads.id, id));
  return NextResponse.json({ ok: true, lead: fresh });
}

/** DELETE /api/leads/:id */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = Number((await params).id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const [row] = await db.delete(leads).where(eq(leads.id, id)).returning({ id: leads.id });
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, id: row.id });
}
