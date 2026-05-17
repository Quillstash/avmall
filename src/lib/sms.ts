/**
 * SMS sender. Wraps Termii (Nigeria-specific provider — cheaper + better
 * delivery than Twilio in NG per CLAUDE.md §3).
 *
 * Endpoint: POST https://api.ng.termii.com/api/sms/send
 * Body shape:
 *   {
 *     to: "234803...",         // E.164 without the +
 *     from: "Avmall",          // approved Sender ID
 *     sms: "Your code is ...", // plain text body
 *     type: "plain",
 *     channel: "generic",      // "dnd" for marketing-blocked numbers
 *     api_key: "..."
 *   }
 *
 * Fire-and-forget contract — failures log a warning but never throw.
 */

import "server-only";

import { env } from "@/lib/env";

export const smsConfigured: boolean = !!env.TERMII_API_KEY;

const TERMII_URL = "https://api.ng.termii.com/api/sms/send";

/** "Avmall" is the default Sender ID. Override via env when you've registered
 *  a different one with Termii. */
const SENDER_ID = "Avmall";

interface SendSmsInput {
  /** E.164 phone — leading "+" is fine, we strip it. */
  to: string;
  body: string;
  /** Use "dnd" when sending to numbers on the marketing block list. */
  channel?: "generic" | "dnd";
}

export interface SendSmsResult {
  ok: boolean;
  id?: string;
  error?: string;
  skipped?: boolean;
}

export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  if (!smsConfigured) {
    console.warn(
      `[sms] skipped (TERMII_API_KEY not set): ${input.to} — "${input.body.slice(0, 40)}..."`,
    );
    return { ok: true, skipped: true };
  }

  const to = input.to.replace(/^\+/, "");

  try {
    const res = await fetch(TERMII_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        from: SENDER_ID,
        sms: input.body,
        type: "plain",
        channel: input.channel ?? "dnd",
        api_key: env.TERMII_API_KEY,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json().catch(() => ({}))) as {
      message_id?: string;
      message?: string;
      code?: string;
    };
    if (!res.ok || json.code === "fail") {
      console.error("[sms] termii rejected:", json);
      return { ok: false, error: json.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, ...(json.message_id && { id: json.message_id }) };
  } catch (err) {
    console.error("[sms] threw:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Unknown" };
  }
}
