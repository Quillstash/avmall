import { AccountSidebar } from "@/components/storefront/account-sidebar";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 lg:px-6 py-6 lg:py-10">
      <div className="grid lg:grid-cols-[240px_1fr] gap-8 lg:gap-12">
        <aside className="hidden lg:block">
          <AccountSidebar />
        </aside>
        <div>{children}</div>
      </div>
    </div>
  );
}
