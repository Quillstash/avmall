/**
 * PATCH  /api/v1/admin/shipping/zones/[id]   Update a zone (toggle active, edit fields)
 * DELETE /api/v1/admin/shipping/zones/[id]   Delete the zone (refuses if orders reference it)
 *
 * Permission: shipping.edit
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, hasDatabase } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError, ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

const areaSchema = z.object({
  state: z.string().min(1),
  lga: z.string().min(1),
});

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  states: z.array(z.string().min(1)).optional(),
  // When present, replaces the zone's entire set of (state, LGA) area overrides.
  areas: z.array(areaSchema).optional(),
  baseRateKobo: z.number().int().nonnegative().optional(),
  freeOverKobo: z.number().int().nonnegative().nullable().optional(),
  etaDays: z.string().min(1).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "shipping.edit");

    if (!hasDatabase) {
      throw new AppError("DB_NOT_CONFIGURED", "Shipping zones require DATABASE_URL.", 503);
    }

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ValidationError({
        [issue?.path.join(".") ?? "body"]: issue?.message ?? "Invalid",
      });
    }
    const b = parsed.data;

    const existing = await db.shippingZone.findUnique({ where: { id: params.id } });
    if (!existing) throw new NotFoundError("Shipping zone");

    // Replacing area overrides: reject LGAs already priced by a *different* zone
    // before we wipe and recreate this zone's set.
    if (b.areas !== undefined && b.areas.length > 0) {
      const clash = await db.shippingZoneArea.findMany({
        where: {
          zoneId: { not: existing.id },
          OR: b.areas.map((a) => ({ state: a.state, lga: a.lga })),
        },
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

    const before = {
      name: existing.name,
      active: existing.active,
      baseRateKobo: Number(existing.baseRateKobo),
    };

    const updated = await db.shippingZone.update({
      where: { id: existing.id },
      data: {
        ...(b.name !== undefined && { name: b.name }),
        ...(b.states !== undefined && { states: b.states }),
        ...(b.baseRateKobo !== undefined && { baseRateKobo: BigInt(b.baseRateKobo) }),
        ...(b.freeOverKobo !== undefined && {
          freeOverKobo: b.freeOverKobo == null ? null : BigInt(b.freeOverKobo),
        }),
        ...(b.etaDays !== undefined && { etaDays: b.etaDays }),
        ...(b.active !== undefined && { active: b.active }),
        // Replace the whole area set when provided.
        ...(b.areas !== undefined && {
          areas: {
            deleteMany: {},
            create: b.areas.map((a) => ({ state: a.state, lga: a.lga })),
          },
        }),
      },
    });

    await writeAudit({
      actorUserId: session.id,
      actorType: "staff",
      action: "shipping_zone.update",
      entityType: "shipping_zone",
      entityId: updated.id,
      before,
      after: {
        name: updated.name,
        active: updated.active,
        baseRateKobo: Number(updated.baseRateKobo),
      },
    });

    return NextResponse.json(
      apiSuccess({ zone: { id: updated.id, active: updated.active } }),
    );
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
    requirePermission(session, "shipping.edit");

    const existing = await db.shippingZone.findUnique({
      where: { id: params.id },
      include: { orders: { take: 1 } },
    });
    if (!existing) throw new NotFoundError("Shipping zone");
    if (existing.orders.length > 0) {
      throw new ConflictError(
        "Zone has order history — deactivate instead of deleting to preserve audit trail",
      );
    }

    await db.shippingZone.delete({ where: { id: existing.id } });

    await writeAudit({
      actorUserId: session.id,
      actorType: "staff",
      action: "shipping_zone.delete",
      entityType: "shipping_zone",
      entityId: existing.id,
      before: { name: existing.name, states: existing.states },
    });

    return NextResponse.json(apiSuccess({ deleted: true }));
  } catch (err) {
    return handleApiError(err);
  }
}
