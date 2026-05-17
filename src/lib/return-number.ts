/**
 * Customer-facing return numbers: RET-XXXXXXX (7-digit zero-padded sequence).
 * Backed by a Postgres SEQUENCE for monotonicity under concurrent inserts.
 */

import { Prisma } from "@prisma/client";

const SEQUENCE = "return_number_seq";

export async function nextReturnNumber(
  tx: Prisma.TransactionClient,
): Promise<string> {
  await tx.$executeRawUnsafe(`CREATE SEQUENCE IF NOT EXISTS "${SEQUENCE}"`);
  const rows = await tx.$queryRawUnsafe<{ nextval: bigint }[]>(
    `SELECT nextval('"${SEQUENCE}"') AS nextval`,
  );
  const n = Number(rows[0]!.nextval);
  return `RET-${String(n).padStart(7, "0")}`;
}
