/**
 * POST /api/v1/admin/products/ai/generate-image
 *
 * Generate a clean studio product image from an already-uploaded photo using
 * OpenAI (gpt-image-1 edit), store it on R2, and return its URL + key.
 * Permission: products.create.
 *
 * Body: { imageUrl: string (R2 public URL of the source), name?, prompt? }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { hasOpenAI, openaiImageEdit } from "@/lib/openai";
import { putObject, r2Configured } from "@/lib/r2";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError, ValidationError } from "@/lib/errors";

export const runtime = "nodejs";
// Image generation can take a while.
export const maxDuration = 120;

const bodySchema = z.object({
  imageUrl: z.string().url("A source image URL is required"),
  name: z.string().optional(),
  prompt: z.string().max(800).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "products.create");

    if (!hasOpenAI) {
      throw new AppError("AI_NOT_CONFIGURED", "Set OPENAI_API_KEY to use AI generation.", 503);
    }
    if (!r2Configured) {
      throw new AppError("R2_NOT_CONFIGURED", "Image storage (R2) is not configured.", 503);
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      const i = parsed.error.issues[0];
      throw new ValidationError({ [i?.path.join(".") ?? "body"]: i?.message ?? "Invalid" });
    }
    const b = parsed.data;

    // Pull the source image down.
    const srcRes = await fetch(b.imageUrl);
    if (!srcRes.ok) {
      throw new AppError("IMAGE_FETCH_FAILED", "Could not load the source image.", 400);
    }
    const contentType = srcRes.headers.get("content-type") ?? "image/png";
    const srcBuf = Buffer.from(await srcRes.arrayBuffer());

    const prompt =
      b.prompt?.trim() ||
      `Professional e-commerce product photograph of ${b.name?.trim() || "this product"} on a clean seamless white studio background, soft natural shadows, sharp focus, high detail, centered, no text, no watermark, no people.`;

    const png = await openaiImageEdit({ image: srcBuf, contentType, prompt });

    const key = `products/ai/${crypto.randomUUID()}.png`;
    const { publicUrl } = await putObject(key, png, "image/png");

    return NextResponse.json(apiSuccess({ image: { url: publicUrl, key } }), {
      status: 201,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
