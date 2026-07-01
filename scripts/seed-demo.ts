/**
 * Demo-data seeder — fills the admin with a small, realistic dataset so every
 * screen has something to exercise (CRUD + role / order-state restrictions).
 *
 *   Seed:   npx dotenv -e .env.local -- npx tsx scripts/seed-demo.ts
 *   Wipe:   npx dotenv -e .env.local -- npx tsx scripts/seed-demo.ts --clean
 *
 * IDEMPOTENT: every run first removes what a previous run created, then
 * re-inserts fresh — it never piles up duplicates.
 *
 * Touches ONLY this (your real products / stores / staff are left alone):
 *   • customers tagged with the "demo" segment        (+ their addresses)
 *   • orders + lines + payments for those customers
 *   • returns for the delivered demo orders
 *   • expense types named in DEMO_EXPENSE_TYPES        (+ their expenses)
 *   • one pending staff invitation to DEMO_INVITE_EMAIL
 *
 * Cleanup keys off those markers, so hand-entered data survives — EXCEPT
 * expenses filed under a demo expense-type name, which a re-run clears. We'll
 * delete all of this before launch anyway.
 *
 * NOTE: orders are written directly; stock is intentionally NOT reserved or
 * decremented — this is admin-UI test data, not a real checkout.
 */

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_SEGMENT = "demo";
const DEMO_INVITE_EMAIL = "demo.invitee@example.com";
const DEMO_EXPENSE_TYPES = [
  "Rent",
  "Utilities",
  "Staff salaries",
  "Logistics & delivery",
  "Marketing",
  "Packaging",
];

const k = (naira: number): bigint => BigInt(Math.round(naira * 100));
const daysAgo = (n: number): Date => new Date(Date.now() - n * 86_400_000);

// ── Customers ───────────────────────────────────────────────────────────────
interface DemoCustomer {
  slot: number; // unique-per-store phone offset
  name: string;
  email: string | null;
  segments: string[];
  addr: { line1: string; city: string; state: string } | null;
  blacklisted?: boolean;
  blacklistReason?: string;
}
const CUSTOMERS: DemoCustomer[] = [
  { slot: 1, name: "Chidinma Okeke", email: "chidinma.okeke@example.com", segments: ["vip"], addr: { line1: "14 Allen Avenue", city: "Ikeja", state: "Lagos" } },
  { slot: 2, name: "Tunde Bakare", email: "tunde.bakare@example.com", segments: [], addr: { line1: "3 Admiralty Way", city: "Lekki", state: "Lagos" } },
  { slot: 3, name: "Aisha Mohammed", email: "aisha.mohammed@example.com", segments: ["wholesale"], addr: { line1: "22 Aminu Kano Crescent", city: "Wuse", state: "FCT" } },
  { slot: 4, name: "Emeka Nwosu", email: "emeka.nwosu@example.com", segments: [], addr: null },
  { slot: 5, name: "Funke Adeyemi", email: "funke.adeyemi@example.com", segments: ["vip", "wholesale"], addr: { line1: "9 Ring Road", city: "Ibadan North", state: "Oyo" } },
  { slot: 6, name: "Bola Ahmed", email: null, segments: [], addr: null }, // OTP-only, no email
  { slot: 7, name: "Ngozi Eze", email: "ngozi.eze@example.com", segments: [], addr: { line1: "5 Aba Road", city: "Port Harcourt", state: "Rivers" }, blacklisted: true, blacklistReason: "Repeated chargebacks" },
];

// ── Orders ──────────────────────────────────────────────────────────────────
// A spread across every status / payment state / channel so the orders list,
// filters, order detail, returns and the dashboard all have something to show.
interface Spec {
  status: "delivered" | "shipped" | "processing" | "confirmed" | "pending" | "cancelled";
  payment: "paid" | "partial" | "unpaid";
  source: "web" | "whatsapp" | "phone" | "walkin" | "ai";
  lines: number;
  ageDays: number;
  manualDiscount?: number; // naira
  overpay?: number; // naira paid above total — exercises the credit/refund case
  withReturn?: "requested" | "approved" | "received";
}
const ORDER_SPECS: Spec[] = [
  { status: "delivered", payment: "paid", source: "web", lines: 2, ageDays: 32, withReturn: "requested" },
  { status: "delivered", payment: "paid", source: "walkin", lines: 1, ageDays: 28 },
  { status: "delivered", payment: "paid", source: "ai", lines: 1, ageDays: 21, overpay: 5000, withReturn: "received" },
  { status: "shipped", payment: "paid", source: "web", lines: 2, ageDays: 9 },
  { status: "processing", payment: "partial", source: "whatsapp", lines: 1, ageDays: 6 },
  { status: "confirmed", payment: "paid", source: "phone", lines: 3, ageDays: 4, manualDiscount: 2000 },
  { status: "pending", payment: "unpaid", source: "web", lines: 1, ageDays: 2 }, // lands on the blacklisted customer → tests the lock
  { status: "cancelled", payment: "unpaid", source: "web", lines: 2, ageDays: 1 },
];

const methodFor = (source: Spec["source"]): "nuqood" | "bank_transfer" | "pos" | "cash" =>
  source === "walkin" ? "pos" : source === "phone" || source === "whatsapp" ? "bank_transfer" : "nuqood";

const phone = (storeIndex: number, slot: number): string =>
  `+23480${String(storeIndex * 1000 + slot).padStart(8, "0")}`;

async function nextOrderNumber(year: number): Promise<string> {
  const seq = `order_number_${year}`;
  await prisma.$executeRawUnsafe(`CREATE SEQUENCE IF NOT EXISTS "${seq}"`);
  const rows = await prisma.$queryRawUnsafe<{ nextval: bigint }[]>(
    `SELECT nextval('"${seq}"') AS nextval`,
  );
  return `AVM-${year}-${String(Number(rows[0]!.nextval)).padStart(8, "0")}`;
}

async function cleanDemo(storeIds: string[]): Promise<void> {
  const demo = await prisma.customer.findMany({
    where: { segments: { has: DEMO_SEGMENT } },
    select: { id: true },
  });
  const cids = demo.map((c) => c.id);
  if (cids.length) {
    await prisma.return.deleteMany({ where: { customerId: { in: cids } } });
    await prisma.order.deleteMany({ where: { customerId: { in: cids } } });
    await prisma.customerAddress.deleteMany({ where: { customerId: { in: cids } } });
    await prisma.customer.deleteMany({ where: { id: { in: cids } } });
  }
  const types = await prisma.expenseType.findMany({
    where: { storeId: { in: storeIds }, name: { in: DEMO_EXPENSE_TYPES } },
    select: { id: true },
  });
  const tids = types.map((t) => t.id);
  if (tids.length) {
    await prisma.expense.deleteMany({ where: { typeId: { in: tids } } });
    await prisma.expenseType.deleteMany({ where: { id: { in: tids } } });
  }
  await prisma.staffInvitation.deleteMany({ where: { email: DEMO_INVITE_EMAIL } });
}

interface Priced {
  productId: string;
  variantId: string;
  name: string;
  sku: string;
  label: string;
  unitKobo: bigint;
}
async function pricedProducts(storeId: string): Promise<Priced[]> {
  const products = await prisma.product.findMany({
    where: { storeId, published: true, archivedAt: null },
    include: { variants: { where: { archivedAt: null }, orderBy: { position: "asc" }, take: 1 } },
    take: 12,
  });
  const out: Priced[] = [];
  for (const p of products) {
    const v = p.variants[0];
    if (!v) continue;
    const base = v.priceKobo ?? p.priceKobo;
    const unitKobo = p.saleActive && p.saleKobo != null ? p.saleKobo : base;
    if (unitKobo <= 0n) continue;
    out.push({ productId: p.id, variantId: v.id, name: p.name, sku: v.sku, label: v.label, unitKobo });
  }
  return out;
}

async function seedStore(
  store: { id: string; name: string },
  storeIndex: number,
  staffId: string | null,
  customerCount: number,
  specs: Spec[],
): Promise<{ customers: number; orders: number; returns: number }> {
  const catalogue = await pricedProducts(store.id);
  if (catalogue.length === 0) {
    console.warn(`  ⚠ ${store.name}: no published products with a price — orders skipped.`);
  }

  // Customers
  const created: { id: string; name: string; phone: string }[] = [];
  for (const c of CUSTOMERS.slice(0, customerCount)) {
    const ph = phone(storeIndex, c.slot);
    const customer = await prisma.customer.create({
      data: {
        storeId: store.id,
        phone: ph,
        email: c.email,
        name: c.name,
        segments: [DEMO_SEGMENT, ...c.segments],
        blacklisted: c.blacklisted ?? false,
        blacklistReason: c.blacklistReason ?? null,
        emailVerified: c.email != null,
        ...(c.addr && {
          addresses: {
            create: {
              label: "Home",
              recipient: c.name,
              phone: ph,
              line1: c.addr.line1,
              city: c.addr.city,
              state: c.addr.state,
              isDefault: true,
            },
          },
        }),
      },
    });
    created.push({ id: customer.id, name: customer.name, phone: ph });
  }

  const year = new Date().getUTCFullYear();
  let orders = 0;
  let returns = 0;
  const usable = catalogue.length ? specs : [];

  for (let i = 0; i < usable.length; i++) {
    const spec = usable[i]!;
    const cust = created[i % created.length]!;
    const addr = await prisma.customerAddress.findFirst({ where: { customerId: cust.id } });

    const lines = Array.from({ length: spec.lines }, (_, l) => {
      const p = catalogue[(i + l) % catalogue.length]!;
      return {
        productId: p.productId,
        variantId: p.variantId,
        nameSnapshot: p.name,
        variantSnapshot: p.label,
        skuSnapshot: p.sku,
        quantity: ((i + l) % 3) + 1,
        unitKobo: p.unitKobo,
      };
    });

    const subtotal = lines.reduce((s, ln) => s + ln.unitKobo * BigInt(ln.quantity), 0n);
    const shipping = spec.source === "walkin" ? 0n : k(1500);
    const manual = spec.manualDiscount ? k(spec.manualDiscount) : 0n;
    const total = subtotal + shipping - manual;
    const paid =
      spec.payment === "paid"
        ? total + (spec.overpay ? k(spec.overpay) : 0n)
        : spec.payment === "partial"
          ? total / 2n
          : 0n;

    const createdAt = daysAgo(spec.ageDays);
    const number = await nextOrderNumber(year);
    const staffCreated = spec.source === "walkin" || spec.source === "phone";

    const payments: Prisma.OrderPaymentUncheckedCreateWithoutOrderInput[] =
      paid > 0n
        ? [{
            method: methodFor(spec.source),
            amountKobo: paid,
            status: "completed",
            recordedById: staffCreated ? staffId : null,
            reference: spec.source === "web" || spec.source === "ai" ? `NQ-${number.slice(-6)}` : null,
          }]
        : [];

    const order = await prisma.order.create({
      data: {
        number,
        customerId: cust.id,
        storeId: store.id,
        status: spec.status,
        paymentStatus: spec.payment,
        source: spec.source,
        shipName: cust.name,
        shipPhone: cust.phone,
        shipLine1: addr?.line1 ?? "1 Marina Road",
        shipCity: addr?.city ?? "Lagos Island",
        shipState: addr?.state ?? "Lagos",
        subtotalKobo: subtotal,
        manualDiscountKobo: manual,
        shippingKobo: shipping,
        totalKobo: total,
        paidKobo: paid,
        createdById: staffCreated ? staffId : null,
        customerNote: spec.source === "whatsapp" ? "Please call before delivery." : null,
        createdAt,
        shippedAt: ["shipped", "delivered"].includes(spec.status) ? daysAgo(spec.ageDays - 1) : null,
        deliveredAt: spec.status === "delivered" ? daysAgo(spec.ageDays - 2) : null,
        cancelledAt: spec.status === "cancelled" ? createdAt : null,
        lines: { create: lines },
        ...(payments.length && { payments: { create: payments } }),
      },
      include: { lines: true },
    });
    orders++;

    if (spec.withReturn && order.lines[0]) {
      const ln = order.lines[0];
      const retNumber = `RET-${String(1_000_000 + storeIndex * 100 + returns).slice(-7)}`;
      await prisma.return.create({
        data: {
          number: retNumber,
          orderId: order.id,
          customerId: cust.id,
          status: spec.withReturn,
          reason: "Item different from description",
          refundKobo: spec.withReturn === "received" ? ln.unitKobo : 0n,
          refundMethod: "original",
          internalNote: "Demo return for testing the returns flow.",
          lines: {
            create: {
              orderLineId: ln.id,
              quantity: 1,
              condition: "unopened",
              restock: true,
              refundKobo: ln.unitKobo,
            },
          },
        },
      });
      returns++;
    }
  }

  return { customers: created.length, orders, returns };
}

async function seedExpenses(storeId: string, staffId: string | null): Promise<number> {
  const ids: Record<string, string> = {};
  for (const name of DEMO_EXPENSE_TYPES) {
    const t = await prisma.expenseType.upsert({
      where: { storeId_name: { storeId, name } },
      update: {},
      create: { storeId, name },
    });
    ids[name] = t.id;
  }
  const rows: { name: string; naira: number; ageDays: number; note?: string }[] = [
    { name: "Rent", naira: 250_000, ageDays: 30, note: "Monthly shop rent" },
    { name: "Staff salaries", naira: 420_000, ageDays: 28, note: "Payroll" },
    { name: "Utilities", naira: 38_500, ageDays: 25, note: "NEPA + water" },
    { name: "Logistics & delivery", naira: 64_000, ageDays: 18, note: "Dispatch riders" },
    { name: "Marketing", naira: 120_000, ageDays: 14, note: "Instagram ads" },
    { name: "Packaging", naira: 27_000, ageDays: 10, note: "Branded bags & tape" },
    { name: "Logistics & delivery", naira: 31_500, ageDays: 6 },
    { name: "Utilities", naira: 22_000, ageDays: 3, note: "Diesel for generator" },
  ];
  for (const r of rows) {
    await prisma.expense.create({
      data: {
        storeId,
        typeId: ids[r.name]!,
        amountKobo: k(r.naira),
        date: daysAgo(r.ageDays),
        note: r.note ?? null,
        createdById: staffId,
      },
    });
  }
  return rows.length;
}

async function main(): Promise<void> {
  const clean = process.argv.includes("--clean");

  const stores = await prisma.store.findMany({
    where: { active: true },
    orderBy: [{ isMain: "desc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
  if (stores.length === 0) throw new Error("No active stores — nothing to seed.");

  console.log("⊘ Clearing any previous demo data…");
  await cleanDemo(stores.map((s) => s.id));
  if (clean) {
    console.log("✓ Demo data cleared. Done.");
    return;
  }

  const staff = await prisma.user.findFirst({ where: { active: true }, select: { id: true } });
  const staffId = staff?.id ?? null;

  const mainStore = stores[0]!;
  console.log(`\n● Main store: ${mainStore.name}`);
  const r1 = await seedStore(mainStore, 0, staffId, CUSTOMERS.length, ORDER_SPECS);
  const e1 = await seedExpenses(mainStore.id, staffId);
  console.log(`  ${r1.customers} customers · ${r1.orders} orders · ${r1.returns} returns · ${e1} expenses`);

  if (stores[1]) {
    const sub = stores[1];
    console.log(`\n● Sub store: ${sub.name}`);
    const r2 = await seedStore(sub, 1, staffId, 3, ORDER_SPECS.slice(0, 3));
    const e2 = await seedExpenses(sub.id, staffId);
    console.log(`  ${r2.customers} customers · ${r2.orders} orders · ${r2.returns} returns · ${e2} expenses`);
  }

  // Pending staff invitation so the Staff screen has an invite to test.
  const role =
    (await prisma.role.findFirst({ where: { slug: "sales" } })) ??
    (await prisma.role.findFirst({ where: { slug: { not: "super_admin" } } }));
  if (role) {
    const ENUM_ROLES = ["super_admin", "manager", "sales", "inventory", "support"];
    await prisma.staffInvitation.create({
      data: {
        email: DEMO_INVITE_EMAIL,
        name: "Demo Invitee",
        role: (ENUM_ROLES.includes(role.slug) ? role.slug : "support") as Prisma.StaffInvitationCreateInput["role"],
        roleId: role.id,
        storeId: mainStore.id,
        token: `demo-${Date.now().toString(36)}-${Math.round(Math.random() * 1e9).toString(36)}`,
        expiresAt: new Date(Date.now() + 7 * 86_400_000),
        invitedById: staffId,
      },
    });
    console.log(`\n● Pending staff invite → ${DEMO_INVITE_EMAIL} (${role.name})`);
  }

  console.log("\n✓ Demo data seeded. Wipe anytime with:  npx tsx scripts/seed-demo.ts --clean");
}

main()
  .catch((e) => {
    console.error("✗ Seed failed:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
