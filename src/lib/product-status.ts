/**
 * The stock-status rule, in one place.
 *
 * The admin products list and its CSV export both classify products, from
 * different shapes (a `Product` view model vs raw Prisma rows). Sharing the
 * predicate keeps "low stock" meaning the same thing in the table and in the
 * file staff download from it.
 */

import type { StockStatus } from "@/components/ui/status-pill";

/** Below this many units on hand, a product reads as low stock. */
export const LOW_STOCK_THRESHOLD = 20;

export function stockStatusFor(p: { preorder?: boolean; stock: number }): StockStatus {
  if (p.preorder) return "preorder";
  if (p.stock === 0) return "out_of_stock";
  if (p.stock < LOW_STOCK_THRESHOLD) return "low_stock";
  return "in_stock";
}
