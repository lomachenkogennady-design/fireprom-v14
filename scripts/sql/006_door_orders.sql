-- FireProM v14 — заказы дверей (PR-6)

CREATE TABLE IF NOT EXISTS door_orders (
  id                       serial PRIMARY KEY,
  quote_id                 integer REFERENCES quotes(id) ON DELETE SET NULL,
  quote_item_id            integer REFERENCES quote_items(id) ON DELETE SET NULL,

  customer_name            text NOT NULL,

  profile_catalog_id       integer NOT NULL REFERENCES catalog_items(id),
  filling_catalog_id       integer NOT NULL REFERENCES catalog_items(id),
  external_finish_catalog_id integer REFERENCES catalog_items(id),
  internal_finish_catalog_id integer REFERENCES catalog_items(id),

  door_width               integer NOT NULL CHECK (door_width > 0 AND door_width <= 2000),
  door_height              integer NOT NULL CHECK (door_height > 0 AND door_height <= 3000),
  hinge_count              integer NOT NULL CHECK (hinge_count IN (2, 3, 4)),

  price_list_version_id    integer REFERENCES price_list_versions(id),
  pricing_snapshot         jsonb NOT NULL,

  subtotal                 numeric(12,2) NOT NULL CHECK (subtotal >= 0),
  vat_rate                 numeric(5,2) NOT NULL DEFAULT 22.00,
  vat_amount               numeric(12,2) NOT NULL DEFAULT 0 CHECK (vat_amount >= 0),
  total_price              numeric(12,2) NOT NULL DEFAULT 0 CHECK (total_price >= 0),

  status                   text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'confirmed', 'in_production', 'completed', 'cancelled')),

  note                     text,
  created_by               text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS door_orders_quote_idx
  ON door_orders (quote_id);
CREATE INDEX IF NOT EXISTS door_orders_status_created_idx
  ON door_orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS door_orders_customer_idx
  ON door_orders (customer_name);

-- Фурнитура: quantity + цена на момент заказа
CREATE TABLE IF NOT EXISTS door_order_hardware (
  order_id          integer NOT NULL REFERENCES door_orders(id) ON DELETE CASCADE,
  hardware_catalog_id integer NOT NULL REFERENCES catalog_items(id),
  quantity          integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  price_at_order    numeric(12,2) NOT NULL CHECK (price_at_order >= 0),
  PRIMARY KEY (order_id, hardware_catalog_id)
);

-- Услуги: цена на момент заказа
CREATE TABLE IF NOT EXISTS door_order_services (
  order_id          integer NOT NULL REFERENCES door_orders(id) ON DELETE CASCADE,
  service_catalog_id integer NOT NULL REFERENCES catalog_items(id),
  price_at_order    numeric(12,2) NOT NULL CHECK (price_at_order >= 0),
  PRIMARY KEY (order_id, service_catalog_id)
);

-- Автообновление updated_at
CREATE OR REPLACE FUNCTION door_orders_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_door_orders_touch ON door_orders;
CREATE TRIGGER trg_door_orders_touch
  BEFORE UPDATE ON door_orders
  FOR EACH ROW EXECUTE FUNCTION door_orders_touch_updated_at();
