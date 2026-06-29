/**
 * POST /api/auth/customer/signup
 *
 * Email + password sign-up for storefront customers. Creates the customer in
 * the active store, hashes the password, and starts a session cookie. Name is
 * collected afterwards on the profile page.
 *
 * Body: { email, password, name? }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { signupWithPassword } from "@/lib/customer-session";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { hasDatabase } from "@/lib/db";
import { AppError, ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Use at least 8 characters"),
  name: z.string().max(80).optional(),
});

export async function POST(req: NextRequest) {
  try {
    if (!hasDatabase) {
      throw new AppError("DB_NOT_CONFIGURED", "Sign-up requires DATABASE_URL.", 503);
    }
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ValidationError({
        [issue?.path.join(".") ?? "body"]: issue?.message ?? "Invalid",
      });
    }
    const { email, password, name } = parsed.data;
    const { customerId } = await signupWithPassword(email, password, name);
    return NextResponse.json(apiSuccess({ ok: true, customerId }), { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
