import { eq, inArray, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  catalogItems,
  priceListVersions,
  priceListItems,
  priceListActive,
  auditLogs,
} from "@/db/schema";

export interface PriceListItemInput {
  catalogItemId: number;
  price: number;
  unitOverride?: string | null;
}

export interface CreateVersionInput {
  name: string;
  comment?: string | null;
  items: PriceListItemInput[];
  actorId?: string | null;
}

export class PriceListError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

export async function createPriceListVersion(input: CreateVersionInput) {
  if (!input.name || input.name.trim().length === 0) {
    throw new PriceListError("name is required", "INVALID_NAME");
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new PriceListError("items must be non-empty", "EMPTY_ITEMS");
  }

  const ids = [...new Set(input.items.map((i) => i.catalogItemId))];
  const existing = await db
    .select({ id: catalogItems.id })
    .from(catalogItems)
    .where(inArray(catalogItems.id, ids));

  const existingIds = new Set(existing.map((r) => r.id));
  const missing = ids.filter((id) => !existingIds.has(id));
  if (missing.length > 0) {
    throw new PriceListError(
      `catalog items not found: ${missing.join(", ")}`,
      "MISSING_CATALOG_ITEMS",
    );
  }

  return await db.transaction(async (tx) => {
    const [version] = await tx
      .insert(priceListVersions)
      .values({
        name: input.name.trim(),
        comment: input.comment ?? null,
        status: "draft",
      })
      .returning();

    await tx.insert(priceListItems).values(
      input.items.map((i) => ({
        versionId: version.id,
        catalogItemId: i.catalogItemId,
        price: i.price.toFixed(2),
        unitOverride: i.unitOverride ?? null,
      })),
    );

    await tx.insert(auditLogs).values({
      userId: input.actorId ?? null,
      action: "create",
      entityType: "price_list_version",
      entityId: version.id,
      oldValue: null,
      newValue: { name: version.name, itemsCount: input.items.length },
    });

    return version;
  });
}

export async function publishPriceList(
  versionId: number,
  actorId: string | null = null,
  ip: string | null = null,
) {
  return await db.transaction(async (tx) => {
    const [version] = await tx
      .select()
      .from(priceListVersions)
      .where(eq(priceListVersions.id, versionId))
      .limit(1)
      .for("update");

    if (!version) {
      throw new PriceListError(
        `price list version ${versionId} not found`,
        "VERSION_NOT_FOUND",
      );
    }

    if (version.status === "published") {
      throw new PriceListError(
        `version ${versionId} is already published`,
        "ALREADY_PUBLISHED",
      );
    }

    const items = await tx
      .select()
      .from(priceListItems)
      .where(eq(priceListItems.versionId, versionId));

    if (items.length === 0) {
      throw new PriceListError(
        `version ${versionId} has no items to publish`,
        "EMPTY_VERSION",
      );
    }

    const [updated] = await tx
      .update(priceListVersions)
      .set({ status: "published" })
      .where(eq(priceListVersions.id, versionId))
      .returning();

    await tx.insert(auditLogs).values({
      userId: actorId,
      action: "publish",
      entityType: "price_list_version",
      entityId: versionId,
      oldValue: { status: version.status },
      newValue: { status: "published", itemsCount: items.length },
      ip,
    });

    return updated;
  });
}

export async function activatePriceList(
  versionId: number,
  actorId: string | null = null,
  ip: string | null = null,
) {
  return await db.transaction(async (tx) => {
    const [version] = await tx
      .select()
      .from(priceListVersions)
      .where(eq(priceListVersions.id, versionId))
      .limit(1);

    if (!version) {
      throw new PriceListError(
        `price list version ${versionId} not found`,
        "VERSION_NOT_FOUND",
      );
    }

    if (version.status !== "published") {
      throw new PriceListError(
        `version ${versionId} is not published (status: ${version.status})`,
        "NOT_PUBLISHED",
      );
    }

    // Блокируем строку указателя — защита от параллельной активации
    const [prev] = await tx
      .select()
      .from(priceListActive)
      .for("update");

    await tx
      .insert(priceListActive)
      .values({ id: true, versionId, activatedBy: actorId })
      .onConflictDoUpdate({
        target: priceListActive.id,
        set: {
          versionId,
          activatedAt: new Date(),
          activatedBy: actorId,
        },
      });

    await tx.insert(auditLogs).values({
      userId: actorId,
      action: "activate",
      entityType: "price_list_version",
      entityId: versionId,
      oldValue: prev ? { versionId: prev.versionId } : null,
      newValue: { versionId, name: version.name },
      ip,
    });

    return version;
  });
}

export async function getActivePriceList() {
  const [active] = await db.select().from(priceListActive).limit(1);

  if (!active) {
    throw new PriceListError(
      "no active price list; activate a version first",
      "NO_ACTIVE_PRICE_LIST",
    );
  }

  const [version] = await db
    .select()
    .from(priceListVersions)
    .where(eq(priceListVersions.id, active.versionId))
    .limit(1);

  const items = await db
    .select()
    .from(priceListItems)
    .where(eq(priceListItems.versionId, active.versionId));

  return { version, items, activatedAt: active.activatedAt };
}

export async function listPriceListVersions() {
  return await db
    .select()
    .from(priceListVersions)
    .orderBy(desc(priceListVersions.createdAt));
}

export async function getPriceListVersion(versionId: number) {
  const [version] = await db
    .select()
    .from(priceListVersions)
    .where(eq(priceListVersions.id, versionId))
    .limit(1);

  if (!version) {
    throw new PriceListError(
      `price list version ${versionId} not found`,
      "VERSION_NOT_FOUND",
    );
  }

  const items = await db
    .select({
      id: priceListItems.id,
      catalogItemId: priceListItems.catalogItemId,
      price: priceListItems.price,
      unitOverride: priceListItems.unitOverride,
      catalogType: catalogItems.type,
      catalogKey: catalogItems.key,
      catalogName: catalogItems.name,
      catalogUnit: catalogItems.unit,
    })
    .from(priceListItems)
    .innerJoin(catalogItems, eq(catalogItems.id, priceListItems.catalogItemId))
    .where(eq(priceListItems.versionId, versionId));

  return { version, items };
}
