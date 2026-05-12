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

  // Payments — Nuqood (Phase 5)
  NUQOOD_API_KEY: z.string().optional(),
  NUQOOD_WEBHOOK_SECRET: z.string().optional(),

  // WhatsApp (Phase 5)
  META_WA_TOKEN: z.string().optional(),
  META_WA_PHONE_NUMBER_ID: z.string().optional(),
  META_WA_VERIFY_TOKEN: z.string().optional(),

  // AI (Phase 5)
  OPENAI_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),

  // Notifications (Phase 5)
  RESEND_API_KEY: z.string().optional(),
  TERMII_API_KEY: z.string().optional(),
  AFRICAS_TALKING_API_KEY: z.string().optional(),
  AFRICAS_TALKING_USERNAME: z.string().optional(),

  // Cache / Queues (Phase 5)
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Observability
  SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  AXIOM_TOKEN: z.string().optional(),
});

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  CUSTOMER_SESSION_SECRET: process.env.CUSTOMER_SESSION_SECRET,
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
  R2_PUBLIC_URL: process.env.R2_PUBLIC_URL,
  NUQOOD_API_KEY: process.env.NUQOOD_API_KEY,
  NUQOOD_WEBHOOK_SECRET: process.env.NUQOOD_WEBHOOK_SECRET,
  META_WA_TOKEN: process.env.META_WA_TOKEN,
  META_WA_PHONE_NUMBER_ID: process.env.META_WA_PHONE_NUMBER_ID,
  META_WA_VERIFY_TOKEN: process.env.META_WA_VERIFY_TOKEN,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  TERMII_API_KEY: process.env.TERMII_API_KEY,
  AFRICAS_TALKING_API_KEY: process.env.AFRICAS_TALKING_API_KEY,
  AFRICAS_TALKING_USERNAME: process.env.AFRICAS_TALKING_USERNAME,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  SENTRY_DSN: process.env.SENTRY_DSN,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  AXIOM_TOKEN: process.env.AXIOM_TOKEN,
});
