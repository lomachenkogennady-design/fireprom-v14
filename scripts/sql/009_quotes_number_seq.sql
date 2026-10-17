-- Атомарная генерация номера КП через PG sequence.
-- Заменяет race-prone count(*)+1 в:
--   src/app/api/quotes/route.ts
--   src/lib/doors/quote-door-service.ts
--   src/lib/doors/quote-from-order-service.ts
CREATE SEQUENCE IF NOT EXISTS quotes_number_seq;

-- Старт с MAX(id)+1, чтобы не сбить существующую нумерацию.
-- setval(..., value, false): следующий nextval вернёт value.
SELECT setval(
  $$quotes_number_seq$$,
  COALESCE((SELECT MAX(id) FROM quotes), 0) + 1,
  false
);
