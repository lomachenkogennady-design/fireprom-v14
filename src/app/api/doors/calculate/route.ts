import { NextResponse } from "next/server";
import {
  computeDoorPrice,
  DoorCalcError,
  type DoorConfig,
} from "@/lib/doors/DoorPriceCalculator";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const config: DoorConfig = {
      profileCatalogId: Number(body.profileCatalogId),
      fillingCatalogId: Number(body.fillingCatalogId),
      externalFinishCatalogId: body.externalFinishCatalogId
        ? Number(body.externalFinishCatalogId)
        : null,
      internalFinishCatalogId: body.internalFinishCatalogId
        ? Number(body.internalFinishCatalogId)
        : null,
      hardwareCatalogIds: Array.isArray(body.hardwareCatalogIds)
        ? body.hardwareCatalogIds.map(Number)
        : [],
      serviceCatalogIds: Array.isArray(body.serviceCatalogIds)
        ? body.serviceCatalogIds.map(Number)
        : [],
      doorWidth: Number(body.doorWidth),
      doorHeight: Number(body.doorHeight),
      hingeCount: Number(body.hingeCount) as 2 | 3 | 4,
    };

    if (
      !Number.isFinite(config.profileCatalogId) ||
      !Number.isFinite(config.fillingCatalogId) ||
      !Number.isFinite(config.doorWidth) ||
      !Number.isFinite(config.doorHeight)
    ) {
      return NextResponse.json(
        { error: "invalid_body", message: "profileCatalogId, fillingCatalogId, doorWidth, doorHeight are required" },
        { status: 400 },
      );
    }

    const result = await computeDoorPrice(config);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof DoorCalcError) {
      const status =
        e.code === "PROFILE_NOT_FOUND" ? 404 :
        e.code === "WIDTH_OUT_OF_RANGE" ||
        e.code === "HEIGHT_OUT_OF_RANGE" ||
        e.code === "INVALID_HINGE_COUNT" ||
        e.code === "NO_HARDWARE" ? 422 :
        e.code === "PRICE_MISSING" ? 409 :
        e.code === "EMPTY_PRICE_LIST" ? 409 :
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
