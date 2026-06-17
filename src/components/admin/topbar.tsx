"use client";

import { Bell, Menu } from "lucide-react";
import { AdminTopBarSearch } from "@/components/admin/topbar-search";
import { StoreSwitcher } from "@/components/admin/store-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAdminNav } from "@/stores/admin-nav-store";

interface TopBarProps {
  breadcrumbs?: { label: string; href?: string }[];
}

export function AdminTopBar({ breadcrumbs = [] }: TopBarProps) {
  const openMobileNav = useAdminNav((s) => s.open);
  return (
    <header className="flex-shrink-0 h-14 bg-surface border-b border-border flex items-center gap-3 px-4 lg:px-6">
      <button
        onClick={openMobileNav}
        className="lg:hidden inline-flex items-center justify-center size-9 rounded-md hover:bg-surface-2"
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </button>

      <nav className="flex items-center gap-1.5 text-xs text-fg-muted">
        {breadcrumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-fg-subtle">/</span>}
            <span
              className={
                i === breadcrumbs.length - 1 ? "text-fg font-semibold" : "hover:text-fg"
              }
            >
              {c.label}
            </span>
          </span>
        ))}
      </nav>

      <div className="flex-1" />

      <StoreSwitcher />
      <AdminTopBarSearch />

      <ThemeToggle />

      <button
        className="relative flex items-center justify-center size-9 rounded-md hover:bg-surface-2"
        aria-label="Notifications"
      >
        <Bell className="size-5" />
      </button>
    </header>
  );
}
