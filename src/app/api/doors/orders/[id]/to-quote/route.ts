import { NextResponse } from "next/server";
import {
  createQuoteFromExistingOrder,
  QuoteFromOrderError,
} from "@/lib/doors/quote-from-order-service";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const orderId = Number(id);
    if (!Number.isFinite(orderId) || orderId <= 0) {
      return NextResponse.json(
        { error: "INVALID_ID", message: "order id must be a positive number" },
        { status: 400 },
      );
    }

    const result = await createQuoteFromExistingOrder({ orderId });
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (e) {
    if (e instanceof QuoteFromOrderError) {
      const status = e.code === "ORDER_NOT_FOUND" ? 404 : 422;
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
