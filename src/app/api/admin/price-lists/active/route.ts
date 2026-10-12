import { NextResponse } from "next/server";
import {
  getActivePriceList,
  PriceListError,
} from "@/lib/pricing/price-list-service";

export async function GET() {
  try {
    const { version, items, activatedAt } = await getActivePriceList();
    return NextResponse.json({ version, items, activatedAt });
  } catch (e) {
    if (e instanceof PriceListError && e.code === "NO_ACTIVE_PRICE_LIST") {
      return NextResponse.json(
        { error: e.code, message: e.message },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "internal_error", message: String(e) },
      { status: 500 },
    );
  }
}
