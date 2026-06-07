import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ProductCard } from "@/components/storefront/product-card";
import {
  getCategoryBySlug,
  listProducts,
} from "@/lib/data/products";
import { SITE } from "@/lib/site";
import { getStorefrontStoreId } from "@/lib/store";
import { CategoryToolbar } from "./toolbar";
import { CategorySidebar } from "./sidebar";

// Defer to request time — Neon cold-start retries make build-time prerender
// flaky. ISR (revalidate=300) keeps the page cached server-side.
export const revalidate = 300;
export const dynamic = "force-dynamic";

interface CategoryPageProps {
  params: { id: string };
  searchParams: {
    min?: string;
    max?: string;
    inStock?: string;
    onSale?: string;
  };
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const category = await getCategoryBySlug(params.id);
  if (!category) return { title: "Category not found" };
  const title = `${category.name} — shop ${category.count ?? ""} products`.trim();
  const description = `Shop ${category.name.toLowerCase()} on ${SITE.name} — curated from Nigerian makers, with same-day Lagos delivery and 14-day returns.`;
  const url = `/category/${category.id}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", url, title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const category = await getCategoryBySlug(params.id);
  if (!category) notFound();

  // Parse filter inputs from search params (Naira → kobo).
  const minNaira = Number(searchParams.min);
  const maxNaira = Number(searchParams.max);
  const minKobo = Number.isFinite(minNaira) && minNaira > 0 ? minNaira * 100 : null;
  const maxKobo = Number.isFinite(maxNaira) && maxNaira > 0 ? maxNaira * 100 : null;
  const inStockOnly = searchParams.inStock === "1";
  const onSaleOnly = searchParams.onSale === "1";
  const hasFilters = minKobo != null || maxKobo != null || inStockOnly || onSaleOnly;

  const storeId = await getStorefrontStoreId();
  let products = await listProducts({
    category: params.id,
    ...(storeId ? { storeId } : {}),
  });

  // Apply filters in-memory — the catalogue is small enough today that we
  // don't need to push these into Prisma. Move into listProducts if the
  // catalogue ever grows past ~5k SKUs.
  if (hasFilters) {
    products = products.filter((p) => {
      const effective =
        p.saleActive && p.sale != null ? p.sale : p.price;
      if (minKobo != null && effective < minKobo) return false;
      if (maxKobo != null && effective > maxKobo) return false;
      if (inStockOnly && p.stock <= 0) return false;
      if (onSaleOnly && !p.saleActive) return false;
      return true;
    });
  } else if (products.length < 8) {
    // Pad to keep the grid lively when a fresh unfiltered category is sparse.
    const pool = await listProducts({ limit: 8, ...(storeId ? { storeId } : {}) });
    const ids = new Set(products.map((p) => p.id));
    for (const p of pool) {
      if (products.length >= 8) break;
      if (!ids.has(p.id)) products.push(p);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 lg:px-6 pt-6 pb-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-fg-muted mb-4">
        <Link href="/" className="hover:text-fg">
          Home
        </Link>
        <ChevronRight className="size-3" />
        <span className="text-fg font-medium">{category.name}</span>
      </nav>

      {/* Title */}
      <div className="flex items-end justify-between gap-4 mb-6 lg:mb-8">
        <div>
          <h1 className="font-display text-3xl lg:text-5xl font-semibold tracking-tight">
            {category.name}
          </h1>
          <p className="text-sm text-fg-muted mt-2">
            {products.length} {products.length === 1 ? "product" : "products"}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[240px_1fr] gap-8 lg:gap-10">
        {/* Sidebar — desktop only */}
        <aside className="hidden lg:block">
          <CategorySidebar />
        </aside>

        {/* Main */}
        <div>
          <CategoryToolbar count={products.length} />
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 lg:gap-6 mt-5">
            {products.map((p, i) => (
              <ProductCard key={p.id + i} product={p} priority={i < 4} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
