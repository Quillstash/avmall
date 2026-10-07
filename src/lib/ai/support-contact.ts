/**
 * The shop's real contact for the AI to hand a customer to, read live from
 * admin Settings. Included in tool responses whenever the agent would
 * otherwise improvise one — in testing it built a "support" wa.me link out of
 * the CUSTOMER's own phone number.
 */

import "server-only";

import { getStoreContact, storeWaLink } from "@/lib/data/settings";

export async function supportContact() {
  const c = await getStoreContact();
  return { whatsappLink: storeWaLink(c.whatsapp), phone: c.phone };
}

export const SUPPORT_HINT =
  "Give the customer support.whatsappLink exactly as given (never build a wa.me link yourself, and never use the customer's own number) so staff can check. Don't say someone will join this chat or ask them to wait.";
