/**
 * GET    /api/v1/admin/settings/ai   Current AI / negotiation settings.
 * PATCH  /api/v1/admin/settings/ai   Update the singleton.
 *
 * The negotiate floor on each product overrides these defaults; this row is
 * only read when a product has no per-SKU rule of its own.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

const SINGLETON_KEY = "default";

const patchSchema = z.object({
  globalNegotiateMaxPct: z.number().int().min(0).max(50).optional(),
  negotiationEnabled: z.boolean().optional(),
});

export async function GET() {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "ai.view");

    let row = await db.aiSettings.findUnique({ where: { key: SINGLETON_KEY } });
    if (!row) {
      // Lazy-create on first read so the AI page always has something to load.
      row = await db.aiSettings.create({
        data: { key: SINGLETON_KEY, globalNegotiateMaxPct: 10, negotiationEnabled: true },
      });
    }

    return NextResponse.json(
      apiSuccess({
        globalNegotiateMaxPct: row.globalNegotiateMaxPct,
        negotiationEnabled: row.negotiationEnabled,
        updatedAt: row.updatedAt,
      }),
    );
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "ai.settings");

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ValidationError({
        [issue?.path.join(".") ?? "body"]: issue?.message ?? "Invalid",
      });
    }
    const b = parsed.data;

    const before = await db.aiSettings.findUnique({ where: { key: SINGLETON_KEY } });

    const next = await db.aiSettings.upsert({
      where: { key: SINGLETON_KEY },
      update: {
        ...(b.globalNegotiateMaxPct !== undefined && {
          globalNegotiateMaxPct: b.globalNegotiateMaxPct,
        }),
        ...(b.negotiationEnabled !== undefined && {
          negotiationEnabled: b.negotiationEnabled,
        }),
      },
      create: {
        key: SINGLETON_KEY,
        globalNegotiateMaxPct: b.globalNegotiateMaxPct ?? 10,
        negotiationEnabled: b.negotiationEnabled ?? true,
      },
    });

    await writeAudit({
      actorUserId: session.id,
      actorType: "staff",
      action: "ai_settings.update",
      entityType: "ai_settings",
      entityId: SINGLETON_KEY,
      ...(before && {
        before: {
          globalNegotiateMaxPct: before.globalNegotiateMaxPct,
          negotiationEnabled: before.negotiationEnabled,
        },
      }),
      after: {
        globalNegotiateMaxPct: next.globalNegotiateMaxPct,
        negotiationEnabled: next.negotiationEnabled,
      },
    });

    return NextResponse.json(
      apiSuccess({
        globalNegotiateMaxPct: next.globalNegotiateMaxPct,
        negotiationEnabled: next.negotiationEnabled,
        updatedAt: next.updatedAt,
      }),
    );
  } catch (err) {
    return handleApiError(err);
  }
}
