import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bendingCalculations, clients } from "@/db/schema";
import { dbErrorResponse } from "@/lib/api";

export async function GET() {
  try {
    const rows = await db
      .select({
        id: bendingCalculations.id,
        name: bendingCalculations.name,
        material: bendingCalculations.material,
        thickness: bendingCalculations.thickness,
        width: bendingCalculations.width,
        payload: bendingCalculations.payload,
        results: bendingCalculations.results,
        createdAt: bendingCalculations.createdAt,
        clientName: clients.name,
      })
      .from(bendingCalculations)
      .leftJoin(clients, eq(bendingCalculations.clientId, clients.id))
      .orderBy(desc(bendingCalculations.createdAt))
      .limit(100);
    return NextResponse.json(rows);
  } catch (e) {
    return dbErrorResponse(e);
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.name || !body.payload || !body.results) {
    return NextResponse.json({ error: "Неполные данные расчёта" }, { status: 400 });
  }
  try {
    const [row] = await db
      .insert(bendingCalculations)
      .values({
        name: String(body.name),
        material: String(body.material ?? "steel"),
        thickness: Number(body.thickness) || 1,
        width: Number(body.width) || 100,
        clientId: body.clientId ? Number(body.clientId) : null,
        payload: body.payload,
        results: body.results,
      })
      .returning();
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    return dbErrorResponse(e);
  }
}
