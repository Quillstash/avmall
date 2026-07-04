/**
 * Bumpa → Avmall stock + price sync. Pulls the CURRENT catalogue from Bumpa and
 * updates ONLY each product's available stock (Bumpa `quantity` = stock − sold)
 * and price — nothing else (published/category/tags/images untouched). Only
 * writes products that actually changed. Idempotent; part of the recurring sync.
 *
 *   tsx --env-file=.env.local scripts/bumpa-stock-sync.ts          # dry-run
 *   tsx --env-file=.env.local scripts/bumpa-stock-sync.ts --live   # apply
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const LIVE = process.argv.includes("--live");
const TOKEN = readFileSync(process.env.BUMPA_TOKEN_FILE!, "utf8").trim();
const BASE = "https://api.getbumpa.com/api/v2/products?location_id=57412&orderBy=desc&orderByField=created_at";
const db = new PrismaClient();

const naira = (v: unknown) => { const n = typeof v === "string" ? parseFloat(v) : Number(v ?? 0); return Number.isFinite(n) ? n : 0; };
const toKobo = (v: unknown) => Math.round(naira(v) * 100);

/** Same "never overcharge" rule as the product import. */
function targetPrice(p: any) {
  const cands = [naira(p.price), naira(p.sales)].filter((n) => n > 0);
  const charged = cands.length ? Math.min(...cands) : 0;
  const original = Math.max(naira(p.price), naira(p.compare_at_price));
  const onSale = original > charged;
  return {
    priceKobo: toKobo(onSale ? original : charged),
    saleKobo: onSale ? toKobo(charged) : null,
    saleActive: onSale,
  };
}

async function fetchAll(): Promise<any[]> {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const out: any[] = [];
  let page = 1, last = 1;
  do {
    let j: any = null;
    for (let a = 0; a < 6; a++) {
      const res = await fetch(`${BASE}&limit=100&page=${page}`, { headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/json" } });
      if (res.status === 429 || res.status >= 500) { await sleep(3000 * (a + 1)); continue; }
      if (!res.ok) throw new Error(`page ${page}: HTTP ${res.status}`);
      j = await res.json(); break;
    }
    if (!j) throw new Error(`page ${page}: gave up`);
    const box = j.products ?? j;
    last = box.last_page ?? 1;
    for (const r of box.data ?? []) out.push(r);
    process.stdout.write(`\r  fetch page ${page}/${last} (${out.length})   `);
    page++; await sleep(350);
  } while (page <= last);
  process.stdout.write("\n");
  return out;
}

async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const idx = i++; await fn(items[idx]!); }
  }));
}

async function main() {
  console.log(`Mode: ${LIVE ? "LIVE" : "DRY-RUN"}\n`);
  for (let i = 0; i < 8; i++) { try { await db.$queryRaw`SELECT 1`; break; } catch { await new Promise((r) => setTimeout(r, 2000)); } }
  const store = await db.store.findFirst({ where: { slug: "main" }, select: { id: true } });
  if (!store) throw new Error("Main Store not found");

  console.log("Fetching current catalogue from Bumpa…");
  const raw = await fetchAll();

  const prods = await db.product.findMany({
    select: {
      id: true, slug: true, priceKobo: true, saleKobo: true, saleActive: true,
      variants: { select: { id: true, storeStock: { where: { storeId: store.id }, select: { onHand: true } } }, orderBy: { position: "asc" }, take: 1 },
    },
  });
  const bySlug = new Map(prods.map((p) => [p.slug, p]));

  const stockUpd: { variantId: string; from: number | undefined; to: number; slug: string }[] = [];
  const priceUpd: { id: string; slug: string; priceKobo: number; saleKobo: number | null; saleActive: boolean; fromPrice: number }[] = [];

  for (const bp of raw) {
    const avp = bySlug.get(bp.slug);
    if (!avp) continue;
    // Stock: only when Bumpa actually reports one (skip non-stock-managed items).
    const rawStock = bp.quantity ?? bp.stock;
    const v = avp.variants[0];
    if (v && rawStock != null) {
      const onHand = Math.max(0, Number(rawStock) || 0);
      const cur = v.storeStock[0]?.onHand;
      if (cur !== onHand) stockUpd.push({ variantId: v.id, from: cur, to: onHand, slug: bp.slug });
    }
    // Price: never sync a product down to ₦0 (Bumpa sometimes returns no price).
    const tp = targetPrice(bp);
    if (tp.priceKobo > 0) {
      const curSale = avp.saleKobo == null ? null : Number(avp.saleKobo);
      if (Number(avp.priceKobo) !== tp.priceKobo || curSale !== tp.saleKobo || avp.saleActive !== tp.saleActive) {
        priceUpd.push({ id: avp.id, slug: bp.slug, ...tp, fromPrice: Number(avp.priceKobo) });
      }
    }
  }

  console.log(`\n──────── SYNC SUMMARY ────────`);
  console.log(`Bumpa products fetched : ${raw.length}`);
  console.log(`Stock changes          : ${stockUpd.length}`);
  console.log(`Price changes          : ${priceUpd.length}`);
  console.log(`\nSample stock changes:`);
  for (const s of stockUpd.slice(0, 12)) console.log(`  ${s.slug.slice(0, 44).padEnd(44)} onHand ${s.from} → ${s.to}`);
  if (priceUpd.length) { console.log(`\nSample price changes:`); for (const p of priceUpd.slice(0, 8)) console.log(`  ${p.slug.slice(0, 44).padEnd(44)} ₦${(p.fromPrice / 100).toLocaleString()} → ₦${(p.priceKobo / 100).toLocaleString()}${p.saleActive ? ` (sale ₦${(p.saleKobo! / 100).toLocaleString()})` : ""}`); }

  if (!LIVE) { console.log(`\nDRY-RUN — nothing written. Re-run with --live.`); await db.$disconnect(); return; }

  console.log(`\nApplying ${stockUpd.length} stock + ${priceUpd.length} price updates…`);
  let sc = 0;
  await pool(stockUpd, 8, async (u) => {
    await db.storeStock.update({ where: { storeId_variantId: { storeId: store.id, variantId: u.variantId } }, data: { onHand: u.to } });
    if (++sc % 50 === 0) process.stdout.write(`\r  stock ${sc}/${stockUpd.length}   `);
  });
  let pc = 0;
  await pool(priceUpd, 8, async (u) => {
    await db.product.update({ where: { id: u.id }, data: { priceKobo: BigInt(u.priceKobo), saleKobo: u.saleKobo == null ? null : BigInt(u.saleKobo), saleActive: u.saleActive } });
    if (++pc % 50 === 0) process.stdout.write(`\r  price ${pc}/${priceUpd.length}   `);
  });
  console.log(`\n\nDone. stock updated=${sc} price updated=${pc}`);
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
