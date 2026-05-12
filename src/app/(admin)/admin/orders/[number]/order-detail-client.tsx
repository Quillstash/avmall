"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Edit2,
  Printer,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Link as LinkIcon,
  Truck,
  Phone,
  Sparkles,
  AlertTriangle,
  Check,
  XCircle,
  Copy,
} from "lucide-react";
import { AdminTopBar } from "@/components/admin/topbar";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { Textarea } from "@/components/ui/textarea";
import {
  OrderStatusPill,
  PaymentStatusPill,
} from "@/components/ui/status-pill";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Timeline, type TimelineEvent } from "@/components/ui/timeline";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { PaymentLedger } from "@/components/admin/payment-ledger";
import { RecordPaymentModal } from "@/components/admin/record-payment-modal";
import { toast } from "@/components/ui/toaster";
import {
  ORDER_DETAIL_ITEMS,
  ORDER_PAYMENTS,
  type OrderPayment,
} from "@/lib/admin-mock-data";
import { formatMoney } from "@/lib/money";

interface PageProps {
  params: { number: string };
}

export function OrderDetailClient({ params }: PageProps) {
  // Totals (mock — Phase 4 will pull from DB)
  const itemsSubtotal = ORDER_DETAIL_ITEMS.reduce(
    (a, i) => a + i.unitKobo * i.qty,
    0,
  );
  const totalLineDiscounts = ORDER_DETAIL_ITEMS.reduce(
    (a, i) => a + i.discountKobo,
    0,
  );
  const couponDiscount = 500000;
  const shipping = 350000;
  const total = itemsSubtotal - totalLineDiscounts - couponDiscount + shipping;

  // Live payments — let the user record new ones in this session
  const [payments, setPayments] = React.useState<OrderPayment[]>([...ORDER_PAYMENTS]);
  const paid = payments
    .filter((p) => p.status === "completed")
    .reduce((a, p) => a + p.amountKobo, 0);
  const outstanding = total - paid;
  const isPartiallyPaid = paid > 0 && outstanding > 0;
  const isOverpaid = outstanding < 0;

  // Edge case toggles (real impl will come from DB)
  const isBlacklisted = false;

  const [recordOpen, setRecordOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState(false);
  const router = useRouter();

  async function recordPayment(data: {
    amountKobo: number;
    method: string;
    reference: string;
    note: string;
  }) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/orders/${params.number}/payments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amountKobo: data.amountKobo,
          method: methodToBackend(data.method),
          ...(data.reference && { reference: data.reference }),
          ...(data.note && { note: data.note }),
        }),
      });

      if (res.status === 404 || res.status === 401 || res.status === 503) {
        // Fallback: append locally (mock mode or not signed in)
        setPayments((prev) => [
          ...prev,
          {
            method: data.method,
            amountKobo: data.amountKobo,
            txRef: data.reference || "—",
            status: "completed",
            by: "Funmi A.",
            time: "just now",
          },
        ]);
        setRecordOpen(false);
        toast.success(`Payment of ${formatMoney(data.amountKobo)} recorded (local)`);
        return;
      }

      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error?.message ?? "Couldn't record payment");

      setRecordOpen(false);
      toast.success(`Payment of ${formatMoney(data.amountKobo)} recorded`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't record payment");
    } finally {
      setActionLoading(false);
    }
  }

  async function cancelOrder() {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/orders/${params.number}/cancel`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });

      if (res.status === 404 || res.status === 503) {
        setCancelOpen(false);
        toast.success("Order cancelled (local)");
        return;
      }

      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error?.message ?? "Couldn't cancel order");

      setCancelOpen(false);
      toast.success("Order cancelled");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't cancel order");
    } finally {
      setActionLoading(false);
    }
  }

  async function shipOrder(override = false) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/orders/${params.number}/ship`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ override }),
      });

      if (res.status === 404 || res.status === 503) {
        toast.success("Order marked as shipped (local)");
        return;
      }

      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error?.message ?? "Couldn't mark as shipped");

      toast.success("Order marked as shipped");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't mark as shipped");
    } finally {
      setActionLoading(false);
    }
  }

  function methodToBackend(uiMethod: string): string {
    switch (uiMethod) {
      case "Nuqood card":
        return "nuqood";
      case "Bank transfer":
        return "bank_transfer";
      case "POS terminal":
        return "pos";
      case "Cash":
        return "cash";
      case "Store credit":
        return "store_credit";
      default:
        return "bank_transfer";
    }
  }

  const timeline: TimelineEvent[] = [
    { title: "Order placed", subtitle: "Tue 14 Jan · 2:14 PM", meta: "Funmi A.", done: true },
    ...payments
      .filter((p) => p.status === "completed")
      .map<TimelineEvent>((p) => ({
        title: `${p.method} payment recorded`,
        subtitle: p.time,
        meta: `${p.by} · ${formatMoney(p.amountKobo)}`,
        done: true,
      })),
    isPartiallyPaid
      ? {
          title: "Awaiting final payment",
          subtitle: `${formatMoney(outstanding)} outstanding`,
          current: true,
        }
      : isOverpaid
        ? {
            title: "Credit due",
            subtitle: `${formatMoney(Math.abs(outstanding))} overpaid`,
            current: true,
          }
        : {
            title: "Paid in full",
            subtitle: "ready to ship",
            done: true,
          },
    {
      title: "Mark as shipped",
      subtitle: isPartiallyPaid ? "blocked" : "ready",
      meta: isPartiallyPaid ? "Requires paid in full" : undefined,
      blocked: isPartiallyPaid,
    },
    { title: "Delivered" },
  ];

  return (
    <>
      <AdminTopBar
        breadcrumbs={[
          { label: "Orders", href: "/admin/orders" },
          { label: params.number },
        ]}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1500px] mx-auto pb-20">
          {/* Header */}
          <div className="flex flex-wrap items-start gap-4 mb-5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-1.5">
                <h1 className="text-2xl font-bold font-mono tracking-tight tabular">
                  #{params.number}
                </h1>
                <OrderStatusPill status="processing" />
                <PaymentStatusPill status="partial" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-surface-2 border border-border font-medium cursor-help">
                      <MessageCircle className="size-3" /> WhatsApp source
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Order originated from WhatsApp conversation with Ada</TooltipContent>
                </Tooltip>
              </div>
              <div className="text-sm text-fg-muted">
                Placed Tue 14 Jan, 2:14 PM · by Funmi A. (you) · 3 items
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => toast.success("Edit mode")}>
                <Edit2 className="size-3.5" /> Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  window.print();
                }}
              >
                <Printer className="size-3.5" /> Print
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="More actions">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => toast.success("Receipt emailed")}>
                    <Mail className="size-3.5" /> Email customer
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast.success("WhatsApp opened")}>
                    <MessageCircle className="size-3.5" /> WhatsApp customer
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      void navigator.clipboard.writeText(params.number);
                      toast.success("Order number copied");
                    }}
                  >
                    <Copy className="size-3.5" /> Copy order #
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem destructive onClick={() => setCancelOpen(true)}>
                    <XCircle className="size-3.5" /> Cancel order
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Blacklist banner */}
          {isBlacklisted && (
            <Alert
              tone="danger"
              icon={<AlertTriangle className="size-5" />}
              title="Customer is blacklisted — order locked"
              description="No further actions can be taken without a manager override."
              action={
                <Button size="sm" variant="ghost" className="text-danger">
                  Override
                </Button>
              }
              className="mb-4"
            />
          )}

          {/* Three column layout */}
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)] gap-4">
            {/* LEFT — order body */}
            <div className="flex flex-col gap-4 min-w-0">
              <Card
                title="Items"
                action={
                  <Button variant="secondary" size="sm">
                    <Plus className="size-3.5" /> Add item
                  </Button>
                }
                padded={false}
              >
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] font-bold uppercase tracking-wider text-fg-muted bg-surface-2">
                      <th className="text-left px-3.5 py-2.5">Product</th>
                      <th className="text-right px-3.5 py-2.5">Qty</th>
                      <th className="text-right px-3.5 py-2.5">Unit</th>
                      <th className="text-right px-3.5 py-2.5">Discount</th>
                      <th className="text-right px-3.5 py-2.5">Total</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {ORDER_DETAIL_ITEMS.map((it) => (
                      <tr key={it.id} className="border-t border-border">
                        <td className="px-3.5 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="relative size-10 rounded-md overflow-hidden flex-shrink-0 bg-surface-2">
                              <Image
                                src={it.imageUrl}
                                alt={it.name}
                                fill
                                sizes="40px"
                                className="object-cover"
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold truncate">{it.name}</div>
                              <div className="text-[11px] text-fg-muted">
                                {it.variant} ·{" "}
                                <span className="font-mono tabular">{it.sku}</span>
                                {it.tier && (
                                  <span className="ml-1.5 text-brand-accent font-semibold">
                                    · {it.tier}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3.5 py-3 text-right font-semibold tabular">{it.qty}</td>
                        <td className="px-3.5 py-3 text-right">
                          <Money kobo={it.unitKobo} />
                        </td>
                        <td className="px-3.5 py-3 text-right">
                          {it.discountKobo > 0 ? (
                            <span className="text-brand-accent">
                              −{formatMoney(it.discountKobo)}
                            </span>
                          ) : (
                            <span className="text-fg-subtle">—</span>
                          )}
                        </td>
                        <td className="px-3.5 py-3 text-right font-bold">
                          <Money kobo={it.unitKobo * it.qty - it.discountKobo} />
                        </td>
                        <td className="px-3.5 py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="p-1 text-fg-muted hover:text-fg"
                                aria-label="Item actions"
                              >
                                <MoreHorizontal className="size-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => toast.success("Edit qty")}>
                                Edit qty
                              </DropdownMenuItem>
                              <DropdownMenuItem destructive onClick={() => toast.success("Removed")}>
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals */}
                <div className="flex justify-end px-4 py-3 border-t border-border">
                  <div className="min-w-[280px] space-y-0.5">
                    <TotalRow label="Subtotal" value={formatMoney(itemsSubtotal)} />
                    <TotalRow
                      label="Bulk discounts"
                      value={`−${formatMoney(totalLineDiscounts)}`}
                      accent
                    />
                    <TotalRow
                      label={
                        <span>
                          Coupon{" "}
                          <code className="font-mono text-[10px] text-fg-muted">JANUARY10</code>
                        </span>
                      }
                      value={`−${formatMoney(couponDiscount)}`}
                      accent
                    />
                    <TotalRow
                      label={
                        <span>
                          Shipping{" "}
                          <span className="text-[10px] text-fg-muted font-medium">
                            · Lagos zone
                          </span>
                        </span>
                      }
                      value={formatMoney(shipping)}
                    />
                    <div className="h-px bg-border my-2" />
                    <TotalRow label="Total" value={formatMoney(total)} strong />
                    <TotalRow label="Amount paid" value={formatMoney(paid)} muted />
                    <TotalRow
                      label="Outstanding"
                      value={formatMoney(Math.abs(outstanding))}
                      highlight={isPartiallyPaid}
                    />
                  </div>
                </div>
              </Card>

              <Card title="Status timeline">
                <Timeline events={timeline} />
              </Card>

              <Card
                title="Internal notes"
                action={<span className="text-[11px] text-fg-subtle">autosaved</span>}
              >
                <div className="flex flex-col gap-3">
                  <NoteEntry
                    author="Funmi A."
                    time="2 min ago"
                    text="Customer requested split between Nuqood (₦20k) and bank transfer for the rest. Awaiting transfer confirmation from accounting."
                  />
                  <NoteEntry
                    author="Tunde I."
                    time="14 min ago"
                    text="Confirmed all items in stock. Boxes labeled, ready for courier pickup once paid in full."
                  />
                  <Textarea placeholder="Add a note for the team…" rows={2} />
                </div>
              </Card>
            </div>

            {/* MIDDLE — payments & actions */}
            <div className="flex flex-col gap-4 min-w-0">
              {/* Partial-payment edge case */}
              {isPartiallyPaid && (
                <div className="rounded-lg p-4 bg-warning-bg border border-warning/30">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-warning mb-1">
                    Outstanding balance
                  </div>
                  <div className="text-[30px] font-bold tracking-tight mb-3 tabular">
                    {formatMoney(outstanding)}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button width="full" onClick={() => toast.success("Payment link generated")}>
                      <LinkIcon className="size-3.5" /> Generate payment link
                    </Button>
                    <Button
                      width="full"
                      variant="secondary"
                      onClick={() => setRecordOpen(true)}
                    >
                      <Plus className="size-3.5" /> Record payment
                    </Button>
                  </div>
                  <p className="text-[11px] text-fg-muted mt-2.5 leading-snug">
                    Fulfilment policy: order must be paid in full before shipping.{" "}
                    <button className="text-brand-primary font-semibold hover:underline">
                      Override
                    </button>
                  </p>
                </div>
              )}

              {/* Overpaid edge case */}
              {isOverpaid && (
                <div className="rounded-lg p-4 bg-info-bg border border-brand-primary/30">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-brand-primary mb-1">
                    Overpaid · credit due
                  </div>
                  <div className="text-[30px] font-bold tracking-tight mb-3 tabular">
                    {formatMoney(Math.abs(outstanding))}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button width="full">Issue store credit (+5% bonus)</Button>
                    <Button width="full" variant="secondary">
                      Refund to original method
                    </Button>
                  </div>
                </div>
              )}

              {/* Paid-in-full happy path */}
              {!isPartiallyPaid && !isOverpaid && (
                <Alert
                  tone="success"
                  icon={<Check className="size-5" />}
                  title="Paid in full"
                  description="Order is ready to be marked shipped."
                />
              )}

              <Card
                title="Payments"
                action={
                  <span className="text-[11px] text-fg-muted">
                    {payments.length} records
                  </span>
                }
                padded={false}
              >
                <PaymentLedger payments={payments} />
              </Card>

              <Card title="Next action">
                <div className="p-3.5 rounded-md bg-surface-2 flex flex-col gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="size-9 rounded-full bg-brand-primary text-brand-primary-fg flex items-center justify-center flex-shrink-0">
                      <Truck className="size-4" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold">Mark as shipped</div>
                      <div className="text-[11px] text-fg-muted">
                        {isPartiallyPaid
                          ? "Disabled until paid in full"
                          : "Ready to dispatch"}
                      </div>
                    </div>
                  </div>
                  <Button
                    width="full"
                    disabled={isPartiallyPaid || actionLoading}
                    loading={actionLoading}
                    onClick={() => shipOrder(false)}
                  >
                    Mark as shipped
                  </Button>
                </div>
              </Card>

              <Card
                title="AI conversation"
                action={
                  <Link
                    href="/admin/ai"
                    className="text-xs font-semibold text-brand-primary hover:underline"
                  >
                    Open thread →
                  </Link>
                }
              >
                <div className="p-3 rounded-md bg-info-bg border border-brand-primary/15">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="size-3.5" />
                    <span className="text-xs font-bold">Ada (AI agent)</span>
                    <span className="ml-auto text-[11px] text-fg-muted">
                      WhatsApp · 18 messages
                    </span>
                  </div>
                  <div className="text-xs leading-snug text-fg-muted">
                    Customer asked for bulk pricing on shea balm and incense; Ada quoted a 9%
                    blended discount and the customer accepted at{" "}
                    <code className="font-mono text-fg">JANUARY10</code> coupon equivalent. No
                    handoff requested.
                  </div>
                </div>
              </Card>
            </div>

            {/* RIGHT — context */}
            <div className="flex flex-col gap-4 min-w-0">
              <Card title="Customer">
                <div className="flex items-center gap-2.5 mb-3">
                  <Avatar size="lg">
                    <AvatarFallback>TA</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm">Tolu Adeniyi</div>
                    <div className="text-[11px] text-fg-muted font-mono tabular">
                      +234 803 421 7790
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 mb-3 flex-wrap">
                  <Badge tone="brand">VIP</Badge>
                  <Badge>Wholesale</Badge>
                  <Badge>Lagos</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 py-3 border-y border-border">
                  <Stat label="Lifetime spend" value="₦1.84M" />
                  <Stat label="Orders" value="14" />
                  <Stat label="Avg order" value="₦131k" />
                  <Stat label="Last order" value="6d ago" />
                </div>
                <div className="flex gap-1 mt-3">
                  <Button variant="ghost" size="icon" aria-label="Phone">
                    <Phone className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="WhatsApp">
                    <MessageCircle className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Email">
                    <Mail className="size-3.5" />
                  </Button>
                  <Link href="/admin/customers/c1" className="flex-1">
                    <Button variant="secondary" size="sm" width="full">
                      Profile →
                    </Button>
                  </Link>
                </div>
              </Card>

              <Card
                title="Shipping address"
                action={
                  <button className="text-xs font-semibold text-brand-primary hover:underline">
                    Edit
                  </button>
                }
              >
                <div className="text-sm leading-relaxed">
                  <div className="font-semibold">Tolu Adeniyi</div>
                  <div className="text-fg-muted">14 Bourdillon Road, Apt 3B</div>
                  <div className="text-fg-muted">Ikoyi, Lagos</div>
                  <div className="text-fg-muted font-mono text-xs tabular mt-1">
                    +234 803 421 7790
                  </div>
                </div>
                <div className="mt-3 p-2.5 rounded-md bg-surface-2 flex items-center gap-2">
                  <Truck className="size-3.5" />
                  <div className="text-[11px] leading-snug">
                    <div className="font-semibold">Lagos · 24h</div>
                    <div className="text-fg-muted">GIG Logistics · ₦3,500</div>
                  </div>
                </div>
              </Card>

              <Card title="Recent orders">
                {[
                  { id: "AVM-2811", date: "8 Jan", total: 18900000, status: "delivered" as const },
                  { id: "AVM-2790", date: "2 Jan", total: 8400000, status: "delivered" as const },
                  { id: "AVM-2754", date: "24 Dec", total: 14200000, status: "refunded" as const },
                ].map((o, i) => (
                  <Link
                    key={o.id}
                    href={`/admin/orders/${o.id}`}
                    className={
                      "flex items-center justify-between py-2 " +
                      (i > 0 ? "border-t border-border" : "")
                    }
                  >
                    <div>
                      <div className="font-mono text-xs font-bold tabular">#{o.id}</div>
                      <div className="text-[11px] text-fg-muted">{o.date}</div>
                    </div>
                    <div className="text-right">
                      <Money kobo={o.total} className="text-xs font-bold" />
                      <div className="mt-0.5">
                        <OrderStatusPill status={o.status} bare />
                      </div>
                    </div>
                  </Link>
                ))}
              </Card>
            </div>
          </div>
        </div>
      </div>

      <RecordPaymentModal
        open={recordOpen}
        onOpenChange={setRecordOpen}
        outstandingKobo={Math.max(0, outstanding)}
        onSubmit={recordPayment}
      />

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel this order?"
        description={
          <>
            Order <span className="font-mono font-bold">#{params.number}</span> will be marked
            cancelled. Stock reservations are released and the customer is notified.
          </>
        }
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
        destructive
        typeToConfirm="CANCEL"
        loading={actionLoading}
        onConfirm={cancelOrder}
      />
    </>
  );
}

function Card({
  title,
  action,
  children,
  padded = true,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  padded?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface shadow-sm">
      <div className="px-4 py-3 flex items-center justify-between gap-2">
        <div className="text-sm font-bold">{title}</div>
        {action}
      </div>
      <div className="h-px bg-border" />
      <div className={padded ? "p-4" : ""}>{children}</div>
    </div>
  );
}

function TotalRow({
  label,
  value,
  strong,
  muted,
  accent,
  highlight,
}: {
  label: React.ReactNode;
  value: string;
  strong?: boolean;
  muted?: boolean;
  accent?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between items-baseline text-sm">
      <span
        className={
          (strong ? "font-bold text-fg" : "text-fg-muted") +
          (muted ? " text-fg-subtle" : "")
        }
      >
        {label}
      </span>
      <span
        className={
          "tabular " +
          (strong ? "font-bold text-lg" : "font-semibold") +
          (accent ? " text-brand-accent" : "") +
          (highlight ? " text-warning font-bold" : "")
        }
      >
        {value}
      </span>
    </div>
  );
}

function NoteEntry({
  author,
  time,
  text,
}: {
  author: string;
  time: string;
  text: string;
}) {
  return (
    <div className="text-xs leading-relaxed">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="font-bold text-fg">{author}</span>
        <span className="text-fg-subtle">· {time}</span>
      </div>
      <p className="text-fg-muted">{text}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">{label}</div>
      <div className="text-sm font-bold tabular mt-0.5">{value}</div>
    </div>
  );
}
