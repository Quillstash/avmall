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

const areaSchema = z.object({
  state: z.string().min(1),
  lga: z.string().min(1),
});

const bodySchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    states: z.array(z.string().min(1)).default([]),
    // Sub-state coverage: specific (state, LGA) areas this zone prices.
    areas: z.array(areaSchema).default([]),
    baseRateKobo: z.number().int().nonnegative(),
    freeOverKobo: z.number().int().nonnegative().nullable().optional(),
    etaDays: z.string().min(1, "ETA is required"),
    active: z.boolean().default(true),
  })
  .refine((d) => d.states.length > 0 || d.areas.length > 0, {
    message: "Pick at least one state or LGA area",
    path: ["states"],
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

    // Each (state, LGA) can only be priced by one zone (DB-enforced). Pre-check
    // so we can name the clashing LGAs instead of surfacing a raw 500.
    if (b.areas.length > 0) {
      const clash = await db.shippingZoneArea.findMany({
        where: { OR: b.areas.map((a) => ({ state: a.state, lga: a.lga })) },
        select: { state: true, lga: true },
      });
      if (clash.length > 0) {
        throw new ValidationError({
          areas: `Already priced by another zone: ${clash
            .map((c) => `${c.state} — ${c.lga}`)
            .join("; ")}`,
        });
      }
    }

    const created = await db.shippingZone.create({
      data: {
        name: b.name,
        states: b.states,
        baseRateKobo: BigInt(b.baseRateKobo),
        freeOverKobo: b.freeOverKobo == null ? null : BigInt(b.freeOverKobo),
        etaDays: b.etaDays,
        active: b.active,
        areas: { create: b.areas.map((a) => ({ state: a.state, lga: a.lga })) },
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
        areas: b.areas,
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
