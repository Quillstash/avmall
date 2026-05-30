/**
 * GET /api/v1/admin/products/search?q=<query>&limit=<n>
 *
 * Staff-only product search for the order builder, return form, etc.
 * Wraps lib/data/products.searchProducts behind a staff-auth guard.
 *
 * Permission: products.view
 */

import { NextRequest, NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { searchProducts } from "@/lib/data/products";
import { apiSuccess, handleApiError } from "@/lib/api-response";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "products.view");

    const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
    const limitParam = Number(req.nextUrl.searchParams.get("limit"));
    const limit = Math.min(
      Math.max(1, Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 8),
      20,
    );

    const hits = await searchProducts(q, limit);
    return NextResponse.json(apiSuccess({ products: hits }));
  } catch (err) {
    return handleApiError(err);
  }
}
