/**
 * Helpers for turning phone / email values into clickable contact URLs.
 *
 *   waLink("+2348034217790")            → "https://wa.me/2348034217790"
 *   waLink("+2348034217790", "Hi Tolu") → "https://wa.me/...?text=Hi%20Tolu"
 *   telLink("+234 803 421 7790")        → "tel:+2348034217790"
 *   mailtoLink("a@b.ng", "Subject", "Body") → "mailto:a@b.ng?subject=...&body=..."
 */

export function digits(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function waLink(phone: string, message?: string): string {
  const num = digits(phone);
  const base = `https://wa.me/${num}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function telLink(phone: string): string {
  return `tel:+${digits(phone)}`;
}

export function mailtoLink(email: string, subject?: string, body?: string): string {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);
  const q = params.toString();
  return `mailto:${email}${q ? `?${q}` : ""}`;
}
