"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { ShoppingBag, Search, Menu, User, MessageCircle, X } from "lucide-react";
import { useCart } from "@/stores/cart-store";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";
import { NavSearch } from "@/components/storefront/nav-search";
import { ThemeToggle } from "@/components/theme-toggle";
import { StoreSwitcher, type StoreOption } from "@/components/storefront/store-switcher";

/** A nav category, fetched per store by the storefront layout. */
export type NavCategory = { slug: string; name: string; count: number };

export function TopNav({
  stores = [],
  currentStoreSlug = null,
  categories = [],
}: {
  stores?: StoreOption[];
  currentStoreSlug?: string | null;
  categories?: NavCategory[];
}) {
  const lines = useCart((s) => s.lines);
  const count = lines.reduce((a, l) => a + l.qty, 0);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = React.useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md border-b border-border">
        {/* Top utility strip (desktop only) */}
        <div className="hidden lg:block border-b border-border">
          <div className="mx-auto max-w-7xl px-6 h-9 flex items-center gap-5 text-xs text-fg-muted">
            {stores.length > 0 && (
              <StoreSwitcher stores={stores} currentSlug={currentStoreSlug} />
            )}
            <span>Free shipping on orders over ₦25,000 in Lagos</span>
            <span className="ml-auto">NGN ₦</span>
            <Link href="/faq" className="hover:text-fg">Help</Link>
            <Link href="/track-order" className="hover:text-fg">Track order</Link>
            <a
              href={SITE.social.whatsapp}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 hover:text-fg"
            >
              <MessageCircle className="size-3" /> WhatsApp us
            </a>
          </div>
        </div>

        {/* Main bar */}
        <div className="mx-auto max-w-7xl px-4 lg:px-6 h-16 flex items-center gap-3 lg:gap-8">
          {/* Mobile menu */}
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden flex items-center justify-center size-10 rounded-md hover:bg-surface-2"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <Image
              src="/brand/monogram.png"
              alt="Avmall"
              width={32}
              height={32}
              className="size-8 rounded-md"
              priority
            />
            <span>mall</span>
          </Link>

          {/* Desktop nav — categories fetched per store */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium">
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={`/category/${c.slug}`}
                className="hover:text-brand-primary transition-colors whitespace-nowrap"
              >
                {c.name}
              </Link>
            ))}
            <Link href="/journal" className="hover:text-brand-primary transition-colors">
              Journal
            </Link>
          </nav>

          <div className="flex-1" />

          {/* Search */}
          <NavSearch />

          <button
            onClick={() => setMobileSearchOpen(true)}
            className="md:hidden flex items-center justify-center size-10 rounded-md hover:bg-surface-2"
            aria-label="Search"
          >
            <Search className="size-5" />
          </button>

          {/* Theme */}
          <ThemeToggle className="size-10 rounded-full" />

          {/* Account */}
          <Link
            href="/account"
            className="hidden md:flex items-center justify-center size-10 rounded-full hover:bg-surface-2 text-fg"
            aria-label="Account"
          >
            <User className="size-5" />
          </Link>

          {/* Cart */}
          <Link
            href="/cart"
            className="relative flex items-center justify-center size-10 rounded-full hover:bg-surface-2"
            aria-label={`Cart with ${count} items`}
          >
            <ShoppingBag className="size-5" />
            {count > 0 && (
              <span
                className="absolute top-1 right-1 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-brand-primary text-brand-primary-fg text-[10px] font-bold tabular"
                aria-hidden
              >
                {count}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* Mobile drawer */}
      <MobileDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        categories={categories}
      />

      {/* Mobile search overlay */}
      {mobileSearchOpen && (
        <NavSearch variant="overlay" onClose={() => setMobileSearchOpen(false)} />
      )}
    </>
  );
}

function MobileDrawer({
  open,
  onClose,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  categories: NavCategory[];
}) {
  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-fg/40 transition-opacity",
          open ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] bg-surface shadow-lg flex flex-col transition-transform",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-5 h-16 border-b border-border">
          <Link href="/" onClick={onClose} className="flex items-center gap-2 font-bold text-xl">
            <Image
              src="/brand/monogram.png"
              alt="Avmall"
              width={32}
              height={32}
              className="size-8 rounded-md"
            />
            <span>mall</span>
          </Link>
          <button
            onClick={onClose}
            className="flex items-center justify-center size-9 rounded-md hover:bg-surface-2"
            aria-label="Close menu"
          >
            <X className="size-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-5 flex flex-col gap-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-fg-muted mb-2">
            Shop
          </div>
          {categories.length === 0 && (
            <div className="py-3 text-sm text-fg-muted">No categories yet.</div>
          )}
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`/category/${c.slug}`}
              onClick={onClose}
              className="flex items-center justify-between py-3 text-base font-medium hover:text-brand-primary border-b border-border"
            >
              {c.name}
              <span className="text-xs text-fg-muted tabular">{c.count}</span>
            </Link>
          ))}
          <div className="text-[11px] font-bold uppercase tracking-wider text-fg-muted mb-2 mt-6">
            Account
          </div>
          <Link
            href="/account"
            onClick={onClose}
            className="py-3 text-base font-medium hover:text-brand-primary border-b border-border"
          >
            My account
          </Link>
          <Link
            href="/account/orders"
            onClick={onClose}
            className="py-3 text-base font-medium hover:text-brand-primary border-b border-border"
          >
            Orders
          </Link>
          <a
            href={SITE.social.whatsapp}
            target="_blank"
            rel="noreferrer noopener"
            onClick={onClose}
            className="py-3 text-base font-medium hover:text-brand-primary border-b border-border inline-flex items-center gap-2"
          >
            <MessageCircle className="size-4" /> WhatsApp support
          </a>
          <Link
            href="/track-order"
            onClick={onClose}
            className="py-3 text-base font-medium hover:text-brand-primary border-b border-border"
          >
            Track order
          </Link>
          <div className="text-[11px] font-bold uppercase tracking-wider text-fg-muted mb-2 mt-6">
            Help
          </div>
          <Link
            href="/faq"
            onClick={onClose}
            className="py-3 text-base font-medium hover:text-brand-primary border-b border-border"
          >
            FAQ
          </Link>
          <Link
            href="/shipping"
            onClick={onClose}
            className="py-3 text-base font-medium hover:text-brand-primary border-b border-border"
          >
            Shipping
          </Link>
          <Link
            href="/returns"
            onClick={onClose}
            className="py-3 text-base font-medium hover:text-brand-primary border-b border-border"
          >
            Returns
          </Link>
          <Link
            href="/contact"
            onClick={onClose}
            className="py-3 text-base font-medium hover:text-brand-primary border-b border-border"
          >
            Contact
          </Link>
        </nav>
      </aside>
    </>
  );
}
