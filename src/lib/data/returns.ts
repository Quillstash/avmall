/**
 * Returns data layer. Mirrors the view-shape used by the admin returns page.
 */

import "server-only";

import { db, hasDatabase, withRetry } from "@/lib/db";
import {
  RETURNS as MOCK_RETURNS,
  type ReturnListRow,
} from "@/lib/admin-mock-data";

export type { ReturnListRow };

const SLA_HOURS = 48;

function formatLagosShort(d: Date): string {
  return d.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    timeZone: "Africa/Lagos",
  });
}

export async function listAdminReturns(): Promise<ReturnListRow[]> {
  if (!hasDatabase) {
    return [...MOCK_RETURNS];
  }

  const rows = await withRetry(() =>
    db.return.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        order: { select: { number: true } },
        customer: { select: { name: true } },
        lines: { select: { quantity: true } },
      },
    }),
  );

  const now = Date.now();
  return rows.map((r) => {
    const itemCount = r.lines.reduce((a, l) => a + l.quantity, 0);
    // SLA breach: still in flight after 48h.
    const slaBreached =
      r.status !== "refunded" &&
      r.status !== "rejected" &&
      now - r.createdAt.getTime() > SLA_HOURS * 60 * 60 * 1000;
    return {
      id: r.number,
      orderNumber: r.order.number,
      customerName: r.customer.name,
      itemCount,
      refundKobo: Number(r.refundKobo),
      status: r.status,
      reason: r.reason,
      ...(r.outsideWindow && { outsideWindow: true }),
      ...(r.fullyReturned && { fullyReturned: true }),
      ...(slaBreached && { slaBreached: true }),
      createdAt: formatLagosShort(r.createdAt),
    } satisfies ReturnListRow;
  });
}
