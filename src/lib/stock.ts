/**
 * Stock reservation. Per CLAUDE.md §2.4 and §6:
 * — Adding to cart does NOT reduce on_hand.
 * — Checkout reserves stock for 15 minutes with SELECT FOR UPDATE inside a
 *   transaction so two simultaneous buyers can't both win the last unit.
 * — A cron job releases reservations that expire without becoming orders.
 */

import { Prisma } from "@prisma/client";
import { StockUnavailableError } from "./errors";

/** Default reservation lifetime — 15 minutes per the spec. */
export const RESERVATION_TTL_MS = 15 * 60 * 1000;

export interface ReservationRequest {
  productId: string;
  variantId: string | null;
  quantity: number;
}

export interface ReservationResult {
  productId: string;
  variantId: string | null;
  reservedQty: number;
  reservationId: string;
}

/**
 * Reserve stock for the given lines, locking variant rows for the transaction
 * duration. Throws `StockUnavailableError` if any line can't be fulfilled.
 *
 * Pass a Prisma transaction client — this MUST run inside an interactive
 * transaction so the row lock and the reservation insert are atomic.
 *
 *   await db.$transaction(async (tx) => {
 *     await reserveStock(tx, items, orderId);
 *     ...
 *   });
 */
export async function reserveStock(
  tx: Prisma.TransactionClient,
  items: ReservationRequest[],
  orderId: string | null,
  ttlMs: number = RESERVATION_TTL_MS,
): Promise<ReservationResult[]> {
  const results: ReservationResult[] = [];
  const expiresAt = new Date(Date.now() + ttlMs);

  for (const item of items) {
    // SELECT FOR UPDATE on the variant row — competing transactions wait here.
    // (Prisma doesn't expose SELECT FOR UPDATE directly, so we use $queryRaw.)
    const rows = await tx.$queryRaw<{ on_hand: number; reserved: number }[]>`
      SELECT on_hand, reserved
      FROM product_variants
      WHERE id = ${item.variantId}::uuid
        AND product_id = ${item.productId}::uuid
      FOR UPDATE
    `;

    if (rows.length === 0) {
      throw new StockUnavailableError(item.productId, 0, item.quantity);
    }

    const row = rows[0]!;
    const available = row.on_hand - row.reserved;
    if (available < item.quantity) {
      throw new StockUnavailableError(item.productId, available, item.quantity);
    }

    // Bump the reserved counter
    await tx.productVariant.update({
      where: { id: item.variantId! },
      data: { reserved: { increment: item.quantity } },
    });

    // Insert the reservation row
    const reservation = await tx.stockReservation.create({
      data: {
        productId: item.productId,
        variantId: item.variantId,
        orderId,
        quantity: item.quantity,
        expiresAt,
      },
    });

    results.push({
      productId: item.productId,
      variantId: item.variantId,
      reservedQty: item.quantity,
      reservationId: reservation.id,
    });
  }

  return results;
}

/**
 * Release reservations explicitly (e.g. order cancelled). Decrements
 * `reserved` on each affected variant and marks the reservation rows as
 * released.
 */
export async function releaseReservations(
  tx: Prisma.TransactionClient,
  reservationIds: string[],
): Promise<void> {
  if (reservationIds.length === 0) return;

  const reservations = await tx.stockReservation.findMany({
    where: { id: { in: reservationIds }, status: "active" },
  });

  for (const r of reservations) {
    if (r.variantId) {
      await tx.productVariant.update({
        where: { id: r.variantId },
        data: { reserved: { decrement: r.quantity } },
      });
    }
  }

  await tx.stockReservation.updateMany({
    where: { id: { in: reservationIds }, status: "active" },
    data: { status: "released" },
  });
}

/**
 * Convert an active reservation to "consumed" when the order is paid &
 * fulfilled. on_hand is decremented and reserved is freed.
 */
export async function consumeReservations(
  tx: Prisma.TransactionClient,
  reservationIds: string[],
): Promise<void> {
  if (reservationIds.length === 0) return;

  const reservations = await tx.stockReservation.findMany({
    where: { id: { in: reservationIds }, status: "active" },
  });

  for (const r of reservations) {
    if (r.variantId) {
      await tx.productVariant.update({
        where: { id: r.variantId },
        data: {
          onHand: { decrement: r.quantity },
          reserved: { decrement: r.quantity },
        },
      });
    }
  }

  await tx.stockReservation.updateMany({
    where: { id: { in: reservationIds }, status: "active" },
    data: { status: "consumed" },
  });
}

/**
 * Sweep expired reservations. Called by the BullMQ cron (Phase 5) but safe
 * to run manually.
 */
export async function expireOldReservations(
  tx: Prisma.TransactionClient,
): Promise<number> {
  const expired = await tx.stockReservation.findMany({
    where: { status: "active", expiresAt: { lt: new Date() } },
  });
  await releaseReservations(
    tx,
    expired.map((r) => r.id),
  );
  return expired.length;
}
