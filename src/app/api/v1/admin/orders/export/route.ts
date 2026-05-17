/**
 * GET /api/v1/admin/orders/export
 *
 * CSV dump of recent orders. Permission-gated by `orders.view` and capped at
 * 5000 rows to protect Neon — Phase 6 will push the heavy export through a
 * BullMQ worker per CLAUDE.md.
 */

import { NextRequest } from "next/server";
import { db, hasDatabase } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { toCsv, csvResponse } from "@/lib/csv";
import { handleApiError } from "@/lib/api-response";
import { AppError } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(_req: NextRequest) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "orders.view");

    if (!hasDatabase) {
      throw new AppError("DB_NOT_CONFIGURED", "Export requires DATABASE_URL.", 503);
    }

    const orders = await db.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 5000,
      include: {
        customer: { select: { name: true, phone: true, email: true } },
        createdBy: { select: { name: true } },
        lines: { select: { id: true } },
      },
    });

    const headers = [
      "Order number",
      "Created at",
      "Status",
      "Payment status",
      "Source",
      "Customer name",
      "Customer phone",
      "Customer email",
      "Recipient",
      "Ship to",
      "Items",
      "Subtotal (kobo)",
      "Discounts (kobo)",
      "Shipping (kobo)",
      "Total (kobo)",
      "Paid (kobo)",
      "Outstanding (kobo)",
      "Coupon",
      "Created by",
    ];
    const rows = orders.map((o) => [
      o.number,
      o.createdAt.toISOString(),
      o.status,
      o.paymentStatus,
      o.source,
      o.customer?.name ?? "",
      o.customer?.phone ?? "",
      o.customer?.email ?? "",
      o.shipName,
      `${o.shipLine1}${o.shipLine2 ? ", " + o.shipLine2 : ""}, ${o.shipCity}, ${o.shipState}`,
      o.lines.length,
      Number(o.subtotalKobo),
      Number(o.bulkDiscountKobo) +
        Number(o.couponDiscountKobo) +
        Number(o.manualDiscountKobo),
      Number(o.shippingKobo),
      Number(o.totalKobo),
      Number(o.paidKobo),
      Number(o.totalKobo) - Number(o.paidKobo),
      o.appliedCouponCode ?? "",
      o.createdBy?.name ?? "",
    ]);

    const stamp = new Date().toISOString().slice(0, 10);
    return csvResponse(`avmall-orders-${stamp}.csv`, toCsv(headers, rows));
  } catch (err) {
    return handleApiError(err);
  }
}
