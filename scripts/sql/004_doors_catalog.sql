-- FireProM v14 — каталог дверей (PR-4)
-- 5 таблиц специфики, каждая ссылается на catalog_items(id)

CREATE TABLE IF NOT EXISTS door_profiles (
  id                serial PRIMARY KEY,
  catalog_item_id   integer NOT NULL REFERENCES catalog_items(id),
  profile_type      text NOT NULL CHECK (profile_type IN ('standard', 'reinforced', 'premium')),
  steel_thickness   numeric(3,2) NOT NULL CHECK (steel_thickness IN (1.20, 1.50, 2.00)),
  min_door_width    integer NOT NULL CHECK (min_door_width > 0),
  max_door_width    integer NOT NULL CHECK (max_door_width <= 2000),
  min_door_height   integer NOT NULL CHECK (min_door_height > 0),
  max_door_height   integer NOT NULL CHECK (max_door_height <= 3000),
  color             text,
  coating           text CHECK (coating IN ('powder', 'polymer', 'wood', 'primer')),
  thermal_break     boolean NOT NULL DEFAULT false,
  u_value           numeric(4,2) CHECK (u_value >= 0),
  weight_per_meter  numeric(6,3) CHECK (weight_per_meter >= 0),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS door_profiles_catalog_idx
  ON door_profiles (catalog_item_id);

CREATE TABLE IF NOT EXISTS door_fillings (
  id                  serial PRIMARY KEY,
  catalog_item_id     integer NOT NULL REFERENCES catalog_items(id),
  filling_type        text NOT NULL CHECK (filling_type IN ('mineral_wool', 'polystyrene', 'combined', 'glass', 'vacuum')),
  thickness_mm        integer NOT NULL CHECK (thickness_mm > 0),
  thermal_resistance  numeric(4,2) CHECK (thermal_resistance >= 0),
  density_kg_m3       integer CHECK (density_kg_m3 > 0),
  fire_rating         text,
  sound_insulation_db integer CHECK (sound_insulation_db > 0),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS door_fillings_catalog_idx
  ON door_fillings (catalog_item_id);

CREATE TABLE IF NOT EXISTS door_finishes (
  id              serial PRIMARY KEY,
  catalog_item_id integer NOT NULL REFERENCES catalog_items(id),
  finish_type     text NOT NULL CHECK (finish_type IN ('powder_paint', 'mdf_panel', 'mirror', 'veneer', 'glass')),
  side            text NOT NULL CHECK (side IN ('external', 'internal', 'both')),
  ral_code        text,
  texture         text,
  thickness_mm    numeric(4,2) CHECK (thickness_mm >= 0),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS door_finishes_catalog_idx
  ON door_finishes (catalog_item_id);

CREATE TABLE IF NOT EXISTS door_hardware (
  id              serial PRIMARY KEY,
  catalog_item_id integer NOT NULL REFERENCES catalog_items(id),
  hardware_type   text NOT NULL CHECK (hardware_type IN ('lock', 'hinge', 'handle', 'closer', 'peephole', 'chain')),
  security_class  integer CHECK (security_class BETWEEN 1 AND 4),
  max_weight_kg   integer CHECK (max_weight_kg > 0),
  material        text,
  finish          text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS door_hardware_catalog_idx
  ON door_hardware (catalog_item_id);

CREATE TABLE IF NOT EXISTS door_services (
  id              serial PRIMARY KEY,
  catalog_item_id integer NOT NULL REFERENCES catalog_items(id),
  service_type    text NOT NULL CHECK (service_type IN ('measurement', 'delivery', 'installation', 'dismantling', 'warranty')),
  is_free         boolean NOT NULL DEFAULT false,
  formula         jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS door_services_catalog_idx
  ON door_services (catalog_item_id);
