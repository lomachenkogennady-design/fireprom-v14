import { NextResponse } from "next/server";
import {
  listPriceListVersions,
  createPriceListVersion,
  PriceListError,
} from "@/lib/pricing/price-list-service";
import { db } from "@/db";
import { priceListActive } from "@/db/schema";

export async function GET() {
  try {
    const versions = await listPriceListVersions();
    const [active] = await db.select().from(priceListActive).limit(1);
    return NextResponse.json({
      versions,
      activeVersionId: active?.versionId ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "internal_error", message: String(e) },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const name = String(body.name ?? "").trim();
    const comment = body.comment ? String(body.comment) : null;
    const rawItems = Array.isArray(body.items) ? body.items : [];

    const items = rawItems.map((raw: unknown) => {
      const r = raw as Record<string, unknown>;
      const priceStr = String(r.price ?? "0");
      const priceNum = Number(priceStr);
      if (!Number.isFinite(priceNum) || priceNum < 0) {
        throw new PriceListError(
          `invalid price: ${priceStr}`,
          "INVALID_PRICE",
        );
      }
      return {
        catalogItemId: Number(r.catalogItemId),
        price: priceNum,
        unitOverride: r.unitOverride ? String(r.unitOverride) : null,
      };
    });

    const version = await createPriceListVersion({
      name,
      comment,
      items,
      actorId: null,
    });

    return NextResponse.json(version, { status: 201 });
  } catch (e) {
    if (e instanceof PriceListError) {
      const status = e.code === "MISSING_CATALOG_ITEMS" ? 400 : 422;
      return NextResponse.json(
        { error: e.code, message: e.message },
        { status },
      );
    }
    return NextResponse.json(
      { error: "internal_error", message: String(e) },
      { status: 500 },
    );
  }
}
