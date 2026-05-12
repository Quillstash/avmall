/**
 * POST   /api/v1/admin/customers/:id/blacklist    Blacklist a customer
 * DELETE /api/v1/admin/customers/:id/blacklist    Unblock a customer
 *
 * Requires `customers.blacklist` permission.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { NotFoundError, ValidationError } from "@/lib/errors";

const blacklistSchema = z.object({
  reason: z.string().min(3, "Provide a reason"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "customers.blacklist");

    const parsed = blacklistSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError({ reason: "Provide a reason" });

    const customer = await db.customer.findUnique({ where: { id: params.id } });
    if (!customer) throw new NotFoundError("Customer");

    const updated = await db.customer.update({
      where: { id: customer.id },
      data: { blacklisted: true, blacklistReason: parsed.data.reason },
    });

    await writeAudit({
      actorUserId: session.id,
      actorType: "staff",
      action: "customer.blacklist",
      entityType: "customer",
      entityId: customer.id,
      after: { blacklisted: true, reason: parsed.data.reason },
    });

    return NextResponse.json(apiSuccess({ blacklisted: updated.blacklisted }));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "customers.blacklist");

    const customer = await db.customer.findUnique({ where: { id: params.id } });
    if (!customer) throw new NotFoundError("Customer");

    await db.customer.update({
      where: { id: customer.id },
      data: { blacklisted: false, blacklistReason: null },
    });

    await writeAudit({
      actorUserId: session.id,
      actorType: "staff",
      action: "customer.unblock",
      entityType: "customer",
      entityId: customer.id,
    });

    return NextResponse.json(apiSuccess({ blacklisted: false }));
  } catch (err) {
    return handleApiError(err);
  }
}
