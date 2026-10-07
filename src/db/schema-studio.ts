// ═══════════════════════════════════════════════════════════
// Bot Studio — прайс, команды, события, уведомления, настройки
// Изолированный модуль. Реэкспортируется из schema.ts.
// Добавлено 07.10.2026
// ═══════════════════════════════════════════════════════════
import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** Прайс — то, что бот отдаёт по /doors, /price */
export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    category: text("category").notNull().default("doors"),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    priceFrom: integer("price_from").notNull().default(0),
    unit: text("unit").notNull().default("шт"),
    specs: jsonb("specs").$type<string[]>().notNull().default([]),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(100),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("products_slug_idx").on(t.slug)],
);

/** Команды бота: /start, /doors, /price, кнопки меню */
export const botCommands = pgTable(
  "bot_commands",
  {
    id: serial("id").primaryKey(),
    command: text("command").notNull(),
    button: text("button"),
    title: text("title").notNull(),
    reply: text("reply").notNull().default(""),
    showPrices: boolean("show_prices").notNull().default(false),
    category: text("category"),
    collectLead: boolean("collect_lead").notNull().default(false),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(100),
    hits: integer("hits").notNull().default(0),
  },
  (t) => [uniqueIndex("bot_commands_command_idx").on(t.command)],
);

/** Лента событий по заявке. FK на leads — в SQL, не в Drizzle */
export const leadEvents = pgTable("lead_events", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull(),
  type: text("type").notNull().default("note"),
  text: text("text").notNull(),
  author: text("author").notNull().default("система"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Журнал уведомлений менеджеру. FK на leads — в SQL */
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id"),
  channel: text("channel").notNull().default("telegram"),
  target: text("target").notNull().default(""),
  text: text("text").notNull(),
  status: text("status").notNull().default("sent"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Настройки бота (key/value) */
export const botSettings = pgTable(
  "bot_settings",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull(),
    value: text("value").notNull().default(""),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("bot_settings_key_idx").on(t.key)],
);

export type Product = typeof products.$inferSelect;
export type BotCommand = typeof botCommands.$inferSelect;
export type LeadEvent = typeof leadEvents.$inferSelect;
export type NotificationRow = typeof notifications.$inferSelect;
