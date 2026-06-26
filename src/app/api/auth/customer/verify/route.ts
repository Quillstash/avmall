import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyOtpAndStartSession } from "@/lib/customer-session";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { hasDatabase } from "@/lib/db";
import { AppError, ValidationError } from "@/lib/errors";
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
      throw new AppError(
        "DB_NOT_CONFIGURED",
        "Customer sign-in requires DATABASE_URL.",
        503,
      );
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
