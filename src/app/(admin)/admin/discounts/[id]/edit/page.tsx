import { notFound } from "next/navigation";
import { db, hasDatabase } from "@/lib/db";
import { EditDiscountClient } from "./edit-discount-client";

export const dynamic = "force-dynamic";

export default async function EditDiscountPage({
  params,
}: {
  params: { id: string };
}) {
  if (!hasDatabase) notFound();
  const d = await db.discount.findUnique({ where: { id: params.id } });
  if (!d) notFound();

  return (
    <EditDiscountClient
      discount={{
        id: d.id,
        kind: d.kind,
        code: d.code,
        name: d.name,
        valueType: d.valueType,
        value: d.value,
        scope: d.scope,
        usage: d.usage,
        usageLimit: d.usageLimit,
        validFrom: d.validFrom?.toISOString() ?? null,
        validUntil: d.validUntil?.toISOString() ?? null,
        active: d.active,
        // Locked once redeemed — value/scope/code/name/type become immutable.
        locked: d.locked || d.usage > 0,
      }}
    />
  );
}
