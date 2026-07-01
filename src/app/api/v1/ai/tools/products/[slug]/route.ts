/**
 * GET /api/v1/ai/tools/products/[slug]
 *
 * Full product detail for the AI agent — used when the customer asks a
 * specific question ("does it have x?", "what's the bulk rate at 50?").
 *
 * Per CLAUDE.md §21 the negotiation floor is NEVER included in this payload.
 * Use POST /api/v1/ai/tools/negotiate to check a counter-offer instead.
 *
 * Auth: public — read-only catalogue tool, no token required.
 */

import { NextRequest, NextResponse } from "next/server";
import { getProductBySlug } from "@/lib/data/products";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { NotFoundError } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    // Public tool: no auth required — read-only catalogue/quote data.

    const p = await getProductBySlug(params.slug);
    if (!p) throw new NotFoundError("Product");

    return NextResponse.json(
      apiSuccess({
        id: p.id,
        slug: p.slug,
        name: p.name,
        brand: p.brand,
        category: p.category,
        shortDescription: p.short,
        imageUrl: p.imageUrl,
        priceKobo: p.price,
        saleKobo: p.saleActive && p.sale != null ? p.sale : null,
        inStock: p.stock > 0,
        stock: p.stock,
        // Variant matrix (size × colour). Hidden when there's only a default
        // single variant.
        ...(p.option1Name && { option1Name: p.option1Name }),
        ...(p.option2Name && { option2Name: p.option2Name }),
        variants: p.variants.map((v) => ({
          id: v.id,
          label: v.label,
          stock: v.stock,
          ...(v.price != null && { priceKobo: v.price }),
          ...(v.option1Value && { option1Value: v.option1Value }),
          ...(v.option2Value && { option2Value: v.option2Value }),
        })),
        // Bulk pricing tiers — the agent can quote these directly.
        bulkTiers: p.bulk.map((t) => ({
          min: t.min,
          max: t.max,
          type: t.type,
          value: t.value,
        })),
        negotiable: !!p.negotiate,
        preorder: !!p.preorder,
        ...(p.moq != null && { moq: p.moq }),
        ...(p.eta && { eta: p.eta }),
      }),
    );
  } catch (err) {
    return handleApiError(err);
  }
}
