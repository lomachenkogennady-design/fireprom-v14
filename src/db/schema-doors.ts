import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  numeric,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { catalogItems } from "./schema-pricing";

export const doorProfiles = pgTable(
  "door_profiles",
  {
    id: serial("id").primaryKey(),
    catalogItemId: integer("catalog_item_id")
      .notNull()
      .references(() => catalogItems.id),
    profileType: text("profile_type").notNull(),
    steelThickness: numeric("steel_thickness", { precision: 3, scale: 2 }).notNull(),
    minDoorWidth: integer("min_door_width").notNull(),
    maxDoorWidth: integer("max_door_width").notNull(),
    minDoorHeight: integer("min_door_height").notNull(),
    maxDoorHeight: integer("max_door_height").notNull(),
    color: text("color"),
    coating: text("coating"),
    thermalBreak: boolean("thermal_break").notNull().default(false),
    uValue: numeric("u_value", { precision: 4, scale: 2 }),
    weightPerMeter: numeric("weight_per_meter", { precision: 6, scale: 3 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("door_profiles_catalog_idx").on(t.catalogItemId)],
);

export const doorFillings = pgTable(
  "door_fillings",
  {
    id: serial("id").primaryKey(),
    catalogItemId: integer("catalog_item_id")
      .notNull()
      .references(() => catalogItems.id),
    fillingType: text("filling_type").notNull(),
    thicknessMm: integer("thickness_mm").notNull(),
    thermalResistance: numeric("thermal_resistance", { precision: 4, scale: 2 }),
    densityKgM3: integer("density_kg_m3"),
    fireRating: text("fire_rating"),
    soundInsulationDb: integer("sound_insulation_db"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("door_fillings_catalog_idx").on(t.catalogItemId)],
);

export const doorFinishes = pgTable(
  "door_finishes",
  {
    id: serial("id").primaryKey(),
    catalogItemId: integer("catalog_item_id")
      .notNull()
      .references(() => catalogItems.id),
    finishType: text("finish_type").notNull(),
    side: text("side").notNull(),
    ralCode: text("ral_code"),
    texture: text("texture"),
    thicknessMm: numeric("thickness_mm", { precision: 4, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("door_finishes_catalog_idx").on(t.catalogItemId)],
);

export const doorHardware = pgTable(
  "door_hardware",
  {
    id: serial("id").primaryKey(),
    catalogItemId: integer("catalog_item_id")
      .notNull()
      .references(() => catalogItems.id),
    hardwareType: text("hardware_type").notNull(),
    securityClass: integer("security_class"),
    maxWeightKg: integer("max_weight_kg"),
    material: text("material"),
    finish: text("finish"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("door_hardware_catalog_idx").on(t.catalogItemId)],
);

export const doorServices = pgTable(
  "door_services",
  {
    id: serial("id").primaryKey(),
    catalogItemId: integer("catalog_item_id")
      .notNull()
      .references(() => catalogItems.id),
    serviceType: text("service_type").notNull(),
    isFree: boolean("is_free").notNull().default(false),
    formula: jsonb("formula"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("door_services_catalog_idx").on(t.catalogItemId)],
);

export type DoorProfile = typeof doorProfiles.$inferSelect;
export type NewDoorProfile = typeof doorProfiles.$inferInsert;
export type DoorFilling = typeof doorFillings.$inferSelect;
export type NewDoorFilling = typeof doorFillings.$inferInsert;
export type DoorFinish = typeof doorFinishes.$inferSelect;
export type NewDoorFinish = typeof doorFinishes.$inferInsert;
export type DoorHardware = typeof doorHardware.$inferSelect;
export type NewDoorHardware = typeof doorHardware.$inferInsert;
export type DoorService = typeof doorServices.$inferSelect;
export type NewDoorService = typeof doorServices.$inferInsert;
