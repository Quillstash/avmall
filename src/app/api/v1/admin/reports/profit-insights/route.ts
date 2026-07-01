/**
 * POST /api/v1/admin/reports/profit-insights
 *
 * Runs the profit analysis for the requested range, hands the P&L + stock
 * summary to the LLM, and returns AI-generated insight/advice. On-demand (the
 * page fetches this when staff click "Generate insights") — not on every load.
 *
 * Permission: reports.view
 */
import { NextRequest, NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { getActiveAdminStoreId } from "@/lib/store";
import { getProfitAnalysis } from "@/lib/data/profit";
import { openaiChatJSON, hasOpenAI } from "@/lib/openai";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "reports.view");
    if (!hasOpenAI) {
      throw new AppError("AI_NOT_CONFIGURED", "AI insights need OPENAI_API_KEY set.", 503);
    }

    const body = (await req.json().catch(() => ({}))) as { range?: number; from?: string; to?: string };
    const range =
      body.from && body.to
        ? { from: new Date(`${body.from}T00:00:00`), to: new Date(`${body.to}T23:59:59.999`) }
        : Number(body.range) || 30;

    const storeId = await getActiveAdminStoreId();
    const a = await getProfitAnalysis(range, storeId);
    const n = (k: number) => "₦" + Math.round(k / 100).toLocaleString("en-NG");

    const summary = {
      period: `${a.from.slice(0, 10)} to ${a.to.slice(0, 10)}`,
      orders: a.ordersCount,
      unitsSold: a.unitsSold,
      grossSales: n(a.grossSalesKobo),
      discountsGiven: n(a.discountKobo),
      netRevenue: n(a.netRevenueKobo),
      costOfGoodsSold: n(a.cogsKobo),
      grossProfit: n(a.grossProfitKobo),
      operatingExpenses: n(a.expensesKobo),
      netProfit: n(a.netProfitKobo),
      netMarginPct: a.marginPct == null ? null : Math.round(a.marginPct * 10) / 10,
      profitIfNoDiscountsGiven: n(a.profitBeforeDiscountKobo),
      topProfitProducts: a.topProducts.slice(0, 6).map((p) => ({ name: p.name, units: p.unitsSold, profit: n(p.profitKobo), marginPct: p.marginPct == null ? null : Math.round(p.marginPct) })),
      lossMakingProducts: a.lossProducts.slice(0, 6).map((p) => ({ name: p.name, units: p.unitsSold, loss: n(p.profitKobo) })),
      byCategory: a.byCategory.slice(0, 8).map((c) => ({ category: c.category, profit: n(c.profitKobo), revenue: n(c.revenueKobo), units: c.unitsSold })),
      expenseBreakdown: a.expenseBreakdown.map((e) => ({ type: e.type, amount: n(e.amountKobo) })),
      inventory: {
        costValue: n(a.inventory.costKobo),
        retailValue: n(a.inventory.retailKobo),
        lowStockProducts: a.inventory.lowStock,
        outOfStockProducts: a.inventory.outOfStock,
        deadStockProducts: a.inventory.deadStock,
      },
    };

    const result = await openaiChatJSON({
      model: "gpt-4o-mini",
      system:
        "You are a sharp retail financial analyst for a Nigerian e-commerce store (all money is Naira, ₦). " +
        "Analyse the P&L and stock data and give concise, SPECIFIC, actionable analysis — cite the real numbers " +
        "and product/category names from the data. Pay attention to: discounts eating into margin, dead/low stock " +
        "tying up cash, loss-making SKUs sold below cost, expense drag on net profit, and where margin is strong. " +
        'Respond ONLY as JSON with this shape: {"summary": string (2-3 sentence headline), ' +
        '"insights": string[] (4-6 findings), "advice": string[] (4-6 concrete recommendations), ' +
        '"risks": string[] (2-4 watch-outs)}.',
      user: JSON.stringify(summary),
    });

    return NextResponse.json(apiSuccess({ insights: result, period: summary.period }));
  } catch (err) {
    return handleApiError(err);
  }
}
