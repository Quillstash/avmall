import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { startOtp } from "@/lib/customer-session";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { hasDatabase } from "@/lib/db";
import { AppError, ValidationError } from "@/lib/errors";
// SMS is paused until we're ready to ship phone OTP — re-enable the import
// + the `kind === "phone"` block below when Termii is provisioned.
// import { sendSms, smsConfigured } from "@/lib/sms";
import { sendEmail, emailConfigured } from "@/lib/email";
import { customerOtpEmail } from "@/lib/email-templates";

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

    // Phone OTP is paused — only email goes out today. Reject phone
    // identifiers with a clear message instead of silently dropping them.
    if (kind === "phone") {
      throw new AppError(
        "PHONE_OTP_DISABLED",
        "Phone sign-in isn't enabled yet — please use your email address.",
        400,
      );
    }

    // Email-only delivery for now. Re-enable phone via the commented block
    // below when SMS is provisioned.
    //
    // if (kind === "phone") {
    //   const res = await sendSms({
    //     to: identifier,
    //     body: `${code} is your ${SITE.name} sign-in code. Expires in 5 minutes. Don't share it with anyone.`,
    //     channel: "dnd",
    //   });
    //   delivered = res.ok && !res.skipped;
    // }
    const { subject, html, text } = customerOtpEmail({ code });
    const sendResult = await sendEmail({
      to: identifier,
      subject,
      html,
      text,
      tags: [{ name: "kind", value: "customer-otp" }],
    });
    const delivered = sendResult.ok && !sendResult.skipped;

    // Dev fallback: when Resend isn't wired, log the code so local testing
    // still works without an API key.
    if (process.env.NODE_ENV !== "production" && !emailConfigured) {
      console.log(`[otp] code for ${identifier}: ${code}`);
    }

    return NextResponse.json(
      apiSuccess({
        delivered,
        kind,
        // Mask the identifier on the way back so we don't leak it via XSS.
        masked: identifier.replace(/(.{2}).+(@.+)/, "$1***$2"),
      }),
    );
  } catch (err) {
    return handleApiError(err);
  }
}
