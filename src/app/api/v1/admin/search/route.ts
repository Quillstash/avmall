/**
 * GET /api/v1/admin/search?q=<query>
 *
 * Cross-entity admin search. Returns up to 5 hits per group across orders,
 * products, customers, staff, discounts, and returns. Staff session required;
 * each group is filtered to what the caller's role can view.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth";
import { searchAdminEntities } from "@/lib/data/admin-search";
import { apiSuccess, handleApiError } from "@/lib/api-response";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await requireStaffSession();
    const q = req.nextUrl.searchParams.get("q") ?? "";
    const results = await searchAdminEntities(q, session.permissions, 5);
    return NextResponse.json(apiSuccess(results));
  } catch (err) {
    return handleApiError(err);
  }
}
