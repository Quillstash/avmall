import { notFound, redirect } from "next/navigation";
import { db, hasDatabase } from "@/lib/db";
import { getCustomerSession } from "@/lib/customer-session";
import { ReturnRequestForm } from "./return-form";

export const dynamic = "force-dynamic";

const RETURN_WINDOW_DAYS = 14;

export default async function RequestReturnPage({
  params,
}: {
  params: { number: string };
}) {
  const session = await getCustomerSession();
  if (!session) {
    redirect(`/login?next=/account/orders/${params.number}/return`);
  }
  if (!hasDatabase) notFound();

  const order = await db.order.findUnique({
    where: { number: params.number },
    include: {
      lines: true,
      returns: { include: { lines: true } },
    },
  });
  if (!order || order.customerId !== session.customerId) notFound();

  // Gate: must be delivered + inside window. We redirect back to the orders
  // list with a flag rather than render an unusable form.
  if (order.status !== "delivered" || !order.deliveredAt) {
    redirect("/account/orders?return=not-delivered");
  }
  const windowEnds = new Date(
    order.deliveredAt.getTime() + RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );
  if (new Date() > windowEnds) {
    redirect("/account/orders?return=outside-window");
  }

  // Compute returnable qty per line (subtract pending + approved returns).
  const alreadyReturned = new Map<string, number>();
  for (const r of order.returns) {
    if (r.status === "rejected") continue;
    for (const rl of r.lines) {
      alreadyReturned.set(
        rl.orderLineId,
        (alreadyReturned.get(rl.orderLineId) ?? 0) + rl.quantity,
      );
    }
  }

  const eligibleLines = order.lines
    .map((l) => ({
      id: l.id,
      name: l.nameSnapshot,
      variant: l.variantSnapshot,
      unitKobo: Number(l.unitKobo),
      totalQty: l.quantity,
      remaining: l.quantity - (alreadyReturned.get(l.id) ?? 0),
    }))
    .filter((l) => l.remaining > 0);

  if (eligibleLines.length === 0) {
    redirect("/account/orders?return=already-returned");
  }

  return (
    <ReturnRequestForm
      orderNumber={order.number}
      windowEndsAt={windowEnds.toISOString()}
      lines={eligibleLines}
    />
  );
}
