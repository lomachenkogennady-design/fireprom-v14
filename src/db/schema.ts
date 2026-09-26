import {
  pgTable,
  serial,
  text,
  integer,
  real,
  boolean,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";

/** Единая база клиентов: КП и расчёты ссылаются сюда */
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contact: text("contact"),
  phone: text("phone"),
  email: text("email"),
  inn: text("inn"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** История расчётов развёртки (модуль «Технологу») */
export const bendingCalculations = pgTable("bending_calculations", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  material: text("material").notNull(),
  thickness: real("thickness").notNull(),
  width: real("width").notNull(),
  /** { flanges: number[], bends: { angle, dir }[] } */
  payload: jsonb("payload").notNull(),
  /** { flatLength, kFactor, radius, vDie, minFlange, weight, tonnageTotal, bends: [...] } */
  results: jsonb("results").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Коммерческие предложения (модуль «Менеджеру») */
export const quotes = pgTable("quotes", {
  id: serial("id").primaryKey(),
  number: text("number").notNull().unique(),
  clientId: integer("client_id").references(() => clients.id, {
    onDelete: "set null",
  }),
  discountPct: real("discount_pct").notNull().default(0),
  vatPct: real("vat_pct").notNull().default(0),
  comment: text("comment"),
  subtotal: real("subtotal").notNull().default(0),
  total: real("total").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const quoteItems = pgTable("quote_items", {
  id: serial("id").primaryKey(),
  quoteId: integer("quote_id")
    .references(() => quotes.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  material: text("material").notNull(),
  /** технология резки: laser | plasma | waterjet */
  tech: text("tech").notNull().default("laser"),
  thickness: real("thickness").notNull(),
  len: real("len").notNull(),
  wid: real("wid").notNull(),
  qty: integer("qty").notNull().default(1),
  bends: integer("bends").notNull().default(0),
  cutLen: real("cut_len").notNull().default(0),
  pierces: integer("pierces").notNull().default(0),
  paint: boolean("paint").notNull().default(false),
  unitPrice: real("unit_price").notNull().default(0),
  totalPrice: real("total_price").notNull().default(0),
  /** { mass, materialCost, cutCost, bendCost, paintCost } */
  breakdown: jsonb("breakdown"),
});

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type BendingCalculation = typeof bendingCalculations.$inferSelect;
export type Quote = typeof quotes.$inferSelect;
export type QuoteItem = typeof quoteItems.$inferSelect;
