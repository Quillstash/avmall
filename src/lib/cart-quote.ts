/**
 * Cart-quote computation. Pure function — given a set of line items + the
 * applied coupon + shipping context, returns the authoritative totals.
 *
 * Implements the discount stacking order from CLAUDE.md Appendix B:
 *   1. Product-level bulk tier (per line, before order total)
 *   2. Sale price override (replaces regular price, before coupon)
 *   3. Coupon — percentage first, then fixed-amount
 *   4. Manual staff discount (applied last)
 *   5. Shipping fee (separate from product discounts)
 *
 * Money is integer kobo. All Math.floor — never partial kobo. See §9.
 */

import type { PrismaClient } from "@prisma/client";
import { applyPercentageDiscount } from "./money";
import { AppError, NotFoundError } from "./errors";

export interface QuoteInputLine {
  productId: string;
  variantId: string | null;
  quantity: number;
  /// Unit price (kobo) — already reflects sale price when applicable.
  unitKobo: number;
  /// Sorted-ascending tier rules for this product.
  bulkTiers: { min: number; max: number | null; type: "percentage" | "fixed"; value: number }[];
}

export interface QuoteInput {
  lines: QuoteInputLine[];
  coupon?: {
    code: string;
    type: "percentage" | "fixed" | "free_shipping";
    value: number;
    /** Scope string from the Discount table. "all" | "category:slug" | "product:id1,id2" */
    scope?: string;
  };
  manualDiscountKobo?: number;
  shippingKobo?: number;
  /// True when the customer qualifies for free shipping by zone threshold.
  freeShippingEligible?: boolean;
}

export interface QuoteLine {
  productId: string;
  variantId: string | null;
  quantity: number;
  unitKobo: number;
  subtotalKobo: number;
  bulkDiscountKobo: number;
  bulkTierLabel: string | null;
  totalKobo: number;
}

export interface Quote {
  lines: QuoteLine[];
  subtotalKobo: number;
  bulkDiscountKobo: number;
  couponDiscountKobo: number;
  manualDiscountKobo: number;
  shippingKobo: number;
  totalKobo: number;
  itemCount: number;
}

/**
 * Find the active bulk tier for a given quantity. Returns the best (highest
 * value) tier that the qty satisfies.
 */
function pickTier(
  tiers: QuoteInputLine["bulkTiers"],
  qty: number,
): QuoteInputLine["bulkTiers"][number] | null {
  let best: QuoteInputLine["bulkTiers"][number] | null = null;
  for (const t of tiers) {
    const inRange = qty >= t.min && (t.max == null || qty <= t.max);
    if (inRange && (!best || t.value > best.value)) {
      best = t;
    }
  }
  return best;
}

export function computeQuote(input: QuoteInput): Quote {
  const lines: QuoteLine[] = input.lines.map((l) => {
    const subtotalKobo = l.unitKobo * l.quantity;
    const tier = pickTier(l.bulkTiers, l.quantity);

    let bulkDiscountKobo = 0;
    let bulkTierLabel: string | null = null;
    if (tier) {
      if (tier.type === "percentage") {
        bulkDiscountKobo = applyPercentageDiscount(subtotalKobo, tier.value);
      } else {
        // Fixed kobo per unit
        bulkDiscountKobo = Math.min(subtotalKobo, tier.value * l.quantity);
      }
      bulkTierLabel = `${tier.value}${tier.type === "percentage" ? "%" : "₦"} off (${tier.min}+)`;
    }

    return {
      productId: l.productId,
      variantId: l.variantId,
      quantity: l.quantity,
      unitKobo: l.unitKobo,
      subtotalKobo,
      bulkDiscountKobo,
      bulkTierLabel,
      totalKobo: subtotalKobo - bulkDiscountKobo,
    };
  });

  const subtotalKobo = lines.reduce((a, l) => a + l.subtotalKobo, 0);
  const bulkDiscountKobo = lines.reduce((a, l) => a + l.bulkDiscountKobo, 0);
  const afterBulk = subtotalKobo - bulkDiscountKobo;

  let couponDiscountKobo = 0;
  let shippingOverride: number | undefined;
  if (input.coupon) {
    // Scope filtering: "product:id1,id2" → only apply to matching lines.
    // "all" or absent → apply to full afterBulk total.
    const scope = input.coupon.scope ?? "all";
    let couponBase = afterBulk;
    if (scope.startsWith("product:")) {
      const allowed = new Set(scope.slice("product:".length).split(",").map((s) => s.trim()));
      couponBase = lines
        .filter((l) => allowed.has(l.productId))
        .reduce((a, l) => a + l.totalKobo, 0);
    }

    if (input.coupon.type === "percentage") {
      couponDiscountKobo = applyPercentageDiscount(couponBase, input.coupon.value);
    } else if (input.coupon.type === "fixed") {
      couponDiscountKobo = Math.min(couponBase, input.coupon.value);
    } else if (input.coupon.type === "free_shipping") {
      shippingOverride = 0;
    }
  }

  let manualDiscountKobo = input.manualDiscountKobo ?? 0;
  // Cap manual discount at the remaining amount so the server never goes negative.
  manualDiscountKobo = Math.min(manualDiscountKobo, afterBulk - couponDiscountKobo);

  const baseShipping = input.shippingKobo ?? 0;
  const shippingKobo =
    shippingOverride !== undefined
      ? shippingOverride
      : input.freeShippingEligible
        ? 0
        : baseShipping;

  const totalKobo =
    afterBulk - couponDiscountKobo - manualDiscountKobo + shippingKobo;

  const itemCount = lines.reduce((a, l) => a + l.quantity, 0);

  return {
    lines,
    subtotalKobo,
    bulkDiscountKobo,
    couponDiscountKobo,
    manualDiscountKobo,
    shippingKobo,
    totalKobo,
    itemCount,
  };
}

/**
 * DB-backed wrapper around `computeQuote`. Used by every consumer that takes
 * an opaque cart from the client (storefront cart, customer checkout, admin
 * manual order). Hydrates real prices, validates the coupon against the
 * Discount table, picks the shipping zone by state.
 *
 * Throws NotFoundError for missing products, AppError("COUPON_INVALID") for
 * expired / used-up coupons. Soft-fails (no error, no coupon applied) when
 * the code simply doesn't exist — the storefront treats that as "invalid".
 */
export interface QuoteFromIdsInput {
  items: { productId: string; variantId: string | null; quantity: number }[];
  couponCode?: string | undefined;
  /// Nigerian state. When provided we pick the matching zone; otherwise
  /// shipping is zero and the caller must remind the customer it's TBD.
  state?: string | undefined;
}

export interface QuoteFromIdsResult {
  quote: Quote;
  couponApplied?: { code: string; type: "percentage" | "fixed" | "free_shipping"; value: number; scope?: string };
  couponRejected?: string;
  shippingZone?: { name: string; etaDays: string };
}

/**
 * The store an order belongs to, derived from the products in the cart.
 * Products are per-store, so a product id uniquely identifies its store — this
 * is the authoritative source of truth for order/payment attribution (more
 * reliable than an ambient cookie). Throws if the cart is empty or mixes
 * products from different stores (orders can't span stores).
 */
export async function resolveCartStoreId(
  db: PrismaClient,
  productIds: string[],
): Promise<string> {
  const ids = Array.from(new Set(productIds));
  const rows = await db.product.findMany({
    where: { id: { in: ids } },
    select: { storeId: true },
  });
  const stores = new Set(rows.map((r) => r.storeId));
  if (stores.size === 0) throw new NotFoundError("Products");
  if (stores.size > 1) {
    throw new AppError(
      "MIXED_STORES",
      "These items belong to different stores. Please check out one store at a time.",
      422,
    );
  }
  return [...stores][0]!;
}

export async function quoteFromProductIds(
  db: PrismaClient,
  input: QuoteFromIdsInput,
): Promise<QuoteFromIdsResult> {
  const productIds = Array.from(new Set(input.items.map((i) => i.productId)));
  const products = await db.product.findMany({
    where: { id: { in: productIds }, archivedAt: null, published: true },
    include: { variants: true, bulkTiers: true },
  });
  const productById = new Map(products.map((p) => [p.id, p]));

  const inputLines: QuoteInputLine[] = input.items.map((item) => {
    const p = productById.get(item.productId);
    if (!p) throw new NotFoundError(`Product ${item.productId}`);

    const variant = item.variantId
      ? p.variants.find((v) => v.id === item.variantId)
      : null;
    if (item.variantId && !variant) {
      throw new NotFoundError(`Variant ${item.variantId}`);
    }

    const unitKobo = Number(
      variant?.priceKobo ?? (p.saleActive && p.saleKobo != null ? p.saleKobo : p.priceKobo),
    );

    return {
      productId: p.id,
      variantId: variant?.id ?? null,
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

  // Coupon lookup. Distinguish "valid but expired/used-up" (422) from
  // "unknown code" (soft-rejected) — the AI cart-quote tool does the same.
  let couponApplied: QuoteFromIdsResult["couponApplied"];
  let couponRejected: string | undefined;
  if (input.couponCode) {
    const code = input.couponCode.toUpperCase();
    const c = await db.discount.findUnique({ where: { code } });
    const now = new Date();
    if (
      c &&
      c.active &&
      (!c.validFrom || c.validFrom <= now) &&
      (!c.validUntil || c.validUntil >= now) &&
      (c.usageLimit == null || c.usage < c.usageLimit)
    ) {
      couponApplied = { code: c.code!, type: c.valueType, value: c.value, scope: c.scope };
    } else if (c) {
      throw new AppError("COUPON_INVALID", "Coupon expired or has hit its usage limit", 422);
    } else {
      couponRejected = code;
    }
  }

  // Shipping zone. When the customer hasn't picked a state yet, the cart
  // page should show "calculated at checkout" — we still return a quote but
  // shippingKobo stays 0 and no zone is returned.
  let shippingKobo = 0;
  let freeShippingEligible = false;
  let shippingZone: QuoteFromIdsResult["shippingZone"];
  if (input.state) {
    const zone = await db.shippingZone.findFirst({
      where: { active: true, states: { has: input.state } },
      orderBy: { createdAt: "asc" },
    });
    if (zone) {
      shippingZone = { name: zone.name, etaDays: zone.etaDays };
      shippingKobo = Number(zone.baseRateKobo);
      if (zone.freeOverKobo != null) {
        const dry = computeQuote({ lines: inputLines });
        if (BigInt(dry.subtotalKobo - dry.bulkDiscountKobo) >= zone.freeOverKobo) {
          freeShippingEligible = true;
        }
      }
    } else {
      const fb = await db.fallbackShipping.findFirst();
      if (fb?.enabled) {
        shippingKobo = Number(fb.flatRateKobo);
        shippingZone = { name: "Standard", etaDays: fb.etaDays };
      }
    }
  }

  const quote = computeQuote({
    lines: inputLines,
    ...(couponApplied && { coupon: couponApplied }),
    shippingKobo,
    freeShippingEligible,
  });

  return {
    quote,
    ...(couponApplied && { couponApplied }),
    ...(couponRejected && { couponRejected }),
    ...(shippingZone && { shippingZone }),
  };
}
