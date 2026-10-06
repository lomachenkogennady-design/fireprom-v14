import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { machineTasks } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const station = req.nextUrl.searchParams.get("station");
  if (!station) {
    return NextResponse.json({ error: "station required" }, { status: 400 });
  }
  const rows = await db
    .select().from(machineTasks)
    .where(eq(machineTasks.station, station))
    .orderBy(asc(machineTasks.createdAt));
  return NextResponse.json(rows);
}
