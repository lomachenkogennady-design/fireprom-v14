import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products } from "@/db/schema-studio";
import { eq, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** GET /api/products?category=doors&active=1 */
export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get("category");
  const onlyActive = req.nextUrl.searchParams.get("active") !== "0";

  const base = db.select().from(products);
  const rows = category
    ? await base.where(eq(products.category, category)).orderBy(asc(products.sortOrder))
    : await base.orderBy(asc(products.sortOrder));

  const filtered = onlyActive ? rows.filter((r) => r.active) : rows;
  return NextResponse.json({ products: filtered });
}

/** POST /api/products { slug, category, title, description, priceFrom, unit, specs } */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "title обязателен" }, { status: 400 });
  }
  const slug =
    String(body.slug ?? "").trim() ||
    title
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/[^a-zа-я0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) +
      "-" +
      Math.random().toString(36).slice(2, 6);

  const [row] = await db
    .insert(products)
    .values({
      slug,
      category: String(body.category ?? "doors"),
      title,
      description: String(body.description ?? ""),
      priceFrom: Number(body.priceFrom ?? 0) || 0,
      unit: String(body.unit ?? "шт"),
      specs: Array.isArray(body.specs) ? body.specs : [],
      active: body.active !== false,
      sortOrder: Number(body.sortOrder ?? 100) || 100,
    })
    .returning();

  return NextResponse.json({ product: row }, { status: 201 });
}
