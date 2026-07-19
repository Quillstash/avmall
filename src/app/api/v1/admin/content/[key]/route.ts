/**
 * GET  /api/v1/admin/content/[key]  — current content for a page (about/makers/careers)
 * PUT  /api/v1/admin/content/[key]  — replace that page's content
 *
 * Permission: settings.view / settings.edit (content editing mirrors settings).
 */

import { NextRequest, NextResponse } from "next/server";
import { db, hasDatabase } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { NotFoundError, ValidationError } from "@/lib/errors";
import {
  contentSchemaFor,
  getContentByKey,
  isContentKey,
} from "@/lib/data/content";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { key: string } },
) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "settings.view");
    if (!isContentKey(params.key)) throw new NotFoundError("Content page");

    const content = await getContentByKey(params.key);
    return NextResponse.json(apiSuccess({ key: params.key, content }));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { key: string } },
) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "settings.edit");
    if (!isContentKey(params.key)) throw new NotFoundError("Content page");

    const schema = contentSchemaFor(params.key);
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ValidationError({
        [issue?.path.join(".") ?? "body"]: issue?.message ?? "Invalid content",
      });
    }

    if (!hasDatabase) {
      return NextResponse.json(apiSuccess({ saved: false, reason: "no_db" }));
    }

    const before = await db.contentPage.findUnique({ where: { key: params.key } });
    const content = parsed.data as object;
    await db.contentPage.upsert({
      where: { key: params.key },
      create: { key: params.key, content },
      update: { content },
    });

    await writeAudit({
      actorUserId: session.id,
      actorType: "staff",
      action: "content.update",
      entityType: "content_page",
      entityId: params.key,
      before: (before?.content as object) ?? {},
      after: content,
    });

    return NextResponse.json(apiSuccess({ saved: true }));
  } catch (err) {
    return handleApiError(err);
  }
}
