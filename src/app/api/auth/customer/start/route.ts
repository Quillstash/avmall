import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { startOtp } from "@/lib/customer-session";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { hasDatabase } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { sendSms, smsConfigured } from "@/lib/sms";
import { sendEmail, emailConfigured } from "@/lib/email";
import { customerOtpEmail } from "@/lib/email-templates";
import { SITE } from "@/lib/site";

export const runtime = "nodejs";

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

    // Deliver: phone → Termii SMS; email → Resend. Both helpers are
    // fire-and-forget; a delivery failure logs but doesn't throw.
    let delivered = false;
    if (kind === "phone") {
      const res = await sendSms({
        to: identifier,
        body: `${code} is your ${SITE.name} sign-in code. Expires in 5 minutes. Don't share it with anyone.`,
        channel: "dnd",
      });
      delivered = res.ok && !res.skipped;
    } else {
      const { subject, html, text } = customerOtpEmail({ code });
      const res = await sendEmail({
        to: identifier,
        subject,
        html,
        text,
        tags: [{ name: "kind", value: "customer-otp" }],
      });
      delivered = res.ok && !res.skipped;
    }

    // Dev fallback: when neither provider is wired, log the code so local
    // testing still works without Termii / Resend keys.
    if (
      process.env.NODE_ENV !== "production" &&
      !smsConfigured &&
      !emailConfigured
    ) {
      console.log(`[otp] code for ${identifier} (${kind}): ${code}`);
    }

    return NextResponse.json(
      apiSuccess({
        delivered,
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
