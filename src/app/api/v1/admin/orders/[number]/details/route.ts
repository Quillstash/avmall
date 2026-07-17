/**
 * PATCH /api/v1/admin/orders/:number/details
 *
 * Correct an order's contact + delivery address (name, phone, address lines,
 * city, state). Pure metadata — it doesn't touch stock, totals or status — so
 * it's allowed on any non-cancelled order, including delivered ones, to fix a
 * mis-recorded address. Every field sent is optional (partial update); the
 * phone is normalised to E.164 before storing. Every change is audited with a
 * before/after snapshot of only the fields that changed.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError, NotFoundError, ValidationError } from "@/lib/errors";
import { normaliseNigerianPhone } from "@/lib/phone";

export const runtime = "nodejs";

const bodySchema = z.object({
  shipName: z.string().trim().min(1, "Name is required").max(120).optional(),
  shipPhone: z.string().trim().min(1, "Phone is required").optional(),
  shipLine1: z.string().trim().min(1, "Address is required").max(200).optional(),
  // line2 is nullable — an empty string clears it.
  shipLine2: z.string().trim().max(200).nullable().optional(),
  shipCity: z.string().trim().min(1, "City is required").max(120).optional(),
  shipState: z.string().trim().min(1, "State is required").max(120).optional(),
});

// The order columns each schema field maps to (identical names here, but keeps
// the update object explicit and typo-proof).
const FIELDS = [
  "shipName",
  "shipPhone",
  "shipLine1",
  "shipLine2",
  "shipCity",
  "shipState",
] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: { number: string } },
) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "orders.edit");

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ValidationError({
        [issue?.path.join(".") ?? "details"]: issue?.message ?? "Invalid",
      });
    }

    const order = await db.order.findUnique({ where: { number: params.number } });
    if (!order) throw new NotFoundError("Order");
    if (order.status === "cancelled") {
      throw new AppError("CONFLICT", "Cannot edit a cancelled order", 409);
    }

    // Normalise the phone if one was supplied (throws ValidationError on junk).
    const input = { ...parsed.data };
    if (input.shipPhone !== undefined) {
      input.shipPhone = normaliseNigerianPhone(input.shipPhone);
    }
    // Empty line2 → null (clears the field).
    if (input.shipLine2 !== undefined && input.shipLine2 === "") {
      input.shipLine2 = null;
    }

    // Build the update + before/after diff from only the changed fields.
    const data: Record<string, string | null> = {};
    const before: Record<string, string | null> = {};
    const after: Record<string, string | null> = {};
    for (const key of FIELDS) {
      const next = input[key];
      if (next === undefined) continue;
      const current = order[key];
      if (next === current) continue;
      data[key] = next;
      before[key] = current;
      after[key] = next;
    }

    if (Object.keys(data).length === 0) {
      // Nothing actually changed — return the current values, no audit noise.
      return NextResponse.json(
        apiSuccess({
          shipName: order.shipName,
          shipPhone: order.shipPhone,
          shipLine1: order.shipLine1,
          shipLine2: order.shipLine2,
          shipCity: order.shipCity,
          shipState: order.shipState,
        }),
      );
    }

    const updated = await db.order.update({
      where: { id: order.id },
      data,
    });

    await writeAudit({
      actorUserId: session.id,
      actorType: "staff",
      action: "order.details.edit",
      entityType: "order",
      entityId: order.id,
      before,
      after,
    });

    return NextResponse.json(
      apiSuccess({
        shipName: updated.shipName,
        shipPhone: updated.shipPhone,
        shipLine1: updated.shipLine1,
        shipLine2: updated.shipLine2,
        shipCity: updated.shipCity,
        shipState: updated.shipState,
      }),
    );
  } catch (err) {
    return handleApiError(err);
  }
}
