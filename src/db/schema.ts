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

/** История расчётов резки (модуль «Резка металла») */
export const cuttingCalculations = pgTable("cutting_calculations", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  material: text("material").notNull(),
  thickness: real("thickness").notNull(),
  /** laser | plasma | waterjet */
  tech: text("tech").notNull().default("laser"),
  /** { parts: CuttingPart[], stockParts?: StockPart[], allowRotate: boolean } */
  payload: jsonb("payload").notNull(),
  /** { sheetCount, utilization, sheets, pricing, barCount?, bars? } */
  results: jsonb("results").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});


/** Производственные задания MES — операторские экраны */
export const machineTasks = pgTable("machine_tasks", {
  id: serial("id").primaryKey(),
  machineId: text("machine_id").notNull(),
  station: text("station").notNull(),
  quoteId: integer("quote_id").references(() => quotes.id, { onDelete: "set null" }),
  partName: text("part_name").notNull(),
  qty: integer("qty").notNull(),
  done: integer("done").notNull().default(0),
  scrap: integer("scrap").notNull().default(0),
  status: text("status").notNull().default("queued"),
  dxfPath: text("dxf_path"),
  note: text("note"),
  meta: jsonb("meta"),
  operatorId: text("operator_id"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Аудит: каждое нажатие "+1"/"брак" — строка */
export const machineEvents = pgTable("machine_events", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").references(() => machineTasks.id, { onDelete: "cascade" }).notNull(),
  kind: text("kind").notNull(),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type MachineTask   = typeof machineTasks.$inferSelect;
export type NewMachineTask = typeof machineTasks.$inferInsert;
export type MachineEvent  = typeof machineEvents.$inferSelect;

// ═══════════════════════════════════════════════════════════
// Модуль «Заявки» (leads) — приём с сайта, Telegram, почты, MAX
// ═══════════════════════════════════════════════════════════

/** Заявки от клиентов — из формы /order, Telegram-бота, IMAP, ручного ввода */
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  number: text("number").notNull().unique(),
  source: text("source").notNull().default("site"),
  name: text("name"),
  phone: text("phone"),
  email: text("email"),
  contactMethod: text("contact_method"),
  region: text("region"),
  address: text("address"),
  requestType: text("request_type"),
  message: text("message"),
  status: text("status").notNull().default("new"),
  utmJson: jsonb("utm_json"),
  referrer: text("referrer"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  tgUserId: text("tg_user_id"),
  tgUsername: text("tg_username"),
  botUsername: text("bot_username"),
  priority: text("priority").notNull().default("normal"),
  amount: integer("amount"),
  manager: text("manager"),
  notifiedAt: timestamp("notified_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  product: text("product"),
});

export const leadItems = pgTable("lead_items", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id")
    .references(() => leads.id, { onDelete: "cascade" })
    .notNull(),
  kind: text("kind").notNull(),
  paramsJson: jsonb("params_json"),
  sketchSvg: text("sketch_svg"),
  sortOrder: integer("sort_order").default(0),
});

export const leadFiles = pgTable("lead_files", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id")
    .references(() => leads.id, { onDelete: "cascade" })
    .notNull(),
  filename: text("filename").notNull(),
  path: text("path").notNull(),
  size: integer("size").notNull(),
  mime: text("mime").notNull(),
  sha256: text("sha256").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type LeadItem = typeof leadItems.$inferSelect;
export type LeadFile = typeof leadFiles.$inferSelect;

// ═══ Bot Studio tables ═══
export * from "./schema-studio";
