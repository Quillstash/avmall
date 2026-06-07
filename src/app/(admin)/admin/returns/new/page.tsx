import { db, hasDatabase } from "@/lib/db";
import { NewReturnClient, type LoadedOrder } from "./new-return-client";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: { order?: string };
}

async function loadOrder(number: string): Promise<LoadedOrder | { error: string }> {
  if (!hasDatabase) {
    return { error: "Database not configured — manual returns require a live DB." };
  }
  const order = await db.order.findUnique({
    where: { number },
    include: {
      customer: { select: { name: true, phone: true, blacklisted: true } },
      lines: {
        include: { returnLines: { select: { quantity: true } } },
      },
    },
  });
  if (!order) return { error: `No order found with number "${number}".` };

  return {
    number: order.number,
    createdAt: order.createdAt.toISOString(),
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
    // Guest / walk-in / POS orders have no linked customer; the form captures
    // one so the return can still be recorded.
    hasCustomer: !!order.customerId,
    customer: {
      name: order.customer?.name ?? order.shipName,
      phone: order.customer?.phone ?? order.shipPhone,
      blacklisted: !!order.customer?.blacklisted,
    },
    lines: order.lines.map((l) => ({
      id: l.id,
      name: l.nameSnapshot,
      variant: l.variantSnapshot,
      sku: l.skuSnapshot,
      quantity: l.quantity,
      alreadyReturned: l.returnLines.reduce((a, r) => a + r.quantity, 0),
      unitKobo: Number(l.unitKobo),
    })),
  };
}

export default async function AdminNewReturnPage({ searchParams }: PageProps) {
  const initialNumber = searchParams.order?.trim() ?? "";
  const initialOrder = initialNumber ? await loadOrder(initialNumber) : null;

  return (
    <NewReturnClient
      initialNumber={initialNumber}
      {...(initialOrder && "error" in initialOrder
        ? { initialError: initialOrder.error }
        : initialOrder
          ? { initialOrder }
          : {})}
    />
  );
}
