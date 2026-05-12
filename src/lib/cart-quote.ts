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

import { applyPercentageDiscount } from "./money";

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
    if (input.coupon.type === "percentage") {
      couponDiscountKobo = applyPercentageDiscount(afterBulk, input.coupon.value);
    } else if (input.coupon.type === "fixed") {
      couponDiscountKobo = Math.min(afterBulk, input.coupon.value);
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
