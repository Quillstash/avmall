/**
 * Shared catalogue view types + Nigerian address reference data.
 *
 * NOTE: This module used to also hold a seeded mock product catalogue. That
 * fixture data has been removed — the app now reads products/categories from
 * the database exclusively (see `src/lib/data/products.ts`). What remains here
 * is the `Product`/`Category` view types every surface shares, plus the
 * Nigerian states/LGAs reference lists used by address pickers.
 *
 * Money is integer kobo throughout.
 */

export type BulkTier = {
  min: number;
  max: number | null;
  type: "percentage" | "fixed";
  value: number; // percent or kobo
};

/** Variant option groups — up to two (e.g. "Size" × "Color"). */
export type ProductOptionGroups = {
  option1Name?: string;
  option2Name?: string;
};

export type ProductVariant = {
  id: string;
  label: string;
  stock: number;
  price: number | null; // kobo; null means inherit product price
  option1Value?: string;
  option2Value?: string;
  /**
   * How many order lines reference this variant. Only populated by the admin
   * editor loader (getProductBySlug); used to gate deletion — a variant with
   * order history can't be removed. Absent elsewhere.
   */
  orderLineCount?: number;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  short: string;
  mark: string; // single letter — used as last-resort placeholder
  /** ISO timestamps — when the product was added / last changed. */
  createdAt: string;
  updatedAt: string;
  category: ProductCategoryId;
  /** Primary product image. */
  imageUrl: string;
  /** Optional additional gallery images. */
  gallery?: string[];
  /**
   * Persisted images with their R2 keys. The admin editor uses these to
   * round-trip uploaded images on save (storefront renders imageUrl/gallery).
   * Absent for products whose imagery is a slug-resolved fallback with no
   * ProductImage row.
   */
  imageRecords?: { url: string; key: string; alt?: string; primary?: boolean }[];
  /** Theme tone used as a gradient background behind the image. */
  bg: string;
  fg?: string;
  price: number; // kobo
  /** Internal cost of goods, kobo. Never exposed on storefront. */
  cost: number;
  last?: number;
  sale?: number;
  saleActive?: boolean;
  stock: number;
  rating: number;
  reviews: number;
  bulk: BulkTier[];
  variants: ProductVariant[];
  /** Variant option group names; null when product has only the default variant. */
  option1Name?: string;
  option2Name?: string;
  published?: boolean;
  /** Soft-deleted — hidden from the storefront + the active admin list. */
  archived?: boolean;
  featured?: boolean;
  negotiate?: boolean;
  /** Per-product negotiation cap. Both null = fall back to AiSettings global. */
  negotiateFloor?: number; // kobo
  negotiateMaxPct?: number; // 0–100
  preorder?: boolean;
  moq?: number;
  eta?: string;
};

// ─── Categories ──────────────────────────────────────────────────────────

export type ProductCategoryId = "phones" | "audio" | "power" | "fans" | "home";

export type Category = {
  id: ProductCategoryId;
  name: string;
  count: number;
};

// ─── Address pickers (Nigerian states + LGAs) ────────────────────────────
// Phase 6 will move this to a seeded `nigeria_states_lgas.json` per CLAUDE.md
// §22; for now a flat list covers the address-picker dropdown and the
// admin order composer.

export const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue",
  "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu",
  "FCT (Abuja)", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina",
  "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo",
  "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
] as const;

export const LAGOS_LGAS = [
  "Agege", "Ajeromi-Ifelodun", "Alimosho", "Amuwo-Odofin", "Apapa", "Badagry",
  "Epe", "Eti-Osa", "Ibeju-Lekki", "Ifako-Ijaiye", "Ikeja", "Ikorodu",
  "Kosofe", "Lagos Island", "Lagos Mainland", "Mushin", "Ojo", "Oshodi-Isolo",
  "Shomolu", "Surulere",
] as const;
