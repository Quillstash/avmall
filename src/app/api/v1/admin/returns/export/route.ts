/** GET /api/v1/admin/returns/export — CSV dump. Permission: returns.view */

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
    requirePermission(session, "returns.view");

    if (!hasDatabase) {
      throw new AppError("DB_NOT_CONFIGURED", "Export requires DATABASE_URL.", 503);
    }

    const rows = await db.return.findMany({
      orderBy: { createdAt: "desc" },
      take: 5000,
      include: {
        order: { select: { number: true } },
        customer: { select: { name: true, phone: true } },
        lines: { select: { quantity: true } },
      },
    });

    const headers = [
      "Return number",
      "Created at",
      "Status",
      "Order number",
      "Customer",
      "Customer phone",
      "Reason",
      "Refund method",
      "Refund (kobo)",
      "Items",
      "Outside window",
      "Fully returned",
    ];
    const data = rows.map((r) => [
      r.number,
      r.createdAt.toISOString(),
      r.status,
      r.order.number,
      r.customer.name,
      r.customer.phone,
      r.reason,
      r.refundMethod,
      Number(r.refundKobo),
      r.lines.reduce((a, l) => a + l.quantity, 0),
      r.outsideWindow ? "yes" : "",
      r.fullyReturned ? "yes" : "",
    ]);

    const stamp = new Date().toISOString().slice(0, 10);
    return csvResponse(`avmall-returns-${stamp}.csv`, toCsv(headers, data));
  } catch (err) {
    return handleApiError(err);
  }
}
