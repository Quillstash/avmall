import { notFound } from "next/navigation";
import { db, hasDatabase } from "@/lib/db";
import { EditZoneClient } from "./edit-zone-client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { id: string };
}

export default async function AdminEditShippingZonePage({ params }: PageProps) {
  if (!hasDatabase) notFound();
  const zone = await db.shippingZone.findUnique({ where: { id: params.id } });
  if (!zone) notFound();

  return (
    <EditZoneClient
      zone={{
        id: zone.id,
        name: zone.name,
        states: zone.states,
        baseRateKobo: Number(zone.baseRateKobo),
        freeOverKobo: zone.freeOverKobo == null ? null : Number(zone.freeOverKobo),
        etaDays: zone.etaDays,
        active: zone.active,
      }}
    />
  );
}
