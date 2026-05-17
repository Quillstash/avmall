/**
 * GET /api/v1/ai/tools/categories
 *
 * Flat list of storefront categories with counts. Lets the AI offer
 * "browse by department"-style navigation.
 *
 * Auth: Bearer AI_AGENT_TOKEN
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAiAgent } from "@/lib/ai-auth";
import { listCategories } from "@/lib/data/products";
import { apiSuccess, handleApiError } from "@/lib/api-response";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    requireAiAgent(req);
    const cats = await listCategories();
    return NextResponse.json(
      apiSuccess({
        categories: cats.map((c) => ({
          slug: c.id,
          name: c.name,
          productCount: c.count,
        })),
      }),
    );
  } catch (err) {
    return handleApiError(err);
  }
}
