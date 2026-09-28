import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { cuttingCalculations, clients } from "@/db/schema";
import { dbErrorResponse } from "@/lib/api";

export async function GET() {
  try {
    const rows = await db
      .select({
        id: cuttingCalculations.id,
        name: cuttingCalculations.name,
        material: cuttingCalculations.material,
        thickness: cuttingCalculations.thickness,
        tech: cuttingCalculations.tech,
        payload: cuttingCalculations.payload,
        results: cuttingCalculations.results,
        createdAt: cuttingCalculations.createdAt,
        clientName: clients.name,
      })
      .from(cuttingCalculations)
      .leftJoin(clients, eq(cuttingCalculations.clientId, clients.id))
      .orderBy(desc(cuttingCalculations.createdAt))
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
      .insert(cuttingCalculations)
      .values({
        name: String(body.name),
        material: String(body.material ?? "steel"),
        thickness: Number(body.thickness) || 1,
        tech: String(body.tech ?? "laser"),
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
