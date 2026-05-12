/**
 * Idempotency-Key handling per CLAUDE.md §7. Every state-mutating POST
 * (checkout, payments, payment-links, webhooks) accepts an Idempotency-Key
 * header. Same key + same body → return cached response. Same key + different
 * body → 409.
 */

import { createHash } from "node:crypto";
import { db } from "./db";
import { IdempotencyConflictError } from "./errors";

/**
 * SHA-256 of the JSON-canonicalised body. Two callers must produce the same
 * hash for the same logical payload, so we stringify with sorted keys.
 */
export function hashBody(body: unknown): string {
  const canonical = JSON.stringify(body, Object.keys(body as object).sort());
  return createHash("sha256").update(canonical).digest("hex");
}

interface IdempotencyResult<T> {
  /** True when the response came from cache (replay). */
  replay: boolean;
  response: T;
  statusCode: number;
}

/**
 * Wraps a state-mutating operation in idempotency-key handling.
 *
 *   const { response, replay } = await withIdempotency(
 *     idempotencyKey,
 *     body,
 *     async () => doTheWork()
 *   );
 *
 * If `key` is undefined the handler is called directly with no caching.
 */
export async function withIdempotency<T>(
  key: string | undefined,
  body: unknown,
  handler: () => Promise<{ response: T; statusCode: number }>,
): Promise<IdempotencyResult<T>> {
  if (!key) {
    const { response, statusCode } = await handler();
    return { replay: false, response, statusCode };
  }

  const bodyHash = hashBody(body);
  const cached = await db.idempotencyKey.findUnique({ where: { key } });

  if (cached) {
    if (cached.bodyHash !== bodyHash) {
      throw new IdempotencyConflictError();
    }
    return {
      replay: true,
      response: cached.response as T,
      statusCode: cached.statusCode,
    };
  }

  const { response, statusCode } = await handler();

  // Best effort — if two requests race we tolerate one losing.
  await db.idempotencyKey
    .create({
      data: {
        key,
        bodyHash,
        response: response as never,
        statusCode,
      },
    })
    .catch(() => undefined);

  return { replay: false, response, statusCode };
}
