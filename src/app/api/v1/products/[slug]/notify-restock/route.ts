/**
 * POST /api/v1/products/[slug]/notify-restock
 *
 * Out-of-stock wait-list signup. Customers click "Notify me when back" on a
 * sold-out PDP and we capture their email (preferred) or phone. Staff fires
 * the notification batch from /admin/products when stock returns.
 *
 * Body:
 *   { email?: string, phone?: string, source?: string }
 *
 * Response (201): { ok: true, alreadySubscribed: boolean }
 *
 * Rate-limited to 5 attempts / 10 minutes / IP to discourage scraping the
 * product catalog by way of restock signups.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, hasDatabase } from "@/lib/db";
import { normaliseNigerianPhone } from "@/lib/phone";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError, NotFoundError, ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

const bodySchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().optional(),
    source: z.string().max(40).optional(),
  })
  .refine((b) => !!(b.email || b.phone), {
    message: "Provide an email or phone number",
    path: ["email"],
  });

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const ip = clientIp(req);
    const rl = rateLimit(`notify-restock:${ip}`, {
      limit: 5,
      windowMs: 10 * 60 * 1000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests. Try again in a few minutes.",
          },
        },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
      );
    }

    if (!hasDatabase) {
      throw new AppError(
        "DB_NOT_CONFIGURED",
        "Restock notifications require DATABASE_URL.",
        503,
      );
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ValidationError({
        [issue?.path.join(".") ?? "body"]: issue?.message ?? "Invalid",
      });
    }
    const { email, phone, source } = parsed.data;

    let normalisedPhone: string | null = null;
    if (phone) {
      try {
        normalisedPhone = normaliseNigerianPhone(phone);
      } catch {
        throw new ValidationError({ phone: "Invalid Nigerian phone number" });
      }
    }

    const product = await db.product.findUnique({
      where: { slug: params.slug, archivedAt: null, published: true },
      select: { id: true },
    });
    if (!product) throw new NotFoundError("Product");

    // Upsert by (productId, email/phone). Re-submits are silently treated as
    // "already subscribed" so we don't leak whether a given email/phone has
    // signed up before. Returns alreadySubscribed=true on the duplicate path.
    let alreadySubscribed = false;
    try {
      await db.stockNotification.create({
        data: {
          productId: product.id,
          ...(email && { email: email.trim().toLowerCase() }),
          ...(normalisedPhone && { phone: normalisedPhone }),
          ...(source && { source }),
        },
      });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "P2002") {
        alreadySubscribed = true;
      } else {
        throw err;
      }
    }

    return NextResponse.json(apiSuccess({ ok: true, alreadySubscribed }), {
      status: 201,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
