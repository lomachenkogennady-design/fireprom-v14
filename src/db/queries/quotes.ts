import { sql } from "drizzle-orm";
import { db } from "@/db";
import { quoteNumber } from "@/lib/pricing";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Атомарно получить следующий номер КП.
 * Использует PG sequence quotes_number_seq — race-free, в отличие от count(*)+1.
 * Номера могут «прыгать» при rollback транзакции (nextval не откатывается),
 * но это нормально: UNIQUE-индекс на quotes.number, дырки допустимы.
 */
export async function nextQuoteNumber(tx: Tx): Promise<string> {
  const r = await tx.execute(
    sql`SELECT nextval($$quotes_number_seq$$)::int AS n`,
  );
  const rows = (r as unknown as { rows: { n: number }[] }).rows;
  const n = rows[0]?.n ?? 1;
  return quoteNumber(n);
}
