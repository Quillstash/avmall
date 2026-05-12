/**
 * GET   /api/v1/customer/me   Current customer profile.
 * PATCH /api/v1/customer/me   Update name / email. Phone changes require OTP
 *                             so they go through /api/auth/customer/start.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, hasDatabase } from "@/lib/db";
import { getCustomerSession } from "@/lib/customer-session";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { UnauthorizedError, ValidationError } from "@/lib/errors";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().nullable().optional(),
});

export async function GET() {
  try {
    const session = await getCustomerSession();
    if (!session) throw new UnauthorizedError();

    if (!hasDatabase || session.customerId === "mock-customer") {
      return NextResponse.json(
        apiSuccess({
          customer: {
            id: "mock-customer",
            name: "Tolu Adeniyi",
            phone: session.phone,
            email: null,
          },
        }),
      );
    }

    const c = await db.customer.findUnique({
      where: { id: session.customerId },
      select: { id: true, name: true, phone: true, email: true },
    });
    if (!c) throw new UnauthorizedError();
    return NextResponse.json(apiSuccess({ customer: c }));
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

    if (!hasDatabase || session.customerId === "mock-customer") {
      // Mock mode — pretend it worked so the page can show a success toast.
      return NextResponse.json(apiSuccess({ customer: { ...parsed.data } }));
    }

    const before = await db.customer.findUnique({
      where: { id: session.customerId },
      select: { name: true, email: true },
    });
    if (!before) throw new UnauthorizedError();

    const updated = await db.customer.update({
      where: { id: session.customerId },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.email !== undefined && { email: parsed.data.email }),
      },
      select: { id: true, name: true, phone: true, email: true },
    });

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
