/**
 * PATCH /api/v1/admin/customers/:id/tags
 *
 * Replace a customer's segments array. Tags are arbitrary strings (e.g.
 * "VIP", "Wholesale", "Zaria"). Send the full desired array — whatever
 * you send replaces what's there.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, hasDatabase } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError, NotFoundError, ValidationError } from "@/lib/errors";

const bodySchema = z.object({
  segments: z.array(z.string().min(1).max(50)).max(20),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "customers.edit");

    if (!hasDatabase) {
      throw new AppError("DB_NOT_CONFIGURED", "Database required.", 503);
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new ValidationError({ segments: parsed.error.issues[0]?.message ?? "Invalid" });
    }

    const customer = await db.customer.findUnique({ where: { id: params.id } });
    if (!customer) throw new NotFoundError("Customer");

    const updated = await db.$transaction(async (tx) => {
      const next = await tx.customer.update({
        where: { id: params.id },
        data: { segments: parsed.data.segments },
        select: { id: true, segments: true },
      });

      await writeAudit(
        {
          actorUserId: session.id,
          actorType: "staff",
          action: "customer.tag",
          entityType: "customer",
          entityId: params.id,
          before: { segments: customer.segments },
          after: { segments: parsed.data.segments },
        },
        tx,
      );

      return next;
    });

    return NextResponse.json(apiSuccess(updated));
  } catch (err) {
    return handleApiError(err);
  }
}
