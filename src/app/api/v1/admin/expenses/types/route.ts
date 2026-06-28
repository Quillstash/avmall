/**
 * POST /api/v1/admin/expenses/types
 *
 * Add a new expense type (category) for the admin's active store. Names are
 * unique per store; re-adding an existing (or archived) name reactivates it.
 *
 * Body: { name: string }
 * Response (201): { id, name }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, hasDatabase } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { resolveAdminStoreId } from "@/lib/store";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError, ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

const bodySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
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
      throw new ValidationError({ name: issue?.message ?? "Invalid" });
    }
    const { name } = parsed.data;

    const storeId = await resolveAdminStoreId(session);
    if (!storeId) {
      throw new AppError("NO_STORE", "No store assigned to this staff member.", 400);
    }

    // Unique per store. Reuse (and un-archive) an existing same-name type
    // instead of erroring on the unique constraint.
    const existing = await db.expenseType.findUnique({
      where: { storeId_name: { storeId, name } },
      select: { id: true, name: true, archivedAt: true },
    });

    let type: { id: string; name: string };
    if (existing) {
      if (existing.archivedAt) {
        await db.expenseType.update({
          where: { id: existing.id },
          data: { archivedAt: null },
        });
      }
      type = { id: existing.id, name: existing.name };
    } else {
      const created = await db.expenseType.create({
        data: { storeId, name },
        select: { id: true, name: true },
      });
      type = created;
      await writeAudit({
        actorUserId: session.id,
        actorType: "staff",
        action: "expense_type.create",
        entityType: "expense_type",
        entityId: created.id,
        after: { name },
      });
    }

    return NextResponse.json(apiSuccess(type), { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
