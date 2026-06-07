import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { ProductCard } from "@/components/storefront/product-card";
import { listProducts } from "@/lib/data/products";
import { getStorefrontStoreId } from "@/lib/store";

export const revalidate = 60;
export const dynamic = "force-dynamic";

interface SearchPageProps {
  searchParams: { q?: string };
}

export function generateMetadata({ searchParams }: SearchPageProps): Metadata {
  const q = searchParams.q?.trim();
  return {
    title: q ? `Search results for "${q}"` : "Search",
    robots: { index: false },
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const q = (searchParams.q ?? "").trim();
  const storeId = await getStorefrontStoreId();
  const products =
    q.length >= 2
      ? await listProducts({ search: q, limit: 60, ...(storeId ? { storeId } : {}) })
      : [];

  return (
    <div className="mx-auto max-w-7xl px-4 lg:px-6 pt-6 pb-12">
      <nav className="flex items-center gap-1.5 text-xs text-fg-muted mb-4">
        <Link href="/" className="hover:text-fg">Home</Link>
        <ChevronRight className="size-3" />
        <span className="text-fg font-medium">Search</span>
      </nav>

      <div className="mb-6 lg:mb-8">
        <h1 className="font-display text-3xl lg:text-4xl font-semibold tracking-tight">
          {q ? <>Results for &ldquo;{q}&rdquo;</> : "Search"}
        </h1>
        {q.length >= 2 && (
          <p className="text-sm text-fg-muted mt-2">
            {products.length} {products.length === 1 ? "product" : "products"} found
          </p>
        )}
      </div>

      {q.length < 2 ? (
        <div className="py-20 text-center">
          <div className="mx-auto size-12 rounded-full bg-surface-2 flex items-center justify-center mb-4">
            <Search className="size-5 text-fg-muted" />
          </div>
          <p className="text-sm text-fg-muted">
            Type at least 2 characters in the search bar above.
          </p>
        </div>
      ) : products.length === 0 ? (
        <div className="py-20 text-center">
          <div className="mx-auto size-12 rounded-full bg-surface-2 flex items-center justify-center mb-4">
            <Search className="size-5 text-fg-muted" />
          </div>
          <p className="text-sm text-fg-muted mb-4">
            No products match &ldquo;{q}&rdquo;.
          </p>
          <Link
            href="/"
            className="text-sm font-semibold text-brand-primary hover:underline"
          >
            Browse the full catalogue →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
