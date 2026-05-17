/**
 * POST /api/v1/newsletter
 *
 * Public — the storefront newsletter signup form posts here. Idempotent
 * (unique email) so re-submits are no-ops. Doesn't disclose whether the
 * email is new or already subscribed.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, hasDatabase } from "@/lib/db";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email().transform((s) => s.trim().toLowerCase()),
  source: z.string().max(80).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new ValidationError({ email: "A valid email is required" });
    }
    const { email, source } = parsed.data;

    if (!hasDatabase) {
      return NextResponse.json(apiSuccess({ ok: true, mock: true }));
    }

    // Upsert — re-submitting just refreshes the source. Always return success.
    await db.newsletterSubscriber.upsert({
      where: { email },
      update: {
        ...(source && { source }),
        unsubscribedAt: null, // re-subscribe if they'd previously unsubscribed
      },
      create: {
        email,
        ...(source && { source }),
      },
    });

    return NextResponse.json(apiSuccess({ ok: true }));
  } catch (err) {
    return handleApiError(err);
  }
}
