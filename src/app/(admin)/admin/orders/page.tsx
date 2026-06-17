import { listAdminOrders } from "@/lib/data/orders";
import { getActiveAdminStoreId } from "@/lib/store";
import { formatMoney } from "@/lib/money";
import { OrdersListClient } from "./orders-client";

export const dynamic = "force-dynamic";

export default async function AdminOrdersListPage() {
  const storeId = await getActiveAdminStoreId();
  const orders = await listAdminOrders(storeId);
  const weekRevenue = orders.reduce((a, o) => a + o.totalKobo, 0);

  return (
    <OrdersListClient
      orders={orders}
      totals={{
        weekCount: orders.length,
        weekRevenueLabel: formatMoney(weekRevenue),
      }}
    />
  );
}
