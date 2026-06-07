/**
 * Returns data layer. Mirrors the view-shape used by the admin returns page.
 */

import "server-only";

import type { ReturnStatus, ReturnRefundMethod } from "@prisma/client";
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

function formatLagosDateTime(d: Date): string {
  return d.toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  });
}

export interface AdminReturnDetailLine {
  id: string;
  name: string;
  variant: string;
  quantity: number;
  unitKobo: number;
  condition: "unopened" | "used" | "damaged";
  restock: boolean;
  refundKobo: number;
}

export interface AdminReturnDetail {
  id: string;
  number: string;
  status: ReturnStatus;
  reason: string;
  internalNote: string | null;
  refundKobo: number;
  refundMethod: ReturnRefundMethod;
  outsideWindow: boolean;
  fullyReturned: boolean;
  photos: string[];
  createdAt: string;
  orderNumber: string;
  customer: { id: string; name: string; phone: string };
  lines: AdminReturnDetailLine[];
}

/** Full return for the admin detail page. Looked up by the customer-facing
 *  RET-XXXXXXX number (that's what the list links carry). */
export async function getAdminReturnByNumber(
  number: string,
): Promise<AdminReturnDetail | null> {
  if (!hasDatabase) return null;

  const r = await withRetry(() =>
    db.return.findUnique({
      where: { number },
      include: {
        order: { select: { number: true } },
        customer: { select: { id: true, name: true, phone: true } },
        lines: {
          include: {
            orderLine: {
              select: {
                nameSnapshot: true,
                variantSnapshot: true,
                unitKobo: true,
              },
            },
          },
        },
      },
    }),
  );
  if (!r) return null;

  return {
    id: r.id,
    number: r.number,
    status: r.status,
    reason: r.reason,
    internalNote: r.internalNote,
    refundKobo: Number(r.refundKobo),
    refundMethod: r.refundMethod,
    outsideWindow: r.outsideWindow,
    fullyReturned: r.fullyReturned,
    photos: r.photos,
    createdAt: formatLagosDateTime(r.createdAt),
    orderNumber: r.order.number,
    customer: {
      id: r.customer.id,
      name: r.customer.name,
      phone: r.customer.phone,
    },
    lines: r.lines.map((l) => ({
      id: l.id,
      name: l.orderLine.nameSnapshot,
      variant: l.orderLine.variantSnapshot ?? "",
      quantity: l.quantity,
      unitKobo: Number(l.orderLine.unitKobo),
      condition: l.condition,
      restock: l.restock,
      refundKobo: Number(l.refundKobo),
    })),
  };
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
