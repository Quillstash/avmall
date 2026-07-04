/**
 * Bumpa → Avmall customers + orders importer (idempotent re-runnable sync).
 *
 *   tsx --env-file=.env.local scripts/bumpa-orders-import.ts          # dry-run
 *   tsx --env-file=.env.local scripts/bumpa-orders-import.ts --live   # write
 *
 * Env: BUMPA_TOKEN_FILE, SCRATCH, REFETCH=1 to bust the cached fetches.
 *
 * Customers → customers (Main Store), deduped by phone, tagged segment
 *   `bumpa:<id>`. Orders → orders + order_lines (Main Store), number
 *   `BUMPA-<order_number>` (unique = the reversible/idempotent marker).
 * Re-running skips customers/orders that already exist.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const LIVE = process.argv.includes("--live");
const TOKEN = readFileSync(process.env.BUMPA_TOKEN_FILE!, "utf8").trim();
const API = "https://api.getbumpa.com/api";
const STORE_SLUG = "main";
const SCRATCH = process.env.SCRATCH ?? ".";
const db = new PrismaClient();

// ── helpers ─────────────────────────────────────────────────────────────────
const naira = (v: unknown): number => {
  const n = typeof v === "string" ? parseFloat(v) : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const toKobo = (v: unknown) => Math.round(naira(v) * 100);

/** Nigerian phone → E.164, or null when unusable. */
function normPhone(raw: unknown): string | null {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (d.startsWith("234") && d.length === 13) return `+${d}`;
  if (d.startsWith("0") && d.length === 11) return `+234${d.slice(1)}`;
  if (d.length === 10) return `+234${d}`;
  return null;
}

const SOURCE_MAP: Record<string, string> = {
  "walk-in": "walkin", walkin: "walkin", whatsapp: "whatsapp", website: "web",
  web: "web", phone: "phone", instagram: "web", facebook: "web", pos: "walkin",
  mobile: "web", manual: "walkin", "": "web",
};
const mapSource = (origin: unknown, channel: unknown) =>
  SOURCE_MAP[String(origin || channel || "").toLowerCase().trim()] ?? "web";

const STATUS_MAP: Record<string, string> = {
  completed: "delivered", delivered: "delivered", pending: "pending",
  processing: "processing", confirmed: "confirmed", shipped: "shipped",
  cancelled: "cancelled", canceled: "cancelled", refunded: "refunded",
  returned: "refunded",
};
const mapStatus = (s: unknown) => STATUS_MAP[String(s ?? "").toLowerCase().trim()] ?? "pending";

const PAY_MAP: Record<string, string> = {
  paid: "paid", unpaid: "unpaid", pending: "unpaid", partial: "partial",
  partially_paid: "partial", refunded: "refunded",
};
const mapPay = (s: unknown) => PAY_MAP[String(s ?? "").toLowerCase().trim()] ?? "unpaid";

/** Pull a product slug out of a Bumpa item URL (…/products/<slug>/). */
function slugFromUrl(url: unknown): string | null {
  const m = String(url ?? "").match(/\/products\/([^/?#]+)/);
  return m ? m[1]! : null;
}

async function fetchAll(path: string, cacheName: string): Promise<any[]> {
  const cache = `${SCRATCH}/${cacheName}`;
  if (existsSync(cache) && process.env.REFETCH !== "1") {
    const c = JSON.parse(readFileSync(cache, "utf8"));
    console.log(`  cached ${cacheName}: ${c.length}`);
    return c;
  }
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const out: any[] = [];
  let page = 1, last = 1;
  do {
    const sep = path.includes("?") ? "&" : "?";
    const url = `${API}${path}${sep}limit=100&page=${page}`;
    let j: any = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/json" },
      });
      if (res.status === 429 || res.status >= 500) {
        const wait = 3000 * (attempt + 1);
        process.stdout.write(`\r  fetch ${cacheName}: page ${page} rate-limited (${res.status}), waiting ${wait / 1000}s…   `);
        await sleep(wait);
        continue;
      }
      if (!res.ok) throw new Error(`${path} page ${page}: HTTP ${res.status}`);
      j = await res.json();
      break;
    }
    if (!j) throw new Error(`${path} page ${page}: gave up after retries`);
    const box = j.orders ?? j.customers ?? j.transactions ?? j;
    last = box.last_page ?? 1;
    for (const r of box.data ?? []) out.push(r);
    process.stdout.write(`\r  fetch ${cacheName}: page ${page}/${last} (${out.length})            `);
    // Persist progress each page so a mid-run failure doesn't lose the fetch.
    writeFileSync(cache, JSON.stringify(out));
    page++;
    await sleep(400); // be gentle on Bumpa's rate limiter
  } while (page <= last);
  process.stdout.write("\n");
  writeFileSync(cache, JSON.stringify(out));
  return out;
}

async function wake() {
  for (let i = 0; i < 6; i++) {
    try { await db.$queryRaw`SELECT 1`; return; }
    catch { await new Promise((r) => setTimeout(r, 1500)); }
  }
}

async function main() {
  console.log(`Mode: ${LIVE ? "LIVE (writes!)" : "DRY-RUN"}\n`);
  await wake();
  const store = await db.store.findFirst({ where: { slug: STORE_SLUG }, select: { id: true, name: true } });
  if (!store) throw new Error("Main Store not found");

  console.log("Fetching from Bumpa…");
  const rawCustomers = await fetchAll("/customers?orderBy=desc&orderByField=created_at", "bumpa-customers-all.json");
  const rawOrders = await fetchAll("/orders?orderBy=desc&orderByField=created_at", "bumpa-orders-all.json");

  // Existing state
  const productBySlug = new Map(
    (await db.product.findMany({ select: { slug: true, id: true, variants: { select: { id: true, sku: true }, orderBy: { position: "asc" }, take: 1 } } }))
      .map((p) => [p.slug, { id: p.id, variantId: p.variants[0]?.id, sku: p.variants[0]?.sku }]),
  );
  const existingOrderNumbers = new Set(
    (await db.order.findMany({ where: { number: { startsWith: "BUMPA-" } }, select: { number: true } })).map((o) => o.number),
  );
  const existingByPhone = new Map(
    (await db.customer.findMany({ where: { storeId: store.id }, select: { id: true, phone: true } })).map((c) => [c.phone, c.id]),
  );

  // ── CUSTOMERS ──────────────────────────────────────────────────────────────
  let custNew = 0, custExisting = 0, custNoPhone = 0, custDupPhone = 0;
  const bumpaCustToAvmall = new Map<number, string>(); // bumpa id -> avmall id (live) or "would" (dry)
  const seenPhones = new Set<string>();
  const emailSeen = new Set<string>();
  const custPlan: { bumpaId: number; phone: string; name: string; email: string | null; createdAt: Date }[] = [];

  for (const c of rawCustomers) {
    const phone = normPhone(c.phone) ?? normPhone(c.alternative_phone);
    if (!phone) { custNoPhone++; continue; }
    const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.name || "Customer";
    let email: string | null = c.email && c.email_valid ? String(c.email).toLowerCase() : null;
    if (email && emailSeen.has(email)) email = null; // email unique per store
    if (email) emailSeen.add(email);
    const createdAt = new Date(String(c.created_at ?? "").replace(/(\.\d{3})\d*Z$/, "$1Z"));

    if (existingByPhone.has(phone) || seenPhones.has(phone)) {
      custExisting++;
      const id = existingByPhone.get(phone);
      if (id) bumpaCustToAvmall.set(c.id, id);
      if (seenPhones.has(phone)) custDupPhone++;
      continue;
    }
    seenPhones.add(phone);
    custNew++;
    custPlan.push({ bumpaId: c.id, phone, name, email, createdAt: isNaN(createdAt.getTime()) ? new Date() : createdAt });
  }

  // ── ORDERS mapping ─────────────────────────────────────────────────────────
  const channelCount: Record<string, number> = {};
  const statusCount: Record<string, number> = {};
  let ordNew = 0, ordExisting = 0, linesMatched = 0, linesOrphan = 0, totalKoboSum = 0;
  let minDate = "", maxDate = "";
  const orphanSlugs = new Set<string>();

  for (const o of rawOrders) {
    const number = `BUMPA-${o.order_number ?? o.id}`;
    if (existingOrderNumbers.has(number)) { ordExisting++; continue; }
    ordNew++;
    const src = mapSource(o.origin, o.channel);
    channelCount[src] = (channelCount[src] ?? 0) + 1;
    statusCount[mapStatus(o.status)] = (statusCount[mapStatus(o.status)] ?? 0) + 1;
    totalKoboSum += toKobo(o.total ?? o.grand_total);
    const ca = String(o.created_at ?? o.order_date ?? "").slice(0, 10);
    if (ca && (!minDate || ca < minDate)) minDate = ca;
    if (ca && (!maxDate || ca > maxDate)) maxDate = ca;
    for (const it of o.items ?? []) {
      const slug = slugFromUrl(it.url);
      if (slug && productBySlug.has(slug)) linesMatched++;
      else { linesOrphan++; if (slug) orphanSlugs.add(slug); }
    }
  }

  // ── REPORT ─────────────────────────────────────────────────────────────────
  const naijaFmt = (k: number) => "₦" + (k / 100).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  console.log(`\n──────── DRY-RUN SUMMARY ────────`);
  console.log(`Target store         : ${store.name}`);
  console.log(`\nCUSTOMERS  fetched ${rawCustomers.length}`);
  console.log(`  new to import      : ${custNew}`);
  console.log(`  already exist (by phone): ${custExisting}`);
  console.log(`  skipped, no valid phone : ${custNoPhone}`);
  console.log(`  duplicate phone in feed : ${custDupPhone}`);
  console.log(`\nORDERS  fetched ${rawOrders.length}`);
  console.log(`  new to import      : ${ordNew}`);
  console.log(`  already imported   : ${ordExisting}`);
  console.log(`  date range         : ${minDate} → ${maxDate}`);
  console.log(`  Σ order totals     : ${naijaFmt(totalKoboSum)}   (Bumpa 2026 overview = ₦48,174,338.01)`);
  console.log(`  channel (source)   :`, channelCount);
  console.log(`  status             :`, statusCount);
  console.log(`  order lines matched: ${linesMatched}   orphan (no product): ${linesOrphan}`);
  console.log(`  distinct orphan slugs: ${orphanSlugs.size}`);

  if (!LIVE) { console.log(`\nDRY-RUN only — nothing written. Re-run with --live.`); await db.$disconnect(); return; }

  // ── LIVE: customers first, then orders ───────────────────────────────────────
  console.log(`\nLIVE: creating ${custPlan.length} customers…`);
  let cDone = 0;
  for (const c of custPlan) {
    try {
      const created = await db.customer.create({
        data: {
          storeId: store.id, phone: c.phone, name: c.name, email: c.email,
          segments: ["bumpa-import", `bumpa:${c.bumpaId}`], createdAt: c.createdAt,
        },
        select: { id: true },
      });
      bumpaCustToAvmall.set(c.bumpaId, created.id);
      if (++cDone % 100 === 0) process.stdout.write(`\r  customers ${cDone}/${custPlan.length}   `);
    } catch (e: any) {
      // phone/email unique race — link if it now exists
      const ex = await db.customer.findFirst({ where: { storeId: store.id, phone: c.phone }, select: { id: true } });
      if (ex) bumpaCustToAvmall.set(c.bumpaId, ex.id);
    }
  }
  console.log(`\n  customers done: ${bumpaCustToAvmall.size} linked`);

  // ── Discontinued products (archived) so every order line links ──────────────
  const orphanData = new Map<string, { name: string; priceKobo: number }>();
  for (const o of rawOrders) {
    for (const it of o.items ?? []) {
      const slug = slugFromUrl(it.url);
      if (!slug || productBySlug.has(slug) || orphanData.has(slug)) continue;
      orphanData.set(slug, { name: String(it.name ?? slug).slice(0, 300), priceKobo: toKobo(it.price) });
    }
  }
  const cats = await db.category.findMany({ select: { id: true, slug: true } });
  const fallbackCatId = cats.find((c) => c.slug === "tech")?.id ?? cats[0]!.id;
  console.log(`\nLIVE: creating ${orphanData.size} discontinued (archived) products…`);
  let discDone = 0;
  for (const [slug, d] of orphanData) {
    try {
      const p = await db.product.create({
        data: {
          slug, name: d.name, brand: (d.name.split(/\s+/)[0] || "Avmall").slice(0, 40),
          shortDesc: d.name, categoryId: fallbackCatId, storeId: store.id,
          priceKobo: BigInt(Math.max(0, d.priceKobo)),
          published: false, archivedAt: new Date(),
          tags: ["bumpa-import", "bumpa-discontinued"],
          variants: { create: { label: "Default", sku: `DISC-${slug}`, position: 0 } },
        },
        include: { variants: true },
      });
      await db.storeStock.create({ data: { storeId: store.id, variantId: p.variants[0]!.id, onHand: 0, reserved: 0 } });
      productBySlug.set(slug, { id: p.id, variantId: p.variants[0]!.id, sku: p.variants[0]!.sku });
      if (++discDone % 100 === 0) process.stdout.write(`\r  discontinued ${discDone}/${orphanData.size}   `);
    } catch {
      const ex = await db.product.findUnique({ where: { slug }, select: { id: true, variants: { select: { id: true, sku: true }, take: 1 } } });
      if (ex?.variants[0]) productBySlug.set(slug, { id: ex.id, variantId: ex.variants[0].id, sku: ex.variants[0].sku });
    }
  }
  console.log(`\n  discontinued products: ${discDone} created`);

  console.log(`\nLIVE: building order + line rows…`);
  const orderRows: any[] = [];
  const lineRows: any[] = [];
  for (const o of rawOrders) {
    const number = `BUMPA-${o.order_number ?? o.id}`;
    if (existingOrderNumbers.has(number)) continue; // skip already-imported (idempotent)
    const oid = randomUUID();
    const ship = o.shipping_details ?? o.customer_details ?? {};
    const custId = o.customer_id != null ? bumpaCustToAvmall.get(o.customer_id) ?? null : null;
    const createdAt = new Date(String(o.created_at ?? o.order_date ?? "").replace(/(\.\d{3})\d*Z$/, "$1Z"));
    orderRows.push({
      id: oid, number, storeId: store.id, customerId: custId,
      status: mapStatus(o.status), paymentStatus: mapPay(o.payment_status),
      source: mapSource(o.origin, o.channel),
      shipName: String(ship?.name ?? o.customer_details?.name ?? "Walk-in customer").slice(0, 120),
      shipPhone: normPhone(ship?.phone) ?? "+2340000000000",
      shipLine1: String(ship?.street ?? ship?.address ?? "N/A").slice(0, 200),
      shipCity: String(ship?.city ?? "Lagos").slice(0, 80),
      shipState: String(ship?.state ?? "Lagos").slice(0, 80),
      subtotalKobo: BigInt(toKobo(o.sub_total ?? o.total)),
      shippingKobo: BigInt(toKobo(o.shipping_price)),
      manualDiscountKobo: BigInt(toKobo(o.total_discount ?? o.discount)),
      totalKobo: BigInt(toKobo(o.total ?? o.grand_total)),
      paidKobo: BigInt(toKobo(o.amount_paid)),
      createdAt: isNaN(createdAt.getTime()) ? new Date() : createdAt,
    });
    for (const it of o.items ?? []) {
      const slug = slugFromUrl(it.url);
      const prod = slug ? productBySlug.get(slug) : undefined;
      if (!prod?.variantId) continue;
      lineRows.push({
        orderId: oid, productId: prod.id, variantId: prod.variantId,
        nameSnapshot: String(it.name ?? "Item").slice(0, 300),
        skuSnapshot: prod.sku ?? "BUMPA-ITEM",
        variantSnapshot: it.variant ? String(it.variant).slice(0, 120) : null,
        quantity: Math.max(1, Number(it.quantity) || 1),
        unitKobo: BigInt(toKobo(it.price)),
      });
    }
  }
  const chunk = <T>(a: T[], n: number) => { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
  console.log(`  inserting ${orderRows.length} orders + ${lineRows.length} lines (batched)…`);
  let oW = 0;
  for (const c of chunk(orderRows, 500)) { await db.order.createMany({ data: c, skipDuplicates: true }); oW += c.length; process.stdout.write(`\r  orders ${oW}/${orderRows.length}   `); }
  let lW = 0;
  for (const c of chunk(lineRows, 1000)) { await db.orderLine.createMany({ data: c, skipDuplicates: true }); lW += c.length; process.stdout.write(`\r  lines ${lW}/${lineRows.length}   `); }
  console.log(`\n\nDone. customers=${bumpaCustToAvmall.size} orders=${orderRows.length} lines=${lineRows.length}`);
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
