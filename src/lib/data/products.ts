/**
 * Product data layer. Reads from the DB when DATABASE_URL is set, otherwise
 * falls back to the in-memory mock data so the storefront keeps working
 * during design iterations.
 *
 * All callers consume the same `Product` view type from mock-data.ts — DB
 * shapes are converted via `productFromDb()`.
 */

import "server-only";

import { db, hasDatabase } from "@/lib/db";
import {
  PRODUCTS as MOCK_PRODUCTS,
  CATEGORIES as MOCK_CATEGORIES,
  type Product,
  type ProductCategoryId,
  type Category,
} from "@/lib/mock-data";

// Prisma row types — kept at the data-layer boundary; never leak outward.
import type {
  Product as DbProduct,
  ProductVariant as DbVariant,
  BulkTier as DbBulkTier,
} from "@prisma/client";

type DbProductWith = DbProduct & {
  variants: DbVariant[];
  bulkTiers: DbBulkTier[];
};

/** Convert a Prisma product (with relations) into the view-shape used by pages. */
function productFromDb(p: DbProductWith): Product {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    short: p.shortDesc,
    mark: p.brand[0]?.toUpperCase() ?? "A",
    category: "home", // overwritten by withCategorySlug() below
    imageUrl: defaultImageFor(p.slug),
    bg: p.themeBg ?? "linear-gradient(135deg, #ece4d4 0%, #c4a87a 100%)",
    price: Number(p.priceKobo),
    ...(p.saleKobo != null && { sale: Number(p.saleKobo) }),
    saleActive: p.saleActive,
    stock: p.variants.reduce((a, v) => a + v.onHand, 0),
    rating: 4.7,
    reviews: 0,
    bulk: p.bulkTiers.map((t) => ({
      min: t.min,
      max: t.max,
      type: t.type,
      value: t.value,
    })),
    variants: p.variants.map((v) => ({
      id: v.id,
      label: v.label,
      stock: v.onHand,
      price: v.priceKobo == null ? null : Number(v.priceKobo),
    })),
    negotiate: p.negotiate,
    preorder: p.preorder,
    ...(p.moq != null && { moq: p.moq }),
    ...(p.eta && { eta: p.eta }),
  } as Product;
}


/**
 * Reuse the Unsplash URL stored in mock-data for the same slug. Phase 5 will
 * read R2 image keys off ProductImage rows; for now we lean on the demo set.
 */
function defaultImageFor(slug: string): string {
  const m = MOCK_PRODUCTS.find((p) => p.slug === slug);
  return m?.imageUrl ?? "";
}

function gallerySlugLookup(slug: string): string[] | undefined {
  const m = MOCK_PRODUCTS.find((p) => p.slug === slug);
  return m?.gallery;
}

/**
 * Hoist the category slug onto the product so the storefront's existing
 * `product.category` access keeps working. Prisma gives us a relation, not a
 * scalar slug — we look it up via the include + categoryById map.
 */
function withCategorySlug(p: DbProductWith, slugByCategoryId: Map<string, ProductCategoryId>): Product {
  const view = productFromDb(p);
  const slug = slugByCategoryId.get(p.categoryId);
  if (slug) view.category = slug;
  const gallery = gallerySlugLookup(view.slug);
  if (gallery) view.gallery = gallery;
  return view;
}

// ─── Categories ───────────────────────────────────────────────────────────

export async function listCategories(): Promise<Category[]> {
  if (!hasDatabase) {
    return [...MOCK_CATEGORIES];
  }
  const cats = await db.category.findMany({ orderBy: { position: "asc" } });
  const counts = await db.product.groupBy({
    by: ["categoryId"],
    where: { archivedAt: null, published: true },
    _count: { _all: true },
  });
  const countByCat = new Map(counts.map((c) => [c.categoryId, c._count._all]));
  return cats.map((c) => ({
    id: c.slug as ProductCategoryId,
    name: c.name,
    count: countByCat.get(c.id) ?? 0,
  }));
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  if (!hasDatabase) {
    return MOCK_CATEGORIES.find((c) => c.id === slug) ?? null;
  }
  const cat = await db.category.findUnique({ where: { slug } });
  if (!cat) return null;
  const count = await db.product.count({
    where: { categoryId: cat.id, archivedAt: null, published: true },
  });
  return { id: cat.slug as ProductCategoryId, name: cat.name, count };
}

// ─── Products ─────────────────────────────────────────────────────────────

async function categorySlugMap(): Promise<Map<string, ProductCategoryId>> {
  const cats = await db.category.findMany();
  return new Map(cats.map((c) => [c.id, c.slug as ProductCategoryId]));
}

export async function listProducts(opts?: {
  category?: string;
  limit?: number;
  featuredFirst?: boolean;
}): Promise<Product[]> {
  if (!hasDatabase) {
    let list = [...MOCK_PRODUCTS];
    if (opts?.category) list = list.filter((p) => p.category === opts.category);
    if (opts?.limit != null) list = list.slice(0, opts.limit);
    return list;
  }

  const where = {
    archivedAt: null,
    published: true,
    ...(opts?.category && { category: { slug: opts.category } }),
  };
  const products = await db.product.findMany({
    where,
    include: { variants: { orderBy: { position: "asc" } }, bulkTiers: true },
    orderBy: opts?.featuredFirst
      ? [{ featured: "desc" as const }, { createdAt: "desc" as const }]
      : [{ createdAt: "desc" as const }],
    ...(opts?.limit != null && { take: opts.limit }),
  });

  const slugBy = await categorySlugMap();
  return products.map((p) => withCategorySlug(p as DbProductWith, slugBy));
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  if (!hasDatabase) {
    return MOCK_PRODUCTS.find((p) => p.slug === slug) ?? null;
  }
  const p = await db.product.findUnique({
    where: { slug },
    include: { variants: { orderBy: { position: "asc" } }, bulkTiers: true },
  });
  if (!p || p.archivedAt) return null;
  const slugBy = await categorySlugMap();
  return withCategorySlug(p as DbProductWith, slugBy);
}

export async function getRelatedProducts(
  product: Pick<Product, "id" | "category">,
  limit = 4,
): Promise<Product[]> {
  const all = await listProducts({ category: product.category, limit: limit + 1 });
  return all.filter((p) => p.id !== product.id).slice(0, limit);
}

/** Used at build time by `generateStaticParams` on `/product/[slug]`. */
export async function listAllProductSlugs(): Promise<string[]> {
  if (!hasDatabase) {
    return MOCK_PRODUCTS.map((p) => p.slug);
  }
  const rows = await db.product.findMany({
    where: { archivedAt: null, published: true },
    select: { slug: true },
  });
  return rows.map((r) => r.slug);
}
