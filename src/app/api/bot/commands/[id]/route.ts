import { NextResponse } from "next/server";
import { db } from "@/db";
import { botCommands } from "@/db/schema-studio";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = Number((await params).id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const body = await req.json().catch(() => ({}));

  const patch: Record<string, unknown> = {};
  if (typeof body.command === "string")      patch.command = body.command;
  if (body.button !== undefined)             patch.button = body.button ? String(body.button) : null;
  if (typeof body.title === "string")        patch.title = body.title;
  if (typeof body.reply === "string")        patch.reply = body.reply;
  if (typeof body.showPrices === "boolean")  patch.showPrices = body.showPrices;
  if (body.category !== undefined)           patch.category = body.category ? String(body.category) : null;
  if (typeof body.collectLead === "boolean") patch.collectLead = body.collectLead;
  if (typeof body.active === "boolean")      patch.active = body.active;
  if (body.sortOrder != null)                patch.sortOrder = Number(body.sortOrder) || 100;

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "nothing to patch" }, { status: 400 });

  const [row] = await db.update(botCommands).set(patch).where(eq(botCommands.id, id)).returning();
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ command: row });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = Number((await params).id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const [row] = await db.delete(botCommands).where(eq(botCommands.id, id)).returning({ id: botCommands.id });
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, id: row.id });
}
