/**
 * When the AI may quote a delivery fee.
 *
 * Only a price set for the place itself — a zone covering the customer's LGA
 * ("area") or their whole state ("state") — counts. Anything else (no zone,
 * the generic flat fallback, a zone left at ₦0) means we don't actually know
 * the fee, so the agent says a member of staff will confirm it instead of
 * quoting a number: the business would rather confirm than guess.
 */

import type { ResolvedShipping } from "@/lib/shipping-zone";

export function hasDeliveryPrice(r: Pick<ResolvedShipping, "source">): boolean {
  return r.source === "area" || r.source === "state";
}

export const DELIVERY_TBC = "To be confirmed";

export const DELIVERY_TBC_MESSAGE =
  "We don't have a delivery price for this address. Don't quote, estimate or calculate one: tell the customer a member of our team will confirm the delivery fee with them.";
