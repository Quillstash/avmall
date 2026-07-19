"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  ScanLine,
  ShoppingBag,
  Store,
  Package,
  Users,
  Archive,
  Flag,
  BarChart3,
  Receipt,
  Sparkles,
  Award,
  Settings,
  Truck,
  Shield,
  FileText,
  LogOut,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminNav } from "@/stores/admin-nav-store";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: number;
  exact?: boolean;
}

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/pos", label: "Register", icon: ScanLine },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/returns", label: "Returns", icon: Archive },
  { href: "/admin/discounts", label: "Discounts", icon: Flag },
  { href: "/admin/shipping", label: "Shipping", icon: Truck },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/expenses", label: "Expenses", icon: Receipt },
  { href: "/admin/ai", label: "Profit Analysis", icon: Sparkles },
  { href: "/admin/staff-analysis", label: "Staff Analysis", icon: Award },
];

const SECONDARY: NavItem[] = [
  { href: "/admin/content", label: "Content", icon: FileText },
  { href: "/admin/stores", label: "Stores", icon: Store },
  { href: "/admin/staff", label: "Staff & roles", icon: Shield },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const mobileOpen = useAdminNav((s) => s.mobileOpen);
  const close = useAdminNav((s) => s.close);

  // Close the mobile drawer whenever the route changes (e.g. tapping a link).
  React.useEffect(() => {
    close();
  }, [pathname, close]);

  return (
    <>
      {/* Desktop: persistent rail */}
      <aside className="hidden lg:flex flex-shrink-0 w-60 flex-col bg-surface border-r border-border">
        <SidebarBody />
      </aside>

      {/* Mobile: slide-in drawer */}
      <div
        className={cn(
          "lg:hidden fixed inset-0 z-40 bg-fg/40 transition-opacity",
          mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={close}
        aria-hidden
      />
      <aside
        className={cn(
          "lg:hidden fixed inset-y-0 left-0 z-50 w-64 max-w-[85vw] flex flex-col bg-surface border-r border-border shadow-lg transition-transform",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <button
          onClick={close}
          className="absolute top-4 right-3 inline-flex items-center justify-center size-8 rounded-md hover:bg-surface-2 text-fg-muted"
          aria-label="Close navigation"
        >
          <X className="size-5" />
        </button>
        <SidebarBody />
      </aside>
    </>
  );
}

function SidebarBody() {
  const pathname = usePathname();
  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <>
      {/* Logo */}
      <div className="px-4 pt-5 pb-4 flex items-center gap-2.5">
        <Image
          src="/brand/monogram.png"
          alt="Avmall"
          width={32}
          height={32}
          className="size-8 rounded-md"
        />
        <div>
          <div className="font-bold text-sm tracking-tight">Avmall</div>
          <div className="text-[10px] text-fg-muted font-medium">Zaria · ops</div>
        </div>
      </div>

      {/* Primary nav */}
      <nav className="flex-1 px-2.5 flex flex-col gap-0.5 overflow-y-auto">
        {NAV.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item)} />
        ))}

        <div className="border-t border-border mt-3 pt-3">
          {SECONDARY.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item)} />
          ))}
        </div>
      </nav>

      {/* User pill */}
      <UserPill />
    </>
  );
}

function UserPill() {
  const { data: session } = useSession();
  const name = session?.user?.name ?? "Staff";
  const role = (session?.user?.role as string | undefined) ?? "—";
  const initials = name
    .split(/\s+/)
    .map((s) => s.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";

  return (
    <div className="px-3 py-3 border-t border-border flex items-center gap-2.5">
      <Link
        href="/admin/profile"
        className="flex items-center gap-2.5 flex-1 min-w-0 hover:bg-surface-2 rounded-md -mx-1 px-1 py-1"
      >
        <div className="size-8 rounded-full bg-gradient-to-br from-brand-primary to-[hsl(262_60%_48%)] text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold truncate">{name}</div>
          <div className="text-[10px] text-fg-muted capitalize">{role.replace("_", " ")}</div>
        </div>
      </Link>
      <button
        onClick={() => signOut({ callbackUrl: "/admin-login" })}
        className="size-7 rounded-md hover:bg-surface-2 text-fg-muted hover:text-danger inline-flex items-center justify-center"
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut className="size-4" />
      </button>
    </div>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] transition-colors",
        active
          ? "bg-info-bg text-brand-primary font-semibold"
          : "text-fg hover:bg-surface-2 font-medium",
      )}
    >
      <Icon className="size-4" />
      <span className="flex-1">{item.label}</span>
      {item.badge != null && (
        <span
          className={cn(
            "inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold tabular",
            active
              ? "bg-brand-primary text-brand-primary-fg"
              : "bg-surface-2 text-fg-muted",
          )}
        >
          {item.badge}
        </span>
      )}
    </Link>
  );
}
