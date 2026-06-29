/**
 * Customer authentication — passwordless OTP.
 *
 * Flow:
 *   1. POST /api/auth/customer/start  { identifier }  — sends a 6-digit code
 *      to the customer's phone (SMS) or email. Code is bcrypt-hashed and
 *      stored in OtpCode with a 5-min expiry, 5-attempt limit.
 *   2. POST /api/auth/customer/verify { identifier, code }  — checks the
 *      latest code, creates or finds the Customer row, then writes a signed
 *      JWT into an HttpOnly cookie (`av_session`).
 *
 * The session cookie is verified on every server-side render that needs the
 * current customer (account pages, cart, checkout).
 *
 * For now the "send code" step prints to the console — Phase 5 wires Termii
 * (SMS) and Resend (email).
 */

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { getStorefrontStoreId } from "./store";
import { env } from "./env";
import {
  normaliseNigerianPhone,
  isValidNigerianPhone,
  PENDING_PHONE_PREFIX,
} from "./phone";
import { AppError, UnauthorizedError, ValidationError, RateLimitedError } from "./errors";

const COOKIE_NAME = "av_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const OTP_TTL_MIN = 5;
const OTP_MAX_ATTEMPTS = 5;

interface CustomerSessionPayload {
  customerId: string;
  phone: string;
}

function getSecret(): Uint8Array {
  const secret = env.CUSTOMER_SESSION_SECRET ?? env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error(
      "CUSTOMER_SESSION_SECRET (or NEXTAUTH_SECRET) must be set to sign customer sessions",
    );
  }
  return new TextEncoder().encode(secret);
}

/** Normalise the identifier — Nigerian E.164 phone or lower-cased email. */
export function normalizeIdentifier(raw: string): { kind: "phone" | "email"; value: string } {
  const trimmed = raw.trim();
  if (trimmed.includes("@")) {
    return { kind: "email", value: trimmed.toLowerCase() };
  }
  if (isValidNigerianPhone(trimmed)) {
    return { kind: "phone", value: normaliseNigerianPhone(trimmed) };
  }
  throw new ValidationError({ identifier: "Enter a Nigerian phone or an email address" });
}

/** Generate a fresh OTP, store it bcrypt-hashed, and return the plaintext
 *  code to the caller so it can be delivered via SMS/email. */
export async function startOtp(rawIdentifier: string): Promise<{
  identifier: string;
  kind: "phone" | "email";
  code: string; // for dev — Phase 5 will deliver this and not return it
}> {
  const { kind, value } = normalizeIdentifier(rawIdentifier);

  // Throttle: reject if we sent a code in the last 60 seconds.
  const recent = await db.otpCode.findFirst({
    where: {
      identifier: value,
      createdAt: { gt: new Date(Date.now() - 60 * 1000) },
    },
  });
  if (recent) {
    throw new RateLimitedError("Wait 60 seconds before requesting another code");
  }

  // Generate a 6-digit code with a leading-zero-preserving format.
  const code = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");

  await db.otpCode.create({
    data: {
      identifier: value,
      codeHash: await bcrypt.hash(code, 10),
      expiresAt: new Date(Date.now() + OTP_TTL_MIN * 60 * 1000),
    },
  });

  return { identifier: value, kind, code };
}

/**
 * Verify the latest active OTP for an identifier and consume it (so it can't
 * be replayed). Throws on missing / expired / wrong / too-many-attempts.
 * Shared by OTP sign-in and password reset.
 */
async function consumeOtpCode(
  rawIdentifier: string,
  code: string,
): Promise<{ kind: "phone" | "email"; value: string }> {
  const { kind, value } = normalizeIdentifier(rawIdentifier);

  const otp = await db.otpCode.findFirst({
    where: { identifier: value, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) throw new UnauthorizedError("Code expired or not found — request a new one");

  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    throw new RateLimitedError("Too many attempts — request a new code");
  }

  const ok = await bcrypt.compare(code, otp.codeHash);
  if (!ok) {
    await db.otpCode.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    throw new UnauthorizedError("Incorrect code");
  }

  await db.otpCode.update({
    where: { id: otp.id },
    data: { consumedAt: new Date() },
  });

  return { kind, value };
}

/**
 * Verify a code against the most recent active OTP for this identifier. On
 * success, find-or-create the Customer and set a signed session cookie.
 */
export async function verifyOtpAndStartSession(
  rawIdentifier: string,
  code: string,
): Promise<{ customerId: string; isNew: boolean }> {
  const { kind, value } = await consumeOtpCode(rawIdentifier, code);

  // Find-or-create the customer within the storefront's active store
  // (customers are per-store).
  const storeId = await getStorefrontStoreId();
  if (!storeId) throw new UnauthorizedError("No store available");
  let customer = await db.customer.findFirst({
    where: {
      storeId,
      ...(kind === "phone" ? { phone: value } : { email: value }),
    },
  });
  let isNew = false;
  if (!customer) {
    customer = await db.customer.create({
      data: {
        storeId,
        phone: kind === "phone" ? value : `${PENDING_PHONE_PREFIX}${Date.now()}`,
        email: kind === "email" ? value : null,
        name: kind === "email" ? value.split("@")[0]! : "Customer",
      },
    });
    isNew = true;
  }

  await setCustomerSession({ customerId: customer.id, phone: customer.phone });

  return { customerId: customer.id, isNew };
}

const PASSWORD_MIN = 8;

/**
 * Create (or password-enable) a customer with email + password, then start a
 * session. If the email already has a password it's a conflict — sign in
 * instead. An OTP-only customer with this email gets the password linked,
 * keeping their existing orders/data.
 */
export async function signupWithPassword(
  rawEmail: string,
  password: string,
  name?: string,
): Promise<{ customerId: string }> {
  const email = rawEmail.trim().toLowerCase();
  if (!email.includes("@")) {
    throw new ValidationError({ email: "Enter a valid email address" });
  }
  if (password.length < PASSWORD_MIN) {
    throw new ValidationError({ password: `Use at least ${PASSWORD_MIN} characters` });
  }

  const storeId = await getStorefrontStoreId();
  if (!storeId) throw new UnauthorizedError("No store available");

  const passwordHash = await bcrypt.hash(password, 10);
  const trimmedName = name?.trim();

  const existing = await db.customer.findFirst({ where: { storeId, email } });
  if (existing) {
    if (existing.passwordHash) {
      throw new AppError(
        "EMAIL_EXISTS",
        "An account with this email already exists — please sign in.",
        409,
      );
    }
    const updated = await db.customer.update({
      where: { id: existing.id },
      data: { passwordHash, ...(trimmedName && { name: trimmedName }) },
    });
    await setCustomerSession({ customerId: updated.id, phone: updated.phone });
    return { customerId: updated.id };
  }

  const customer = await db.customer.create({
    data: {
      storeId,
      email,
      // Placeholder until the customer adds a real number (phone is the other
      // unique key); mirrors the OTP-by-email path.
      phone: `${PENDING_PHONE_PREFIX}${Date.now()}`,
      name: trimmedName || email.split("@")[0]!,
      passwordHash,
    },
  });
  await setCustomerSession({ customerId: customer.id, phone: customer.phone });
  return { customerId: customer.id };
}

/** Verify an email + password and start a session. */
export async function loginWithPassword(
  rawEmail: string,
  password: string,
): Promise<{ customerId: string }> {
  const email = rawEmail.trim().toLowerCase();
  const storeId = await getStorefrontStoreId();
  if (!storeId) throw new UnauthorizedError("No store available");

  const customer = await db.customer.findFirst({ where: { storeId, email } });
  // Identical message for "no such email" and "wrong password" so we never
  // leak which emails have accounts.
  if (
    !customer?.passwordHash ||
    !(await bcrypt.compare(password, customer.passwordHash))
  ) {
    throw new UnauthorizedError("Incorrect email or password");
  }

  await setCustomerSession({ customerId: customer.id, phone: customer.phone });
  return { customerId: customer.id };
}

/**
 * Reset a customer's password using an OTP they received by email (the "forgot
 * password" flow). Verifies + consumes the code, sets the new password, and
 * starts a session. The account must already exist.
 */
export async function resetPasswordWithOtp(
  rawIdentifier: string,
  code: string,
  newPassword: string,
): Promise<{ customerId: string }> {
  if (newPassword.length < PASSWORD_MIN) {
    throw new ValidationError({ password: `Use at least ${PASSWORD_MIN} characters` });
  }

  const { kind, value } = await consumeOtpCode(rawIdentifier, code);

  const storeId = await getStorefrontStoreId();
  if (!storeId) throw new UnauthorizedError("No store available");

  const customer = await db.customer.findFirst({
    where: { storeId, ...(kind === "phone" ? { phone: value } : { email: value }) },
  });
  if (!customer) {
    throw new UnauthorizedError("No account found for that email");
  }

  const updated = await db.customer.update({
    where: { id: customer.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 10) },
  });
  await setCustomerSession({ customerId: updated.id, phone: updated.phone });
  return { customerId: updated.id };
}

/**
 * Confirm the logged-in customer's email with a code sent to it. No-op if
 * already verified.
 */
export async function verifyEmailWithCode(code: string): Promise<void> {
  const session = await getCustomerSession();
  if (!session) throw new UnauthorizedError("Sign in first");

  const customer = await db.customer.findUnique({
    where: { id: session.customerId },
  });
  if (!customer) throw new UnauthorizedError("Account not found");
  if (customer.emailVerified) return;
  if (!customer.email) {
    throw new ValidationError({ email: "No email on file to verify" });
  }

  await consumeOtpCode(customer.email, code);
  await db.customer.update({
    where: { id: customer.id },
    data: { emailVerified: true },
  });
}

/**
 * Change the logged-in customer's password. If they already have one, the
 * current password must be supplied + correct; OTP-only customers can set one
 * without it.
 */
export async function changePassword(
  currentPassword: string | undefined,
  newPassword: string,
): Promise<void> {
  if (newPassword.length < PASSWORD_MIN) {
    throw new ValidationError({ newPassword: `Use at least ${PASSWORD_MIN} characters` });
  }
  const session = await getCustomerSession();
  if (!session) throw new UnauthorizedError("Sign in first");

  const customer = await db.customer.findUnique({
    where: { id: session.customerId },
  });
  if (!customer) throw new UnauthorizedError("Account not found");

  if (customer.passwordHash) {
    if (
      !currentPassword ||
      !(await bcrypt.compare(currentPassword, customer.passwordHash))
    ) {
      throw new ValidationError({ currentPassword: "Current password is incorrect" });
    }
  }

  await db.customer.update({
    where: { id: customer.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 10) },
  });
}

export async function setCustomerSession(payload: CustomerSessionPayload): Promise<void> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${COOKIE_MAX_AGE}s`)
    .sign(getSecret());

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function getCustomerSession(): Promise<CustomerSessionPayload | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      customerId: payload.customerId as string,
      phone: payload.phone as string,
    };
  } catch {
    return null;
  }
}

export async function clearCustomerSession(): Promise<void> {
  cookies().delete(COOKIE_NAME);
}
