/**
 * Customer-facing order numbers: AVM-YYYY-XXXXXXXX where XXXXXXXX is an
 * 8-digit zero-padded sequence per year. Internal UUIDs are never exposed
 * to customers (CLAUDE.md §7).
 *
 * We back this with a Postgres SEQUENCE per year for guaranteed monotonicity
 * even under concurrent INSERTs.
 */

import { Prisma } from "@prisma/client";

export async function nextOrderNumber(
  tx: Prisma.TransactionClient,
  now: Date = new Date(),
): Promise<string> {
  const year = now.getUTCFullYear();
  const seqName = `order_number_${year}`;

  // Create the sequence on first use for this year.
  await tx.$executeRawUnsafe(`CREATE SEQUENCE IF NOT EXISTS "${seqName}"`);

  const rows = await tx.$queryRawUnsafe<{ nextval: bigint }[]>(
    `SELECT nextval('"${seqName}"') AS nextval`,
  );

  const n = Number(rows[0]!.nextval);
  return `AVM-${year}-${String(n).padStart(8, "0")}`;
}
