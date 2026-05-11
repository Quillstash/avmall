"use client";

import { Bell, Search, Menu } from "lucide-react";

interface TopBarProps {
  breadcrumbs?: { label: string; href?: string }[];
  onOpenMobileNav?: () => void;
}

export function AdminTopBar({ breadcrumbs = [], onOpenMobileNav }: TopBarProps) {
  return (
    <header className="flex-shrink-0 h-14 bg-surface border-b border-border flex items-center gap-3 px-4 lg:px-6">
      <button
        onClick={onOpenMobileNav}
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

      <div className="hidden md:flex items-center gap-2 px-3 h-9 w-72 bg-surface-2 border border-border rounded-md text-fg-muted text-sm">
        <Search className="size-4" />
        <span className="flex-1">Search orders, products, customers…</span>
        <kbd className="text-[10px] font-mono px-1.5 py-0.5 bg-surface border border-border rounded">
          ⌘K
        </kbd>
      </div>

      <button
        className="relative flex items-center justify-center size-9 rounded-md hover:bg-surface-2"
        aria-label="Notifications"
      >
        <Bell className="size-5" />
        <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-danger border-2 border-surface" />
      </button>
    </header>
  );
}
