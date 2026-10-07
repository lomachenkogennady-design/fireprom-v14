import { NextResponse } from "next/server";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { leadEvents, notifications } from "@/db/schema-studio";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * POST /api/leads/:id/notify
 *
 * Заглушка уведомления. Реальную отправку делает Python-бот @Fireprombot
 * на Samsung (через SOCKS5) — он читает leads и сам шлёт в Telegram.
 * Здесь только фиксируем факт в журнале.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = Number((await params).id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const [lead] = await db.select().from(leads).where(eq(leads.id, id));
  if (!lead) return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });

  const text =
    `🔥 Новая заявка #${lead.number}\n` +
    `👤 ${lead.name ?? "—"}\n` +
    `📞 ${lead.phone ?? "—"}\n` +
    `🧩 ${lead.requestType ?? "—"}\n` +
    `💬 ${lead.message ?? "—"}\n` +
    `📍 Источник: ${lead.source}`;

  await db.insert(notifications).values({
    leadId: id,
    channel: "telegram",
    target: "manager",
    text,
    status: "simulated",
    error: "Отправка через Python-бот на Samsung",
  });

  await db.insert(leadEvents).values({
    leadId: id,
    type: "notify",
    text: "Уведомление менеджеру записано в журнал (отправка через Samsung)",
    author: "менеджер",
  });

  return NextResponse.json({ status: "simulated", text });
}
