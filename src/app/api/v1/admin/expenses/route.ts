/**
 * POST /api/v1/admin/expenses
 *
 * Record an operating expense against the admin's active store. Expenses are
 * subtracted from gross profit to get net profit (see the Expenses tab).
 *
 * Body: { typeId: uuid, amountKobo: int>0, date: "yyyy-mm-dd", note?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, hasDatabase } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { resolveAdminStoreId } from "@/lib/store";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError, NotFoundError, ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

const bodySchema = z.object({
  typeId: z.string().uuid(),
  amountKobo: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use yyyy-mm-dd"),
  note: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "expenses.create");

    if (!hasDatabase) {
      throw new AppError("DB_NOT_CONFIGURED", "Expenses require DATABASE_URL.", 503);
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ValidationError({
        [issue?.path.join(".") ?? "body"]: issue?.message ?? "Invalid",
      });
    }
    const body = parsed.data;

    const storeId = await resolveAdminStoreId(session);
    if (!storeId) {
      throw new AppError("NO_STORE", "No store assigned to this staff member.", 400);
    }

    // The type must belong to this store (prevents recording against another
    // store's category by passing a foreign id).
    const type = await db.expenseType.findFirst({
      where: { id: body.typeId, storeId, archivedAt: null },
      select: { id: true },
    });
    if (!type) throw new NotFoundError("Expense type");

    const expense = await db.expense.create({
      data: {
        storeId,
        typeId: body.typeId,
        amountKobo: BigInt(body.amountKobo),
        date: new Date(`${body.date}T00:00:00.000Z`),
        note: body.note?.trim() || null,
        createdById: session.id,
      },
    });

    await writeAudit({
      actorUserId: session.id,
      actorType: "staff",
      action: "expense.create",
      entityType: "expense",
      entityId: expense.id,
      after: {
        typeId: body.typeId,
        amountKobo: body.amountKobo,
        date: body.date,
      },
    });

    return NextResponse.json(apiSuccess({ id: expense.id }), { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
