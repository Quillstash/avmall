/**
 * GET /api/v1/admin/orders/search?q=<query>
 *
 * Lightweight order typeahead — matches on order number, customer name/phone,
 * or the shipping snapshot. Returns up to 8 recent matches. Permission:
 * orders.view.
 */

import { NextRequest, NextResponse } from "next/server";
import { db, hasDatabase } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, handleApiError } from "@/lib/api-response";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "orders.view");

    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    if (!hasDatabase || q.length < 2) {
      return NextResponse.json(apiSuccess({ orders: [] }));
    }

    const rows = await db.order.findMany({
      where: {
        OR: [
          { number: { contains: q, mode: "insensitive" } },
          { shipName: { contains: q, mode: "insensitive" } },
          { shipPhone: { contains: q } },
          { customer: { name: { contains: q, mode: "insensitive" } } },
          { customer: { phone: { contains: q } } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        number: true,
        status: true,
        totalKobo: true,
        createdAt: true,
        shipName: true,
        shipPhone: true,
        customer: { select: { name: true, phone: true } },
      },
    });

    return NextResponse.json(
      apiSuccess({
        orders: rows.map((o) => ({
          number: o.number,
          customerName: o.customer?.name ?? o.shipName,
          customerPhone: o.customer?.phone ?? o.shipPhone,
          totalKobo: Number(o.totalKobo),
          status: o.status,
          createdAt: o.createdAt.toISOString(),
        })),
      }),
    );
  } catch (err) {
    return handleApiError(err);
  }
}
