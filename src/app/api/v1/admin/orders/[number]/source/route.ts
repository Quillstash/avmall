/**
 * POST /api/v1/admin/orders/:number/source
 *
 * Correct which sales channel an order is attributed to (walk-in, WhatsApp,
 * Instagram, Facebook, phone, website, manual). Pure metadata — it doesn't
 * touch stock, totals or status — so it's allowed on any order, including
 * terminal ones, to fix a mis-tagged sale. Every change is audited.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { NotFoundError, ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

// Channels a staff member may set by hand. Excludes `ai`, which is only ever
// applied server-side by the agent, never chosen from the dashboard.
const bodySchema = z.object({
  source: z.enum(["walkin", "phone", "whatsapp", "instagram", "facebook", "web", "manual"]),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { number: string } },
) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "orders.edit");

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError({ source: "Invalid channel" });

    const { source } = parsed.data;

    const order = await db.order.findUnique({ where: { number: params.number } });
    if (!order) throw new NotFoundError("Order");

    if (order.source === source) {
      return NextResponse.json(apiSuccess({ source }));
    }

    const updated = await db.order.update({
      where: { id: order.id },
      data: { source },
    });

    await writeAudit({
      actorUserId: session.id,
      actorType: "staff",
      action: "order.source.change",
      entityType: "order",
      entityId: order.id,
      before: { source: order.source },
      after: { source: updated.source },
    });

    return NextResponse.json(apiSuccess({ source: updated.source }));
  } catch (err) {
    return handleApiError(err);
  }
}
