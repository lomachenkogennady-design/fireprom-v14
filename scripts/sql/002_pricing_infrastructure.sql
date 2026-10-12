CREATE TABLE IF NOT EXISTS catalog_items (
  id           serial PRIMARY KEY,
  type         text NOT NULL,
  key          text NOT NULL,
  name         text NOT NULL,
  unit         text NOT NULL,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS catalog_items_type_key_idx
  ON catalog_items (type, key);
CREATE INDEX IF NOT EXISTS catalog_items_type_active_idx
  ON catalog_items (type, is_active);

CREATE TABLE IF NOT EXISTS price_list_versions (
  id           serial PRIMARY KEY,
  name         text NOT NULL,
  comment      text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS price_list_versions_name_idx
  ON price_list_versions (name);

CREATE TABLE IF NOT EXISTS price_list_items (
  id              serial PRIMARY KEY,
  version_id      integer NOT NULL REFERENCES price_list_versions(id) ON DELETE CASCADE,
  catalog_item_id integer NOT NULL REFERENCES catalog_items(id),
  price           numeric(12,2) NOT NULL CHECK (price >= 0),
  unit_override   text
);

CREATE UNIQUE INDEX IF NOT EXISTS price_list_items_version_catalog_idx
  ON price_list_items (version_id, catalog_item_id);
CREATE INDEX IF NOT EXISTS price_list_items_version_idx
  ON price_list_items (version_id);

CREATE TABLE IF NOT EXISTS price_list_active (
  id           boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  version_id   integer NOT NULL REFERENCES price_list_versions(id),
  activated_at timestamptz NOT NULL DEFAULT now(),
  activated_by text
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id           bigserial PRIMARY KEY,
  user_id      text,
  action       text NOT NULL,
  entity_type  text NOT NULL,
  entity_id    integer,
  old_value    jsonb,
  new_value    jsonb,
  ip           text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_entity_idx
  ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx
  ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx
  ON audit_logs (action);

CREATE OR REPLACE FUNCTION prevent_active_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'price_list_active is a singleton pointer; DELETE/TRUNCATE not allowed. Use UPDATE to switch version.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_active_delete ON price_list_active;
CREATE TRIGGER trg_prevent_active_delete
  BEFORE DELETE ON price_list_active
  FOR EACH ROW EXECUTE FUNCTION prevent_active_delete();

DROP TRIGGER IF EXISTS trg_prevent_active_truncate ON price_list_active;
CREATE TRIGGER trg_prevent_active_truncate
  BEFORE TRUNCATE ON price_list_active
  FOR EACH STATEMENT EXECUTE FUNCTION prevent_active_delete();
