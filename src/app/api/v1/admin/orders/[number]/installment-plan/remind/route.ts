/**
 * POST /api/v1/admin/orders/:number/installment-plan/remind
 *
 * Staff-triggered installment reminder. Emails the customer their outstanding
 * balance (if they have an email) and stamps lastReminderAt. The WhatsApp
 * hand-off is done client-side (wa.me) since outbound WA isn't automated yet.
 * Permission: orders.edit.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { emailInstallmentReminder } from "@/lib/order-emails";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { ConflictError, NotFoundError } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, { params }: { params: { number: string } }) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "orders.edit");

    const order = await db.order.findUnique({
      where: { number: params.number },
      include: { installmentPlan: true },
    });
    if (!order?.installmentPlan) throw new NotFoundError("Installment plan");
    if (order.paidKobo >= order.totalKobo) {
      throw new ConflictError("Order is already paid in full");
    }

    const emailed = await emailInstallmentReminder(order.id);

    await db.installmentPlan.update({
      where: { id: order.installmentPlan.id },
      data: { lastReminderAt: new Date() },
    });

    return NextResponse.json(apiSuccess({ emailed }));
  } catch (err) {
    return handleApiError(err);
  }
}
