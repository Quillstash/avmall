/**
 * GET /api/v1/admin/profit/export?range=<7|30|90>|from=<ISO>&to=<ISO>
 *
 * The Profit Analysis screen as a downloadable CSV: the full P&L chain, the
 * expense breakdown by type, per-product and per-category profit, and the
 * inventory snapshot — for the same date range shown on screen.
 *
 * Money columns are plain Naira (e.g. 4500.00) so spreadsheets treat them as
 * numeric. Permission: reports.export.
 */

import { NextRequest } from "next/server";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { getProfitAnalysis } from "@/lib/data/profit";
import { resolveRevenueRange, revenueReportArg } from "@/lib/data/reports";
import { getActiveAdminStoreId } from "@/lib/store";
import { toCsv, csvResponse } from "@/lib/csv";
import { handleApiError } from "@/lib/api-response";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Kobo → plain Naira string (2dp) for spreadsheet-numeric columns. */
const naira = (kobo: number) => (kobo / 100).toFixed(2);

export async function GET(req: NextRequest) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "reports.export");

    const sp: { range?: string; from?: string; to?: string } = {};
    const rangeParam = req.nextUrl.searchParams.get("range");
    const fromParam = req.nextUrl.searchParams.get("from");
    const toParam = req.nextUrl.searchParams.get("to");
    if (rangeParam) sp.range = rangeParam;
    if (fromParam) sp.from = fromParam;
    if (toParam) sp.to = toParam;
    const resolved = resolveRevenueRange(sp);
    const storeId = await getActiveAdminStoreId();
    const a = await getProfitAnalysis(revenueReportArg(resolved), storeId);

    const expensesTotal = a.expenseBreakdown.reduce((s, e) => s + e.amountKobo, 0);
    const productCols = ["Product", "Units", "Revenue (NGN)", "Cost (NGN)", "Profit (NGN)", "Margin %"];
    const productRow = (p: (typeof a.topProducts)[number]) => [
      p.name,
      p.unitsSold,
      naira(p.revenueKobo),
      naira(p.costKobo),
      naira(p.profitKobo),
      p.marginPct == null ? "" : p.marginPct.toFixed(1),
    ];

    // Multi-section report: a title line, then a CSV block, per section.
    const sections: string[] = [
      "Profit Analysis",
      `Period,${a.from} to ${a.to}`,
      "",
      "Profit & Loss",
      toCsv(
        ["Metric", "Amount (NGN)"],
        [
          ["Gross sales", naira(a.grossSalesKobo)],
          ["Discounts given", naira(-a.discountKobo)],
          ["Net revenue", naira(a.netRevenueKobo)],
          ["Cost of goods sold", naira(-a.cogsKobo)],
          ["Gross profit", naira(a.grossProfitKobo)],
          ["Operating expenses", naira(-a.expensesKobo)],
          ["Net profit", naira(a.netProfitKobo)],
          ["Margin %", a.marginPct == null ? "" : a.marginPct.toFixed(1)],
          ["Orders", a.ordersCount],
          ["Units sold", a.unitsSold],
        ],
      ).trimEnd(),
      "",
      "Expenses by type",
      toCsv(
        ["Expense type", "Amount (NGN)"],
        [
          ...a.expenseBreakdown.map((e) => [e.type, naira(e.amountKobo)]),
          ["Total expenses", naira(expensesTotal)],
        ],
      ).trimEnd(),
      "",
      "Most profitable products",
      toCsv(productCols, a.topProducts.map(productRow)).trimEnd(),
    ];

    if (a.lossProducts.length > 0) {
      sections.push(
        "",
        "Loss-making products (sold below cost)",
        toCsv(productCols, a.lossProducts.map(productRow)).trimEnd(),
      );
    }

    sections.push(
      "",
      "Profit by category",
      toCsv(
        ["Category", "Units", "Revenue (NGN)", "Profit (NGN)"],
        a.byCategory.map((c) => [c.category, c.unitsSold, naira(c.revenueKobo), naira(c.profitKobo)]),
      ).trimEnd(),
      "",
      "Inventory snapshot",
      toCsv(
        ["Metric", "Value"],
        [
          ["Inventory cost value (NGN)", naira(a.inventory.costKobo)],
          ["Inventory retail value (NGN)", naira(a.inventory.retailKobo)],
          ["Low stock (SKUs)", a.inventory.lowStock],
          ["Out of stock (SKUs)", a.inventory.outOfStock],
          ["Dead stock (unsold this period)", a.inventory.deadStock],
        ],
      ).trimEnd(),
    );

    const body = sections.join("\r\n") + "\r\n";
    // Date part only: `a.from`/`a.to` are full ISO strings, and csvResponse's
    // sanitiser turns their colons into underscores (`2026-08-01T00_00_00...`).
    return csvResponse(
      `profit-analysis_${a.from.slice(0, 10)}_to_${a.to.slice(0, 10)}.csv`,
      body,
    );
  } catch (err) {
    return handleApiError(err);
  }
}
