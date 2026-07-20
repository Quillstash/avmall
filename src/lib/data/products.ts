/**
 * Product data layer. Reads from the DB when DATABASE_URL is set; otherwise
 * returns empty results (no fabricated data).
 *
 * All callers consume the same `Product` view type from mock-data.ts — DB
 * shapes are converted via `productFromDb()`.
 */

import "server-only";

import { cache } from "react";
import { db, hasDatabase, withRetry } from "@/lib/db";
import { SEED_PRODUCT_IMAGE_BY_SLUG } from "@/lib/seed-product-images";
import {
  type Product,
  type ProductCategoryId,
  type Category,
} from "@/lib/mock-data";

// Prisma row types — kept at the data-layer boundary; never leak outward.
import type {
  Product as DbProduct,
  ProductVariant as DbVariant,
  BulkTier as DbBulkTier,
  Category as DbCategoryRow,
  ProductImage as DbProductImage,
} from "@prisma/client";
import { Prisma } from "@prisma/client";

type DbVariantWithStock = DbVariant & {
  storeStock: { onHand: number; reserved: number }[];
  // Only the single-product editor loader requests this.
  _count?: { orderLines: number };
};

type DbProductWith = DbProduct & {
  variants: DbVariantWithStock[];
  bulkTiers: DbBulkTier[];
  category: DbCategoryRow;
  images?: DbProductImage[];
};

/**
 * Total on-hand for a variant across whatever store_stock rows were loaded —
 * one store when the query scoped by storeId, all stores (aggregate) when not.
 */
function variantStock(v: { storeStock?: { onHand: number }[] }): number {
  return (v.storeStock ?? []).reduce((a, s) => a + s.onHand, 0);
}

/** Compose the public URL for an R2 key. Returns null when R2 isn't
 *  configured, so the legacy CloudFront fallback can step in. */
function publicUrlForKey(key: string): string | null {
  const base = process.env.R2_PUBLIC_URL?.trim();
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/${key}`;
}

/** Convert a Prisma product (with relations) into the view-shape used by pages. */
function productFromDb(p: DbProductWith): Product {
  // Image resolution priority:
  //   1. ProductImage rows on R2 (primary first, then by position)
  //   2. Neutral branded placeholder when no image is uploaded
  const sortedImages = [...(p.images ?? [])].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return a.position - b.position;
  });
  const primaryR2Url = sortedImages
    .map((img) => publicUrlForKey(img.key))
    .find((u): u is string => !!u);
  const galleryR2Urls = sortedImages
    .slice(1)
    .map((img) => publicUrlForKey(img.key))
    .filter((u): u is string => !!u);
  // Carry the R2 keys (not just composed URLs) so the admin editor can persist
  // existing images on save instead of dropping them as keyless entries.
  const imageRecords = sortedImages
    .map((img) => {
      const url = publicUrlForKey(img.key);
      return url
        ? { url, key: img.key, ...(img.alt && { alt: img.alt }), primary: img.isPrimary }
        : null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    short: p.shortDesc,
    mark: p.brand[0]?.toUpperCase() ?? "A",
    category: "home", // overwritten by withCategorySlug() below
    imageUrl: primaryR2Url ?? defaultImageFor(p.slug),
    ...(galleryR2Urls.length > 0 && { gallery: galleryR2Urls }),
    ...(imageRecords.length > 0 && { imageRecords }),
    bg: p.themeBg ?? "linear-gradient(135deg, #ece4d4 0%, #c4a87a 100%)",
    price: Number(p.priceKobo),
    cost: Number(p.costPriceKobo),
    ...(p.saleKobo != null && { sale: Number(p.saleKobo) }),
    saleActive: p.saleActive,
    stock: p.variants.reduce((a, v) => a + variantStock(v), 0),
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
      stock: variantStock(v),
      price: v.priceKobo == null ? null : Number(v.priceKobo),
      ...(v.option1Value && { option1Value: v.option1Value }),
      ...(v.option2Value && { option2Value: v.option2Value }),
      ...(v._count && { orderLineCount: v._count.orderLines }),
    })),
    ...(p.option1Name && { option1Name: p.option1Name }),
    ...(p.option2Name && { option2Name: p.option2Name }),
    published: p.published,
    archived: !!p.archivedAt,
    featured: p.featured,
    negotiate: p.negotiate,
    ...(p.negotiateFloorKobo != null && { negotiateFloor: Number(p.negotiateFloorKobo) }),
    ...(p.negotiateMaxPct != null && { negotiateMaxPct: p.negotiateMaxPct }),
    preorder: p.preorder,
    ...(p.moq != null && { moq: p.moq }),
    ...(p.eta && { eta: p.eta }),
  } as Product;
}


/**
 * Image for a product with no R2 ProductImage row. Seeded demo products resolve
 * their image by slug from the CloudFront export (until Phase 5 moves imagery to
 * R2); everything else falls back to the neutral branded placeholder. Real
 * uploaded images come from ProductImage rows resolved in `productFromDb`.
 */
function defaultImageFor(slug: string): string {
  return SEED_PRODUCT_IMAGE_BY_SLUG[slug] ?? "/product-placeholder.png";
}

/**
 * Hoist the category slug onto the product so the storefront's existing
 * `product.category` access keeps working. Prisma gives us a relation, not a
 * scalar slug — we look it up via the include + categoryById map.
 */
/** Sets the category slug on the converted product. Category is loaded via
 *  Prisma `include`, so no follow-up query needed. */
function finalize(p: DbProductWith): Product {
  const view = productFromDb(p);
  view.category = p.category.slug as ProductCategoryId;
  return view;
}

// ─── Categories ───────────────────────────────────────────────────────────

/**
 * Categories — one query (with product `_count`) instead of two. Wrapped in
 * React `cache` so two callers in the same request share the result.
 */
export const listCategories = cache(async (): Promise<Category[]> => {
  if (!hasDatabase) return [];

  const cats = await withRetry(() =>
    db.category.findMany({
      orderBy: { position: "asc" },
      include: {
        _count: {
          select: { products: { where: { archivedAt: null, published: true } } },
        },
      },
    }),
  );
  return cats.map((c) => ({
    id: c.slug as ProductCategoryId,
    name: c.name,
    count: c._count.products,
  }));
});

export const getCategoryBySlug = cache(
  async (slug: string): Promise<Category | null> => {
    if (!hasDatabase) {
      return null;
    }
    const cat = await withRetry(() =>
      db.category.findUnique({
        where: { slug },
        include: {
          _count: {
            select: { products: { where: { archivedAt: null, published: true } } },
          },
        },
      }),
    );
    if (!cat) return null;
    return {
      id: cat.slug as ProductCategoryId,
      name: cat.name,
      count: cat._count.products,
    };
  },
);

/** A category that actually has products in a given store — name, live count,
 *  and a representative image. Drives the storefront nav + homepage grid so
 *  each store shows only its own categories. */
export type StoreCategory = {
  slug: string;
  name: string;
  count: number;
  imageUrl: string;
};

/**
 * Categories that have at least one published product in `storeId` (or across
 * all stores when omitted), each with its in-store product count and a
 * representative image. Unlike `listCategories`, this never returns categories
 * the store doesn't stock — so a sub-store's nav doesn't link to empty pages.
 */
export const listStoreCategories = cache(
  async (storeId?: string): Promise<StoreCategory[]> => {
    if (!hasDatabase) {
      return [];
    }

    const productWhere = {
      archivedAt: null,
      published: true,
      ...(storeId ? { storeId } : {}),
    };

    const cats = await withRetry(() =>
      db.category.findMany({
        where: { products: { some: productWhere } },
        orderBy: { position: "asc" },
        include: {
          _count: { select: { products: { where: productWhere } } },
          products: {
            where: productWhere,
            orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
            take: 1,
            select: {
              slug: true,
              images: {
                orderBy: [{ isPrimary: "desc" }, { position: "asc" }],
                take: 1,
                select: { key: true },
              },
            },
          },
        },
      }),
    );

    return cats.map((c) => {
      const sample = c.products[0];
      const imageUrl =
        (sample?.images[0] ? publicUrlForKey(sample.images[0].key) : null) ??
        (sample ? defaultImageFor(sample.slug) : "/product-placeholder.png");
      return {
        slug: c.slug,
        name: c.name,
        count: c._count.products,
        imageUrl,
      };
    });
  },
);

// ─── Products ─────────────────────────────────────────────────────────────

export async function listProducts(opts?: {
  category?: string;
  limit?: number;
  featuredFirst?: boolean;
  /** Return only products flagged `featured` (for the homepage feature grid). */
  featuredOnly?: boolean;
  /** Admin view — return unpublished and archived products too. */
  includeUnpublished?: boolean;
  /** Free-text search across name/brand/slug (case-insensitive substring). */
  search?: string;
  /**
   * Scope stock + availability to one store. When set, only products stocked
   * at that store are returned and `stock` reflects that store. When omitted,
   * stock is the sum across all stores (admin aggregate view).
   */
  storeId?: string;
}): Promise<Product[]> {
  const q = opts?.search?.trim().toLowerCase();

  if (!hasDatabase) {
    return [];
  }

  const where = {
    ...(opts?.storeId && { storeId: opts.storeId }),
    ...(!opts?.includeUnpublished && { archivedAt: null, published: true }),
    ...(opts?.featuredOnly && { featured: true }),
    ...(opts?.category && { category: { slug: opts.category } }),
    ...(q && q.length >= 2 && {
      OR: [
        { name: { contains: q, mode: "insensitive" as const } },
        { brand: { contains: q, mode: "insensitive" as const } },
        { slug: { contains: q, mode: "insensitive" as const } },
      ],
    }),
  };
  // Single query — joins variants, bulkTiers, AND category in one round trip.
  const products = await withRetry(() =>
    db.product.findMany({
      where,
      include: {
        variants: {
          orderBy: { position: "asc" },
          include: {
            storeStock: opts?.storeId
              ? { where: { storeId: opts.storeId } }
              : true,
          },
        },
        bulkTiers: true,
        category: true,
        images: { orderBy: [{ isPrimary: "desc" }, { position: "asc" }] },
      },
      orderBy: opts?.featuredFirst
        ? [{ featured: "desc" as const }, { createdAt: "desc" as const }]
        : [{ createdAt: "desc" as const }],
      ...(opts?.limit != null && { take: opts.limit }),
    }),
  );

  // Products are isolated per store via Product.storeId (filtered above), so
  // the result is already store-scoped.
  return products.map((p) => finalize(p as DbProductWith));
}

export async function getProductBySlug(
  slug: string,
  storeId?: string,
): Promise<Product | null> {
  if (!hasDatabase) {
    return null;
  }
  const p = await withRetry(() =>
    db.product.findUnique({
      where: { slug },
      include: {
        variants: {
          orderBy: { position: "asc" },
          include: {
            storeStock: storeId ? { where: { storeId } } : true,
            // Gate variant deletion in the admin editor — a variant with order
            // history can't be removed.
            _count: { select: { orderLines: true } },
          },
        },
        bulkTiers: true,
        category: true,
        images: { orderBy: [{ isPrimary: "desc" }, { position: "asc" }] },
      },
    }),
  );
  if (!p || p.archivedAt) return null;
  return finalize(p as DbProductWith);
}

export async function getRelatedProducts(
  product: Pick<Product, "id" | "category">,
  limit = 4,
): Promise<Product[]> {
  const all = await listProducts({ category: product.category, limit: limit + 1 });
  return all.filter((p) => p.id !== product.id).slice(0, limit);
}

/**
 * Search products by name, brand, or slug. Case-insensitive substring match.
 * Returns lightweight rows suitable for a search dropdown — not the full
 * Product view with variants. The storefront-only call so always filters to
 * `published & not archived`.
 */
export interface ProductSearchHit {
  id: string;
  slug: string;
  name: string;
  brand: string;
  imageUrl: string;
  priceKobo: number;
  saleKobo: number | null;
  saleActive: boolean;
  /** Category slug, e.g. "power". */
  category: string;
  /** Readable category name, e.g. "Power" — for the AI's product table. */
  categoryName: string;
  /** Short description — a specs/capacity hint (e.g. "10,000mAh") for listings. */
  shortDesc: string;
  stock: number;
  /** Variants for the order/POS builder to pick from. A product with a single
   *  default variant has one entry; multi-variant products let staff choose. */
  variants: {
    id: string;
    label: string;
    /** Variant-specific price; null → falls back to the product price. */
    priceKobo: number | null;
    stock: number;
  }[];
}

/**
 * Synonym / alias groups for catalogue search. If any member of a group shows
 * up in the shopper's query, the whole group joins the search — so "power bank"
 * also finds an item that only says so in its description or is tagged a
 * "charger" / "battery pack", and "earphones" finds "earbuds" / "headphones".
 * Tuned for this store's mix (phones, audio, power, fans, home & kitchen);
 * extend freely — order within a group doesn't matter.
 */
const SEARCH_SYNONYMS: readonly (readonly string[])[] = [
  ["power bank", "powerbank", "portable charger", "battery pack", "backup battery", "power"],
  ["charger", "adapter", "adaptor", "charging", "fast charger", "wall charger"],
  ["cable", "cord", "usb cable", "charging cable", "type c", "lightning cable"],
  ["earphone", "earbud", "earbuds", "headphone", "headphones", "headset", "airpod", "airpods", "handsfree", "audio"],
  ["speaker", "bluetooth speaker", "sound", "soundbar", "boombox"],
  ["fan", "rechargeable fan", "standing fan", "table fan", "cooling fan", "cooler"],
  ["phone", "smartphone", "android", "mobile", "handset"],
  ["tablet", "tab", "ipad"],
  ["smartwatch", "smart watch", "watch", "fitness band"],
  ["television", "tv", "smart tv"],
  ["blender", "mixer", "grinder", "smoothie maker"],
  ["kettle", "electric kettle"],
  ["iron", "pressing iron", "steam iron"],
  ["torch", "flashlight", "rechargeable light", "rechargeable lamp", "lantern"],
  ["generator", "inverter", "power station"],
  ["memory card", "sd card", "flash drive", "pendrive", "usb drive"],
];

/** Filler words dropped from a query before matching, so "do you have a good
 *  power bank" searches on {power, bank}, not the whole sentence. */
const SEARCH_STOPWORDS = new Set([
  "the", "a", "an", "of", "for", "to", "and", "or", "with", "in", "on", "my", "me", "i", "is", "are", "am", "be",
  "do", "you", "have", "need", "needed", "want", "get", "got", "looking", "look", "show", "find", "buy", "sell",
  "some", "any", "good", "best", "new", "cheap", "affordable", "quality", "original", "genuine", "please", "pls",
  "abeg", "this", "that", "your", "their", "there", "it", "can", "could", "would", "like", "one", "ones", "us", "we",
  "product", "products", "item", "items", "available", "stock",
]);

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Expand a raw query into terms to match against the catalogue: the full
 * phrase, its non-stopword tokens, and every triggered synonym-group member.
 */
/** Crude singular: drop a trailing "s" from words of 4+ chars so "earphones"
 *  matches "earphone". Good enough for retail nouns; avoids a stemmer dep. */
function singular(w: string): string {
  return w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w;
}

function expandSearchTerms(query: string): { tokens: string[]; terms: string[]; norm: string } {
  const norm = normalizeText(query);
  const tokens = norm.split(" ").filter((t) => t.length >= 2 && !SEARCH_STOPWORDS.has(t));
  const terms = new Set<string>();
  if (norm) terms.add(norm);
  for (const t of tokens) {
    terms.add(t);
    const sg = singular(t);
    if (sg !== t) terms.add(sg); // "earphones" also matches an "Earphone" product
  }
  // Trigger a synonym group only on a real match: the group phrase appearing in
  // the query, or a token equal to a group term (singular-insensitive). Looser
  // substring matching wrongly pulled "earphones" into the phone group, etc.
  for (const group of SEARCH_SYNONYMS) {
    const triggered = group.some(
      (g) =>
        // Multi-word group terms ("power bank") match as a phrase; single words
        // must equal a whole token, so "earphones" can't trigger via "phone".
        (g.includes(" ") && norm.length >= 3 && norm.includes(g)) ||
        tokens.some((t) => g === t || singular(g) === singular(t)),
    );
    if (triggered) for (const g of group) terms.add(g);
  }
  const effectiveTokens = tokens.length ? tokens : norm ? [norm] : [];
  // Cap the term set so the OR query stays bounded.
  return { tokens: effectiveTokens, terms: [...terms].slice(0, 20), norm };
}

function bigrams(s: string): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
  return out;
}

/** Dice coefficient over character bigrams — a cheap typo-similarity in [0,1].
 *  "orimo" vs "oraimo" ≈ 0.67, so a misspelled brand still matches. */
function diceSim(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const A = bigrams(a);
  const B = bigrams(b);
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return (2 * inter) / (A.size + B.size);
}

// Distinct brand list, cached briefly in-memory (brands change rarely). Only the
// fuzzy typo fallback reads it, so the common search path never fetches it.
let brandCache: { at: number; brands: string[] } | null = null;
async function knownBrands(): Promise<string[]> {
  const now = Date.now();
  if (brandCache && now - brandCache.at < 5 * 60 * 1000) return brandCache.brands;
  const rows = await withRetry(() =>
    db.product.findMany({
      where: { archivedAt: null, published: true },
      select: { brand: true },
      distinct: ["brand"],
    }),
  );
  brandCache = { at: now, brands: rows.map((r) => r.brand).filter(Boolean) };
  return brandCache.brands;
}

export async function searchProducts(
  query: string,
  limit = 8,
  storeId?: string,
): Promise<ProductSearchHit[]> {
  const { tokens, terms, norm } = expandSearchTerms(query);
  if (terms.length === 0 || !hasDatabase) return [];

  let hits = await queryProductHits(terms, tokens, norm, limit, storeId);

  // Typo tolerance: a thin result is usually a misspelled brand ("orimo" →
  // "Oraimo") that substring search can't catch. Fuzzy-match the query tokens
  // against the real brand list and retry with any close brand added as a term.
  if (hits.length < 3) {
    const corrections = new Set<string>();
    for (const b of await knownBrands()) {
      const bn = normalizeText(b);
      if (!bn) continue;
      for (const t of tokens) {
        if (t.length >= 4 && bn !== t && diceSim(t, bn) >= 0.6) corrections.add(bn);
      }
    }
    if (corrections.size > 0) {
      const mergedTerms = [...new Set([...terms, ...corrections])].slice(0, 24);
      const mergedTokens = [...new Set([...tokens, ...corrections])];
      hits = await queryProductHits(mergedTerms, mergedTokens, norm, limit, storeId);
    }
  }

  return hits;
}

/** Run the OR search over the given terms and rank the hits. Shared by the
 *  normal search and the fuzzy-corrected retry. */
async function queryProductHits(
  terms: string[],
  tokens: string[],
  norm: string,
  limit: number,
  storeId?: string,
): Promise<ProductSearchHit[]> {
  // Broad candidate net: any expanded term in ANY searchable field — name,
  // brand, slug, both descriptions, the category, or an exact tag. This is what
  // lets "power bank" find a product that only says so in its details, not name.
  const or: Prisma.ProductWhereInput[] = terms.flatMap((term) => [
    { name: { contains: term, mode: "insensitive" } },
    { brand: { contains: term, mode: "insensitive" } },
    { slug: { contains: term, mode: "insensitive" } },
    { shortDesc: { contains: term, mode: "insensitive" } },
    { longDesc: { contains: term, mode: "insensitive" } },
    { category: { name: { contains: term, mode: "insensitive" } } },
    { category: { slug: { contains: term, mode: "insensitive" } } },
  ]);
  or.push({ tags: { hasSome: terms } });

  const rows = await withRetry(() =>
    db.product.findMany({
      where: {
        archivedAt: null,
        published: true,
        OR: or,
      },
      include: {
        variants: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            label: true,
            priceKobo: true,
            storeStock: {
              ...(storeId ? { where: { storeId } } : {}),
              select: { onHand: true },
            },
          },
        },
        category: { select: { slug: true, name: true } },
        images: {
          orderBy: [{ isPrimary: "desc" }, { position: "asc" }],
          take: 1,
          select: { key: true },
        },
      },
      // Pull a generous pool ordered by prominence, then rank for relevance
      // below — Postgres can't score our token/synonym logic.
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      take: Math.max(limit * 8, 50),
    }),
  );

  // Relevance: the shopper's own words weigh most, and a hit in the name beats
  // one buried in the long description; synonyms count for less than real words.
  const scoreOf = (p: (typeof rows)[number]): number => {
    const name = `${p.name} ${p.brand}`.toLowerCase();
    const short = p.shortDesc.toLowerCase();
    const long = p.longDesc.toLowerCase();
    const cat = `${p.category.name} ${p.category.slug}`.toLowerCase();
    const tagset = p.tags.map((t) => t.toLowerCase());
    let s = 0;
    if (norm.length >= 3 && name.includes(norm)) s += 100; // whole phrase, in the name
    for (const t of tokens) {
      if (name.includes(t)) s += 10;
      if (tagset.includes(t)) s += 8;
      if (cat.includes(t)) s += 6;
      if (short.includes(t)) s += 4;
      if (long.includes(t)) s += 2;
    }
    for (const term of terms) {
      if (term === norm || tokens.includes(term)) continue; // real words already scored
      if (name.includes(term)) s += 5;
      else if (cat.includes(term)) s += 4;
      else if (tagset.includes(term)) s += 4;
      else if (short.includes(term)) s += 3;
      else if (long.includes(term)) s += 1;
    }
    if (p.featured) s += 3;
    return s;
  };

  return rows
    // Store-scoped search hides products not stocked at that store.
    .filter((p) => (storeId ? p.variants.some((v) => v.storeStock.length > 0) : true))
    .map((p) => ({ p, s: scoreOf(p) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || Number(b.p.featured) - Number(a.p.featured))
    .slice(0, limit)
    .map(({ p }) => {
      const r2Url = p.images[0] ? publicUrlForKey(p.images[0].key) : null;
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        brand: p.brand,
        imageUrl: r2Url ?? defaultImageFor(p.slug),
        priceKobo: Number(p.priceKobo),
        saleKobo: p.saleKobo == null ? null : Number(p.saleKobo),
        saleActive: p.saleActive,
        category: p.category.slug,
        categoryName: p.category.name,
        shortDesc: p.shortDesc,
        stock: p.variants.reduce(
          (a, v) => a + v.storeStock.reduce((b, s) => b + s.onHand, 0),
          0,
        ),
        variants: p.variants.map((v) => ({
          id: v.id,
          label: v.label,
          priceKobo: v.priceKobo == null ? null : Number(v.priceKobo),
          stock: v.storeStock.reduce((b, s) => b + s.onHand, 0),
        })),
      };
    });
}

/**
 * Audit-panel summary for a single product. Pulls real creator + last editor
 * from AuditLog, and a 30-day units-sold count from OrderLine. Returns empty
 * data when the DB isn't configured.
 */
export interface ProductAuditSummary {
  createdAt: Date;
  createdBy: string | null;
  updatedAt: Date;
  updatedBy: string | null;
  sales30d: number;
}

export async function getProductAuditSummary(
  productId: string,
): Promise<ProductAuditSummary> {
  const now = new Date();
  const empty: ProductAuditSummary = {
    createdAt: now,
    createdBy: null,
    updatedAt: now,
    updatedBy: null,
    sales30d: 0,
  };

  if (!hasDatabase) return empty;

  // Bail out cleanly for non-UUID product IDs that wouldn't pass the UUID
  // guard at the DB layer.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId)) {
    return empty;
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [productRow, createLog, updateLog, salesAgg] = await Promise.all([
    db.product.findUnique({
      where: { id: productId },
      select: { createdAt: true, updatedAt: true },
    }),
    db.auditLog.findFirst({
      where: {
        entityType: "product",
        entityId: productId,
        action: "product.create",
      },
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.auditLog.findFirst({
      where: {
        entityType: "product",
        entityId: productId,
        action: { in: ["product.update", "product.stock_adjust"] },
      },
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.orderLine.aggregate({
      _sum: { quantity: true },
      where: {
        productId,
        order: {
          createdAt: { gte: thirtyDaysAgo },
          status: { notIn: ["cancelled"] },
        },
      },
    }),
  ]);

  if (!productRow) return empty;

  return {
    createdAt: productRow.createdAt,
    createdBy: createLog?.actor?.name ?? null,
    updatedAt: productRow.updatedAt,
    updatedBy: updateLog?.actor?.name ?? null,
    sales30d: salesAgg._sum.quantity ?? 0,
  };
}

/** Used at build time by `generateStaticParams` on `/product/[slug]`. */
export async function listAllProductSlugs(): Promise<string[]> {
  if (!hasDatabase) {
    return [];
  }
  const rows = await withRetry(() =>
    db.product.findMany({
      where: { archivedAt: null, published: true },
      select: { slug: true },
    }),
  );
  return rows.map((r) => r.slug);
}
