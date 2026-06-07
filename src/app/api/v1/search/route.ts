/**
 * GET /api/v1/search?q=<query>&limit=<n>
 *
 * Storefront product search. Returns up to `limit` (default 8) lightweight
 * product hits for the top-nav dropdown. Sub-2-char queries return [].
 */

import { NextRequest, NextResponse } from "next/server";
import { searchProducts } from "@/lib/data/products";
import { getStorefrontStoreId } from "@/lib/store";
import { apiSuccess, handleApiError } from "@/lib/api-response";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q") ?? "";
    const limitRaw = req.nextUrl.searchParams.get("limit");
    const limit = Math.min(
      Math.max(1, Number.isFinite(Number(limitRaw)) ? Number(limitRaw) : 8),
      20,
    );

    const storeId = (await getStorefrontStoreId()) ?? undefined;
    const hits = await searchProducts(q, limit, storeId);
    return NextResponse.json(apiSuccess({ products: hits }));
  } catch (err) {
    return handleApiError(err);
  }
}
