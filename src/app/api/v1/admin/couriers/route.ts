/**
 * POST /api/v1/admin/couriers
 *
 * Create a delivery courier. Setting it primary unsets the previous primary.
 * Permission: shipping.edit
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, hasDatabase } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError, ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

const bodySchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional(),
  trackingUrl: z.string().optional(),
  note: z.string().optional(),
  active: z.boolean().optional(),
  isPrimary: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "shipping.edit");

    if (!hasDatabase) {
      throw new AppError("DB_NOT_CONFIGURED", "Couriers require DATABASE_URL.", 503);
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      const i = parsed.error.issues[0];
      throw new ValidationError({ [i?.path.join(".") ?? "body"]: i?.message ?? "Invalid" });
    }
    const b = parsed.data;

    const courier = await db.$transaction(async (tx) => {
      if (b.isPrimary) {
        await tx.courier.updateMany({ where: { isPrimary: true }, data: { isPrimary: false } });
      }
      const max = await tx.courier.aggregate({ _max: { position: true } });
      const created = await tx.courier.create({
        data: {
          name: b.name.trim(),
          phone: b.phone?.trim() || null,
          trackingUrl: b.trackingUrl?.trim() || null,
          note: b.note?.trim() || null,
          active: b.active ?? true,
          isPrimary: b.isPrimary ?? false,
          position: (max._max.position ?? 0) + 1,
        },
      });
      await writeAudit(
        {
          actorUserId: session.id,
          actorType: "staff",
          action: "courier.create",
          entityType: "courier",
          entityId: created.id,
          after: { name: created.name, active: created.active, isPrimary: created.isPrimary },
        },
        tx,
      );
      return created;
    });

    return NextResponse.json(
      apiSuccess({ courier: { id: courier.id, name: courier.name } }),
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err);
  }
}
