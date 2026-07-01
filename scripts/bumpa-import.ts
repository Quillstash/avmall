/**
 * Bumpa → Avmall product importer.
 *
 *   tsx --env-file=.env.local scripts/bumpa-import.ts            # dry-run (no writes)
 *   tsx --env-file=.env.local scripts/bumpa-import.ts --live     # real import
 *
 * Env: BUMPA_TOKEN_FILE (path to token, out of repo), SCRATCH (work dir),
 *      REFETCH=1 to bust the cached raw fetch.
 *
 * Behaviour (per the agreed plan):
 *   • Target store: Main Store, published=true.
 *   • Prices: charged = min(price, sales); struck = max(price, compare_at). kobo.
 *   • Slug already in catalog  → OVERRIDE the existing product (no duplicates).
 *   • Variant products (variationCount>0) → SKIPPED (re-pulled separately later).
 *   • Images → downloaded, re-encoded to WebP (EXIF stripped), stored in R2.
 *   • Every imported/overridden product tagged `bumpa-import` + `bumpa-src-<id>`.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

const LIVE = process.argv.includes("--live");
const LIMIT = (() => {
  const a = process.argv.find((x) => x.startsWith("--limit="));
  return a ? parseInt(a.split("=")[1]!, 10) : null;
})();
const TOKEN = readFileSync(process.env.BUMPA_TOKEN_FILE!, "utf8").trim();
const BASE =
  "https://api.getbumpa.com/api/v2/products?location_id=57412&orderBy=desc&orderByField=created_at";
const STORE_SLUG = "main";
const CONCURRENCY = Number(process.env.BUMPA_CONCURRENCY) || 6;
const SCRATCH = process.env.SCRATCH ?? ".";
const RAW_CACHE = `${SCRATCH}/bumpa-raw.json`;

const db = new PrismaClient();
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});
const R2_BUCKET = process.env.R2_BUCKET_NAME!;

// ── helpers ────────────────────────────────────────────────────────────────
const naira = (v: unknown): number | null => {
  if (v == null) return null;
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : null;
};
const toKobo = (n: number) => Math.round(n * 100);
const firstWord = (s: string) => (s.trim().split(/\s+/)[0] || "Avmall").slice(0, 40);

// First match wins — ordered most-specific/least-ambiguous first.
const CATEGORY_RULES: [RegExp, string][] = [
  [/earbud|ear bud|earpiece|earphone|headset|headphone|airpod|\bbuds?\b|speaker|microphone|\bmic\b|soundbar|woofer|\baudio\b/i, "audio"],
  [/power\s?bank|charger|charging|chager|\bcable\b|adapter|adaptor|extension|inverter|\bsolar\b|generator|batter(?:y|ies)|\bwatt\b|\bcord\b|\bplug\b|socket|\bups\b|voltage|surge|power ?station/i, "power"],
  [/\bfan\b|air cooler|\bcooler\b|cooling/i, "fans"],
  [/smartphone|iphone|\bphone\b|tablet|\btab\b|ipad|redmi|infinix|tecno|\bitel\b|samsung|\boppo\b|nokia|gionee|feature phone/i, "phones"],
  [/perfume|fragrance|cologne|cosmetic|makeup|make up|lipstick|mascara|\blash|eyebrow|foundation|\bcream\b|lotion|\bskin|\bbody\b|\bsoap|\bspa\b|\bhair|\bwig\b|clipper|shaver|trimmer|massager|facial|\bnail|comb|straighten|curler|\bdryer\b|grooming|toothbrush|epilator|razor|cosmetics|gift set/i, "beauty"],
  [/ceramic|melamine|\bbowl|\bplate|cookware|cutlery|\bspoon|\bfork\b|\bknife|\btray|water ?bottle|\bflask\b|thermos|\bburner|\bgas\b|\bstove|chopping|chopper|\bmixer|blender|juicer|\bsoup|kettle|\bpot\b|\bpan\b|cooker|\boven|masterchef|\bmug\b|\bcup\b|tumbler|\bjug\b|\bjar\b|dinner|kitchen|\blamp|dispenser|pounder|\bdecor|\brug\b|wallpaper|candle|sponge|bucket|basket|container|\bmat\b|footmat|\brack\b|\btable\b|\bwall\b|diffuser|humidifier|\biron\b|towel|bedsheet|\bbed\b|duvet|pillow|curtain|broom|\bmop\b|\bbin\b|hanger|organi[sz]er|storage|cushion|blanket|napkin|apron|\bware\b|\bdish|bakeware|\bbake|grater|peeler|whisk|ladle|sieve|colander|warmer|\bvacuum\b|umbrella|\brain\b|chandelier|night light|grill|toaster|microwave|fridge|freezer|washing|cooler box|mosquito|\bnet\b|mirror|\bclock\b|toilet|\bmaker\b|\bscale\b/i, "home"],
  [/\bfood\b|snack|\bdrink|spice|\bgrain|\brice\b|beverage|\btea\b|coffee|honey|cereal|noodle/i, "food"],
  [/\bbag\b|backpack|hand ?bag|\bcap\b|\bhat\b|shirt|\bcloth|dress|\bshoe|sneaker|slipper|sandal|\bwear\b|jewel|necklace|bracelet|\bbelt\b|wallet|purse|sunglass|\bscarf|\bsock|boxer|brief|pant(?:y|ies)|\bbra\b|singlet|waist|underwear|lingerie|jersey|wrist ?watch|\bwatch\b/i, "fashion"],
  [/laptop|computer|\bmouse\b|keyboard|\busb\b|\bhdmi\b|tripod|ring ?light|\bled\b|\brgb\b|projector|\bcamera\b|webcam|monitor|flash drive|memory card|sd card|\bgame|gaming|console|controller|smart ?watch|stylus|\bstand\b|holder|gadget|remote|router|modem|selfie|gimbal|\bbulb\b/i, "tech"],
];
function inferCategory(name: string, tags: string[]): string {
  const text = `${name} ${tags.join(" ")}`;
  for (const [re, slug] of CATEGORY_RULES) if (re.test(text)) return slug;
  return "tech";
}

interface MappedVariant {
  label: string;      // e.g. "White"
  sku: string;        // Bumpa variation sku, or a generated unique one
  priceKobo: number;  // per-variant price
  onHand: number;     // per-variant stock
}
interface Mapped {
  bumpaId: number;
  name: string;
  slug: string;
  brand: string;
  shortDesc: string;
  longDesc: string;
  priceKobo: number;
  saleKobo: number | null;
  saleActive: boolean;
  costPriceKobo: number;
  onHand: number;
  featured: boolean;
  categorySlug: string;
  sku: string;
  imageUrls: string[];
  /** Variant products only — one ProductVariant per entry. null = single default variant. */
  optionName: string | null;
  variations: MappedVariant[] | null;
}

function mapProduct(p: any): Mapped | null {
  const name: string = (p.name || p.title || "").trim();
  if (!name) return null;

  const tags: string[] = Array.isArray(p.tags) ? p.tags.map((t: any) => t?.tag).filter(Boolean) : [];
  const imgPath: string = p.image_path || "";
  const imageUrls: string[] = [];
  if (Array.isArray(p.images)) for (const im of p.images) if (im?.name) imageUrls.push(imgPath + im.name);
  if (imageUrls.length === 0 && typeof p.image_url === "string" && !/default\.png$/i.test(p.image_url)) {
    imageUrls.push(p.image_url);
  }

  // ── Variant products → one ProductVariant per live variation ─────────────
  const rawVars: any[] = Array.isArray(p.variations)
    ? p.variations.filter((v: any) => !v.deleted_at && Number(v.status) !== 0)
    : [];
  let variations: MappedVariant[] | null = null;
  let optionName: string | null = null;
  if (rawVars.length > 0) {
    const vs: MappedVariant[] = [];
    rawVars.forEach((v: any, idx: number) => {
      const cands = [naira(v.price), naira(v.sales)].filter((n): n is number => n != null && n > 0);
      const priceN = cands.length ? Math.min(...cands) : null;
      if (priceN == null) return; // skip a priceless variation
      const st = Number(v.stock);
      vs.push({
        label: (String(v.variant || "").trim() || `Option ${idx + 1}`).slice(0, 80),
        sku: (v.sku ? String(v.sku).trim() : "") || `BUMPA-${p.id}-${idx}`,
        priceKobo: toKobo(priceN),
        onHand: Number.isFinite(st) ? Math.max(0, st) : 0,
      });
    });
    if (vs.length > 0) {
      variations = vs;
      optionName = Array.isArray(p.options) && p.options[0]?.name
        ? String(p.options[0].name).slice(0, 40)
        : "Option";
    }
  }

  // ── Price ────────────────────────────────────────────────────────────────
  let priceKobo: number, saleKobo: number | null, saleActive: boolean, onHand: number;
  if (variations) {
    // Baseline = cheapest variant ("From ₦X"); per-variant prices live on the variants.
    priceKobo = Math.min(...variations.map((v) => v.priceKobo));
    saleKobo = null;
    saleActive = false;
    onHand = variations.reduce((a, v) => a + v.onHand, 0);
  } else {
    const priceN = naira(p.price);
    const salesN = naira(p.sales);
    const compareN = naira(p.compare_at_price);
    const candidates = [priceN, salesN].filter((n): n is number => n != null && n > 0);
    const chargedN = candidates.length ? Math.min(...candidates) : null;
    if (chargedN == null) return null; // no valid price
    const originalN = Math.max(priceN ?? 0, compareN ?? 0);
    const onSale = originalN > chargedN;
    priceKobo = toKobo(onSale ? originalN : chargedN);
    saleKobo = onSale ? toKobo(chargedN) : null;
    saleActive = onSale;
    const oh = Number(p.stock);
    onHand = Number.isFinite(oh) ? Math.max(0, oh) : 0;
  }

  return {
    bumpaId: p.id,
    name,
    slug: (p.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")) as string,
    brand: firstWord(name),
    shortDesc: (p.description || p.details || name).toString().slice(0, 300),
    longDesc: (p.details || p.description || "").toString(),
    priceKobo,
    saleKobo,
    saleActive,
    costPriceKobo: naira(p.cost) != null ? toKobo(naira(p.cost)!) : 0,
    onHand,
    featured: !!p.featured,
    categorySlug: inferCategory(name, tags),
    sku: `BUMPA-${p.id}`,
    imageUrls,
    optionName,
    variations,
  };
}

async function fetchAll(): Promise<any[]> {
  if (existsSync(RAW_CACHE) && process.env.REFETCH !== "1") {
    const cached = JSON.parse(readFileSync(RAW_CACHE, "utf8"));
    console.log(`  using cached fetch (${cached.length} products) — REFETCH=1 to refresh`);
    return cached;
  }
  const out: any[] = [];
  let page = 1, last = 1;
  do {
    const res = await fetch(`${BASE}&limit=100&page=${page}`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Bumpa page ${page}: HTTP ${res.status}`);
    const j: any = await res.json();
    const pg = j.products ?? j;
    last = pg.last_page ?? 1;
    for (const item of pg.data ?? []) out.push(item);
    process.stdout.write(`\r  fetched page ${page}/${last} (${out.length})   `);
    page++;
  } while (page <= last);
  process.stdout.write("\n");
  writeFileSync(RAW_CACHE, JSON.stringify(out));
  return out;
}

async function uploadImage(productId: string, url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const webp = await sharp(buf, { failOn: "error" })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer();
    const key = `products/${productId}/${randomUUID()}.webp`;
    await r2.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: webp, ContentType: "image/webp" }));
    return key;
  } catch {
    return null;
  }
}

async function pool<T>(items: T[], n: number, fn: (t: T, i: number) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) { const idx = i++; await fn(items[idx]!, idx); }
    }),
  );
}

async function main() {
  console.log(`Mode: ${LIVE ? "LIVE (writes!)" : "DRY-RUN (no writes)"}\n`);
  for (let i = 0; i < 6; i++) { try { await db.$queryRaw`SELECT 1`; break; } catch { await new Promise((r) => setTimeout(r, 1500)); } }

  const store = await db.store.findFirst({ where: { slug: STORE_SLUG }, select: { id: true, name: true } });
  if (!store) throw new Error(`Store '${STORE_SLUG}' not found`);
  const cats = await db.category.findMany({ select: { id: true, slug: true } });
  const catId = new Map(cats.map((c) => [c.slug, c.id]));

  console.log("Fetching from Bumpa…");
  const raw = await fetchAll();
  // Bumpa's feed lists some products twice — collapse to the first by id so
  // duplicate slugs/SKUs don't collide on insert.
  const seenIds = new Set<number>();
  const rawDeduped = (raw as any[]).filter((p) => { if (seenIds.has(p.id)) return false; seenIds.add(p.id); return true; });

  // existing products → slug map for override (+ primary variant for stock)
  const existingRows = await db.product.findMany({
    select: { id: true, slug: true, variants: { select: { id: true }, orderBy: { position: "asc" }, take: 1 }, images: { select: { id: true }, take: 1 } },
  });
  const existingBySlug = new Map(existingRows.map((p) => [p.slug, { id: p.id, variantId: p.variants[0]?.id, hasImages: p.images.length > 0 }]));

  let skippedNoName = 0, skippedNoPrice = 0, skippedDeleted = 0;
  const mapped: Mapped[] = [];
  for (const p of rawDeduped) {
    if (p.deleted_at || p.is_demo === 1) { skippedDeleted++; continue; }
    const m = mapProduct(p);
    if (!m) { if (!(p.name || p.title)) skippedNoName++; else skippedNoPrice++; continue; }
    mapped.push(m);
  }
  const variantProducts = mapped.filter((m) => m.variations);
  const totalVariants = variantProducts.reduce((a, m) => a + (m.variations?.length ?? 0), 0);

  const toCreate = mapped.filter((m) => !existingBySlug.has(m.slug));
  const toOverride = mapped.filter((m) => existingBySlug.has(m.slug));

  const byCat: Record<string, number> = {};
  for (const m of mapped) byCat[m.categorySlug] = (byCat[m.categorySlug] ?? 0) + 1;
  const withImages = mapped.filter((m) => m.imageUrls.length > 0).length;

  console.log(`\n──────── SUMMARY ────────`);
  console.log(`Target store           : ${store.name}`);
  console.log(`Fetched                : ${raw.length}  (${rawDeduped.length} unique after de-dup)`);
  console.log(`Skipped — deleted/demo : ${skippedDeleted}`);
  console.log(`Variant products       : ${variantProducts.length}  (${totalVariants} variants total)`);
  console.log(`Skipped — no price     : ${skippedNoPrice}`);
  console.log(`Skipped — no name      : ${skippedNoName}`);
  console.log(`\n→ CREATE (new)         : ${toCreate.length}`);
  console.log(`→ OVERRIDE (existing)  : ${toOverride.length}`);
  console.log(`With image(s)          : ${withImages} / ${mapped.length}`);
  console.log(`\nCategory split (create+override):`);
  for (const [k, v] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) console.log(`   ${k.padEnd(8)} ${v}`);

  writeFileSync(`${SCRATCH}/bumpa-mapped.json`, JSON.stringify(mapped, null, 2));
  console.log(`\nFull mapped list → ${SCRATCH}/bumpa-mapped.json`);

  if (!LIVE) { console.log(`\nDRY-RUN only — nothing written. Re-run with --live to import.`); await db.$disconnect(); return; }

  // ── LIVE ───────────────────────────────────────────────────────────────
  const targets = LIMIT ? mapped.slice(0, LIMIT) : mapped;
  console.log(`\nLIVE: writing ${targets.length}${LIMIT ? ` (--limit=${LIMIT} test batch)` : ` (full: create ${toCreate.length}, override ${toOverride.length})`}…`);
  let created = 0, overridden = 0, imagesUp = 0, failed = 0;

  // Assign each NEW product a final unique slug up-front, single-threaded, so
  // the concurrent writers below can never race two products onto one slug
  // (distinct products that share a base slug get -2, -3, … suffixes).
  const slugSet = new Set<string>(existingBySlug.keys());
  for (const m of targets) {
    if (existingBySlug.has(m.slug)) continue; // will override — keep its slug
    let s = m.slug, n = 2;
    while (slugSet.has(s)) s = `${m.slug}-${n++}`;
    slugSet.add(s);
    m.slug = s;
  }

  const writeImages = async (productId: string, urls: string[]) => {
    for (let idx = 0; idx < urls.length; idx++) {
      const key = await uploadImage(productId, urls[idx]!);
      if (key) {
        await db.productImage.create({ data: { productId, key, alt: "", position: idx, isPrimary: idx === 0 } });
        imagesUp++;
      }
    }
  };

  await pool(targets, CONCURRENCY, async (m) => {
    try {
      const existing = existingBySlug.get(m.slug);
      const data = {
        name: m.name, brand: m.brand, shortDesc: m.shortDesc, longDesc: m.longDesc,
        categoryId: catId.get(m.categorySlug) ?? catId.get("tech")!,
        storeId: store.id, priceKobo: BigInt(m.priceKobo),
        saleKobo: m.saleKobo != null ? BigInt(m.saleKobo) : null,
        saleActive: m.saleActive, costPriceKobo: BigInt(m.costPriceKobo),
        published: true, featured: m.featured,
        tags: ["bumpa-import", `bumpa-src-${m.bumpaId}`],
      };

      if (existing) {
        await db.product.update({ where: { id: existing.id }, data });
        if (existing.variantId) {
          await db.storeStock.upsert({
            where: { storeId_variantId: { storeId: store.id, variantId: existing.variantId } },
            create: { storeId: store.id, variantId: existing.variantId, onHand: m.onHand, reserved: 0 },
            update: { onHand: m.onHand },
          });
        }
        // Only (re)fetch images for products that don't have any yet — makes a
        // gap-filling re-run fast (existing images are left untouched).
        if (m.imageUrls.length && !existing.hasImages) {
          await writeImages(existing.id, m.imageUrls);
        }
        overridden++;
      } else {
        // Variant products → one ProductVariant per variation (own price/stock);
        // single products → one "Default" variant.
        const variantRows = m.variations
          ? m.variations.map((v, i) => ({
              label: v.label, sku: v.sku, option1Value: v.label,
              priceKobo: BigInt(v.priceKobo), position: i,
            }))
          : [{ label: "Default", sku: m.sku, position: 0 }];
        const product = await db.product.create({
          data: {
            ...data, slug: m.slug,
            ...(m.optionName && { option1Name: m.optionName }),
            variants: { create: variantRows },
          },
          include: { variants: { orderBy: { position: "asc" } } },
        });
        const stockPer = m.variations ? m.variations.map((v) => v.onHand) : [m.onHand];
        for (let i = 0; i < product.variants.length; i++) {
          await db.storeStock.create({
            data: { storeId: store.id, variantId: product.variants[i]!.id, onHand: stockPer[i] ?? 0, reserved: 0 },
          });
        }
        await writeImages(product.id, m.imageUrls);
        created++;
      }
      const tot = created + overridden;
      if (tot % 25 === 0) process.stdout.write(`\r  done ${tot}/${targets.length}  created=${created} overridden=${overridden} images=${imagesUp} failed=${failed}   `);
    } catch (e: any) {
      failed++;
      console.log(`\n  ✗ ${m.name}: ${e.message}`);
    }
  });
  console.log(`\n\nDone. created=${created} overridden=${overridden} images=${imagesUp} failed=${failed}`);
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
