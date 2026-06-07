/**
 * POST   /api/v1/admin/returns/:id/approve    Approve a return request
 * DELETE /api/v1/admin/returns/:id/approve    Reject (treat DELETE as reject)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { ConflictError, NotFoundError } from "@/lib/errors";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "returns.approve");

    const ret = await db.return.findUnique({ where: { number: params.id } });
    if (!ret) throw new NotFoundError("Return");
    if (ret.status !== "requested") {
      throw new ConflictError(`Return already ${ret.status}`);
    }

    const updated = await db.return.update({
      where: { id: ret.id },
      data: { status: "approved" },
    });

    await writeAudit({
      actorUserId: session.id,
      actorType: "staff",
      action: "return.approve",
      entityType: "return",
      entityId: ret.id,
    });

    return NextResponse.json(apiSuccess({ status: updated.status }));
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
    requirePermission(session, "returns.approve");

    const ret = await db.return.findUnique({ where: { number: params.id } });
    if (!ret) throw new NotFoundError("Return");

    await db.return.update({
      where: { id: ret.id },
      data: { status: "rejected" },
    });

    await writeAudit({
      actorUserId: session.id,
      actorType: "staff",
      action: "return.reject",
      entityType: "return",
      entityId: ret.id,
    });

    return NextResponse.json(apiSuccess({ status: "rejected" }));
  } catch (err) {
    return handleApiError(err);
  }
}
