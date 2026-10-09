import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { channels, notifications } from "@/db/schema-studio";
import { leads } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** GET /api/notifications?status=pending — очередь для Samsung-бота */
export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status") ?? "pending";
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 50), 200);

  const rows = await db
    .select({ notif: notifications, lead: leads, channel: channels })
    .from(notifications)
    .leftJoin(leads, eq(notifications.leadId, leads.id))
    .leftJoin(channels, eq(channels.kind, notifications.channel))
    .where(eq(notifications.status, status))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.notif.id,
      channel: r.notif.channel,
      target: r.notif.target,
      subject: r.notif.subject,
      text: r.notif.text,
      status: r.notif.status,
      error: r.notif.error,
      createdAt: r.notif.createdAt,
      lead: r.lead,
      channelTarget: r.channel?.target,
    })),
  });
}
