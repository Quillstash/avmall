"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Users,
  Archive,
  Flag,
  BarChart3,
  Sparkles,
  Settings,
  Truck,
  Shield,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: number;
  exact?: boolean;
}

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag, badge: 12 },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/returns", label: "Returns", icon: Archive, badge: 3 },
  { href: "/admin/discounts", label: "Discounts", icon: Flag },
  { href: "/admin/shipping", label: "Shipping", icon: Truck },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/ai", label: "AI agent", icon: Sparkles, badge: 2 },
];

const SECONDARY: NavItem[] = [
  { href: "/admin/staff", label: "Staff & roles", icon: Shield },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <aside className="hidden lg:flex flex-shrink-0 w-60 flex-col bg-surface border-r border-border">
      {/* Logo */}
      <div className="px-4 pt-5 pb-4 flex items-center gap-2.5">
        <span className="inline-flex items-center justify-center size-8 rounded-md bg-brand-primary text-brand-primary-fg text-sm font-extrabold">
          av
        </span>
        <div>
          <div className="font-bold text-sm tracking-tight">Avmall</div>
          <div className="text-[10px] text-fg-muted font-medium">Lagos · ops</div>
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
      <div className="px-3 py-3 border-t border-border flex items-center gap-2.5">
        <div className="size-8 rounded-full bg-gradient-to-br from-brand-primary to-[hsl(262_60%_48%)] text-white flex items-center justify-center font-bold text-xs">
          FA
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold truncate">Funmi A.</div>
          <div className="text-[10px] text-fg-muted">Manager</div>
        </div>
        <button
          className="size-7 rounded-md hover:bg-surface-2 text-fg-muted inline-flex items-center justify-center"
          aria-label="More"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </div>
    </aside>
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
