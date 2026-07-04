import { z } from "zod";

/**
 * Centralised env validation. All env access in the app goes through this
 * module — never reach into `process.env` directly.
 *
 * Variables are split into "required-at-runtime" (will throw on app boot if
 * missing) and "optional" (gracefully degraded). The split is calibrated for
 * the current build phase: in Phase 4 the DB is required-when-present but
 * the storefront still boots without one so design work can continue.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Database — optional in Phase 4 so the storefront still boots while you
  // provision Neon. The DB-backed endpoints check `hasDatabase` and fall back
  // to mock data when unset.
  DATABASE_URL: z.string().url().optional(),
  DIRECT_URL: z.string().url().optional(),

  // Auth
  NEXTAUTH_SECRET: z.string().min(32).optional(),
  NEXTAUTH_URL: z.string().url().optional(),
  /// Signs the customer OTP session cookie. Falls back to NEXTAUTH_SECRET.
  CUSTOMER_SESSION_SECRET: z.string().min(32).optional(),

  // Cloudflare R2 (Phase 5)
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().url().optional(),

  // Payments — Nuqood
  /// "APIKEY-..." string — sent as the `api-key` header.
  NUQOOD_API_KEY: z.string().optional(),
  /// "SECKEY-..." string — sent as the `secret-key` header.
  NUQOOD_SECRET_KEY: z.string().optional(),
  /// Business code Nuqood issues per merchant — required on every request body.
  NUQOOD_BUSINESS_CODE: z.string().optional(),
  /// Override the API base. Defaults to https://nuqood.ng — set this if Nuqood
  /// gives us a sandbox host.
  NUQOOD_API_BASE: z.string().url().optional(),
  /// Nuqood doesn't sign webhooks. We embed this opaque token in the callback
  /// URL (`?token=…`) and reject any inbound webhook missing/mismatching it.
  NUQOOD_WEBHOOK_SECRET: z.string().min(16).optional(),

  // WhatsApp (Phase 5)
  META_WA_TOKEN: z.string().optional(),
  META_WA_PHONE_NUMBER_ID: z.string().optional(),
  META_WA_VERIFY_TOKEN: z.string().optional(),

  // AI (Phase 5)
  OPENAI_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  /// Bearer token D-Zero (or any AI orchestrator) presents when calling
  /// /api/v1/ai/tools/*. Treat as a secret. Rotate from admin settings.
  AI_AGENT_TOKEN: z.string().min(16).optional(),
  /// Bearer token cron callers (Vercel Cron, GitHub Actions, etc.) present
  /// in the Authorization header so our /api/cron/* routes aren't anonymous.
  CRON_SECRET: z.string().min(16).optional(),

  // Notifications (Phase 5)
  RESEND_API_KEY: z.string().optional(),
  /** Verified Resend sender, e.g. `Avmall <orders@avmall.ng>`. Falls back to
   *  Resend's shared onboarding@resend.dev (which only delivers to your own
   *  Resend account email) until a domain is verified. */
  EMAIL_FROM: z.string().optional(),
  /** Optional override for who receives the recurring sales-summary emails —
   *  a comma-separated list. When unset, they go to every active manager /
   *  super-admin from the staff table. */
  SALES_SUMMARY_RECIPIENTS: z.string().optional(),
  TERMII_API_KEY: z.string().optional(),
  AFRICAS_TALKING_API_KEY: z.string().optional(),
  AFRICAS_TALKING_USERNAME: z.string().optional(),

  // Cache / Queues (Phase 5)
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  /// Overrides the base URL used for functional links (payment URLs, Nuqood
  /// webhook callbacks). Defaults to SITE.url for SEO/OG. Set this to the
  /// active deployment (e.g. https://avmall.vercel.app) when the apex domain
  /// hasn't been moved over yet.
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),

  // Observability
  SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  AXIOM_TOKEN: z.string().optional(),
});

/** Treat empty strings in .env as unset — zod URL validators reject "". */
function blank(v: string | undefined): string | undefined {
  return v && v.trim() !== "" ? v : undefined;
}

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: blank(process.env.DATABASE_URL),
  DIRECT_URL: blank(process.env.DIRECT_URL),
  NEXTAUTH_SECRET: blank(process.env.NEXTAUTH_SECRET),
  NEXTAUTH_URL: blank(process.env.NEXTAUTH_URL),
  CUSTOMER_SESSION_SECRET: blank(process.env.CUSTOMER_SESSION_SECRET),
  R2_ACCOUNT_ID: blank(process.env.R2_ACCOUNT_ID),
  R2_ACCESS_KEY_ID: blank(process.env.R2_ACCESS_KEY_ID),
  R2_SECRET_ACCESS_KEY: blank(process.env.R2_SECRET_ACCESS_KEY),
  R2_BUCKET_NAME: blank(process.env.R2_BUCKET_NAME),
  R2_PUBLIC_URL: blank(process.env.R2_PUBLIC_URL),
  NUQOOD_API_KEY: blank(process.env.NUQOOD_API_KEY),
  NUQOOD_SECRET_KEY: blank(process.env.NUQOOD_SECRET_KEY),
  NUQOOD_BUSINESS_CODE: blank(process.env.NUQOOD_BUSINESS_CODE),
  NUQOOD_API_BASE: blank(process.env.NUQOOD_API_BASE),
  NUQOOD_WEBHOOK_SECRET: blank(process.env.NUQOOD_WEBHOOK_SECRET),
  META_WA_TOKEN: blank(process.env.META_WA_TOKEN),
  META_WA_PHONE_NUMBER_ID: blank(process.env.META_WA_PHONE_NUMBER_ID),
  META_WA_VERIFY_TOKEN: blank(process.env.META_WA_VERIFY_TOKEN),
  OPENAI_API_KEY: blank(process.env.OPENAI_API_KEY),
  DEEPSEEK_API_KEY: blank(process.env.DEEPSEEK_API_KEY),
  AI_AGENT_TOKEN: blank(process.env.AI_AGENT_TOKEN),
  CRON_SECRET: blank(process.env.CRON_SECRET),
  RESEND_API_KEY: blank(process.env.RESEND_API_KEY),
  EMAIL_FROM: blank(process.env.EMAIL_FROM),
  SALES_SUMMARY_RECIPIENTS: blank(process.env.SALES_SUMMARY_RECIPIENTS),
  TERMII_API_KEY: blank(process.env.TERMII_API_KEY),
  AFRICAS_TALKING_API_KEY: blank(process.env.AFRICAS_TALKING_API_KEY),
  AFRICAS_TALKING_USERNAME: blank(process.env.AFRICAS_TALKING_USERNAME),
  UPSTASH_REDIS_REST_URL: blank(process.env.UPSTASH_REDIS_REST_URL),
  UPSTASH_REDIS_REST_TOKEN: blank(process.env.UPSTASH_REDIS_REST_TOKEN),
  NEXT_PUBLIC_APP_URL: blank(process.env.NEXT_PUBLIC_APP_URL),
  SENTRY_DSN: blank(process.env.SENTRY_DSN),
  NEXT_PUBLIC_POSTHOG_KEY: blank(process.env.NEXT_PUBLIC_POSTHOG_KEY),
  AXIOM_TOKEN: blank(process.env.AXIOM_TOKEN),
});
