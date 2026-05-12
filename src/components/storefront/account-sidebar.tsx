"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Package, MapPin, User, LogOut, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/account", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/account/orders", label: "Orders", icon: Package },
  { href: "/account/addresses", label: "Addresses", icon: MapPin },
  { href: "/account/profile", label: "Profile", icon: User },
];

interface Props {
  /** Current customer profile from server. Optional so the sidebar can render
   *  before hydration completes. */
  customer?: { name: string; phone: string } | null;
}

export function AccountSidebar({ customer }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = React.useState(false);

  const name = customer?.name ?? "Welcome";
  const phone = customer?.phone ?? "";
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function signOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/customer/session", { method: "DELETE" });
    } finally {
      setSigningOut(false);
      router.replace("/");
      router.refresh();
    }
  }

  return (
    <div className="sticky top-28">
      <div className="flex items-center gap-3 mb-6 pb-5 border-b border-border">
        <div className="size-12 rounded-full bg-gradient-to-br from-brand-primary to-[hsl(262_60%_48%)] text-white flex items-center justify-center font-bold">
          {initials}
        </div>
        <div className="min-w-0">
          <div className="font-bold text-sm truncate">{name}</div>
          {phone && (
            <div className="text-xs text-fg-muted font-mono tabular truncate">{phone}</div>
          )}
        </div>
      </div>
      <nav className="flex flex-col gap-1">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                active
                  ? "bg-info-bg text-brand-primary font-semibold"
                  : "text-fg hover:bg-surface-2",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
        <button
          onClick={signOut}
          disabled={signingOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-danger hover:bg-danger-bg mt-2 text-left disabled:opacity-50"
        >
          <LogOut className="size-4" />
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </nav>
    </div>
  );
}
