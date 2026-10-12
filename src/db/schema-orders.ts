import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  numeric,
  jsonb,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { catalogItems, priceListVersions } from "./schema-pricing";
import { quotes, quoteItems } from "./schema";

export const doorOrders = pgTable(
  "door_orders",
  {
    id: serial("id").primaryKey(),
    quoteId: integer("quote_id").references(() => quotes.id, { onDelete: "set null" }),
    quoteItemId: integer("quote_item_id").references(() => quoteItems.id, { onDelete: "set null" }),

    customerName: text("customer_name").notNull(),

    profileCatalogId: integer("profile_catalog_id")
      .notNull()
      .references(() => catalogItems.id),
    fillingCatalogId: integer("filling_catalog_id")
      .notNull()
      .references(() => catalogItems.id),
    externalFinishCatalogId: integer("external_finish_catalog_id")
      .references(() => catalogItems.id),
    internalFinishCatalogId: integer("internal_finish_catalog_id")
      .references(() => catalogItems.id),

    doorWidth: integer("door_width").notNull(),
    doorHeight: integer("door_height").notNull(),
    hingeCount: integer("hinge_count").notNull(),

    priceListVersionId: integer("price_list_version_id")
      .references(() => priceListVersions.id),
    pricingSnapshot: jsonb("pricing_snapshot").notNull(),

    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
    vatRate: numeric("vat_rate", { precision: 5, scale: 2 }).notNull().default("22.00"),
    vatAmount: numeric("vat_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    totalPrice: numeric("total_price", { precision: 12, scale: 2 }).notNull().default("0"),

    status: text("status").notNull().default("draft"),
    note: text("note"),
    createdBy: text("created_by"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("door_orders_quote_idx").on(t.quoteId),
    index("door_orders_status_created_idx").on(t.status, t.createdAt),
    index("door_orders_customer_idx").on(t.customerName),
  ],
);

export const doorOrderHardware = pgTable(
  "door_order_hardware",
  {
    orderId: integer("order_id")
      .notNull()
      .references(() => doorOrders.id, { onDelete: "cascade" }),
    hardwareCatalogId: integer("hardware_catalog_id")
      .notNull()
      .references(() => catalogItems.id),
    quantity: integer("quantity").notNull().default(1),
    priceAtOrder: numeric("price_at_order", { precision: 12, scale: 2 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.orderId, t.hardwareCatalogId] })],
);

export const doorOrderServices = pgTable(
  "door_order_services",
  {
    orderId: integer("order_id")
      .notNull()
      .references(() => doorOrders.id, { onDelete: "cascade" }),
    serviceCatalogId: integer("service_catalog_id")
      .notNull()
      .references(() => catalogItems.id),
    priceAtOrder: numeric("price_at_order", { precision: 12, scale: 2 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.orderId, t.serviceCatalogId] })],
);

export type DoorOrder = typeof doorOrders.$inferSelect;
export type NewDoorOrder = typeof doorOrders.$inferInsert;
export type DoorOrderHardware = typeof doorOrderHardware.$inferSelect;
export type DoorOrderService = typeof doorOrderServices.$inferSelect;
