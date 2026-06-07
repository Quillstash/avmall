/**
 * POST /api/v1/admin/shipping/zones
 *
 * Create a shipping zone. Permission: shipping.edit.
 *
 * Body:
 *   {
 *     name: string,
 *     states: string[],
 *     baseRateKobo: number,
 *     freeOverKobo?: number | null,
 *     etaDays: string,
 *     active?: boolean,
 *   }
 *
 * One price per state — no priority. Keep states across zones non-overlapping
 * (the admin warns on overlap); edit a zone to change a state's price.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, hasDatabase } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError, ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

const bodySchema = z.object({
  name: z.string().min(1, "Name is required"),
  states: z.array(z.string().min(1)).min(1, "Pick at least one state"),
  baseRateKobo: z.number().int().nonnegative(),
  freeOverKobo: z.number().int().nonnegative().nullable().optional(),
  etaDays: z.string().min(1, "ETA is required"),
  active: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "shipping.edit");

    if (!hasDatabase) {
      throw new AppError("DB_NOT_CONFIGURED", "Shipping zones require DATABASE_URL.", 503);
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ValidationError({
        [issue?.path.join(".") ?? "body"]: issue?.message ?? "Invalid",
      });
    }
    const b = parsed.data;

    const created = await db.shippingZone.create({
      data: {
        name: b.name,
        states: b.states,
        baseRateKobo: BigInt(b.baseRateKobo),
        freeOverKobo: b.freeOverKobo == null ? null : BigInt(b.freeOverKobo),
        etaDays: b.etaDays,
        active: b.active,
      },
    });

    await writeAudit({
      actorUserId: session.id,
      actorType: "staff",
      action: "shipping_zone.create",
      entityType: "shipping_zone",
      entityId: created.id,
      after: {
        name: created.name,
        states: created.states,
        baseRateKobo: Number(created.baseRateKobo),
        freeOverKobo:
          created.freeOverKobo == null ? null : Number(created.freeOverKobo),
        etaDays: created.etaDays,
        active: created.active,
      },
    });

    return NextResponse.json(
      apiSuccess({ zone: { id: created.id, name: created.name } }),
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err);
  }
}
