/**
 * GET /api/v1/ai/tools/products/search?q=<query>&category=<slug>&limit=<n>
 *
 * Product search for the AI agent. Returns up to `limit` (default 6, max 20)
 * compact product hits suitable for the AI to summarise in a reply.
 *
 * Auth: public — read-only catalogue tool, no token required.
 */

import { NextRequest, NextResponse } from "next/server";
import { searchProducts, listProducts } from "@/lib/data/products";
import { apiSuccess, handleApiError } from "@/lib/api-response";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    // Public tool: no auth required — read-only catalogue/quote data.
    const sp = req.nextUrl.searchParams;
    const q = sp.get("q")?.trim() ?? "";
    const category = sp.get("category")?.trim() ?? undefined;
    const limitParam = Number(sp.get("limit"));
    const limit = Math.min(
      Math.max(1, Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 6),
      20,
    );

    // When `q` is short or missing, return category top picks so the agent
    // has something to suggest. When `q` is set, run the substring search.
    let products;
    if (q.length >= 2) {
      const hits = await searchProducts(q, limit);
      products = hits.map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        brand: p.brand,
        category: p.category,
        priceKobo: p.priceKobo,
        saleKobo: p.saleActive ? p.saleKobo : null,
        inStock: p.stock > 0,
        stock: p.stock,
        imageUrl: p.imageUrl,
      }));
    } else {
      const list = await listProducts({
        ...(category && { category }),
        limit,
        featuredFirst: true,
      });
      products = list.map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        brand: p.brand,
        category: p.category,
        priceKobo: p.price,
        saleKobo: p.saleActive && p.sale != null ? p.sale : null,
        inStock: p.stock > 0,
        stock: p.stock,
        imageUrl: p.imageUrl,
      }));
    }

    return NextResponse.json(
      apiSuccess({
        query: q,
        ...(category && { category }),
        count: products.length,
        products,
      }),
    );
  } catch (err) {
    return handleApiError(err);
  }
}
