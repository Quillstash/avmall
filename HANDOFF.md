# Avmall — Session Handoff / Progress Log

> Working notes to resume this project on another machine (or in a fresh AI
> session). The authoritative architecture doc is **[CLAUDE.md](CLAUDE.md)** — read
> that first. This file is the "where we are right now" layer on top of it.
>
> _Last updated: 2026-07-04._

---

## 0. Moving to a new laptop — checklist

Git carries the code; it does **not** carry secrets. Do these in order:

1. `git clone` the repo, then `git checkout feat/substore-storefront-and-payment`
   (the active branch — `main` does not yet have PR #16).
2. `pnpm install`
3. **Copy `.env.local` from the old laptop** (AirDrop / 1Password / scp — never
   commit it; it's gitignored). It holds every secret: `DATABASE_URL`,
   `DIRECT_URL`, `NEXTAUTH_SECRET`, all `R2_*`, `RESEND_API_KEY`, `EMAIL_FROM`,
   `NUQOOD_*`, `OPENAI_API_KEY`, `AI_AGENT_TOKEN`, `CRON_SECRET`,
   `SALES_SUMMARY_RECIPIENTS`, etc. See `.env.example` for the full key list.
4. **Copy the Bumpa token file** — the sync scripts read the bearer token from
   the file at `$BUMPA_TOKEN_FILE` (kept outside the repo on purpose). Copy that
   file over and point `BUMPA_TOKEN_FILE` at its new path (set it in `.env.local`).
5. `pnpm exec prisma generate`
6. Sanity check: `pnpm exec tsc --noEmit` (should exit 0) and `pnpm dev`.

---

## 1. Current git state

- **Active branch:** `feat/substore-storefront-and-payment`
- **Remotes:** `origin` = `IbrahimDoba/avmall` (push here), `fork` = `Quillstash/avmall` (base `main`, auto-deploys to Vercel prod).
- **Flow:** commit → push `origin` branch → open cross-fork PR (head `IbrahimDoba:feat/...` → base `Quillstash:main`) → **the user merges** (never auto-merge). Cross-fork PRs show `UNSTABLE` mergeStateStatus — that's a harmless Vercel authorization gate, not a failure.
- **Open PR:** **#16** — product sales history + sales-summary emails + interactive revenue chart + Vercel cron. _Merge this to ship those features._
- **Merged recently:** #15 sales-channel, #14 Profit + Staff Analysis, #13 Business Overview, #12 AI Naira fix, #11 products table/AI tools.

---

## 2. Features shipped in this arc

| Feature | Where (route) | Key files |
|---|---|---|
| **Profit Analysis** tab | `/admin/ai` | `src/lib/data/profit.ts`, `src/app/(admin)/admin/ai/page.tsx`, `src/components/admin/profit-insights.tsx`, `src/app/api/v1/admin/reports/profit-insights/route.ts` |
| **Staff Analysis** tab | `/admin/staff-analysis` | `src/lib/data/staff-analysis.ts`, `src/app/(admin)/admin/staff-analysis/page.tsx` |
| **Sales channel** (purchase route) — set on create-order + register, editable on order detail | `/admin/orders/new`, `/admin/pos`, `/admin/orders/[number]` | `src/lib/order-source.ts` (single source of truth), `src/app/api/v1/admin/orders/[number]/source/route.ts`, `OrderSource` enum in `prisma/schema.prisma` (added `facebook`/`instagram`/`manual`) |
| **Product sales history** — when / how / who sold each unit | product page (`/admin/products/[slug]`) | `src/lib/data/product-history.ts`, `src/components/admin/product-sales-history.tsx` |
| **Sales-summary emails** (daily/weekly/monthly) | cron + Reports "Preview" | `src/lib/data/sales-summary.ts`, `src/lib/sales-summary-email.ts`, `src/lib/email-templates.ts` (`salesSummaryEmail`), `src/app/api/cron/sales-summary/route.ts`, `src/app/api/v1/admin/reports/email-summary/route.ts`, `src/components/admin/summary-email-tester.tsx` |
| **Interactive revenue chart** — hover tooltip + legend | dashboard + `/admin/reports/revenue` | `src/components/ui/charts.tsx` (`LineChart`) |

Money is always integer **kobo**. Order channels live in `src/lib/order-source.ts`.

---

## 3. Sales-summary emails — how they run

- **Recipients:** `SALES_SUMMARY_RECIPIENTS` env (currently `mubarakabdussalam7@gmail.com`). If unset → all active managers + super-admins. Comma-separate for several.
- **Schedule:** `vercel.json` → `crons` hits `GET /api/cron/sales-summary` daily at `0 5 * * *` (05:00 UTC = 06:00 WAT). The route self-selects: **daily** every run, **weekly** on Mondays, **monthly** on the 1st. Force one with `?period=daily|weekly|monthly` (or `all`).
- **Auth:** Vercel auto-sends `Authorization: Bearer $CRON_SECRET`; the route verifies it. **`CRON_SECRET` and `SALES_SUMMARY_RECIPIENTS` must be set in Vercel Production env** (dashboard) or the cron 503s.
- **Manual test:** Reports page → "Preview daily/weekly/monthly" (emails the caller only), or `curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/sales-summary?period=daily`.

---

## 4. Local sync scripts (`scripts/bumpa-*.ts`)

Run with `tsx --env-file=.env.local scripts/<name>.ts` and `BUMPA_TOKEN_FILE` set. Most are dry-run by default; pass `--live` to write.

- **`bumpa-import.ts`** — Bumpa → Avmall product importer (Main Store, published). Prices in kobo; overrides existing by slug; variant products skipped. `--live` to write.
- **`bumpa-stock-sync.ts`** — updates only each product's available stock (Bumpa `quantity` = stock − sold) and price. Only writes what changed. `--live`.
- **`bumpa-orders-import.ts`** — customers + orders importer, idempotent, orders tagged `BUMPA-<order_number>`. _Note: the imported orders/customers were later wiped in the "fresh start" pivot — this exists for re-sync if ever needed._
- **`bumpa-analytics-sync.ts`** — caches Bumpa's authoritative sales aggregates into `bumpa_sales_snapshots` (needs the `20260701120000_add_bumpa_sales_snapshot` migration).

**Running data-layer modules from a standalone script:** modules under `src/lib/**` start with `import "server-only"`, which isn't resolvable under plain `tsx`. To run one (e.g. to send a test summary email), create temporary no-op stubs and delete them after:
```bash
mkdir -p node_modules/server-only node_modules/client-only
printf '{"name":"server-only","main":"index.js"}' > node_modules/server-only/package.json
printf 'module.exports = {};' > node_modules/server-only/index.js
# (same two files for client-only)
tsx --env-file=.env.local scripts/your-script.ts
rm -rf node_modules/server-only node_modules/client-only
```
`@/` path aliases resolve fine under `tsx`.

---

## 5. Pending / follow-ups

- [ ] **Merge PR #16.**
- [ ] In **Vercel Production env**, set `CRON_SECRET` and `SALES_SUMMARY_RECIPIENTS`; confirm `RESEND_API_KEY` (emails) and `OPENAI_API_KEY` (Profit Analysis "Generate insights") are present.
- [ ] Optional: add the other cron routes (`/api/cron/expire-reservations`, `/api/cron/installment-reminders`) to `vercel.json` crons.
- [ ] ~56 Bumpa **variant** products still pending re-pull (variant products were skipped by the importer).
- [ ] The Bumpa snapshot dashboard (PR #13) shipped, but the imported orders/stats were wiped on the client's "start fresh" decision — only products remain live.

---

## 6. Conventions (don't relearn the hard way)

- **Never** reintroduce mock/DB-off fallbacks — app is real-DB-only (seed fixtures in `prisma/seed-data/`).
- Migrations are hand-authored timestamped folders; they apply in CI via `vercel.json`'s `prisma migrate deploy`. Never `prisma db push` in prod.
- Passing a **function** prop from a Server Component to a Client Component throws — pass pre-formatted strings/arrays instead (see `LineChart`'s `valueLabels`).
- `exactOptionalPropertyTypes` is on — spread optional props conditionally (`{...(cond ? { x } : {})}`), don't pass `undefined`.
- Local-only Bumpa scripts were historically excluded from commits; they're committed now specifically for the laptop move.
