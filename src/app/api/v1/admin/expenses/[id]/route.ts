/**
 * DELETE /api/v1/admin/expenses/:id
 *
 * Remove an expense (e.g. a mistaken entry). Scoped to the admin's active
 * store so one store can't delete another's records.
 */

import { NextRequest, NextResponse } from "next/server";
import { db, hasDatabase } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { resolveAdminStoreId } from "@/lib/store";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError, NotFoundError } from "@/lib/errors";

export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "expenses.delete");

    if (!hasDatabase) {
      throw new AppError("DB_NOT_CONFIGURED", "Expenses require DATABASE_URL.", 503);
    }

    const storeId = await resolveAdminStoreId(session);
    if (!storeId) {
      throw new AppError("NO_STORE", "No store assigned to this staff member.", 400);
    }

    const expense = await db.expense.findFirst({
      where: { id: params.id, storeId },
      select: { id: true, typeId: true, amountKobo: true },
    });
    if (!expense) throw new NotFoundError("Expense");

    await db.expense.delete({ where: { id: expense.id } });

    await writeAudit({
      actorUserId: session.id,
      actorType: "staff",
      action: "expense.delete",
      entityType: "expense",
      entityId: expense.id,
      before: {
        typeId: expense.typeId,
        amountKobo: Number(expense.amountKobo),
      },
    });

    return NextResponse.json(apiSuccess({ deleted: true }));
  } catch (err) {
    return handleApiError(err);
  }
}
