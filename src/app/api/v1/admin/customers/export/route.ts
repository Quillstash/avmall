/** GET /api/v1/admin/customers/export — CSV dump. Permission: customers.view */

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
    requirePermission(session, "customers.view");

    if (!hasDatabase) {
      throw new AppError("DB_NOT_CONFIGURED", "Export requires DATABASE_URL.", 503);
    }

    const customers = await db.customer.findMany({
      orderBy: { createdAt: "desc" },
      take: 5000,
      include: {
        orders: { select: { totalKobo: true, createdAt: true } },
      },
    });

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
    const rows = customers.map((c) => {
      const lifetime = c.orders.reduce((a, o) => a + Number(o.totalKobo), 0);
      const last = c.orders.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      )[0];
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

    const stamp = new Date().toISOString().slice(0, 10);
    return csvResponse(`avmall-customers-${stamp}.csv`, toCsv(headers, rows));
  } catch (err) {
    return handleApiError(err);
  }
}
