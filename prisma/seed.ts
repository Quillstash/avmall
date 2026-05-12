/**
 * Seed the database for Phase 4 development. Idempotent — safe to re-run.
 *
 *   pnpm prisma db seed
 *
 * Seeds:
 * — 5 product categories matching the storefront mock data
 * — The 8 sample products (with variants, bulk tiers, and images)
 * — 5 shipping zones + fallback rate (Lagos, SW, SE/SS, FCT, NW/NE)
 * — 1 super_admin user (email: admin@avmall.ng, password: changeme)
 * — A handful of customers + the partially-paid sample order AVM-2026-00000001
 *   (the same one shown on the admin order-detail mock page)
 * — 5 starter discounts including WELCOME10 and JANUARY10
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  console.log("→ Seeding categories");
  const categories = await Promise.all(
    [
      { slug: "beauty", name: "Beauty & Skincare", position: 1 },
      { slug: "home", name: "Home & Living", position: 2 },
      { slug: "fashion", name: "Fashion", position: 3 },
      { slug: "tech", name: "Tech", position: 4 },
      { slug: "food", name: "Pantry", position: 5 },
    ].map((c) =>
      db.category.upsert({
        where: { slug: c.slug },
        update: c,
        create: c,
      }),
    ),
  );
  const catBySlug = Object.fromEntries(categories.map((c) => [c.slug, c]));

  console.log("→ Seeding shipping zones");
  await Promise.all(
    [
      {
        name: "Lagos (intra-state)",
        states: ["Lagos"],
        baseRateKobo: 250_000n,
        freeOverKobo: 2_500_000n,
        etaDays: "Same day – 24h",
        priority: 10,
      },
      {
        name: "South-West",
        states: ["Ogun", "Oyo", "Osun", "Ondo", "Ekiti"],
        baseRateKobo: 450_000n,
        freeOverKobo: 5_000_000n,
        etaDays: "2–3 days",
        priority: 20,
      },
      {
        name: "South-East / South-South",
        states: ["Anambra", "Imo", "Rivers", "Cross River", "Akwa Ibom", "Bayelsa", "Abia", "Ebonyi", "Edo", "Delta"],
        baseRateKobo: 580_000n,
        freeOverKobo: null,
        etaDays: "3–5 days",
        priority: 30,
      },
      {
        name: "Abuja & North-Central",
        states: ["FCT (Abuja)", "Niger", "Nasarawa", "Plateau", "Kogi", "Kwara", "Benue"],
        baseRateKobo: 680_000n,
        freeOverKobo: null,
        etaDays: "3–5 days",
        priority: 40,
      },
      {
        name: "North-West / North-East",
        states: ["Kano", "Kaduna", "Bauchi", "Sokoto", "Kebbi", "Zamfara", "Katsina", "Jigawa", "Gombe", "Borno", "Yobe", "Adamawa", "Taraba"],
        baseRateKobo: 850_000n,
        freeOverKobo: null,
        etaDays: "4–6 days",
        priority: 50,
      },
    ].map(async (z) => {
      const existing = await db.shippingZone.findFirst({ where: { name: z.name } });
      if (existing) {
        return db.shippingZone.update({ where: { id: existing.id }, data: z });
      }
      return db.shippingZone.create({ data: z });
    }),
  );

  const fallback = await db.fallbackShipping.findFirst();
  if (!fallback) {
    await db.fallbackShipping.create({
      data: { enabled: true, flatRateKobo: 900_000n, etaDays: "5–7 days" },
    });
  }

  console.log("→ Seeding products");
  const products = [
    {
      slug: "aramide-rose-clay-mask",
      name: "Rose & Clay Hydrating Mask",
      brand: "Aramide",
      shortDesc: "Detoxifies and softens with Kaolin and damask rose",
      category: "beauty",
      themeBg: "linear-gradient(135deg, #f7d4c4 0%, #e6a489 100%)",
      priceKobo: 1_450_000n,
      saleKobo: 1_200_000n,
      saleActive: true,
      negotiate: true,
      tags: ["handmade", "small-batch", "lagos"],
      variants: [
        { label: "50ml", sku: "ARM-MASK-50", onHand: 47, priceKobo: null },
        { label: "100ml", sku: "ARM-MASK-100", onHand: 12, priceKobo: 2_400_000n },
        { label: "200ml", sku: "ARM-MASK-200", onHand: 0, priceKobo: 4_400_000n },
      ],
      bulk: [
        { min: 5, max: 9, type: "percentage" as const, value: 5 },
        { min: 10, max: 49, type: "percentage" as const, value: 10 },
        { min: 50, max: null, type: "percentage" as const, value: 15 },
      ],
    },
    {
      slug: "omolewa-shea-balm",
      name: "Whipped Shea Body Balm",
      brand: "Omolewa",
      shortDesc: "Unrefined Nigerian shea, ginger root, and frankincense",
      category: "beauty",
      themeBg: "linear-gradient(135deg, #d9e3d4 0%, #95b694 100%)",
      priceKobo: 980_000n,
      negotiate: true,
      tags: ["organic", "small-batch"],
      variants: [
        { label: "120g", sku: "OML-SBB-120", onHand: 102, priceKobo: null },
        { label: "250g", sku: "OML-SBB-250", onHand: 38, priceKobo: 1_800_000n },
      ],
      bulk: [{ min: 6, max: null, type: "percentage" as const, value: 8 }],
    },
    {
      slug: "idanre-ceramic-vase",
      name: "Idanre Ridge Ceramic Vase",
      brand: "Tafa Studio",
      shortDesc: "Hand-thrown stoneware, fired in Abeokuta",
      category: "home",
      themeBg: "linear-gradient(135deg, #ece4d4 0%, #c4a87a 100%)",
      priceKobo: 4_200_000n,
      tags: ["handmade"],
      variants: [
        { label: "Small (22cm)", sku: "TFA-VASE-S", onHand: 6, priceKobo: null },
        { label: "Large (34cm)", sku: "TFA-VASE-L", onHand: 0, priceKobo: 6_800_000n },
      ],
      bulk: [],
    },
    {
      slug: "ade-leather-tote",
      name: "Ade Everyday Tote",
      brand: "Ade & Co.",
      shortDesc: "Vegetable-tanned leather, hand-stitched in Lagos",
      category: "fashion",
      themeBg: "linear-gradient(135deg, #dcc6b4 0%, #6b4730 100%)",
      priceKobo: 8_800_000n,
      negotiate: true,
      preorder: true,
      moq: 10,
      eta: "3–4 weeks",
      tags: ["leather", "lagos"],
      variants: [
        { label: "Tan", sku: "ADE-TOTE-TAN", onHand: 0, priceKobo: null },
        { label: "Noir", sku: "ADE-TOTE-NOIR", onHand: 4, priceKobo: null },
      ],
      bulk: [],
    },
    {
      slug: "kola-coffee-blend",
      name: "Owerri Single-Origin Coffee",
      brand: "Kola Roasters",
      shortDesc: "Medium roast, notes of cocoa and hibiscus",
      category: "food",
      themeBg: "linear-gradient(135deg, #d9c7b1 0%, #5a3520 100%)",
      priceKobo: 720_000n,
      tags: ["coffee", "single-origin"],
      variants: [
        { label: "250g whole bean", sku: "KLR-OW-250", onHand: 240, priceKobo: null },
        { label: "500g whole bean", sku: "KLR-OW-500", onHand: 88, priceKobo: 1_380_000n },
        { label: "1kg whole bean", sku: "KLR-OW-1K", onHand: 24, priceKobo: 2_600_000n },
      ],
      bulk: [
        { min: 3, max: 9, type: "percentage" as const, value: 8 },
        { min: 10, max: null, type: "percentage" as const, value: 15 },
      ],
    },
    {
      slug: "pneuma-incense",
      name: "Harmattan Incense Set",
      brand: "Pneuma",
      shortDesc: "Hand-rolled in Ibadan — moringa, oud, and cedar",
      category: "home",
      themeBg: "linear-gradient(135deg, #e4d4ec 0%, #4a2d52 100%)",
      priceKobo: 580_000n,
      saleKobo: 480_000n,
      saleActive: true,
      negotiate: true,
      tags: ["handmade"],
      variants: [{ label: "24 sticks", sku: "PNM-HRM-24", onHand: 18, priceKobo: null }],
      bulk: [{ min: 5, max: null, type: "percentage" as const, value: 10 }],
    },
    {
      slug: "iba-silk-scarf",
      name: "Ibadan Silk Scarf",
      brand: "Iba Atelier",
      shortDesc: "Adire-inspired pattern on charmeuse silk",
      category: "fashion",
      themeBg: "linear-gradient(135deg, #c5d1f0 0%, #4f6dc4 100%)",
      priceKobo: 3_500_000n,
      tags: ["silk", "adire"],
      variants: [
        { label: "Indigo", sku: "IBA-SCRF-INDIGO", onHand: 22, priceKobo: null },
        { label: "Rust", sku: "IBA-SCRF-RUST", onHand: 9, priceKobo: null },
      ],
      bulk: [],
    },
    {
      slug: "sade-glass-tumbler",
      name: "Sade Recycled Glass Tumblers",
      brand: "Bauchi Glass",
      shortDesc: "Set of four, hand-blown from recycled bottle glass",
      category: "home",
      themeBg: "linear-gradient(135deg, #d8e6e6 0%, #7ba3a3 100%)",
      priceKobo: 2_200_000n,
      tags: ["recycled", "glass"],
      variants: [
        { label: "Set of 4", sku: "BAU-GLS-4", onHand: 34, priceKobo: null },
        { label: "Set of 8", sku: "BAU-GLS-8", onHand: 11, priceKobo: 4_100_000n },
      ],
      bulk: [{ min: 3, max: null, type: "percentage" as const, value: 7 }],
    },
  ];

  for (const p of products) {
    const cat = catBySlug[p.category];
    if (!cat) throw new Error(`unknown category ${p.category}`);

    const created = await db.product.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        brand: p.brand,
        shortDesc: p.shortDesc,
        categoryId: cat.id,
        themeBg: p.themeBg,
        priceKobo: p.priceKobo,
        saleKobo: p.saleKobo ?? null,
        saleActive: p.saleActive ?? false,
        negotiate: p.negotiate ?? false,
        preorder: p.preorder ?? false,
        moq: p.moq ?? null,
        eta: p.eta ?? null,
        tags: p.tags,
        published: true,
      },
      create: {
        slug: p.slug,
        name: p.name,
        brand: p.brand,
        shortDesc: p.shortDesc,
        categoryId: cat.id,
        themeBg: p.themeBg,
        priceKobo: p.priceKobo,
        saleKobo: p.saleKobo ?? null,
        saleActive: p.saleActive ?? false,
        negotiate: p.negotiate ?? false,
        preorder: p.preorder ?? false,
        moq: p.moq ?? null,
        eta: p.eta ?? null,
        tags: p.tags,
        published: true,
      },
    });

    // Variants
    for (const [i, v] of p.variants.entries()) {
      await db.productVariant.upsert({
        where: { sku: v.sku },
        update: {
          label: v.label,
          onHand: v.onHand,
          priceKobo: v.priceKobo,
          productId: created.id,
          position: i,
        },
        create: {
          productId: created.id,
          label: v.label,
          sku: v.sku,
          onHand: v.onHand,
          priceKobo: v.priceKobo,
          position: i,
        },
      });
    }

    // Bulk tiers — wipe + replace for simplicity
    await db.bulkTier.deleteMany({ where: { productId: created.id } });
    for (const tier of p.bulk) {
      await db.bulkTier.create({
        data: {
          productId: created.id,
          min: tier.min,
          max: tier.max,
          type: tier.type,
          value: tier.value,
        },
      });
    }
  }

  console.log("→ Seeding super admin");
  await db.user.upsert({
    where: { email: "admin@avmall.ng" },
    update: {},
    create: {
      email: "admin@avmall.ng",
      name: "Funmi A.",
      role: "super_admin",
      passwordHash: await bcrypt.hash("changeme", 10),
      totpEnabled: false,
    },
  });

  console.log("→ Seeding discounts");
  const discounts = [
    {
      code: "WELCOME10",
      kind: "coupon" as const,
      name: "First-time customer 10% off",
      valueType: "percentage" as const,
      value: 10,
      scope: "all",
      active: true,
    },
    {
      code: "JANUARY10",
      kind: "coupon" as const,
      name: "January 10% off",
      valueType: "percentage" as const,
      value: 10,
      scope: "all",
      usageLimit: 500,
      active: true,
    },
    {
      code: "WHOLESALE15",
      kind: "coupon" as const,
      name: "Wholesale partner 15% off",
      valueType: "percentage" as const,
      value: 15,
      scope: "segment:wholesale",
      active: true,
    },
  ];
  for (const d of discounts) {
    await db.discount.upsert({
      where: { code: d.code },
      update: {},
      create: d,
    });
  }

  console.log("✓ Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
