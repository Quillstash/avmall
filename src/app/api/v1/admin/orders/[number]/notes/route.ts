/**
 * POST /api/v1/admin/orders/:number/notes
 * Add an internal staff note to an order.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { NotFoundError, ValidationError } from "@/lib/errors";

const bodySchema = z.object({
  text: z.string().min(1, "Note cannot be empty").max(2000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { number: string } },
) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "orders.edit");

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new ValidationError({ text: parsed.error.issues[0]?.message ?? "Invalid" });
    }

    const order = await db.order.findUnique({ where: { number: params.number } });
    if (!order) throw new NotFoundError("Order");

    const note = await db.orderNote.create({
      data: {
        orderId: order.id,
        authorId: session.id,
        text: parsed.data.text,
      },
      include: { author: { select: { name: true } } },
    });

    return NextResponse.json(
      apiSuccess({
        id: note.id,
        text: note.text,
        author: note.author?.name ?? "Staff",
        createdAt: note.createdAt,
      }),
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err);
  }
}
