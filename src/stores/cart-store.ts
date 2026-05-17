"use client";

/**
 * Cart store (Phase 2 client-only — will be replaced by server cart API in Phase 4).
 * Mirrors the future server contract: line items + qty, totals computed via the quote endpoint.
 * For now, the client computes the quote locally using a product snapshot stored on
 * each line at add-time. The snapshot is what makes the cart work for products
 * created at runtime in the DB (whose UUIDs aren't in the mock catalogue).
 *
 * See CLAUDE.md §12 — production cart is server-managed via POST /api/v1/cart/:id/quote.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { PRODUCTS, type Product, type ProductVariant } from "@/lib/mock-data";
import { applyPercentageDiscount } from "@/lib/money";

export interface CartLineSnapshot {
  slug: string;
  name: string;
  brand: string;
  imageUrl: string;
  bg: string;
  variantLabel: string;
  unitKobo: number;
  /** Stock at the moment the line was added/refreshed. Authoritative check
   *  still happens at checkout reservation; this is the UI cap. Optional for
   *  legacy v2 lines that pre-date this field. */
  stock?: number;
  bulk: { min: number; max: number | null; type: "percentage" | "fixed"; value: number }[];
}

export interface CartLine {
  productId: string;
  variantId: string;
  qty: number;
  /** Snapshot is optional only because v1 lines in localStorage didn't have it. */
  snapshot?: CartLineSnapshot;
}

export interface ResolvedCartLine extends CartLine {
  snapshot: CartLineSnapshot;
  lineSubtotalKobo: number;
  bulkPct: number;
  bulkLabel: string | null;
  bulkDiscountKobo: number;
  lineTotalKobo: number;
}

interface CartState {
  lines: CartLine[];
  add: (product: Product, variantId: string, qty?: number) => void;
  remove: (productId: string, variantId: string) => void;
  setQty: (productId: string, variantId: string, qty: number) => void;
  clear: () => void;
}

function snapshotFor(product: Product, variant: ProductVariant): CartLineSnapshot {
  const unitKobo =
    variant.price ??
    (product.saleActive && product.sale != null ? product.sale : product.price);
  return {
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    imageUrl: product.imageUrl,
    bg: product.bg,
    variantLabel: variant.label,
    unitKobo,
    stock: variant.stock,
    bulk: product.bulk.map((t) => ({
      min: t.min,
      max: t.max,
      type: t.type,
      value: t.value,
    })),
  };
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      add: (product, variantId, qty = 1) =>
        set((state) => {
          const variant =
            product.variants.find((v) => v.id === variantId) ?? product.variants[0];
          if (!variant) return state;
          const snap = snapshotFor(product, variant);
          const idx = state.lines.findIndex(
            (l) => l.productId === product.id && l.variantId === variantId,
          );
          if (idx >= 0) {
            const next = [...state.lines];
            const existing = next[idx]!;
            next[idx] = {
              ...existing,
              qty: existing.qty + qty,
              snapshot: snap, // refresh snapshot on re-add (price may have changed)
            };
            return { lines: next };
          }
          return {
            lines: [
              ...state.lines,
              { productId: product.id, variantId, qty, snapshot: snap },
            ],
          };
        }),
      remove: (productId, variantId) =>
        set((state) => ({
          lines: state.lines.filter(
            (l) => !(l.productId === productId && l.variantId === variantId),
          ),
        })),
      setQty: (productId, variantId, qty) =>
        set((state) => ({
          lines: state.lines.map((l) =>
            l.productId === productId && l.variantId === variantId
              ? { ...l, qty: Math.max(1, qty) }
              : l,
          ),
        })),
      clear: () => set({ lines: [] }),
    }),
    {
      name: "avmall-cart",
      // v2 introduced per-line snapshots. v1 lines (just {productId, variantId, qty})
      // can't resolve against DB-created products, so we drop them on upgrade.
      version: 2,
      migrate: () => ({ lines: [] as CartLine[] }),
    },
  ),
);

/**
 * Resolve cart lines: prefer the per-line snapshot, fall back to the mock
 * catalogue only for legacy lines (rare — anything added since v2 has a snapshot).
 */
export function resolveCart(lines: CartLine[]): ResolvedCartLine[] {
  return lines.flatMap((line) => {
    let snap = line.snapshot;

    if (!snap) {
      // Legacy path: try the mock catalogue. Will return [] for DB UUIDs.
      const product = PRODUCTS.find((p) => p.id === line.productId);
      if (!product) return [];
      const variant = product.variants.find((v) => v.id === line.variantId);
      if (!variant) return [];
      snap = snapshotFor(product, variant);
    }

    const lineSubtotalKobo = snap.unitKobo * line.qty;

    let bulkPct = 0;
    let bulkLabel: string | null = null;
    for (const tier of snap.bulk) {
      if (line.qty >= tier.min && (tier.max == null || line.qty <= tier.max)) {
        bulkPct = tier.value;
        bulkLabel = `${tier.value}% off (${tier.min}+)`;
      }
    }

    const bulkDiscountKobo = applyPercentageDiscount(lineSubtotalKobo, bulkPct);

    return [
      {
        ...line,
        snapshot: snap,
        lineSubtotalKobo,
        bulkPct,
        bulkLabel,
        bulkDiscountKobo,
        lineTotalKobo: lineSubtotalKobo - bulkDiscountKobo,
      },
    ];
  });
}

export interface CartTotals {
  subtotalKobo: number;
  bulkDiscountKobo: number;
  couponDiscountKobo: number;
  shippingKobo: number;
  totalKobo: number;
  itemCount: number;
}

export function computeTotals(
  resolved: ResolvedCartLine[],
  {
    couponPct = 0,
    shippingKobo = 0,
  }: { couponPct?: number; shippingKobo?: number } = {},
): CartTotals {
  const subtotalKobo = resolved.reduce((a, l) => a + l.lineSubtotalKobo, 0);
  const bulkDiscountKobo = resolved.reduce((a, l) => a + l.bulkDiscountKobo, 0);
  const afterBulk = subtotalKobo - bulkDiscountKobo;
  const couponDiscountKobo = applyPercentageDiscount(afterBulk, couponPct);
  const totalKobo = afterBulk - couponDiscountKobo + shippingKobo;
  const itemCount = resolved.reduce((a, l) => a + l.qty, 0);

  return {
    subtotalKobo,
    bulkDiscountKobo,
    couponDiscountKobo,
    shippingKobo,
    totalKobo,
    itemCount,
  };
}
