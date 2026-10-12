// Сервис каталога дверей: чтение, создание, soft delete.
// Все операции с audit_logs — в одной транзакции.
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  catalogItems,
  doorProfiles,
  doorFillings,
  doorFinishes,
  doorHardware,
  doorServices,
  auditLogs,
} from "@/db/schema";

export class CatalogError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

// ─── Чтение ──────────────────────────────────────────

export async function listProfiles() {
  return await db
    .select({
      catalogId: catalogItems.id,
      key: catalogItems.key,
      name: catalogItems.name,
      unit: catalogItems.unit,
      isActive: catalogItems.isActive,
      profileId: doorProfiles.id,
      profileType: doorProfiles.profileType,
      steelThickness: doorProfiles.steelThickness,
      minDoorWidth: doorProfiles.minDoorWidth,
      maxDoorWidth: doorProfiles.maxDoorWidth,
      minDoorHeight: doorProfiles.minDoorHeight,
      maxDoorHeight: doorProfiles.maxDoorHeight,
      color: doorProfiles.color,
      coating: doorProfiles.coating,
      thermalBreak: doorProfiles.thermalBreak,
      uValue: doorProfiles.uValue,
      weightPerMeter: doorProfiles.weightPerMeter,
    })
    .from(doorProfiles)
    .innerJoin(catalogItems, eq(catalogItems.id, doorProfiles.catalogItemId))
    .orderBy(desc(catalogItems.isActive), catalogItems.key);
}

export async function listFillings() {
  return await db
    .select({
      catalogId: catalogItems.id,
      key: catalogItems.key,
      name: catalogItems.name,
      unit: catalogItems.unit,
      isActive: catalogItems.isActive,
      fillingId: doorFillings.id,
      fillingType: doorFillings.fillingType,
      thicknessMm: doorFillings.thicknessMm,
      thermalResistance: doorFillings.thermalResistance,
      densityKgM3: doorFillings.densityKgM3,
      fireRating: doorFillings.fireRating,
      soundInsulationDb: doorFillings.soundInsulationDb,
    })
    .from(doorFillings)
    .innerJoin(catalogItems, eq(catalogItems.id, doorFillings.catalogItemId))
    .orderBy(desc(catalogItems.isActive), catalogItems.key);
}

export async function listFinishes() {
  return await db
    .select({
      catalogId: catalogItems.id,
      key: catalogItems.key,
      name: catalogItems.name,
      unit: catalogItems.unit,
      isActive: catalogItems.isActive,
      finishId: doorFinishes.id,
      finishType: doorFinishes.finishType,
      side: doorFinishes.side,
      ralCode: doorFinishes.ralCode,
      texture: doorFinishes.texture,
      thicknessMm: doorFinishes.thicknessMm,
    })
    .from(doorFinishes)
    .innerJoin(catalogItems, eq(catalogItems.id, doorFinishes.catalogItemId))
    .orderBy(desc(catalogItems.isActive), catalogItems.key);
}

export async function listHardware() {
  return await db
    .select({
      catalogId: catalogItems.id,
      key: catalogItems.key,
      name: catalogItems.name,
      unit: catalogItems.unit,
      isActive: catalogItems.isActive,
      hardwareId: doorHardware.id,
      hardwareType: doorHardware.hardwareType,
      securityClass: doorHardware.securityClass,
      maxWeightKg: doorHardware.maxWeightKg,
      material: doorHardware.material,
      finish: doorHardware.finish,
    })
    .from(doorHardware)
    .innerJoin(catalogItems, eq(catalogItems.id, doorHardware.catalogItemId))
    .orderBy(desc(catalogItems.isActive), catalogItems.key);
}

export async function listServices() {
  return await db
    .select({
      catalogId: catalogItems.id,
      key: catalogItems.key,
      name: catalogItems.name,
      unit: catalogItems.unit,
      isActive: catalogItems.isActive,
      serviceId: doorServices.id,
      serviceType: doorServices.serviceType,
      isFree: doorServices.isFree,
      formula: doorServices.formula,
    })
    .from(doorServices)
    .innerJoin(catalogItems, eq(catalogItems.id, doorServices.catalogItemId))
    .orderBy(desc(catalogItems.isActive), catalogItems.key);
}

export async function countByType() {
  const rows = await db
    .select({ type: catalogItems.type, count: catalogItems.id })
    .from(catalogItems);
  const out: Record<string, number> = {};
  for (const r of rows) out[r.type] = (out[r.type] ?? 0) + 1;
  return out;
}

// ─── Создание ────────────────────────────────────────

export interface CreateProfileInput {
  key: string;
  name: string;
  profileType: "standard" | "reinforced" | "premium";
  steelThickness: number;
  minDoorWidth: number;
  maxDoorWidth: number;
  minDoorHeight: number;
  maxDoorHeight: number;
  color?: string | null;
  coating?: "powder" | "polymer" | "wood" | "primer" | null;
  thermalBreak?: boolean;
  uValue?: number | null;
  weightPerMeter?: number | null;
  actorId?: string | null;
}

export async function createProfile(input: CreateProfileInput) {
  return await db.transaction(async (tx) => {
    const [ci] = await tx
      .insert(catalogItems)
      .values({
        type: "door_profile",
        key: input.key,
        name: input.name,
        unit: "м",
      })
      .returning();

    const [profile] = await tx
      .insert(doorProfiles)
      .values({
        catalogItemId: ci.id,
        profileType: input.profileType,
        steelThickness: input.steelThickness.toFixed(2),
        minDoorWidth: input.minDoorWidth,
        maxDoorWidth: input.maxDoorWidth,
        minDoorHeight: input.minDoorHeight,
        maxDoorHeight: input.maxDoorHeight,
        color: input.color ?? null,
        coating: input.coating ?? null,
        thermalBreak: input.thermalBreak ?? false,
        uValue: input.uValue != null ? input.uValue.toFixed(2) : null,
        weightPerMeter: input.weightPerMeter != null ? input.weightPerMeter.toFixed(3) : null,
      })
      .returning();

    await tx.insert(auditLogs).values({
      userId: input.actorId ?? null,
      action: "create",
      entityType: "door_profile",
      entityId: profile.id,
      newValue: { key: input.key, name: input.name },
    });

    return { catalogItem: ci, profile };
  });
}

export interface CreateFillingInput {
  key: string;
  name: string;
  fillingType: "mineral_wool" | "polystyrene" | "combined" | "glass" | "vacuum";
  thicknessMm: number;
  thermalResistance?: number | null;
  densityKgM3?: number | null;
  fireRating?: string | null;
  soundInsulationDb?: number | null;
  actorId?: string | null;
}

export async function createFilling(input: CreateFillingInput) {
  return await db.transaction(async (tx) => {
    const [ci] = await tx
      .insert(catalogItems)
      .values({ type: "door_filling", key: input.key, name: input.name, unit: "м²" })
      .returning();

    const [filling] = await tx
      .insert(doorFillings)
      .values({
        catalogItemId: ci.id,
        fillingType: input.fillingType,
        thicknessMm: input.thicknessMm,
        thermalResistance: input.thermalResistance != null ? input.thermalResistance.toFixed(2) : null,
        densityKgM3: input.densityKgM3 ?? null,
        fireRating: input.fireRating ?? null,
        soundInsulationDb: input.soundInsulationDb ?? null,
      })
      .returning();

    await tx.insert(auditLogs).values({
      userId: input.actorId ?? null,
      action: "create",
      entityType: "door_filling",
      entityId: filling.id,
      newValue: { key: input.key, name: input.name },
    });

    return { catalogItem: ci, filling };
  });
}

export interface CreateFinishInput {
  key: string;
  name: string;
  finishType: "powder_paint" | "mdf_panel" | "mirror" | "veneer" | "glass";
  side: "external" | "internal" | "both";
  ralCode?: string | null;
  texture?: string | null;
  thicknessMm?: number | null;
  actorId?: string | null;
}

export async function createFinish(input: CreateFinishInput) {
  return await db.transaction(async (tx) => {
    const [ci] = await tx
      .insert(catalogItems)
      .values({ type: "door_finish", key: input.key, name: input.name, unit: "м²" })
      .returning();

    const [finish] = await tx
      .insert(doorFinishes)
      .values({
        catalogItemId: ci.id,
        finishType: input.finishType,
        side: input.side,
        ralCode: input.ralCode ?? null,
        texture: input.texture ?? null,
        thicknessMm: input.thicknessMm != null ? input.thicknessMm.toFixed(2) : null,
      })
      .returning();

    await tx.insert(auditLogs).values({
      userId: input.actorId ?? null,
      action: "create",
      entityType: "door_finish",
      entityId: finish.id,
      newValue: { key: input.key, name: input.name },
    });

    return { catalogItem: ci, finish };
  });
}

export interface CreateHardwareInput {
  key: string;
  name: string;
  hardwareType: "lock" | "hinge" | "handle" | "closer" | "peephole" | "chain";
  securityClass?: number | null;
  maxWeightKg?: number | null;
  material?: string | null;
  finish?: string | null;
  actorId?: string | null;
}

export async function createHardware(input: CreateHardwareInput) {
  return await db.transaction(async (tx) => {
    const [ci] = await tx
      .insert(catalogItems)
      .values({ type: "door_hardware", key: input.key, name: input.name, unit: "шт" })
      .returning();

    const [hw] = await tx
      .insert(doorHardware)
      .values({
        catalogItemId: ci.id,
        hardwareType: input.hardwareType,
        securityClass: input.securityClass ?? null,
        maxWeightKg: input.maxWeightKg ?? null,
        material: input.material ?? null,
        finish: input.finish ?? null,
      })
      .returning();

    await tx.insert(auditLogs).values({
      userId: input.actorId ?? null,
      action: "create",
      entityType: "door_hardware",
      entityId: hw.id,
      newValue: { key: input.key, name: input.name },
    });

    return { catalogItem: ci, hardware: hw };
  });
}

export interface CreateServiceInput {
  key: string;
  name: string;
  serviceType: "measurement" | "delivery" | "installation" | "dismantling" | "warranty";
  isFree?: boolean;
  formula?: Record<string, unknown> | null;
  actorId?: string | null;
}

export async function createService(input: CreateServiceInput) {
  return await db.transaction(async (tx) => {
    const [ci] = await tx
      .insert(catalogItems)
      .values({ type: "door_service", key: input.key, name: input.name, unit: "шт" })
      .returning();

    const [svc] = await tx
      .insert(doorServices)
      .values({
        catalogItemId: ci.id,
        serviceType: input.serviceType,
        isFree: input.isFree ?? false,
        formula: input.formula ?? null,
      })
      .returning();

    await tx.insert(auditLogs).values({
      userId: input.actorId ?? null,
      action: "create",
      entityType: "door_service",
      entityId: svc.id,
      newValue: { key: input.key, name: input.name },
    });

    return { catalogItem: ci, service: svc };
  });
}

// ─── Soft delete ─────────────────────────────────────

export async function setCatalogItemActive(
  catalogItemId: number,
  isActive: boolean,
  actorId: string | null = null,
) {
  return await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(catalogItems)
      .where(eq(catalogItems.id, catalogItemId))
      .limit(1);

    if (!existing) {
      throw new CatalogError(
        `catalog item ${catalogItemId} not found`,
        "NOT_FOUND",
      );
    }

    const [updated] = await tx
      .update(catalogItems)
      .set({ isActive })
      .where(eq(catalogItems.id, catalogItemId))
      .returning();

    await tx.insert(auditLogs).values({
      userId: actorId,
      action: isActive ? "restore" : "deactivate",
      entityType: "catalog_item",
      entityId: catalogItemId,
      oldValue: { isActive: existing.isActive },
      newValue: { isActive },
    });

    return updated;
  });
}
