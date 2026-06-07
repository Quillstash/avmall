/**
 * POST /api/v1/admin/products/ai/generate-copy
 *
 * Generate a short description, full description, and tags from a product name
 * (+ optional brand/category) using OpenAI. Permission: products.create.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { hasOpenAI, openaiChatJSON } from "@/lib/openai";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError, ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

const bodySchema = z.object({
  name: z.string().min(1, "Product name is required"),
  brand: z.string().optional(),
  category: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "products.create");

    if (!hasOpenAI) {
      throw new AppError(
        "AI_NOT_CONFIGURED",
        "Set OPENAI_API_KEY to use AI generation.",
        503,
      );
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new ValidationError({
        name: parsed.error.issues[0]?.message ?? "Invalid",
      });
    }
    const b = parsed.data;

    const result = await openaiChatJSON({
      system:
        "You are a product copywriter for Avmall, a Nigerian online store. Write clear, benefit-led, honest copy. Prices are in Naira (₦). Never invent specs you weren't given. Return STRICT JSON only.",
      user: [
        "Write store copy for this product.",
        `Name: ${b.name}`,
        `Brand: ${b.brand?.trim() || "unbranded"}`,
        `Category: ${b.category?.trim() || "general"}`,
        "",
        'Return JSON with exactly these keys: { "shortDescription": string (one punchy sentence, max 140 chars), "description": string (2-3 short paragraphs of plain text separated by blank lines, no markdown or HTML), "tags": string[] (5-8 short lowercase keywords, no "#") }',
      ].join("\n"),
    });

    const shortDesc =
      typeof result.shortDescription === "string"
        ? result.shortDescription.trim().slice(0, 200)
        : "";
    const longDesc =
      typeof result.description === "string" ? result.description.trim() : "";
    const tags = Array.isArray(result.tags)
      ? result.tags
          .filter((t): t is string => typeof t === "string")
          .map((t) => t.toLowerCase().trim().replace(/^#/, ""))
          .filter(Boolean)
          .slice(0, 8)
      : [];

    return NextResponse.json(apiSuccess({ shortDesc, longDesc, tags }));
  } catch (err) {
    return handleApiError(err);
  }
}
