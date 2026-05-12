import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  verifyOtpAndStartSession,
  setCustomerSession,
} from "@/lib/customer-session";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { hasDatabase } from "@/lib/db";
import { ValidationError, UnauthorizedError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";

const bodySchema = z.object({
  identifier: z.string().min(3),
  code: z.string().regex(/^\d{6}$/),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new ValidationError({ code: "Must be a 6-digit code" });
    }

    if (!hasDatabase) {
      // Dev mock — accept 123456 only.
      if (parsed.data.code !== "123456") {
        throw new UnauthorizedError("Incorrect code");
      }
      await setCustomerSession({
        customerId: "mock-customer",
        phone: "+2348034217790",
      });
      return NextResponse.json(apiSuccess({ ok: true, mock: true }));
    }

    const { customerId, isNew } = await verifyOtpAndStartSession(
      parsed.data.identifier,
      parsed.data.code,
    );

    await writeAudit({
      actorType: "customer",
      action: isNew ? "auth.customer.signup" : "auth.customer.login",
      entityType: "customer",
      entityId: customerId,
    });

    return NextResponse.json(apiSuccess({ ok: true, isNew }));
  } catch (err) {
    return handleApiError(err);
  }
}
