/**
 * GET /api/v1/admin/customers/export?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * CSV of customers, optionally limited to those who signed up inside a date
 * window (Lagos days, both ends inclusive). Scoped to the operator's active
 * store, matching the customers list. Permission: `customers.view`.
 *
 * Lifetime value and order count stay lifetime figures — the window picks
 * WHICH customers are listed, it does not slice their history.
 */

import { NextRequest } from "next/server";
import { db, hasDatabase } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { getActiveAdminStoreId } from "@/lib/store";
import { parseExportDateRange } from "@/lib/date-range";
import { toCsv, csvResponse, capRows, truncationRow, EXPORT_ROW_CAP } from "@/lib/csv";
import { handleApiError } from "@/lib/api-response";
import { AppError } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "customers.view");

    if (!hasDatabase) {
      throw new AppError("DB_NOT_CONFIGURED", "Export requires DATABASE_URL.", 503);
    }

    const range = parseExportDateRange(req.nextUrl.searchParams);
    const storeId = await getActiveAdminStoreId();

    const found = await db.customer.findMany({
      where: {
        ...(storeId ? { storeId } : {}),
        ...(range.active
          ? {
              createdAt: {
                ...(range.from ? { gte: range.from } : {}),
                ...(range.to ? { lt: range.to } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: EXPORT_ROW_CAP + 1,
      include: {
        // Newest first, so the "last order" is simply the head of the list.
        orders: {
          select: { totalKobo: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    const { rows: customers, truncated } = capRows(found, EXPORT_ROW_CAP);

    const headers = [
      "Customer ID",
      "Name",
      "Phone",
      "Email",
      "Segments",
      "Blacklisted",
      "Lifetime value (kobo)",
      "Orders",
      "Last order at",
      "Created at",
    ];
    const rows: (string | number)[][] = customers.map((c) => {
      const lifetime = c.orders.reduce((a, o) => a + Number(o.totalKobo), 0);
      const last = c.orders[0];
      return [
        c.id,
        c.name,
        c.phone,
        c.email ?? "",
        c.segments.join("|"),
        c.blacklisted ? "yes" : "",
        lifetime,
        c.orders.length,
        last?.createdAt.toISOString() ?? "",
        c.createdAt.toISOString(),
      ];
    });

    if (truncated) rows.push(truncationRow(EXPORT_ROW_CAP, headers.length));

    return csvResponse(`avmall-customers_${range.slug}.csv`, toCsv(headers, rows));
  } catch (err) {
    return handleApiError(err);
  }
}
