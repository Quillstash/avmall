import { AccountSidebar } from "@/components/storefront/account-sidebar";
import { VerifyEmailBanner } from "@/components/storefront/verify-email-banner";
import { getCustomerSession } from "@/lib/customer-session";
import { db } from "@/lib/db";
import { formatNigerianPhone, isPlaceholderPhone } from "@/lib/phone";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getCustomerSession();
  let customer: { name: string; phone: string } | null = null;
  let unverifiedEmail: string | null = null;

  if (session) {
    const c = await db.customer.findUnique({ where: { id: session.customerId } });
    if (c) {
      customer = {
        name: c.name,
        phone: isPlaceholderPhone(c.phone) ? "" : formatNigerianPhone(c.phone),
      };
      if (c.email && !c.emailVerified) unverifiedEmail = c.email;
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 lg:px-6 py-6 lg:py-10">
      <div className="grid lg:grid-cols-[240px_1fr] gap-8 lg:gap-12">
        <aside className="hidden lg:block">
          <AccountSidebar customer={customer} />
        </aside>
        <div>
          {unverifiedEmail && <VerifyEmailBanner email={unverifiedEmail} />}
          {children}
        </div>
      </div>
    </div>
  );
}
