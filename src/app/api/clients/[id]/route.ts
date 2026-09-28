import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clients } from "@/db/schema";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [row] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, Number(id)));
  if (!row) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const patch: Record<string, unknown> = {};

  if (body.name !== undefined) patch.name = String(body.name);
  if (body.contact !== undefined) patch.contact = body.contact ? String(body.contact) : null;
  if (body.phone !== undefined) patch.phone = body.phone ? String(body.phone) : null;
  if (body.email !== undefined) patch.email = body.email ? String(body.email) : null;
  if (body.inn !== undefined) patch.inn = body.inn ? String(body.inn) : null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Нечего обновлять" }, { status: 400 });
  }

  const [row] = await db
    .update(clients)
    .set(patch)
    .where(eq(clients.id, Number(id)))
    .returning();

  if (!row) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.delete(clients).where(eq(clients.id, Number(id)));
  return NextResponse.json({ ok: true });
}
