import {
  listShippingZones,
  getFallbackShipping,
  listCouriers,
} from "@/lib/data/shipping";
import { ShippingClient } from "./shipping-client";

export const dynamic = "force-dynamic";

export default async function AdminShippingPage() {
  const [zones, fallback, couriers] = await Promise.all([
    listShippingZones(),
    getFallbackShipping(),
    listCouriers(),
  ]);
  return (
    <ShippingClient
      initialZones={zones}
      initialFallback={fallback}
      initialCouriers={couriers}
    />
  );
}
