import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clients } from "@/db/schema";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isFinite(numId)) {
    return NextResponse.json({ error: "Неверный id" }, { status: 400 });
  }
  const [row] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, numId))
    .limit(1);
  if (!row) {
    return NextResponse.json({ error: "Клиент не найден" }, { status: 404 });
  }
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
