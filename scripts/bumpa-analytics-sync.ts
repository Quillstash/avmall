/**
 * Fetch Bumpa's authoritative sales aggregates and cache them in Avmall's DB
 * (bumpa_sales_snapshots), so the dashboard can show Bumpa-exact figures with
 * no view-time dependency on Bumpa. Idempotent (upsert). Part of the recurring
 * sync. Requires the 20260701120000_add_bumpa_sales_snapshot migration applied.
 *
 *   tsx --env-file=.env.local scripts/bumpa-analytics-sync.ts
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const TOKEN = readFileSync(process.env.BUMPA_TOKEN_FILE!, "utf8").trim();
const API = "https://api.getbumpa.com/api/analytics/v2/sales";
const LOCATION = "57412";

/** "₦48,174,338.01" → 4817433801 (kobo). */
const koboFromNaira = (v: unknown) =>
  Math.round(parseFloat(String(v ?? "").replace(/[₦,\s]/g, "") || "0") * 100);

async function get(url: string): Promise<any> {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/json" } });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

async function syncPeriod(storeId: string, periodKey: string, from: string, to: string) {
  const ov = await get(`${API}?from=${from}&to=${to}&dataset=overview&location_id=${LOCATION}`);
  const kpi: Record<string, number> = {};
  for (const d of ov.data ?? []) kpi[d.title] = koboFromNaira(d.value);

  const chRes = await get(`${API}?from=${from}&to=${to}&dataset=sales_channels&location_id=${LOCATION}`);
  const channels = ((chRes.data?.chart?.data ?? []) as any[]).map((c) => ({
    source: c.channel,
    label: c.channel_label,
    valueKobo: Math.round((Number(c.value) || 0) * 100),
    color: c.color,
  }));

  const data = {
    periodFrom: new Date(from),
    periodTo: new Date(to),
    totalSalesKobo: BigInt(kpi["Total Sales"] ?? 0),
    offlineSalesKobo: BigInt(kpi["Offline Sales"] ?? 0),
    settledKobo: BigInt(kpi["Total Settled"] ?? 0),
    owedKobo: BigInt(kpi["Total Owed"] ?? 0),
    channels,
    fetchedAt: new Date(),
  };
  await db.bumpaSalesSnapshot.upsert({
    where: { storeId_periodKey: { storeId, periodKey } },
    create: { storeId, periodKey, ...data },
    update: data,
  });
  const n = (k: number) => "₦" + (k / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 });
  console.log(`  ${periodKey}: total ${n(Number(data.totalSalesKobo))}  offline ${n(Number(data.offlineSalesKobo))}  channels ${channels.length}`);
}

async function main() {
  for (let i = 0; i < 6; i++) { try { await db.$queryRaw`SELECT 1`; break; } catch { await new Promise((r) => setTimeout(r, 1500)); } }
  const store = await db.store.findFirst({ where: { slug: "main" }, select: { id: true } });
  if (!store) throw new Error("Main Store not found");
  const thisYear = new Date().getUTCFullYear();
  console.log("Syncing Bumpa analytics snapshots…");
  await syncPeriod(store.id, String(thisYear), `${thisYear}-01-01`, `${thisYear}-12-31`);
  await syncPeriod(store.id, "all-time", "2020-01-01", "2035-12-31");
  console.log("Done.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
