import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bendingCalculations } from "@/db/schema";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [row] = await db
    .select()
    .from(bendingCalculations)
    .where(eq(bendingCalculations.id, Number(id)));
  if (!row) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db
    .delete(bendingCalculations)
    .where(eq(bendingCalculations.id, Number(id)));
  return NextResponse.json({ ok: true });
}
