/**
 * GET /api/v1/admin/orders/export
 *   ?from=YYYY-MM-DD&to=YYYY-MM-DD   optional date window (Lagos days, inclusive)
 *   &status=&payment=&source=&q=     the orders list's own filters
 *
 * CSV of the orders the list is currently showing. The filters are parsed by
 * the same `buildAdminOrdersWhere` the list page uses, so the CSV can never
 * disagree with what's on screen, and the rows are scoped to the operator's
 * active store like every other admin read.
 *
 * Capped at MAX_ROWS; when the cap bites, a final row says so rather than the
 * file just stopping. Permission: `orders.view`.
 */

import { NextRequest } from "next/server";
import { db, hasDatabase } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { buildAdminOrdersWhere } from "@/lib/data/orders";
import { getActiveAdminStoreId } from "@/lib/store";
import { parseExportDateRange } from "@/lib/date-range";
import { toCsv, csvResponse, capRows, truncationRow, EXPORT_ROW_CAP } from "@/lib/csv";
import { handleApiError } from "@/lib/api-response";
import { AppError } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Split a comma-separated query param into a clean string array. */
function parseList(v: string | null): string[] {
  if (!v) return [];
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

/** Human labels for the payment methods a customer can pay with. */
const METHOD_LABEL: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  pos: "POS",
  nuqood: "Nuqood",
};

export async function GET(req: NextRequest) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "orders.view");

    if (!hasDatabase) {
      throw new AppError("DB_NOT_CONFIGURED", "Export requires DATABASE_URL.", 503);
    }

    const sp = req.nextUrl.searchParams;
    const range = parseExportDateRange(sp);
    const storeId = await getActiveAdminStoreId();

    const { statusWhere } = buildAdminOrdersWhere({
      storeId,
      status: sp.get("status"),
      payment: parseList(sp.get("payment")),
      source: parseList(sp.get("source")),
      search: sp.get("q"),
      from: range.from,
      to: range.to,
    });

    const found = await db.order.findMany({
      where: statusWhere,
      orderBy: { createdAt: "desc" },
      take: EXPORT_ROW_CAP + 1,
      include: {
        customer: { select: { name: true, phone: true, email: true } },
        createdBy: { select: { name: true } },
        payments: { select: { method: true, status: true } },
        // A COUNT beats pulling every line id back just to call `.length`.
        _count: { select: { lines: true } },
      },
    });
    const { rows: orders, truncated } = capRows(found, EXPORT_ROW_CAP);

    const headers = [
      "Order number",
      "Created at",
      "Status",
      "Payment status",
      "Payment method",
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
    const rows: (string | number)[][] = orders.map((o) => [
      o.number,
      o.createdAt.toISOString(),
      o.status,
      o.paymentStatus,
      [...new Set(o.payments.filter((p) => p.status === "completed").map((p) => p.method))]
        .map((m) => METHOD_LABEL[m] ?? m)
        .join(" | "),
      o.source,
      o.customer?.name ?? "",
      o.customer?.phone ?? "",
      o.customer?.email ?? "",
      o.shipName,
      `${o.shipLine1}${o.shipLine2 ? ", " + o.shipLine2 : ""}, ${o.shipCity}, ${o.shipState}`,
      o._count.lines,
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

    if (truncated) rows.push(truncationRow(EXPORT_ROW_CAP, headers.length));

    // No preamble line: row 1 stays the header row so the file imports cleanly
    // into a spreadsheet. The period lives in the filename instead.
    return csvResponse(`avmall-orders_${range.slug}.csv`, toCsv(headers, rows));
  } catch (err) {
    return handleApiError(err);
  }
}
