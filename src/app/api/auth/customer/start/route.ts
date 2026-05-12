import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { startOtp } from "@/lib/customer-session";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { hasDatabase } from "@/lib/db";
import { ValidationError } from "@/lib/errors";

const bodySchema = z.object({
  identifier: z.string().min(3),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new ValidationError({ identifier: "Required" });
    }

    if (!hasDatabase) {
      // Dev mode without Neon — let the existing mock UI keep working.
      return NextResponse.json(
        apiSuccess({ delivered: true, mock: true, hint: "Use 123456" }),
      );
    }

    const { identifier, kind, code } = await startOtp(parsed.data.identifier);

    // TODO Phase 5 — deliver via Termii (SMS) or Resend (email).
    if (process.env.NODE_ENV !== "production") {
      console.log(`[otp] code for ${identifier} (${kind}): ${code}`);
    }

    return NextResponse.json(
      apiSuccess({
        delivered: true,
        kind,
        // Mask the identifier on the way back so we don't leak it via XSS.
        masked:
          kind === "phone"
            ? `${identifier.slice(0, 4)} *** ${identifier.slice(-4)}`
            : identifier.replace(/(.{2}).+(@.+)/, "$1***$2"),
      }),
    );
  } catch (err) {
    return handleApiError(err);
  }
}
