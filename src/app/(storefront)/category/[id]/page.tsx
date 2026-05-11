import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ProductCard } from "@/components/storefront/product-card";
import {
  CATEGORIES,
  PRODUCTS,
  getCategory,
  getProductsByCategory,
  type ProductCategoryId,
} from "@/lib/mock-data";
import { CategoryToolbar } from "./toolbar";
import { CategorySidebar } from "./sidebar";

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ id: c.id }));
}

interface CategoryPageProps {
  params: { id: string };
}

export default function CategoryPage({ params }: CategoryPageProps) {
  const category = getCategory(params.id);
  if (!category) notFound();

  let products = getProductsByCategory(params.id as ProductCategoryId);
  if (products.length < 8) {
    products = [
      ...products,
      ...PRODUCTS.filter((p) => !products.includes(p)).slice(0, 8 - products.length),
    ];
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
            {products.length} products from {Math.min(products.length, 22)} verified makers
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
