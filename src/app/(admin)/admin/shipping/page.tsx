import { listShippingZones, getFallbackShipping } from "@/lib/data/shipping";
import { ShippingClient } from "./shipping-client";

export const dynamic = "force-dynamic";

export default async function AdminShippingPage() {
  const [zones, fallback] = await Promise.all([
    listShippingZones(),
    getFallbackShipping(),
  ]);
  return <ShippingClient initialZones={zones} initialFallback={fallback} />;
}
