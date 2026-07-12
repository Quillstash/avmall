/**
 * Email sender. Wraps Resend with a graceful "no-op when not configured"
 * fallback so dev-mode and design-only environments don't crash.
 *
 * Use the template helpers in `src/lib/email-templates.ts` to build payloads
 * — never hand-roll subject/html at the call site so the look stays consistent.
 *
 * Failure policy: emails are fire-and-forget. A delivery failure logs a
 * warning but never throws into the caller (an order shouldn't fail because
 * Resend is having a bad day).
 */

import "server-only";

import { Resend } from "resend";
import { env } from "@/lib/env";
import { SITE } from "@/lib/site";

/** True when Resend is wired up. UI uses this to show/hide email features. */
export const emailConfigured: boolean = !!env.RESEND_API_KEY;

let _client: Resend | null = null;

function client(): Resend {
  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set");
  }
  if (!_client) _client = new Resend(env.RESEND_API_KEY);
  return _client;
}

/**
 * The domain verified in Resend for sending. Deliberately NOT derived from
 * `SITE.domain` — that repoints for SEO/canonical URLs (e.g. to a *.vercel.app
 * deployment), which cannot send email. Sending from an unverified domain makes
 * Resend reject every message (invites, resets, receipts) silently. Override the
 * whole sender per-environment with EMAIL_FROM.
 */
const VERIFIED_EMAIL_DOMAIN = "avmall.com.ng";

/** Default "from" — points at the configured Resend sender. Override per-send
 *  when needed (e.g. invitations might come "from Funmi at Avmall"). */
function defaultFrom(): string {
  // Default to the VERIFIED domain so emails send to any recipient in every
  // environment without per-env config. `onboarding@resend.dev` is deliberately
  // NOT used as a fallback — it only delivers to the Resend account owner, which
  // silently breaks invites/receipts/resets. Override with EMAIL_FROM.
  return env.EMAIL_FROM || `${SITE.legalName} <noreply@${VERIFIED_EMAIL_DOMAIN}>`;
}

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  /** Free-form tags — Resend dashboard uses these for filtering. */
  tags?: { name: string; value: string }[];
}

export interface SendEmailResult {
  ok: boolean;
  /** Resend's message id on success. */
  id?: string;
  error?: string;
  /** True when we skipped because Resend isn't configured (still a "success"
   *  shape so callers don't blow up — the email simply didn't fly). */
  skipped?: boolean;
}

/**
 * Fire-and-forget send. Never throws — returns `{ ok: false, error }` instead.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!emailConfigured) {
    console.warn(
      `[email] skipped (RESEND_API_KEY not set): "${input.subject}" → ${
        Array.isArray(input.to) ? input.to.join(", ") : input.to
      }`,
    );
    return { ok: true, skipped: true };
  }

  try {
    const res = await client().emails.send({
      from: input.from ?? defaultFrom(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      ...(input.text && { text: input.text }),
      ...(input.replyTo && { replyTo: input.replyTo }),
      ...(input.tags && { tags: input.tags }),
    });
    if (res.error) {
      console.error("[email] resend rejected:", res.error);
      return { ok: false, error: res.error.message };
    }
    return { ok: true, ...(res.data?.id && { id: res.data.id }) };
  } catch (err) {
    console.error("[email] threw:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Unknown" };
  }
}
