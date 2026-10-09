import { NextResponse } from "next/server";
import { db } from "@/db";
import { channels, notifications } from "@/db/schema-studio";
import { leads } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = Number((await params).id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const status = String(body.status ?? "sent");
  const error = body.error ? String(body.error) : null;

  const [row] = await db
    .update(notifications)
    .set({ status, error })
    .where(eq(notifications.id, id))
    .returning();

  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (row.channel) {
    await db
      .update(channels)
      .set({
        lastStatus: status,
        lastError: error,
        lastSentAt: sql`now()`,
        sentCount: status === "sent" ? sql`${channels.sentCount} + 1` : channels.sentCount,
        failCount: status === "failed" ? sql`${channels.failCount} + 1` : channels.failCount,
      })
      .where(eq(channels.kind, row.channel));
  }

  if (row.leadId && status === "sent") {
    await db.update(leads).set({ notifiedAt: sql`now()` }).where(eq(leads.id, row.leadId));
  }

  return NextResponse.json({ ok: true, notification: row });
}
