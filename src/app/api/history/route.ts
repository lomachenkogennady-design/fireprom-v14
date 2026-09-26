import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bendingCalculations, quotes, clients } from "@/db/schema";
import { dbErrorResponse } from "@/lib/api";

export interface HistoryEntry {
  kind: "bending" | "quote";
  id: number;
  title: string;
  subtitle: string;
  href: string;
  createdAt: string;
}

export async function GET() {
  try {
    const [bends, qp] = await Promise.all([
      db
        .select({
          id: bendingCalculations.id,
          name: bendingCalculations.name,
          material: bendingCalculations.material,
          thickness: bendingCalculations.thickness,
          results: bendingCalculations.results,
          createdAt: bendingCalculations.createdAt,
          clientName: clients.name,
        })
        .from(bendingCalculations)
        .leftJoin(clients, eq(bendingCalculations.clientId, clients.id))
        .orderBy(desc(bendingCalculations.createdAt))
        .limit(12),
      db
        .select({
          id: quotes.id,
          number: quotes.number,
          total: quotes.total,
          createdAt: quotes.createdAt,
          clientName: clients.name,
        })
        .from(quotes)
        .leftJoin(clients, eq(quotes.clientId, clients.id))
        .orderBy(desc(quotes.createdAt))
        .limit(12),
    ]);

    const entries: HistoryEntry[] = [
      ...bends.map((b): HistoryEntry => {
        const r = (b.results ?? {}) as Record<string, unknown>;
        const flat = typeof r.flatLength === "number" ? r.flatLength : null;
        return {
          kind: "bending",
          id: b.id,
          title: b.name,
          subtitle: [
            `s=${b.thickness}`,
            flat ? `развёртка ${Math.round(flat)} мм` : null,
            b.clientName,
          ]
            .filter(Boolean)
            .join(" · "),
          href: `/bending?load=${b.id}`,
          createdAt: b.createdAt.toISOString(),
        };
      }),
      ...qp.map((q): HistoryEntry => ({
        kind: "quote",
        id: q.id,
        title: q.number,
        subtitle: [
          q.clientName ?? "без клиента",
          `${Math.round(q.total).toLocaleString("ru-RU")} ₽`,
        ].join(" · "),
        href: `/kp?load=${q.id}`,
        createdAt: q.createdAt.toISOString(),
      })),
    ];

    entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return NextResponse.json(entries.slice(0, 15));
  } catch (e) {
    return dbErrorResponse(e);
  }
}
