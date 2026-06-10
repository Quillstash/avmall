/**
 * Installment (buy-now-pay-later) plan for an order.
 *
 *   POST   /api/v1/admin/orders/:number/installment-plan   create a plan
 *   PATCH  /api/v1/admin/orders/:number/installment-plan   update status/fields
 *   DELETE /api/v1/admin/orders/:number/installment-plan   remove the plan
 *
 * The plan is a flexible balance: the customer gets the goods and pays the
 * balance down over time via the normal payment ledger. Permission: orders.edit.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

const createSchema = z.object({
  minPaymentKobo: z.number().int().positive().optional(),
  targetPayoffDate: z.string().optional(),
  note: z.string().max(500).optional(),
});

const updateSchema = z.object({
  status: z.enum(["active", "completed", "cancelled", "defaulted"]).optional(),
  minPaymentKobo: z.number().int().nonnegative().nullable().optional(),
  targetPayoffDate: z.string().nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});

function parseDate(v: string): Date {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) {
    throw new ValidationError({ targetPayoffDate: "Invalid date" });
  }
  return d;
}

export async function POST(req: NextRequest, { params }: { params: { number: string } }) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "orders.edit");

    const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new ValidationError({ body: parsed.error.issues[0]?.message ?? "Invalid" });
    }
    const b = parsed.data;

    const result = await db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { number: params.number },
        include: { installmentPlan: true },
      });
      if (!order) throw new NotFoundError("Order");
      if (order.status === "cancelled") throw new ConflictError("Order is cancelled");
      if (order.installmentPlan) {
        throw new ConflictError("This order already has an installment plan");
      }
      if (order.paidKobo >= order.totalKobo) {
        throw new ConflictError("Order is already paid in full");
      }

      const plan = await tx.installmentPlan.create({
        data: {
          orderId: order.id,
          status: "active",
          createdById: session.id,
          ...(b.minPaymentKobo != null && { minPaymentKobo: BigInt(b.minPaymentKobo) }),
          ...(b.targetPayoffDate && { targetPayoffDate: parseDate(b.targetPayoffDate) }),
          ...(b.note && { note: b.note }),
        },
      });

      // A plan is an agreement to fulfil — move a pending order to confirmed.
      if (order.status === "pending") {
        await tx.order.update({ where: { id: order.id }, data: { status: "confirmed" } });
      }

      await writeAudit(
        {
          actorUserId: session.id,
          actorType: "staff",
          action: "order.installment.create",
          entityType: "order",
          entityId: order.id,
          after: {
            minPaymentKobo: b.minPaymentKobo ?? null,
            targetPayoffDate: b.targetPayoffDate ?? null,
          },
        },
        tx,
      );

      return plan;
    });

    return NextResponse.json(apiSuccess({ id: result.id, status: result.status }), {
      status: 201,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { number: string } }) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "orders.edit");

    const parsed = updateSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new ValidationError({ body: parsed.error.issues[0]?.message ?? "Invalid" });
    }
    const b = parsed.data;

    await db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { number: params.number },
        include: { installmentPlan: true },
      });
      if (!order?.installmentPlan) throw new NotFoundError("Installment plan");

      await tx.installmentPlan.update({
        where: { id: order.installmentPlan.id },
        data: {
          ...(b.status && { status: b.status }),
          ...(b.minPaymentKobo !== undefined && {
            minPaymentKobo: b.minPaymentKobo === null ? null : BigInt(b.minPaymentKobo),
          }),
          ...(b.targetPayoffDate !== undefined && {
            targetPayoffDate: b.targetPayoffDate === null ? null : parseDate(b.targetPayoffDate),
          }),
          ...(b.note !== undefined && { note: b.note }),
        },
      });

      await writeAudit(
        {
          actorUserId: session.id,
          actorType: "staff",
          action: "order.installment.update",
          entityType: "order",
          entityId: order.id,
          before: { status: order.installmentPlan.status },
          after: { status: b.status ?? order.installmentPlan.status },
        },
        tx,
      );
    });

    return NextResponse.json(apiSuccess({ ok: true }));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { number: string } }) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "orders.edit");

    await db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { number: params.number },
        include: { installmentPlan: true },
      });
      if (!order?.installmentPlan) throw new NotFoundError("Installment plan");

      await tx.installmentPlan.delete({ where: { id: order.installmentPlan.id } });

      await writeAudit(
        {
          actorUserId: session.id,
          actorType: "staff",
          action: "order.installment.remove",
          entityType: "order",
          entityId: order.id,
          before: { status: order.installmentPlan.status },
        },
        tx,
      );
    });

    return NextResponse.json(apiSuccess({ ok: true }));
  } catch (err) {
    return handleApiError(err);
  }
}
