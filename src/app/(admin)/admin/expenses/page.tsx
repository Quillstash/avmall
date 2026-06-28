import { getActiveAdminStoreId } from "@/lib/store";
import {
  listExpenses,
  listExpenseTypes,
  getExpenseSummary,
} from "@/lib/data/expenses";
import { ExpensesClient } from "./expenses-client";

export const dynamic = "force-dynamic";

/** Resolve the ?range= filter into a UTC date window + label. */
function resolveRange(key: string | undefined): {
  from: Date;
  to: Date;
  label: string;
  key: string;
} {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  switch (key) {
    case "last_month":
      return {
        from: new Date(Date.UTC(y, m - 1, 1)),
        to: new Date(Date.UTC(y, m, 1) - 1),
        label: "Last month",
        key: "last_month",
      };
    case "this_year":
      return {
        from: new Date(Date.UTC(y, 0, 1)),
        to: now,
        label: "This year",
        key: "this_year",
      };
    case "all":
      return { from: new Date(0), to: now, label: "All time", key: "all" };
    case "this_month":
    default:
      return {
        from: new Date(Date.UTC(y, m, 1)),
        to: now,
        label: "This month",
        key: "this_month",
      };
  }
}

export default async function AdminExpensesPage({
  searchParams,
}: {
  searchParams: { range?: string };
}) {
  const storeId = await getActiveAdminStoreId();
  const range = resolveRange(searchParams.range);

  const [types, expenses, summary] = await Promise.all([
    listExpenseTypes(storeId),
    listExpenses(storeId, range),
    getExpenseSummary(storeId, range),
  ]);

  // Today in WAT (yyyy-mm-dd) for the date-input default.
  const todayISO = new Date().toLocaleDateString("en-CA", {
    timeZone: "Africa/Lagos",
  });

  return (
    <ExpensesClient
      types={types}
      expenses={expenses}
      summary={summary}
      rangeKey={range.key}
      rangeLabel={range.label}
      todayISO={todayISO}
    />
  );
}
