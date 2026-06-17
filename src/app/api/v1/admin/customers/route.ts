/**
 * POST /api/v1/admin/customers
 *
 * Create a customer. Phone is normalised to E.164 (+234…) and must be unique.
 * Permission: customers.edit.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, hasDatabase } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { normaliseNigerianPhone } from "@/lib/phone";
import { resolveAdminStoreId } from "@/lib/store";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError, ConflictError, ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

const bodySchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  segments: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "customers.edit");

    if (!hasDatabase) {
      throw new AppError("DB_NOT_CONFIGURED", "Database required.", 503);
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      const i = parsed.error.issues[0];
      throw new ValidationError({ [i?.path.join(".") ?? "body"]: i?.message ?? "Invalid" });
    }
    const b = parsed.data;

    let phone: string;
    try {
      phone = normaliseNigerianPhone(b.phone);
    } catch {
      throw new ValidationError({ phone: "Enter a valid Nigerian phone number" });
    }

    const storeId = await resolveAdminStoreId(session);
    if (!storeId) {
      throw new ValidationError({ store: "No store available for this customer" });
    }

    const existing = await db.customer.findFirst({ where: { storeId, phone } });
    if (existing) {
      throw new ConflictError("A customer with this phone number already exists in this store");
    }

    const customer = await db.customer.create({
      data: {
        storeId,
        name: b.name.trim(),
        phone,
        email: b.email?.trim() || null,
        segments: (b.segments ?? []).map((s) => s.trim()).filter(Boolean),
      },
    });

    await writeAudit({
      actorUserId: session.id,
      actorType: "staff",
      action: "customer.create",
      entityType: "customer",
      entityId: customer.id,
      after: { name: customer.name, phone },
    });

    return NextResponse.json(apiSuccess({ id: customer.id, name: customer.name }), {
      status: 201,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
