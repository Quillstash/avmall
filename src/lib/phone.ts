/**
 * Nigerian phone number normalisation — always store as E.164 (+234...).
 * Accepts: 0803..., +234803..., 234803..., 803... (10-digit, no leading zero).
 * See CLAUDE.md §2.1 + §22.
 */

export class InvalidPhoneError extends Error {
  constructor(public readonly input: string) {
    super(`Invalid Nigerian phone number: ${input}`);
    this.name = "InvalidPhoneError";
  }
}

/** Prefix for the synthetic phone given to email-only signups that have no
 *  real number yet (the phone column is required + unique). Never shown. */
export const PENDING_PHONE_PREFIX = "+pending-";

/** True for an email-signup placeholder phone (no real number set yet). */
export function isPlaceholderPhone(phone: string | null | undefined): boolean {
  return !!phone && phone.startsWith(PENDING_PHONE_PREFIX);
}

export function normaliseNigerianPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");

  if (digits.startsWith("234") && digits.length === 13) {
    return `+${digits}`;
  }
  if (digits.startsWith("0") && digits.length === 11) {
    return `+234${digits.slice(1)}`;
  }
  if (digits.length === 10) {
    return `+234${digits}`;
  }

  throw new InvalidPhoneError(raw);
}

/** Format a normalised E.164 Nigerian phone for display: "+234 803 421 7790". */
export function formatNigerianPhone(e164: string): string {
  if (!e164.startsWith("+234")) return e164;
  const rest = e164.slice(4);
  if (rest.length !== 10) return e164;
  return `+234 ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`;
}

/** True if input is a valid Nigerian phone in any accepted format. */
export function isValidNigerianPhone(raw: string): boolean {
  try {
    normaliseNigerianPhone(raw);
    return true;
  } catch {
    return false;
  }
}
