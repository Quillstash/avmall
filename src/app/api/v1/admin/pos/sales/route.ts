/**
 * POST /api/v1/admin/pos/sales
 *
 * Point-of-sale "register" sale for walk-in customers. Unlike the manual
 * order endpoint (which creates a `pending`/`unpaid` order and reserves stock
 * for later fulfilment), a register sale settles immediately: the customer
 * pays and carries the goods out the door. So in one transaction we
 *   1. reserve stock (SELECT FOR UPDATE availability check), then
 *   2. consume it right away — on_hand is decremented now,
 *   3. create the order as source `walkin`, status `delivered`, no customer,
 *   4. record the (possibly split) cash / POS / transfer payments.
 *
 * There is no shipping (in-store pickup) and no linked customer — walk-ins
 * aren't asked for details. Change is handled client-side; the amounts that
 * arrive here are the portions actually applied to the order, so their sum is
 * never allowed to exceed the total.
 *
 * Body:
 *   {
 *     items: [{ productSlug, quantity }],
 *     payments: [{ method: "cash"|"pos"|"bank_transfer", amountKobo, reference? }],
 *     manualDiscountKobo?: number,
 *     note?: string,
 *   }
 *
 * Response (201):
 *   { order: { id, number, status, paymentStatus, totalKobo, paidKobo,
 *              subtotalKobo, discountKobo, lines: [...] } }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, hasDatabase } from "@/lib/db";
import { computeQuote, type QuoteInputLine } from "@/lib/cart-quote";
import { reserveStock, consumeReservations } from "@/lib/stock";
import { nextOrderNumber } from "@/lib/order-number";
import { writeAudit } from "@/lib/audit";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { resolveStaffStoreId } from "@/lib/store";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError, NotFoundError, ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

const bodySchema = z.object({
  items: z
    .array(
      z.object({
        productSlug: z.string().min(1),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1, "Add at least one item"),
  payments: z
    .array(
      z.object({
        method: z.enum(["cash", "pos", "bank_transfer"]),
        amountKobo: z.number().int().positive(),
        reference: z.string().optional(),
      }),
    )
    .default([]),
  manualDiscountKobo: z.number().int().nonnegative().default(0),
  note: z.string().optional(),
  /** Till store. All-store operators (manager/super_admin) can pass one;
   *  otherwise the operator's home store is used. */
  storeId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "orders.create");

    if (!hasDatabase) {
      throw new AppError(
        "DB_NOT_CONFIGURED",
        "Register sales require DATABASE_URL.",
        503,
      );
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ValidationError({
        [issue?.path.join(".") ?? "body"]: issue?.message ?? "Invalid",
      });
    }
    const body = parsed.data;

    // The register sells from the operator's store (or a till store an
    // all-store operator passed explicitly).
    const storeId = body.storeId ?? (await resolveStaffStoreId(session));
    if (!storeId) {
      throw new AppError("NO_STORE", "No store assigned to this register.", 400);
    }

    // Hydrate products by slug (mock-data slugs match DB slugs, so the picker
    // can submit slugs without resolving UUIDs). Same shape as the manual
    // order endpoint so pricing + bulk tiers stay identical. Store stock is
    // loaded for the till store so we sell from the right shelf.
    const slugs = Array.from(new Set(body.items.map((i) => i.productSlug)));
    const products = await db.product.findMany({
      where: { slug: { in: slugs }, archivedAt: null, published: true },
      include: {
        variants: {
          orderBy: { position: "asc" },
          include: { storeStock: { where: { storeId } } },
        },
        bulkTiers: true,
      },
    });
    const productBySlug = new Map(products.map((p) => [p.slug, p]));

    const inputLines: QuoteInputLine[] = body.items.map((item) => {
      const p = productBySlug.get(item.productSlug);
      if (!p) throw new NotFoundError(`Product ${item.productSlug}`);

      // Prefer a variant that's actually in stock at this store.
      const variant =
        p.variants.find((v) => {
          const s = v.storeStock[0];
          return s && s.onHand - s.reserved > 0;
        }) ?? p.variants[0];
      if (!variant) throw new NotFoundError(`Variant for ${item.productSlug}`);

      const unitKobo = Number(
        variant.priceKobo ??
          (p.saleActive && p.saleKobo != null ? p.saleKobo : p.priceKobo),
      );

      return {
        productId: p.id,
        variantId: variant.id,
        quantity: item.quantity,
        unitKobo,
        bulkTiers: p.bulkTiers.map((t) => ({
          min: t.min,
          max: t.max,
          type: t.type,
          value: t.value,
        })),
      };
    });

    // Register sales have no delivery — goods leave in-store.
    const quote = computeQuote({
      lines: inputLines,
      manualDiscountKobo: body.manualDiscountKobo,
      shippingKobo: 0,
    });

    // The ledger must never sum above the order total — any excess cash is
    // change, not revenue. Trim the overage off cash rows (server is the
    // source of truth for the total, so this also absorbs a stale client total
    // from e.g. a bulk tier the picker didn't preview). Only card/transfer
    // genuinely can't overpay, so an overage left after draining cash is a
    // real error.
    const payments = body.payments.map((p) => ({ ...p }));
    let over = Math.max(
      0,
      payments.reduce((a, p) => a + p.amountKobo, 0) - quote.totalKobo,
    );
    for (const p of payments) {
      if (over <= 0) break;
      if (p.method === "cash") {
        const take = Math.min(over, p.amountKobo);
        p.amountKobo -= take;
        over -= take;
      }
    }
    if (over > 0) {
      throw new ValidationError({
        payments: "Card / transfer payments exceed the order total.",
      });
    }
    const finalPayments = payments.filter((p) => p.amountKobo > 0);
    const paidKobo = finalPayments.reduce((a, p) => a + p.amountKobo, 0);

    const paymentStatus =
      paidKobo >= quote.totalKobo
        ? ("paid" as const)
        : paidKobo > 0
          ? ("partial" as const)
          : ("unpaid" as const);

    const order = await db.$transaction(
      async (tx) => {
        // Reserve stock (locks variant rows + checks availability), then keep
        // the reservation ids so we can consume exactly these — decrementing
        // on_hand now rather than at a later "shipped" step.
        const reservations = await reserveStock(
          tx,
          storeId,
          inputLines.map((l) => ({
            productId: l.productId,
            variantId: l.variantId,
            quantity: l.quantity,
          })),
          null,
        );
        const reservationIds = reservations.map((r) => r.reservationId);

        const orderNumber = await nextOrderNumber(tx);
        const now = new Date();

        const created = await tx.order.create({
          data: {
            number: orderNumber,
            customerId: null,
            storeId,
            status: "delivered",
            paymentStatus,
            source: "walkin",
            shipName: "Walk-in customer",
            shipPhone: "Walk-in",
            shipLine1: "Walk-in (in-store)",
            shipCity: "Lagos",
            shipState: "Lagos",
            shippingZoneId: null,
            subtotalKobo: BigInt(quote.subtotalKobo),
            bulkDiscountKobo: BigInt(quote.bulkDiscountKobo),
            couponDiscountKobo: BigInt(0),
            manualDiscountKobo: BigInt(quote.manualDiscountKobo),
            shippingKobo: BigInt(0),
            totalKobo: BigInt(quote.totalKobo),
            paidKobo: BigInt(paidKobo),
            createdById: session.id,
            deliveredAt: now,
            customerNote: body.note ?? null,
            lines: {
              create: quote.lines.map((l) => {
                const p = products.find((x) => x.id === l.productId)!;
                const v = p.variants.find((x) => x.id === l.variantId);
                return {
                  productId: l.productId,
                  variantId: l.variantId,
                  nameSnapshot: p.name,
                  variantSnapshot: v?.label ?? null,
                  skuSnapshot: v?.sku ?? p.slug.toUpperCase(),
                  quantity: l.quantity,
                  unitKobo: BigInt(l.unitKobo),
                  bulkDiscountKobo: BigInt(l.bulkDiscountKobo),
                  bulkTierLabel: l.bulkTierLabel,
                  preorder: p.preorder,
                };
              }),
            },
          },
          include: { lines: true },
        });

        // Tie the reservations to the order, then consume them — on_hand drops
        // immediately because the customer walks out with the goods.
        await tx.stockReservation.updateMany({
          where: { id: { in: reservationIds } },
          data: { orderId: created.id },
        });
        await consumeReservations(tx, reservationIds);

        // Record each tendered payment as a completed ledger entry.
        for (const p of finalPayments) {
          await tx.orderPayment.create({
            data: {
              orderId: created.id,
              method: p.method,
              amountKobo: BigInt(p.amountKobo),
              reference: p.reference?.trim() || null,
              status: "completed",
              recordedById: session.id,
            },
          });
        }

        await writeAudit(
          {
            actorUserId: session.id,
            actorType: "staff",
            action: "pos.sale",
            entityType: "order",
            entityId: created.id,
            after: {
              number: created.number,
              totalKobo: quote.totalKobo,
              paidKobo,
              paymentStatus,
              items: created.lines.length,
              payments: finalPayments.map((p) => ({
                method: p.method,
                amountKobo: p.amountKobo,
              })),
            },
          },
          tx,
        );

        return created;
      },
      { timeout: 20_000, maxWait: 10_000 },
    );

    return NextResponse.json(
      apiSuccess({
        order: {
          id: order.id,
          number: order.number,
          status: order.status,
          paymentStatus: order.paymentStatus,
          totalKobo: Number(order.totalKobo),
          paidKobo: Number(order.paidKobo),
          subtotalKobo: Number(order.subtotalKobo),
          discountKobo:
            Number(order.bulkDiscountKobo) + Number(order.manualDiscountKobo),
          lines: order.lines.map((l) => ({
            name: l.nameSnapshot,
            variant: l.variantSnapshot ?? "—",
            sku: l.skuSnapshot,
            qty: l.quantity,
            unitKobo: Number(l.unitKobo),
            discountKobo: Number(l.bulkDiscountKobo),
          })),
        },
      }),
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err);
  }
}
