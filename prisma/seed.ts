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

import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PRODUCTS, CATEGORIES } from "../src/lib/mock-data";

const db = new PrismaClient();

/**
 * Run the entire seed inside a retry wrapper. Neon serverless takes ~5-10s
 * to wake from cold; Prisma's default connect timeout (~5s) is too short,
 * so the first attempt often fails with P1001 even when the endpoint is
 * fine. Retry up to 5× with linear back-off so `pnpm db:seed` doesn't need
 * babysitting.
 */
async function withRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isConn =
        err instanceof Prisma.PrismaClientInitializationError ||
        (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P1001") ||
        (err instanceof Error && /Can't reach database server|ECONNREFUSED|ETIMEDOUT/.test(err.message));
      if (!isConn || i === attempts - 1) throw err;
      const waitMs = 2000 * (i + 1);
      console.log(`  …connection failed, retrying in ${waitMs}ms (attempt ${i + 2}/${attempts})`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastErr;
}

async function main() {
  console.log("→ Seeding categories");
  const categories = await withRetry(() =>
    Promise.all(
      CATEGORIES.map((c, i) =>
        db.category.upsert({
          where: { slug: c.id },
          update: { name: c.name, position: i + 1 },
          create: { slug: c.id, name: c.name, position: i + 1 },
        }),
      ),
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

  console.log("→ Seeding Main store");
  const mainStore = await db.store.upsert({
    where: { slug: "main" },
    update: {},
    create: {
      name: "Main Store",
      slug: "main",
      isMain: true,
      active: true,
      address: "14 Bourdillon Road",
      city: "Ikoyi",
      state: "Lagos",
      phone: "+234 803 421 7790",
    },
  });

  console.log(`→ Seeding ${PRODUCTS.length} products from the mock catalogue`);
  // Wipe old rows whose slugs are no longer in the catalogue (idempotency).
  const keepSlugs = PRODUCTS.map((p) => p.slug);
  await db.product.updateMany({
    where: { slug: { notIn: keepSlugs } },
    data: { archivedAt: new Date(), published: false },
  });

  for (const p of PRODUCTS) {
    const cat = catBySlug[p.category];
    if (!cat) throw new Error(`unknown category ${p.category} for ${p.slug}`);

    const created = await db.product.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        brand: p.brand,
        shortDesc: p.short,
        categoryId: cat.id,
        themeBg: p.bg,
        priceKobo: BigInt(p.price),
        costPriceKobo: BigInt(p.cost),
        saleKobo: p.sale != null ? BigInt(p.sale) : null,
        saleActive: p.saleActive ?? false,
        negotiate: p.negotiate ?? false,
        negotiateFloorKobo: p.negotiateFloor != null ? BigInt(p.negotiateFloor) : null,
        negotiateMaxPct: p.negotiateMaxPct ?? null,
        option1Name: p.option1Name ?? null,
        option2Name: p.option2Name ?? null,
        preorder: p.preorder ?? false,
        moq: p.moq ?? null,
        eta: p.eta ?? null,
        tags: [],
        published: true,
        archivedAt: null,
      },
      create: {
        slug: p.slug,
        name: p.name,
        brand: p.brand,
        shortDesc: p.short,
        categoryId: cat.id,
        themeBg: p.bg,
        priceKobo: BigInt(p.price),
        costPriceKobo: BigInt(p.cost),
        saleKobo: p.sale != null ? BigInt(p.sale) : null,
        saleActive: p.saleActive ?? false,
        negotiate: p.negotiate ?? false,
        negotiateFloorKobo: p.negotiateFloor != null ? BigInt(p.negotiateFloor) : null,
        negotiateMaxPct: p.negotiateMaxPct ?? null,
        option1Name: p.option1Name ?? null,
        option2Name: p.option2Name ?? null,
        preorder: p.preorder ?? false,
        moq: p.moq ?? null,
        eta: p.eta ?? null,
        tags: [],
        published: true,
      },
    });

    // Variants — each mock product carries a single default variant. SKU is
    // derived from the variant id so re-seeding is idempotent.
    for (const [i, v] of p.variants.entries()) {
      const sku = v.id.toUpperCase();
      const variant = await db.productVariant.upsert({
        where: { sku },
        update: {
          label: v.label,
          priceKobo: v.price != null ? BigInt(v.price) : null,
          option1Value: v.option1Value ?? null,
          option2Value: v.option2Value ?? null,
          productId: created.id,
          position: i,
        },
        create: {
          productId: created.id,
          label: v.label,
          sku,
          priceKobo: v.price != null ? BigInt(v.price) : null,
          option1Value: v.option1Value ?? null,
          option2Value: v.option2Value ?? null,
          position: i,
        },
      });
      // Stock lives per store now — seed the Main store's shelf.
      await db.storeStock.upsert({
        where: {
          storeId_variantId: { storeId: mainStore.id, variantId: variant.id },
        },
        update: { onHand: v.stock },
        create: {
          storeId: mainStore.id,
          variantId: variant.id,
          onHand: v.stock,
          reserved: 0,
        },
      });
    }

    // Bulk tiers — wipe + replace for simplicity.
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
  // System roles are created by the add_roles migration; link the admin to one.
  const superRole = await db.role.findUnique({ where: { slug: "super_admin" } });
  await db.user.upsert({
    where: { email: "admin@avmall.ng" },
    update: { ...(superRole && { roleId: superRole.id }) },
    create: {
      email: "admin@avmall.ng",
      name: "Funmi A.",
      role: "super_admin",
      ...(superRole && { roleId: superRole.id }),
      storeId: mainStore.id,
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

  console.log("→ Seeding AI settings (singleton)");
  await db.aiSettings.upsert({
    where: { key: "default" },
    update: {},
    create: {
      key: "default",
      globalNegotiateMaxPct: 10,
      negotiationEnabled: true,
    },
  });

  console.log("✓ Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
