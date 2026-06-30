import Link from "next/link";
import Image from "next/image";
import { Search, Home, ShoppingBag, LifeBuoy } from "lucide-react";
import { SITE } from "@/lib/site";

export const metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="min-h-screen bg-bg text-fg flex flex-col">
      <header className="px-5 sm:px-8 py-5">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-bold text-xl tracking-tight"
        >
          <Image
            src="/brand/monogram.png"
            alt="Avmall"
            width={32}
            height={32}
            className="size-8 rounded-md"
            priority
          />
          <span>Avmall</span>
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-xl text-center">
          {/* Big gradient 404 with a soft glow behind it */}
          <div className="relative isolate">
            <div
              aria-hidden
              className="absolute inset-0 -z-10 mx-auto h-48 w-48 sm:h-64 sm:w-64 rounded-full bg-brand-primary/15 blur-3xl"
            />
            <p className="font-display font-bold leading-none tracking-tight text-[7rem] sm:text-[10rem] bg-gradient-to-br from-brand-primary to-brand-accent bg-clip-text text-transparent select-none">
              404
            </p>
          </div>

          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight mt-1">
            This page wandered off
          </h1>
          <p className="text-sm sm:text-base text-fg-muted mt-3 max-w-md mx-auto leading-relaxed">
            The page you&apos;re looking for doesn&apos;t exist or may have
            moved. Let&apos;s get you back to the good stuff.
          </p>

          {/* Search — plain GET form, works without JS */}
          <form
            action="/search"
            method="get"
            className="mt-8 flex items-center gap-2 max-w-md mx-auto"
          >
            <div className="flex-1 flex items-center gap-2 h-12 px-4 rounded-lg border border-border-strong bg-surface focus-within:ring-2 focus-within:ring-brand-primary/30 focus-within:border-brand-primary transition-shadow">
              <Search className="size-4 text-fg-muted flex-shrink-0" />
              <input
                name="q"
                type="search"
                placeholder="Search products…"
                aria-label="Search products"
                className="flex-1 min-w-0 bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle"
              />
            </div>
            <button
              type="submit"
              className="h-12 px-5 rounded-lg bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity flex-shrink-0"
            >
              Search
            </button>
          </form>

          {/* Primary actions */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-11 px-6 rounded-lg bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              <Home className="size-4" /> Back home
            </Link>
            <Link
              href="/search"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-11 px-6 rounded-lg border border-border-strong bg-surface font-semibold text-sm hover:bg-surface-2 transition-colors"
            >
              <ShoppingBag className="size-4" /> Browse the shop
            </Link>
          </div>

          {/* Help */}
          <p className="text-xs text-fg-muted mt-10">
            Still stuck?{" "}
            <a
              href={SITE.social.whatsapp}
              target="_blank"
              rel="noreferrer noopener"
              className="text-brand-primary font-semibold hover:underline inline-flex items-center gap-1 align-middle"
            >
              <LifeBuoy className="size-3.5" /> Chat with us on WhatsApp
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
