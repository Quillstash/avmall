/**
 * GET /api/v1/admin/products/export
 *   ?from=YYYY-MM-DD&to=YYYY-MM-DD   only products that SOLD in this window
 *   &q=&category=&stock=&image=      the products list's own filters
 *
 * One row per product: every field, the period sales columns, then each
 * product's image URLs (image_1 … image_N, N = the most any product has).
 * Money columns are plain Naira numbers (e.g. 4500.00) so spreadsheets treat
 * them as numeric and they import cleanly elsewhere. Permission: products.view.
 *
 * With a date range the file becomes a "what sold" report: only products with
 * sales in the window, plus units/revenue/orders for it. Without one it stays
 * the full catalogue dump it has always been — which is the file the bulk-stock
 * importer expects, hence the different filename stem for a ranged export.
 *
 * The sales columns are present either way (blank when there is no range): the
 * bulk-stock importer resolves columns by header NAME, so a header row whose
 * width shifts with the query string would be a trap for anyone scripting
 * against it.
 */

import { NextRequest } from "next/server";
import { db, hasDatabase } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { getActiveAdminStoreId } from "@/lib/store";
import { parseExportDateRange } from "@/lib/date-range";
import { getProductSalesInRange } from "@/lib/data/products";
import { stockStatusFor } from "@/lib/product-status";
import { toCsv, csvResponse, capRows, truncationRow } from "@/lib/csv";
import { handleApiError } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Higher than the shared EXPORT_ROW_CAP: this is a catalogue bound, not a
 * time-series one, so it doesn't grow with trading volume.
 */
const MAX_ROWS = 20000;

/** Kobo → plain Naira string (2dp), blank for null. Spreadsheet-numeric. */
const naira = (kobo: bigint | number | null | undefined) =>
  kobo == null ? "" : (Number(kobo) / 100).toFixed(2);

/** Public CDN URL for an R2 image key. */
function imageUrl(key: string): string {
  const base = env.R2_PUBLIC_URL?.replace(/\/+$/, "");
  return base ? `${base}/${key}` : key;
}

/** Split a comma-separated query param into a clean string array. */
function parseList(v: string | null): string[] {
  if (!v) return [];
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "products.view");

    if (!hasDatabase) {
      throw new AppError("DB_NOT_CONFIGURED", "Export requires DATABASE_URL.", 503);
    }

    const sp = req.nextUrl.searchParams;
    const range = parseExportDateRange(sp);
    const storeId = await getActiveAdminStoreId();

    const q = sp.get("q")?.trim() ?? "";
    const categorySlugs = parseList(sp.get("category"));
    const imageFilter = sp.get("image"); // "missing" | "has" | null
    const statusFilters = parseList(sp.get("stock"));
    const archivedSelected = statusFilters.includes("archived");
    const stockFilters = statusFilters.filter((s) => s !== "archived");

    // With a range, the catalogue is narrowed to whatever actually sold.
    const sales = range.active
      ? await getProductSalesInRange({ from: range.from, to: range.to, storeId })
      : null;
    const soldIds = sales ? [...sales.keys()] : null;

    if (soldIds && soldIds.length === 0) {
      // An empty `in` would match nothing, but an explicit note beats handing
      // back a bare header row that reads like a broken export.
      return csvResponse(
        `avmall-products-sold_${range.slug}.csv`,
        toCsv(["name"], [["No products sold in this period."]]),
      );
    }

    const where: Prisma.ProductWhereInput = {
      ...(storeId ? { storeId } : {}),
      ...(soldIds ? { id: { in: soldIds } } : {}),
      // Mirrors the list: archived products stay out unless explicitly asked for.
      ...(archivedSelected ? {} : { archivedAt: null }),
      ...(categorySlugs.length > 0
        ? {
            OR: [
              { category: { slug: { in: categorySlugs } } },
              { secondaryCategorySlugs: { hasSome: categorySlugs } },
            ],
          }
        : {}),
      ...(q
        ? {
            AND: [
              {
                OR: [
                  { name: { contains: q, mode: "insensitive" } },
                  { brand: { contains: q, mode: "insensitive" } },
                  { slug: { contains: q, mode: "insensitive" } },
                ],
              },
            ],
          }
        : {}),
      ...(imageFilter === "missing" ? { images: { none: {} } } : {}),
      ...(imageFilter === "has" ? { images: { some: {} } } : {}),
    };

    const found = await db.product.findMany({
      where,
      orderBy: [{ name: "asc" }],
      take: MAX_ROWS + 1,
      include: {
        category: { select: { name: true } },
        store: { select: { name: true } },
        variants: {
          where: { archivedAt: null },
          orderBy: { position: "asc" },
          select: { label: true, sku: true, storeStock: { select: { onHand: true } } },
        },
        images: {
          orderBy: [{ isPrimary: "desc" }, { position: "asc" }],
          select: { key: true },
        },
        bulkTiers: {
          orderBy: { min: "asc" },
          select: { min: true, max: true, type: true, value: true },
        },
      },
    });

    /** On-hand units, summed across variants — the same figure the list shows. */
    const stockOf = (p: (typeof found)[number]) =>
      p.variants.reduce((a, v) => a + v.storeStock.reduce((b, s) => b + s.onHand, 0), 0);

    // The cap is judged on the raw query, before the in-memory availability
    // filter — otherwise a narrow filter over an over-cap catalogue would look
    // complete while rows had silently been dropped by the `take`.
    const { rows: capped, truncated } = capRows(found, MAX_ROWS);

    // Availability is derived from summed variant stock, so it can't be a SQL
    // predicate — it's applied here, using the list's own classifier.
    const products =
      stockFilters.length > 0
        ? capped.filter((p) =>
            stockFilters.includes(
              stockStatusFor({ preorder: p.preorder, stock: stockOf(p) }),
            ),
          )
        : capped;

    // Widen the image columns to whatever the most-photographed product needs.
    const maxImages = products.reduce((m, p) => Math.max(m, p.images.length), 0);
    const imageHeaders = Array.from({ length: maxImages }, (_, i) => `image_${i + 1}`);

    const headers = [
      "name", "brand", "category", "store", "slug",
      "short_description", "long_description",
      "price_naira", "sale_price_naira", "on_sale", "cost_price_naira",
      "stock", "variant_count", "variants", "skus",
      "bulk_tiers", "negotiable", "preorder", "min_order_qty", "eta", "featured",
      "status", "archived", "tags", "created_at", "product_id",
      // Blank without a date range. Kept ahead of the variable-width image
      // block so image_N stays last and the padding below still lines up.
      "units_sold_period", "revenue_period_naira", "orders_period",
      ...imageHeaders,
    ];

    const dateFmt = new Intl.DateTimeFormat("en-NG", {
      year: "numeric", month: "short", day: "numeric", timeZone: "Africa/Lagos",
    });

    const rows: (string | number)[][] = products.map((p) => {
      const stock = stockOf(p);
      const s = sales?.get(p.id);
      const variantLabels = p.variants
        .map((v) => v.label)
        .filter((l) => l && l !== "Default")
        .join(" | ");
      const skus = p.variants.map((v) => v.sku).filter(Boolean).join(" | ");
      const tiers = p.bulkTiers
        .map((t) => {
          const range = t.max != null ? `${t.min}-${t.max}` : `${t.min}+`;
          const off = t.type === "percentage" ? `${t.value}%` : `₦${(t.value / 100).toFixed(2)}`;
          return `${range}: ${off}`;
        })
        .join(" | ");
      const imgs = p.images.map((im) => imageUrl(im.key));

      return [
        p.name,
        p.brand,
        p.category?.name ?? "",
        p.store?.name ?? "",
        p.slug,
        p.shortDesc,
        p.longDesc,
        naira(p.priceKobo),
        p.saleActive && p.saleKobo != null ? naira(p.saleKobo) : "",
        p.saleActive ? "Yes" : "No",
        naira(p.costPriceKobo),
        stock,
        p.variants.length,
        variantLabels,
        skus,
        tiers,
        p.negotiate ? "Yes" : "No",
        p.preorder ? "Yes" : "No",
        p.moq ?? "",
        p.eta ?? "",
        p.featured ? "Yes" : "No",
        p.published ? "Published" : "Draft",
        p.archivedAt ? "Yes" : "No",
        p.tags.join("; "),
        dateFmt.format(p.createdAt),
        p.id,
        s ? s.unitsSold : "",
        s ? naira(s.revenueKobo) : "",
        s ? s.ordersCount : "",
        // Pad the image columns so every row has the same width.
        ...imgs,
        ...Array<string>(maxImages - imgs.length).fill(""),
      ];
    });

    if (truncated) rows.push(truncationRow(MAX_ROWS, headers.length));

    // A ranged export is a sales report, not the catalogue file that Import
    // stock round-trips — the filename says which one you're holding.
    if (range.active) {
      return csvResponse(`avmall-products-sold_${range.slug}.csv`, toCsv(headers, rows));
    }
    const stamp = dateFmt.format(new Date()).replace(/\s+/g, "-");
    return csvResponse(`avmall-products-${stamp}.csv`, toCsv(headers, rows));
  } catch (err) {
    return handleApiError(err);
  }
}
