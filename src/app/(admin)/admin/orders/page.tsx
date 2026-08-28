import { listAdminOrdersPage } from "@/lib/data/orders";
import { getActiveAdminStoreId } from "@/lib/store";
import { parseExportDateRange } from "@/lib/date-range";
import { OrdersListClient, PAGE_SIZES } from "./orders-client";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = PAGE_SIZES[0];

/** Split a comma-separated query param into a clean string array. */
function parseList(v: string | undefined): string[] {
  if (!v) return [];
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * Rows per page from `?size=`, validated against the offered set so a
 * hand-edited URL can't ask for an unbounded page. (The data layer clamps at
 * 100 too, but rejecting here keeps the pager's arithmetic honest.)
 */
function parsePageSize(v: string | undefined): number {
  const n = Number(v);
  return (PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
}

export default async function AdminOrdersListPage({
  searchParams,
}: {
  searchParams: {
    page?: string;
    size?: string;
    status?: string;
    payment?: string;
    source?: string;
    q?: string;
    from?: string;
    to?: string;
  };
}) {
  const storeId = await getActiveAdminStoreId();

  const pageSize = parsePageSize(searchParams.size);
  const page = Math.max(1, Number(searchParams.page) || 1);
  const status = searchParams.status ?? "all";
  const payment = parseList(searchParams.payment);
  const source = parseList(searchParams.source);
  const search = searchParams.q?.trim() ?? "";
  // The same window the CSV export uses, so the button and the list agree.
  const range = parseExportDateRange(
    new URLSearchParams({
      ...(searchParams.from ? { from: searchParams.from } : {}),
      ...(searchParams.to ? { to: searchParams.to } : {}),
    }),
  );

  const { rows, total, statusCounts, allCount } = await listAdminOrdersPage({
    storeId,
    page,
    pageSize,
    status,
    payment,
    source,
    search,
    from: range.from,
    to: range.to,
  });

  return (
    <OrdersListClient
      orders={rows}
      total={total}
      page={page}
      pageSize={pageSize}
      statusCounts={statusCounts}
      allCount={allCount}
      filters={{ status, payment, source, search, from: range.fromYmd, to: range.toYmd }}
    />
  );
}
