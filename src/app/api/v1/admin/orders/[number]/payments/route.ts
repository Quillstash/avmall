/**
 * POST /api/v1/admin/orders/:number/payments
 *
 * Record a payment. Updates the order's paid_kobo + payment_status. When
 * the payment pushes the order to fully paid, status moves to "confirmed"
 * automatically (it would otherwise be left at "pending" / "processing"
 * for staff review).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { emailOnPaymentReceived } from "@/lib/order-emails";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

const bodySchema = z.object({
  amountKobo: z.number().int().positive(),
  method: z.enum(["nuqood", "bank_transfer", "pos", "cash"]),
  reference: z.string().optional(),
  note: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { number: string } },
) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "orders.edit");

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new ValidationError({
        body: parsed.error.issues[0]?.message ?? "Invalid body",
      });
    }
    const { amountKobo, method, reference, note } = parsed.data;

    const result = await db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { number: params.number },
        include: { installmentPlan: true },
      });
      if (!order) throw new NotFoundError("Order");
      if (order.status === "cancelled") throw new ConflictError("Order is cancelled");

      // On an active installment plan, enforce any minimum-per-payment — unless
      // this payment clears the remaining balance (the final top-up).
      const plan = order.installmentPlan;
      const outstanding = order.totalKobo - order.paidKobo;
      if (
        plan?.status === "active" &&
        plan.minPaymentKobo != null &&
        BigInt(amountKobo) < plan.minPaymentKobo &&
        BigInt(amountKobo) < outstanding
      ) {
        throw new ConflictError(
          `Minimum payment is ₦${(Number(plan.minPaymentKobo) / 100).toLocaleString("en-NG")}`,
        );
      }

      const payment = await tx.orderPayment.create({
        data: {
          orderId: order.id,
          method,
          amountKobo: BigInt(amountKobo),
          reference: reference ?? null,
          status: "completed",
          recordedById: session.id,
          ...(note && { note }),
        },
      });

      const newPaid = order.paidKobo + BigInt(amountKobo);
      let paymentStatus: "paid" | "partial" | "unpaid" = "unpaid";
      if (newPaid >= order.totalKobo) paymentStatus = "paid";
      else if (newPaid > 0) paymentStatus = "partial";

      // If freshly paid in full and still pending, advance to confirmed.
      const nextStatus =
        paymentStatus === "paid" && order.status === "pending"
          ? "confirmed"
          : order.status;

      const next = await tx.order.update({
        where: { id: order.id },
        data: {
          paidKobo: newPaid,
          paymentStatus,
          status: nextStatus,
        },
      });

      // Paid off an active installment plan → mark it completed.
      if (paymentStatus === "paid" && plan?.status === "active") {
        await tx.installmentPlan.update({
          where: { id: plan.id },
          data: { status: "completed" },
        });
      }

      await writeAudit(
        {
          actorUserId: session.id,
          actorType: "staff",
          action: "order.payment.record",
          entityType: "order",
          entityId: order.id,
          before: {
            paidKobo: Number(order.paidKobo),
            paymentStatus: order.paymentStatus,
          },
          after: {
            paidKobo: Number(newPaid),
            paymentStatus,
            method,
            amountKobo,
          },
        },
        tx,
      );

      return { payment, order: next };
    });

    void emailOnPaymentReceived(result.order.id, amountKobo, method);

    return NextResponse.json(
      apiSuccess({
        payment: {
          id: result.payment.id,
          amountKobo: Number(result.payment.amountKobo),
          method: result.payment.method,
        },
        order: {
          paidKobo: Number(result.order.paidKobo),
          paymentStatus: result.order.paymentStatus,
          status: result.order.status,
        },
      }),
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err);
  }
}
