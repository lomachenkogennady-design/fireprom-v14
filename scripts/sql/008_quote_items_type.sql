-- FireProM v14 — тип позиции КП (metal | door)
BEGIN;

ALTER TABLE quote_items
  ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'metal'
    CHECK (item_type IN ('metal', 'door'));

CREATE INDEX IF NOT EXISTS quote_items_type_idx
  ON quote_items (item_type);

COMMIT;
