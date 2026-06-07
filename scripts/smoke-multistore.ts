/**
 * Throwaway integration smoke test for the multi-store stock engine.
 * Runs everything inside a transaction that is rolled back at the end, so it
 * mutates nothing. Verifies: per-store reserve/consume math, store isolation,
 * "not stocked at this store" error, and over-reservation error.
 *
 *   pnpm exec dotenv -e .env.local -- tsx scripts/smoke-multistore.ts
 */
import { PrismaClient } from "@prisma/client";
import { reserveStock, consumeReservations } from "../src/lib/stock";

const db = new PrismaClient();

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("ASSERT FAILED: " + msg);
  console.log("  ✓ " + msg);
}

async function main() {
  const mainStore = await db.store.findFirst({ where: { isMain: true } });
  if (!mainStore) throw new Error("No main store found");
  console.log(`Main store: ${mainStore.name} (${mainStore.id})`);

  // Pick a clean variant: stocked at Main, reserved=0, no active reservation,
  // so the lazy expire-sweep inside reserveStock can't perturb our numbers.
  const candidates = await db.storeStock.findMany({
    where: { storeId: mainStore.id, onHand: { gte: 3 }, reserved: 0 },
    include: { variant: true },
    take: 50,
  });
  let chosen: (typeof candidates)[number] | null = null;
  for (const c of candidates) {
    const active = await db.stockReservation.count({
      where: { variantId: c.variantId, status: "active" },
    });
    if (active === 0) {
      chosen = c;
      break;
    }
  }
  if (!chosen) throw new Error("No clean test variant available");
  const variantId = chosen.variantId;
  const productId = chosen.variant.productId;
  console.log(`Test variant ${variantId} — onHand ${chosen.onHand}, reserved ${chosen.reserved}`);

  const orig = await db.storeStock.findUniqueOrThrow({
    where: { storeId_variantId: { storeId: mainStore.id, variantId } },
  });

  let passed = true;
  try {
    await db.$transaction(async (tx) => {
      const before = await tx.storeStock.findUniqueOrThrow({
        where: { storeId_variantId: { storeId: mainStore.id, variantId } },
      });

      console.log("\n[1] reserve 2 at Main");
      const res = await reserveStock(
        tx,
        mainStore.id,
        [{ productId, variantId, quantity: 2 }],
        null,
      );
      assert(res.length === 1, "reserveStock created 1 reservation");
      const afterReserve = await tx.storeStock.findUniqueOrThrow({
        where: { storeId_variantId: { storeId: mainStore.id, variantId } },
      });
      assert(afterReserve.reserved === before.reserved + 2, "reserved +2");
      assert(afterReserve.onHand === before.onHand, "onHand unchanged by reserve");

      console.log("\n[2] consume the reservation");
      await consumeReservations(tx, [res[0]!.reservationId]);
      const afterConsume = await tx.storeStock.findUniqueOrThrow({
        where: { storeId_variantId: { storeId: mainStore.id, variantId } },
      });
      assert(afterConsume.onHand === before.onHand - 2, "onHand -2 after consume");
      assert(afterConsume.reserved === before.reserved, "reserved freed after consume");

      console.log("\n[3] store isolation — a second store's shelf is untouched");
      const tmp = await tx.store.create({
        data: { name: "SMOKE TEST STORE", slug: "tmp-smoke-store", active: true },
      });
      await tx.storeStock.create({
        data: { storeId: tmp.id, variantId, onHand: 5, reserved: 0 },
      });
      await reserveStock(tx, mainStore.id, [{ productId, variantId, quantity: 1 }], null);
      const tmpRow = await tx.storeStock.findUniqueOrThrow({
        where: { storeId_variantId: { storeId: tmp.id, variantId } },
      });
      assert(
        tmpRow.onHand === 5 && tmpRow.reserved === 0,
        "other store's stock unaffected by a Main reservation",
      );

      console.log("\n[4] reserving a variant not stocked at a store throws");
      const otherVar = await tx.productVariant.findFirst({
        where: { id: { not: variantId } },
      });
      let threwNotStocked = false;
      if (otherVar) {
        try {
          await reserveStock(
            tx,
            tmp.id,
            [{ productId: otherVar.productId, variantId: otherVar.id, quantity: 1 }],
            null,
          );
        } catch {
          threwNotStocked = true;
        }
        assert(threwNotStocked, "StockUnavailable when variant has no row at store");
      }

      console.log("\n[5] over-reserving beyond available throws");
      let threwOver = false;
      try {
        await reserveStock(tx, mainStore.id, [{ productId, variantId, quantity: 999999 }], null);
      } catch {
        threwOver = true;
      }
      assert(threwOver, "StockUnavailable when requesting more than available");

      throw new Error("__ROLLBACK__");
    }, { timeout: 30_000, maxWait: 15_000 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg !== "__ROLLBACK__") {
      passed = false;
      console.error("\n✗ " + msg);
    }
  }

  console.log("\n[6] verify rollback — nothing persisted");
  const after = await db.storeStock.findUniqueOrThrow({
    where: { storeId_variantId: { storeId: mainStore.id, variantId } },
  });
  assert(
    after.onHand === orig.onHand && after.reserved === orig.reserved,
    "Main stock identical on disk (transaction rolled back)",
  );
  const leaked = await db.store.findUnique({ where: { slug: "tmp-smoke-store" } });
  assert(leaked === null, "temp store not persisted");

  console.log(passed ? "\nALL SMOKE TESTS PASSED ✅" : "\nSMOKE TESTS FAILED ❌");
  await db.$disconnect();
  if (!passed) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
