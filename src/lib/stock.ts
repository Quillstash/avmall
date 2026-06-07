/**
 * Per-store stock reservation. Per CLAUDE.md §2.4 and §6, now multi-store:
 * — Stock lives in `store_stock` (one row per store × variant). The old global
 *   ProductVariant.onHand/reserved was migrated into the Main store.
 * — Adding to cart does NOT reduce on_hand.
 * — Checkout reserves stock for 15 minutes with SELECT FOR UPDATE inside a
 *   transaction so two simultaneous buyers can't both win the last unit — the
 *   lock is taken on the (store, variant) `store_stock` row.
 * — Expired reservations get swept lazily at the start of every reserveStock()
 *   call, so a missed cron tick can't leak stock indefinitely.
 *
 * Every reservation/consume/release is scoped to a store: a sale in Lekki can't
 * draw down Ikoyi's shelf.
 */

import { Prisma } from "@prisma/client";
import { StockUnavailableError } from "./errors";

/** Default reservation lifetime — 15 minutes per the spec. */
export const RESERVATION_TTL_MS = 15 * 60 * 1000;

export interface ReservationRequest {
  productId: string;
  /** Store stock is tracked per variant; a null variant can't be reserved. */
  variantId: string | null;
  quantity: number;
}

export interface ReservationResult {
  productId: string;
  variantId: string;
  reservedQty: number;
  reservationId: string;
}

/**
 * Reserve stock for the given lines at a specific store, locking the
 * `store_stock` rows for the transaction duration. Throws
 * `StockUnavailableError` if a line can't be fulfilled at that store (including
 * when the product isn't stocked there at all — no store_stock row).
 *
 * Pass a Prisma transaction client — this MUST run inside an interactive
 * transaction so the row lock and the reservation insert are atomic.
 *
 *   await db.$transaction(async (tx) => {
 *     await reserveStock(tx, storeId, items, orderId);
 *     ...
 *   });
 */
export async function reserveStock(
  tx: Prisma.TransactionClient,
  storeId: string,
  items: ReservationRequest[],
  orderId: string | null,
  ttlMs: number = RESERVATION_TTL_MS,
): Promise<ReservationResult[]> {
  const results: ReservationResult[] = [];
  const expiresAt = new Date(Date.now() + ttlMs);

  // Sweep expired reservations first — frees up `reserved` counters before we
  // check availability. Cheap: indexed scan on (status, expires_at).
  await expireOldReservations(tx);

  for (const item of items) {
    // Store stock is keyed on variant — a line without one can't be reserved.
    if (!item.variantId) {
      throw new StockUnavailableError(item.productId, 0, item.quantity);
    }

    // SELECT FOR UPDATE on the (store, variant) stock row — competing
    // transactions wait here. (Prisma doesn't expose SELECT FOR UPDATE
    // directly, so we use $queryRaw.)
    const rows = await tx.$queryRaw<{ on_hand: number; reserved: number }[]>`
      SELECT on_hand, reserved
      FROM store_stock
      WHERE store_id = ${storeId}::uuid
        AND variant_id = ${item.variantId}::uuid
      FOR UPDATE
    `;

    if (rows.length === 0) {
      // Product/variant isn't stocked at this store.
      throw new StockUnavailableError(item.productId, 0, item.quantity);
    }

    const row = rows[0]!;
    const available = row.on_hand - row.reserved;
    if (available < item.quantity) {
      throw new StockUnavailableError(item.productId, available, item.quantity);
    }

    // Bump the reserved counter on the store_stock row.
    await tx.storeStock.update({
      where: { storeId_variantId: { storeId, variantId: item.variantId } },
      data: { reserved: { increment: item.quantity } },
    });

    // Insert the reservation row (scoped to the store).
    const reservation = await tx.stockReservation.create({
      data: {
        storeId,
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
 * `reserved` on each affected (store, variant) row and marks the reservation
 * rows as released.
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
      await tx.storeStock.update({
        where: { storeId_variantId: { storeId: r.storeId, variantId: r.variantId } },
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
 * Convert active reservations to "consumed" when the order is paid & fulfilled.
 * Decrements `on_hand` and frees `reserved` on each reservation's
 * (store, variant) stock row.
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
      await tx.storeStock.update({
        where: { storeId_variantId: { storeId: r.storeId, variantId: r.variantId } },
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
 * Sweep expired reservations. Called lazily by reserveStock() and by the
 * BullMQ cron. Safe to run manually.
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
