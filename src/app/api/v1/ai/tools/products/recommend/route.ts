/**
 * GET /api/v1/ai/tools/products/recommend
 *
 * Light recommendation surface for the AI agent. Two modes:
 *
 *   ?relatedTo=<slug>            — products in the same category, excluding the seed
 *   ?category=<slug>             — top picks in that category
 *   (neither)                    — featured / new arrivals across the catalogue
 *
 * Optional `?limit=<n>` (default 6, max 20).
 *
 * Auth: Bearer AI_AGENT_TOKEN
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAiAgent } from "@/lib/ai-auth";
import {
  getProductBySlug,
  getRelatedProducts,
  listProducts,
} from "@/lib/data/products";
import { apiSuccess, handleApiError } from "@/lib/api-response";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    requireAiAgent(req);
    const sp = req.nextUrl.searchParams;
    const relatedTo = sp.get("relatedTo")?.trim() ?? undefined;
    const category = sp.get("category")?.trim() ?? undefined;
    const limitParam = Number(sp.get("limit"));
    const limit = Math.min(
      Math.max(1, Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 6),
      20,
    );

    let products;
    if (relatedTo) {
      const seed = await getProductBySlug(relatedTo);
      if (!seed) {
        return NextResponse.json(
          apiSuccess({ basis: "related", seed: relatedTo, count: 0, products: [] }),
        );
      }
      const related = await getRelatedProducts(seed, limit);
      products = related;
    } else {
      products = await listProducts({
        ...(category && { category }),
        limit,
        featuredFirst: true,
      });
    }

    return NextResponse.json(
      apiSuccess({
        basis: relatedTo ? "related" : category ? "category" : "featured",
        ...(relatedTo && { seed: relatedTo }),
        ...(category && { category }),
        count: products.length,
        products: products.map((p) => ({
          id: p.id,
          slug: p.slug,
          name: p.name,
          brand: p.brand,
          category: p.category,
          priceKobo: p.price,
          saleKobo: p.saleActive && p.sale != null ? p.sale : null,
          inStock: p.stock > 0,
          imageUrl: p.imageUrl,
        })),
      }),
    );
  } catch (err) {
    return handleApiError(err);
  }
}
