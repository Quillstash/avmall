/**
 * GET   /api/v1/customer/me   Current customer profile.
 * PATCH /api/v1/customer/me   Update name / email. Phone changes require OTP
 *                             so they go through /api/auth/customer/start.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db, hasDatabase } from "@/lib/db";
import { getCustomerSession } from "@/lib/customer-session";
import { normaliseNigerianPhone, isPlaceholderPhone } from "@/lib/phone";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError, UnauthorizedError, ValidationError } from "@/lib/errors";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().optional(),
});

export async function GET() {
  try {
    const session = await getCustomerSession();
    if (!session) throw new UnauthorizedError();

    if (!hasDatabase) {
      throw new AppError(
        "DB_NOT_CONFIGURED",
        "Customer profiles require DATABASE_URL.",
        503,
      );
    }

    const c = await db.customer.findUnique({
      where: { id: session.customerId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        emailVerified: true,
        passwordHash: true,
      },
    });
    if (!c) throw new UnauthorizedError();
    const { passwordHash, ...rest } = c;
    return NextResponse.json(
      apiSuccess({ customer: { ...rest, hasPassword: !!passwordHash } }),
    );
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getCustomerSession();
    if (!session) throw new UnauthorizedError();

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ValidationError({
        [issue?.path.join(".") ?? "body"]: issue?.message ?? "Invalid",
      });
    }

    if (!hasDatabase) {
      throw new AppError(
        "DB_NOT_CONFIGURED",
        "Customer profiles require DATABASE_URL.",
        503,
      );
    }

    const before = await db.customer.findUnique({
      where: { id: session.customerId },
      select: { name: true, email: true, phone: true },
    });
    if (!before) throw new UnauthorizedError();

    // A phone can only be ADDED while the account still has the email-signup
    // placeholder — a real (verified) number isn't editable from this form.
    let phoneUpdate: string | undefined;
    const rawPhone = parsed.data.phone?.trim();
    if (rawPhone) {
      if (!isPlaceholderPhone(before.phone)) {
        throw new ValidationError({ phone: "Your phone number can't be changed here." });
      }
      try {
        phoneUpdate = normaliseNigerianPhone(rawPhone);
      } catch {
        throw new ValidationError({ phone: "Enter a valid Nigerian phone number" });
      }
    }

    let updated;
    try {
      updated = await db.customer.update({
        where: { id: session.customerId },
        data: {
          ...(parsed.data.name !== undefined && { name: parsed.data.name }),
          ...(parsed.data.email !== undefined && { email: parsed.data.email }),
          ...(phoneUpdate && { phone: phoneUpdate }),
        },
        select: { id: true, name: true, phone: true, email: true },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const field = (e.meta?.target as string[] | undefined)?.some((t) => t.includes("phone"))
          ? "phone"
          : "email";
        throw new ValidationError({
          [field]: `That ${field} is already in use on another account.`,
        });
      }
      throw e;
    }

    await writeAudit({
      actorType: "customer",
      action: "customer.profile.update",
      entityType: "customer",
      entityId: session.customerId,
      before,
      after: { name: updated.name, email: updated.email },
    });

    return NextResponse.json(apiSuccess({ customer: updated }));
  } catch (err) {
    return handleApiError(err);
  }
}
