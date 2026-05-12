import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions, verifyTotp } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { UnauthorizedError, ValidationError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";

const bodySchema = z.object({ code: z.string().regex(/^\d{6}$/) });

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new UnauthorizedError();

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new ValidationError({ code: "Must be a 6-digit code" });
    }

    const user = await db.user.findUnique({ where: { id: session.user.id } });
    if (!user || !user.totpSecret) {
      throw new UnauthorizedError("Two-factor not configured for this account");
    }

    const ok = verifyTotp(user.totpSecret, parsed.data.code);
    if (!ok) throw new UnauthorizedError("Invalid code");

    await writeAudit({
      actorUserId: user.id,
      actorType: "staff",
      action: "auth.totp.verify",
      entityType: "user",
      entityId: user.id,
    });

    // The client calls update() after this resolves to clear pendingTotp.
    return NextResponse.json(apiSuccess({ ok: true }));
  } catch (err) {
    return handleApiError(err);
  }
}
