import { listAdminOrders } from "@/lib/data/orders";
import { formatMoney } from "@/lib/money";
import { OrdersListClient } from "./orders-client";

export default async function AdminOrdersListPage() {
  const orders = await listAdminOrders();
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
