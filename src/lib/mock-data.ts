/**
 * Mock data for Phase 2 — Storefront UI with no API.
 * Money is integer kobo. Product visuals are gradient + serif mark (no fake photos).
 * Source: curated from doba/project/storefront.jsx.
 */

export type BulkTier = {
  min: number;
  max: number | null;
  type: "percentage" | "fixed";
  value: number; // percent or kobo
};

export type ProductVariant = {
  id: string;
  label: string;
  stock: number;
  price: number | null; // kobo; null means inherit product price
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  short: string;
  mark: string; // single letter — used as last-resort placeholder
  category: ProductCategoryId;
  /** Primary product image (Unsplash). */
  imageUrl: string;
  /** Optional additional gallery images. */
  gallery?: string[];
  /** Theme tone used as a gradient background behind the image. */
  bg: string;
  fg?: string;
  price: number; // kobo
  last?: number;
  sale?: number;
  saleActive?: boolean;
  stock: number;
  rating: number;
  reviews: number;
  bulk: BulkTier[];
  variants: ProductVariant[];
  negotiate?: boolean;
  preorder?: boolean;
  moq?: number;
  eta?: string;
};

const UNSPLASH = (id: string, w = 800) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;

export type ProductCategoryId = "beauty" | "home" | "fashion" | "tech" | "food";

export type Category = {
  id: ProductCategoryId;
  name: string;
  count: number;
};

export const CATEGORIES: readonly Category[] = [
  { id: "beauty", name: "Beauty & Skincare", count: 84 },
  { id: "home", name: "Home & Living", count: 142 },
  { id: "fashion", name: "Fashion", count: 67 },
  { id: "tech", name: "Tech", count: 38 },
  { id: "food", name: "Pantry", count: 51 },
] as const;

export const PRODUCTS: readonly Product[] = [
  {
    id: "p1",
    slug: "aramide-rose-clay-mask",
    name: "Rose & Clay Hydrating Mask",
    brand: "Aramide",
    short: "Detoxifies and softens with Kaolin and damask rose",
    mark: "A",
    category: "beauty",
    imageUrl: UNSPLASH("1556228720-195a672e8a03", 1200),
    gallery: [
      UNSPLASH("1556228720-195a672e8a03", 1200),
      UNSPLASH("1571781926291-c477ebfd024b", 1200),
      UNSPLASH("1620916566398-39f1143ab7be", 1200),
    ],
    bg: "linear-gradient(135deg, #f7d4c4 0%, #e6a489 100%)",
    price: 1450000,
    last: 1300000,
    sale: 1200000,
    saleActive: true,
    stock: 47,
    rating: 4.8,
    reviews: 218,
    bulk: [
      { min: 5, max: 9, type: "percentage", value: 5 },
      { min: 10, max: 49, type: "percentage", value: 10 },
      { min: 50, max: null, type: "percentage", value: 15 },
    ],
    variants: [
      { id: "v1", label: "50ml", stock: 47, price: null },
      { id: "v2", label: "100ml", stock: 12, price: 2400000 },
      { id: "v3", label: "200ml", stock: 0, price: 4400000 },
    ],
    negotiate: true,
  },
  {
    id: "p2",
    slug: "omolewa-shea-balm",
    name: "Whipped Shea Body Balm",
    brand: "Omolewa",
    short: "Unrefined Nigerian shea, ginger root, and frankincense",
    mark: "O",
    category: "beauty",
    imageUrl: UNSPLASH("1556228720-195a672e8a03", 1200),
    gallery: [
      UNSPLASH("1556228720-195a672e8a03", 1200),
      UNSPLASH("1620916566398-39f1143ab7be", 1200),
    ],
    bg: "linear-gradient(135deg, #d9e3d4 0%, #95b694 100%)",
    price: 980000,
    last: 880000,
    stock: 102,
    rating: 4.9,
    reviews: 412,
    bulk: [{ min: 6, max: null, type: "percentage", value: 8 }],
    variants: [
      { id: "va", label: "120g", stock: 102, price: null },
      { id: "vb", label: "250g", stock: 38, price: 1800000 },
    ],
    negotiate: true,
  },
  {
    id: "p3",
    slug: "idanre-ceramic-vase",
    name: "Idanre Ridge Ceramic Vase",
    brand: "Tafa Studio",
    short: "Hand-thrown stoneware, fired in Abeokuta",
    mark: "T",
    category: "home",
    imageUrl: UNSPLASH("1578749556568-bc2c40e68b61", 1200),
    bg: "linear-gradient(135deg, #ece4d4 0%, #c4a87a 100%)",
    fg: "#1a1208",
    price: 4200000,
    stock: 6,
    rating: 4.7,
    reviews: 38,
    bulk: [],
    variants: [
      { id: "small", label: "Small (22cm)", stock: 6, price: null },
      { id: "large", label: "Large (34cm)", stock: 0, price: 6800000 },
    ],
  },
  {
    id: "p4",
    slug: "ade-leather-tote",
    name: "Ade Everyday Tote",
    brand: "Ade & Co.",
    short: "Vegetable-tanned leather, hand-stitched in Lagos",
    mark: "Æ",
    category: "fashion",
    imageUrl: UNSPLASH("1548036328-c9fa89d128fa", 1200),
    bg: "linear-gradient(135deg, #dcc6b4 0%, #6b4730 100%)",
    price: 8800000,
    stock: 0,
    rating: 4.6,
    reviews: 91,
    bulk: [],
    variants: [
      { id: "tan", label: "Tan", stock: 0, price: null },
      { id: "noir", label: "Noir", stock: 4, price: null },
    ],
    negotiate: true,
    preorder: true,
    moq: 10,
    eta: "3-4 weeks",
  },
  {
    id: "p5",
    slug: "kola-coffee-blend",
    name: "Owerri Single-Origin Coffee",
    brand: "Kola Roasters",
    short: "Medium roast, notes of cocoa and hibiscus",
    mark: "K",
    category: "food",
    imageUrl: UNSPLASH("1559056199-641a0ac8b55e", 1200),
    gallery: [
      UNSPLASH("1559056199-641a0ac8b55e", 1200),
      UNSPLASH("1495474472287-4d71bcdd2085", 1200),
    ],
    bg: "linear-gradient(135deg, #d9c7b1 0%, #5a3520 100%)",
    price: 720000,
    stock: 240,
    rating: 4.8,
    reviews: 524,
    bulk: [
      { min: 3, max: 9, type: "percentage", value: 8 },
      { min: 10, max: null, type: "percentage", value: 15 },
    ],
    variants: [
      { id: "g250", label: "250g whole bean", stock: 240, price: null },
      { id: "g500", label: "500g whole bean", stock: 88, price: 1380000 },
      { id: "g1k", label: "1kg whole bean", stock: 24, price: 2600000 },
    ],
  },
  {
    id: "p6",
    slug: "pneuma-incense",
    name: "Harmattan Incense Set",
    brand: "Pneuma",
    short: "Hand-rolled in Ibadan — moringa, oud, and cedar",
    mark: "P",
    category: "home",
    imageUrl: UNSPLASH("1602002418082-a4443e081dd1", 1200),
    bg: "linear-gradient(135deg, #e4d4ec 0%, #4a2d52 100%)",
    price: 580000,
    last: 520000,
    sale: 480000,
    saleActive: true,
    stock: 18,
    rating: 4.7,
    reviews: 156,
    bulk: [{ min: 5, max: null, type: "percentage", value: 10 }],
    variants: [{ id: "set", label: "24 sticks", stock: 18, price: null }],
    negotiate: true,
  },
  {
    id: "p7",
    slug: "iba-silk-scarf",
    name: "Ibadan Silk Scarf",
    brand: "Iba Atelier",
    short: "Adire-inspired pattern on charmeuse silk",
    mark: "I",
    category: "fashion",
    imageUrl: UNSPLASH("1601924994987-69e26d50dc26", 1200),
    bg: "linear-gradient(135deg, #c5d1f0 0%, #4f6dc4 100%)",
    price: 3500000,
    stock: 22,
    rating: 4.9,
    reviews: 67,
    bulk: [],
    variants: [
      { id: "indigo", label: "Indigo", stock: 22, price: null },
      { id: "rust", label: "Rust", stock: 9, price: null },
    ],
  },
  {
    id: "p8",
    slug: "sade-glass-tumbler",
    name: "Sade Recycled Glass Tumblers",
    brand: "Bauchi Glass",
    short: "Set of four, hand-blown from recycled bottle glass",
    mark: "B",
    category: "home",
    imageUrl: UNSPLASH("1551803091-e20673f15770", 1200),
    bg: "linear-gradient(135deg, #d8e6e6 0%, #7ba3a3 100%)",
    price: 2200000,
    stock: 34,
    rating: 4.6,
    reviews: 88,
    bulk: [{ min: 3, max: null, type: "percentage", value: 7 }],
    variants: [
      { id: "4", label: "Set of 4", stock: 34, price: null },
      { id: "8", label: "Set of 8", stock: 11, price: 4100000 },
    ],
  },
] as const;

export function getProduct(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

export function getProductById(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

export function getCategory(id: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

export function getProductsByCategory(id: ProductCategoryId): Product[] {
  return PRODUCTS.filter((p) => p.category === id);
}

/** Nigerian states (subset for now — full list in Phase 4 seed). */
export const NIGERIAN_STATES = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "FCT (Abuja)",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
] as const;

export const LAGOS_LGAS = [
  "Agege",
  "Ajeromi-Ifelodun",
  "Alimosho",
  "Amuwo-Odofin",
  "Apapa",
  "Badagry",
  "Epe",
  "Eti-Osa",
  "Ibeju-Lekki",
  "Ifako-Ijaiye",
  "Ikeja",
  "Ikorodu",
  "Ikoyi",
  "Kosofe",
  "Lagos Island",
  "Lagos Mainland",
  "Lekki",
  "Mushin",
  "Ojo",
  "Oshodi-Isolo",
  "Shomolu",
  "Surulere",
  "Victoria Island",
  "Yaba",
] as const;
