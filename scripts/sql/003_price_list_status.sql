ALTER TABLE price_list_versions
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'
  CHECK (status IN ('draft', 'published'));

UPDATE price_list_versions
SET status = 'published'
WHERE id IN (SELECT version_id FROM price_list_active);

CREATE INDEX IF NOT EXISTS price_list_versions_status_idx
  ON price_list_versions (status);
