/**
 * POST /api/v1/admin/orders/[number]/resend-receipt
 *
 * Fires the order-confirmation email for an existing order. Useful when a
 * customer says they didn't get the original (spam, typo) or staff want to
 * re-send after editing the order.
 *
 * The actual send uses the same helper as the order-creation hook, so the
 * template + provider config stays identical. A 200 response means the email
 * helper accepted the order — it's a fire-and-forget against the email
 * provider, so true delivery is observable via Resend logs.
 *
 * Permission: orders.view (anyone who can see the order can resend it)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { emailOnOrderCreated } from "@/lib/order-emails";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { ConflictError, NotFoundError } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: { number: string } },
) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "orders.view");

    const order = await db.order.findUnique({
      where: { number: params.number },
      select: {
        id: true,
        number: true,
        customer: { select: { email: true } },
      },
    });
    if (!order) throw new NotFoundError("Order");
    if (!order.customer?.email) {
      throw new ConflictError(
        "Customer has no email on file — nothing to send the receipt to.",
      );
    }

    await emailOnOrderCreated(order.id);

    await writeAudit({
      actorUserId: session.id,
      actorType: "staff",
      action: "order.receipt_resent",
      entityType: "order",
      entityId: order.id,
      after: { sentTo: order.customer.email },
    });

    return NextResponse.json(apiSuccess({ ok: true, sentTo: order.customer.email }));
  } catch (err) {
    return handleApiError(err);
  }
}
