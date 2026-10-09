import { NextRequest, NextResponse } from "next/server";
import { ingestMail } from "@/lib/email-intake";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/email/inbound — приём письма от внешнего поллера (Samsung inbox.py)
 * Тело: { from, fromName?, subject?, text, messageId? }
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const from = typeof body.from === "string" ? body.from.trim() : "";
  const text =
    typeof body.text === "string" ? body.text :
    typeof body.body === "string" ? body.body : "";

  if (!from) {
    return NextResponse.json({ error: "Нужно поле from" }, { status: 400 });
  }

  const result = await ingestMail({
    from,
    fromName: typeof body.fromName === "string" ? body.fromName : null,
    subject: typeof body.subject === "string" ? body.subject : null,
    text,
    messageId: typeof body.messageId === "string" ? body.messageId : null,
  });

  return NextResponse.json(result, { status: result.skipped ? 200 : 201 });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    hint: "POST { from, fromName?, subject?, text, messageId? } для приёма письма",
  });
}
