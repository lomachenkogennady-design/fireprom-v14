import { NextResponse } from "next/server";
import { db } from "@/db";
import { products } from "@/db/schema-studio";
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
  if (typeof body.title === "string")       patch.title = body.title;
  if (typeof body.description === "string") patch.description = body.description;
  if (typeof body.category === "string")    patch.category = body.category;
  if (typeof body.unit === "string")        patch.unit = body.unit;
  if (body.priceFrom != null)               patch.priceFrom = Number(body.priceFrom) || 0;
  if (body.sortOrder != null)               patch.sortOrder = Number(body.sortOrder) || 100;
  if (typeof body.active === "boolean")     patch.active = body.active;
  if (Array.isArray(body.specs))            patch.specs = body.specs;

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "nothing to patch" }, { status: 400 });

  const [row] = await db.update(products).set(patch).where(eq(products.id, id)).returning();
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ product: row });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = Number((await params).id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const [row] = await db.delete(products).where(eq(products.id, id)).returning({ id: products.id });
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, id: row.id });
}
