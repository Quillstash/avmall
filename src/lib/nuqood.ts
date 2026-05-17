/**
 * Nuqood client — typed wrapper around the few REST endpoints we use.
 *
 * Docs: https://nuqood.ng/documentation
 *
 * Auth: two custom headers
 *   api-key:    APIKEY-...   (env NUQOOD_API_KEY)
 *   secret-key: SECKEY-...   (env NUQOOD_SECRET_KEY)
 *
 * Every request body also carries `business_code` (env NUQOOD_BUSINESS_CODE).
 *
 * Currency note: the docs say `amount: String|Int` with no unit. Nuqood is
 * Nigerian-only and we believe the field is in whole Naira (NOT kobo), so we
 * convert kobo → naira before sending. If a test transaction comes through
 * 100× too small, flip CURRENCY_IN_KOBO to true here and that's the fix.
 */

import "server-only";

import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

const DEFAULT_BASE = "https://nuqood.ng";
const CURRENCY_IN_KOBO = false;

/** True when every required Nuqood env var is set. Endpoints fall back to a
 *  storefront-hosted stub URL when this is false. */
export const nuqoodConfigured: boolean =
  !!env.NUQOOD_API_KEY && !!env.NUQOOD_SECRET_KEY && !!env.NUQOOD_BUSINESS_CODE;

function baseUrl(): string {
  return env.NUQOOD_API_BASE ?? DEFAULT_BASE;
}

function authHeaders(): Record<string, string> {
  if (!env.NUQOOD_API_KEY || !env.NUQOOD_SECRET_KEY) {
    throw new AppError(
      "NUQOOD_NOT_CONFIGURED",
      "Nuqood credentials missing — set NUQOOD_API_KEY, NUQOOD_SECRET_KEY and NUQOOD_BUSINESS_CODE.",
      503,
    );
  }
  return {
    "Content-Type": "application/json",
    "api-key": env.NUQOOD_API_KEY,
    "secret-key": env.NUQOOD_SECRET_KEY,
  };
}

/** Convert our internal kobo to whatever Nuqood expects for `amount`. */
export function amountForNuqood(kobo: number): number {
  return CURRENCY_IN_KOBO ? kobo : Math.floor(kobo / 100);
}

/** Convert a webhook payload's `amount` back to our internal kobo. */
export function amountFromNuqood(value: number | string): number {
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (!Number.isFinite(n)) return 0;
  return CURRENCY_IN_KOBO ? Math.round(n) : Math.round(n * 100);
}

/** Shape of POST /api/v1/get_dynamic_account response per docs. */
export interface NuqoodDynamicAccount {
  ref: string;
  number: string;
  name: string;
  bank: string;
  time_left: string;
  checkoutUrl: string;
}

export interface CreateDynamicAccountInput {
  email: string;
  amountKobo: number;
  /// Where Nuqood should POST the success webhook. Include the URL token.
  callbackUrl: string;
}

/**
 * Spin up a one-shot virtual account / hosted-checkout link. The customer
 * is shown the bank details (or sent to checkoutUrl) and Nuqood POSTs our
 * callback when the transfer lands.
 */
export async function createDynamicAccount(
  input: CreateDynamicAccountInput,
): Promise<NuqoodDynamicAccount> {
  const body = {
    business_code: env.NUQOOD_BUSINESS_CODE,
    email: input.email,
    amount: amountForNuqood(input.amountKobo),
    callback: input.callbackUrl,
  };

  const res = await fetch(`${baseUrl()}/api/v1/get_dynamic_account`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
    // Network calls on the request path — keep them tight.
    signal: AbortSignal.timeout(12_000),
  });

  let json: {
    status?: boolean;
    desc?: string;
    account?: NuqoodDynamicAccount;
  };
  try {
    json = await res.json();
  } catch {
    throw new AppError(
      "NUQOOD_BAD_RESPONSE",
      `Nuqood returned a non-JSON response (status ${res.status})`,
      502,
    );
  }

  if (!res.ok || !json.status || !json.account) {
    throw new AppError(
      "NUQOOD_REQUEST_FAILED",
      json.desc ?? `Nuqood rejected the request (status ${res.status})`,
      502,
    );
  }

  return json.account;
}

/**
 * Shape of the inbound webhook payload per docs. Field names match Nuqood
 * exactly — don't rename without re-reading the docs.
 */
export interface NuqoodWebhookPayload {
  email?: string;
  phone?: string;
  business_code?: string;
  account_number?: string;
  customer_account_name?: string;
  customer_account_bank?: string;
  amount: number | string;
  date?: string;
  transaction_reference: string;
  customer_senderbankname?: string;
  customer_senderaccountnumber?: string;
  customer_sendername?: string;
}
