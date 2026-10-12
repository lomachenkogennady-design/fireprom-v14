import {
  pgTable, serial, integer, text, boolean, timestamp, numeric, uniqueIndex, index,
} from "drizzle-orm/pg-core";

export const catalogItems = pgTable(
  "catalog_items",
  {
    id: serial("id").primaryKey(),
    type: text("type").notNull(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    unit: text("unit").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("catalog_items_type_key_idx").on(t.type, t.key),
    index("catalog_items_type_active_idx").on(t.type, t.isActive),
  ],
);

export const priceListVersions = pgTable(
  "price_list_versions",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    status: text("status").notNull().default("draft"),
  },
  (t) => [uniqueIndex("price_list_versions_name_idx").on(t.name)],
);

export const priceListItems = pgTable(
  "price_list_items",
  {
    id: serial("id").primaryKey(),
    versionId: integer("version_id")
      .notNull()
      .references(() => priceListVersions.id, { onDelete: "cascade" }),
    catalogItemId: integer("catalog_item_id")
      .notNull()
      .references(() => catalogItems.id),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    unitOverride: text("unit_override"),
  },
  (t) => [
    uniqueIndex("price_list_items_version_catalog_idx").on(t.versionId, t.catalogItemId),
    index("price_list_items_version_idx").on(t.versionId),
  ],
);

export const priceListActive = pgTable("price_list_active", {
  id: boolean("id").primaryKey().default(true),
  versionId: integer("version_id")
    .notNull()
    .references(() => priceListVersions.id),
  activatedAt: timestamp("activated_at", { withTimezone: true }).notNull().defaultNow(),
  activatedBy: text("activated_by"),
});

export type CatalogItem = typeof catalogItems.$inferSelect;
export type NewCatalogItem = typeof catalogItems.$inferInsert;
export type PriceListVersion = typeof priceListVersions.$inferSelect;
export type NewPriceListVersion = typeof priceListVersions.$inferInsert;
export type PriceListItem = typeof priceListItems.$inferSelect;
export type NewPriceListItem = typeof priceListItems.$inferInsert;
