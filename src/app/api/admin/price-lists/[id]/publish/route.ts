import { NextResponse } from "next/server";
import {
  publishPriceList,
  PriceListError,
} from "@/lib/pricing/price-list-service";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const versionId = Number(id);
    if (!Number.isFinite(versionId) || versionId <= 0) {
      return NextResponse.json(
        { error: "invalid_id", message: "id must be a positive integer" },
        { status: 400 },
      );
    }
    const version = await publishPriceList(versionId, null, null);
    return NextResponse.json(version);
  } catch (e) {
    if (e instanceof PriceListError) {
      const status =
        e.code === "VERSION_NOT_FOUND" ? 404 :
        e.code === "ALREADY_PUBLISHED" ? 409 :
        e.code === "EMPTY_VERSION" ? 422 :
        422;
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
