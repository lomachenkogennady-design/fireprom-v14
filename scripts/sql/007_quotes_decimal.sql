-- FireProM v14 — миграция quotes/quote_items real → numeric(12,2)
-- Только денежные и процентные колонки. Размеры (thickness, len, wid, cut_len) не трогаем.

BEGIN;

ALTER TABLE quotes
  ALTER COLUMN discount_pct TYPE numeric(5,2) USING discount_pct::numeric(5,2),
  ALTER COLUMN vat_pct      TYPE numeric(5,2) USING vat_pct::numeric(5,2),
  ALTER COLUMN subtotal     TYPE numeric(12,2) USING subtotal::numeric(12,2),
  ALTER COLUMN total        TYPE numeric(12,2) USING total::numeric(12,2);

ALTER TABLE quote_items
  ALTER COLUMN unit_price  TYPE numeric(12,2) USING unit_price::numeric(12,2),
  ALTER COLUMN total_price TYPE numeric(12,2) USING total_price::numeric(12,2);

-- Defaults остаются 0, но уже в новом типе
ALTER TABLE quotes
  ALTER COLUMN discount_pct SET DEFAULT 0,
  ALTER COLUMN vat_pct      SET DEFAULT 0,
  ALTER COLUMN subtotal     SET DEFAULT 0,
  ALTER COLUMN total        SET DEFAULT 0;

ALTER TABLE quote_items
  ALTER COLUMN unit_price  SET DEFAULT 0,
  ALTER COLUMN total_price SET DEFAULT 0;

COMMIT;
