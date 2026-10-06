-- ФАЙЕРПРОМ Metalworks — базовая схема.
-- Полностью идемпотентно: можно выполнять при каждом старте контейнера.
--
-- Имена ограничений совпадают с теми, что генерирует drizzle-kit,
-- поэтому `drizzle-kit push` на такой базе не видит расхождений.

CREATE TABLE IF NOT EXISTS clients (
  id          serial PRIMARY KEY,
  name        text NOT NULL,
  contact     text,
  phone       text,
  email       text,
  inn         text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bending_calculations (
  id          serial PRIMARY KEY,
  client_id   integer,
  name        text NOT NULL,
  material    text NOT NULL,
  thickness   real NOT NULL,
  width       real NOT NULL,
  payload     jsonb NOT NULL,
  results     jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quotes (
  id           serial PRIMARY KEY,
  number       text NOT NULL,
  client_id    integer,
  discount_pct real NOT NULL DEFAULT 0,
  vat_pct      real NOT NULL DEFAULT 0,
  comment      text,
  subtotal     real NOT NULL DEFAULT 0,
  total        real NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quote_items (
  id          serial PRIMARY KEY,
  quote_id    integer NOT NULL,
  name        text NOT NULL,
  material    text NOT NULL,
  tech        text NOT NULL DEFAULT 'laser',
  thickness   real NOT NULL,
  len         real NOT NULL,
  wid         real NOT NULL,
  qty         integer NOT NULL DEFAULT 1,
  bends       integer NOT NULL DEFAULT 0,
  cut_len     real NOT NULL DEFAULT 0,
  pierces     integer NOT NULL DEFAULT 0,
  paint       boolean NOT NULL DEFAULT false,
  unit_price  real NOT NULL DEFAULT 0,
  total_price real NOT NULL DEFAULT 0,
  breakdown   jsonb
);

-- Ограничения добавляем отдельно: ADD CONSTRAINT IF NOT EXISTS в Postgres нет,
-- поэтому оборачиваем в DO-блок с проверкой pg_constraint.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotes_number_unique') THEN
    ALTER TABLE quotes ADD CONSTRAINT quotes_number_unique UNIQUE (number);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bending_calculations_client_id_clients_id_fk') THEN
    ALTER TABLE bending_calculations
      ADD CONSTRAINT bending_calculations_client_id_clients_id_fk
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotes_client_id_clients_id_fk') THEN
    ALTER TABLE quotes
      ADD CONSTRAINT quotes_client_id_clients_id_fk
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_items_quote_id_quotes_id_fk') THEN
    ALTER TABLE quote_items
      ADD CONSTRAINT quote_items_quote_id_quotes_id_fk
      FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Миграция для баз, созданных до появления технологий резки
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS tech text NOT NULL DEFAULT 'laser';

CREATE INDEX IF NOT EXISTS idx_bending_created ON bending_calculations (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_created  ON quotes (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quote_items_qid ON quote_items (quote_id);

-- ═══════════════════════════════════════════════════════
-- Модуль «Резка металла» (добавлено 06.10.2026)
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS cutting_calculations (
  id            serial PRIMARY KEY,
  client_id     integer REFERENCES clients(id) ON DELETE SET NULL,
  name          text NOT NULL,
  material      text NOT NULL,
  thickness     real NOT NULL,
  tech          text NOT NULL DEFAULT 'laser',
  payload       jsonb NOT NULL,
  results       jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════
-- Модуль MES: задания и аудит (добавлено 06.10.2026)
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS machine_tasks (
  id            serial PRIMARY KEY,
  machine_id    text NOT NULL,
  station       text NOT NULL,
  quote_id      integer REFERENCES quotes(id) ON DELETE SET NULL,
  part_name     text NOT NULL,
  qty           integer NOT NULL,
  done          integer NOT NULL DEFAULT 0,
  scrap         integer NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'queued',
  dxf_path      text,
  note          text,
  meta          jsonb,
  operator_id   text,
  started_at    timestamptz,
  finished_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS machine_events (
  id            serial PRIMARY KEY,
  task_id       integer NOT NULL REFERENCES machine_tasks(id) ON DELETE CASCADE,
  kind          text NOT NULL,
  payload       jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
