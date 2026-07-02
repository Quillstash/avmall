"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Loader2,
  Printer,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Link as LinkIcon,
  Truck,
  Phone,
  AlertTriangle,
  Check,
  XCircle,
  Copy,
  Pencil,
  Trash2,
  Send,
  Search,
  LockKeyhole,
  ChevronDown,
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
import { ReceiptPrintView } from "@/components/admin/receipt-print-view";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { NumberInput } from "@/components/ui/number-input";
import { Select } from "@/components/ui/select";
import { PaymentLedger } from "@/components/admin/payment-ledger";
import { RecordPaymentModal } from "@/components/admin/record-payment-modal";
import { InstallmentPanel } from "@/components/admin/installment-panel";
import { toast } from "@/components/ui/toaster";
import { telLink, waLink } from "@/lib/contact-links";
import { MANUAL_ORDER_SOURCES } from "@/lib/order-source";
import type { OrderPayment } from "@/lib/admin-mock-data";
import type { OrderDetail } from "@/lib/data/orders";
import { formatMoney } from "@/lib/money";

interface PageProps {
  params: { number: string };
  order: OrderDetail;
}

// How each order source is labelled + described in the header pill. Driven by
// the real `order.source` rather than assuming every order came from WhatsApp.
const SOURCE_META: Record<string, { label: string; tip: string }> = {
  web: { label: "Website", tip: "Placed by the customer on the storefront" },
  whatsapp: { label: "WhatsApp", tip: "Originated from a WhatsApp conversation" },
  instagram: { label: "Instagram", tip: "Came in via Instagram" },
  facebook: { label: "Facebook", tip: "Came in via Facebook" },
  phone: { label: "Phone", tip: "Taken over the phone by a staff member" },
  walkin: { label: "Walk-in", tip: "Created at the register / in-store" },
  manual: { label: "Manual", tip: "Recorded by hand by a staff member" },
  ai: { label: "AI agent", tip: "Created by the AI agent" },
};

// Forward order flow. Ranks mirror the status API, which rejects backward
// moves — so the status modal only offers statuses further along than the
// current one. Cancel/refund have their own dedicated actions.
const STATUS_FLOW: { value: string; label: string }[] = [
  { value: "confirmed", label: "Confirmed" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
];
const STATUS_RANK: Record<string, number> = {
  pending: 0,
  confirmed: 1,
  processing: 2,
  shipped: 3,
  delivered: 4,
};

export function OrderDetailClient({ params, order }: PageProps) {
  const { data: session } = useSession();
  const currentStaffName = session?.user?.name ?? "Staff";
  // Items + monetary totals come from the server-fetched OrderDetail.
  const orderItems = order.lines.map((l) => ({
    id: l.id,
    name: l.name,
    variant: l.variant ?? "—",
    sku: l.sku,
    qty: l.quantity,
    unitKobo: l.unitKobo,
    discountKobo: l.bulkDiscountKobo,
    tier: l.bulkTierLabel,
    imageUrl: l.imageUrl,
  }));

  const itemsSubtotal = Number(order.totals.subtotalKobo);
  const totalLineDiscounts = Number(order.totals.bulkDiscountKobo);
  const couponDiscount = Number(order.totals.couponDiscountKobo);
  const shipping = Number(order.totals.shippingKobo);
  const total = Number(order.totals.totalKobo);

  // Payments mirror the server data; locally appended ones are stub for the
  // mock-mode fallback path.
  const initialPayments: OrderPayment[] = order.payments.map((p) => ({
    method: prettyMethod(p.method),
    amountKobo: p.amountKobo,
    txRef: p.reference ?? "—",
    status: p.status === "completed" ? "completed" : p.status === "pending" ? "pending" : "completed",
    by: p.by,
    time: p.createdAt.toLocaleString("en-NG", { timeZone: "Africa/Lagos" }),
  }));
  const [payments, setPayments] = React.useState<OrderPayment[]>(initialPayments);
  const [generatingLink, setGeneratingLink] = React.useState(false);
  const paid = Number(order.totals.paidKobo);
  const outstanding = Number(order.totals.outstandingKobo);
  const isPartiallyPaid = paid > 0 && outstanding > 0;
  const hasPlan = !!order.installmentPlan;

  async function generatePaymentLink() {
    setGeneratingLink(true);
    try {
      const res = await fetch(
        `/api/v1/admin/orders/${encodeURIComponent(order.number)}/payment-link`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      );
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not generate payment link");
        return;
      }
      const url = json.data?.paymentUrl as string | undefined;
      if (url) {
        await navigator.clipboard?.writeText(url).catch(() => undefined);
        toast.success("Payment link generated + copied to clipboard");
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        toast.success("Payment link generated");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setGeneratingLink(false);
    }
  }
  const isOverpaid = outstanding < 0;
  const isBlacklisted = order.customer?.blacklisted ?? false;

  const [recordOpen, setRecordOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState(false);

  // Sales-channel pill is editable inline. Optimistic local state so the pill
  // flips immediately; reverts on failure. Server enforces orders.edit.
  const [sourceValue, setSourceValue] = React.useState<string>(order.source);
  const [changingSource, setChangingSource] = React.useState(false);
  async function changeSource(newSource: string) {
    const prev = sourceValue;
    if (newSource === prev) return;
    setSourceValue(newSource);
    setChangingSource(true);
    try {
      const res = await fetch(`/api/v1/admin/orders/${params.number}/source`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: newSource }),
      });
      if (res.status === 404 || res.status === 503) {
        toast.success("Channel updated (local)");
        return;
      }
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error?.message ?? "Couldn't update channel");
      toast.success(`Channel set to ${SOURCE_META[newSource]?.label ?? newSource}`);
      router.refresh();
    } catch (err) {
      setSourceValue(prev);
      toast.error(err instanceof Error ? err.message : "Couldn't update channel");
    } finally {
      setChangingSource(false);
    }
  }

  // Status update modal — opened from the header and the timeline card.
  const currentRank = STATUS_RANK[order.status] ?? 0;
  const nextStatuses = STATUS_FLOW.filter(
    (s) => (STATUS_RANK[s.value] ?? 0) > currentRank,
  );
  const canUpdateStatus =
    order.status !== "cancelled" && order.status !== "delivered";
  const [statusOpen, setStatusOpen] = React.useState(false);
  const [statusChoice, setStatusChoice] = React.useState("");
  React.useEffect(() => {
    if (statusOpen) setStatusChoice(nextStatuses[0]?.value ?? "");
    // Re-seed the default each time the modal opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusOpen]);

  async function submitStatus() {
    if (!statusChoice) return;
    await changeStatus(statusChoice);
    setStatusOpen(false);
  }

  // Line-item editing
  type LineItem = (typeof orderItems)[number];
  const [editQtyTarget, setEditQtyTarget] = React.useState<LineItem | null>(null);
  const [editQtyValue, setEditQtyValue] = React.useState(1);
  const [removeTarget, setRemoveTarget] = React.useState<LineItem | null>(null);
  const [lineActionLoading, setLineActionLoading] = React.useState(false);

  // Add item dialog
  interface ProductHit {
    id: string; slug: string; name: string; brand: string;
    imageUrl: string; priceKobo: number; saleKobo: number | null;
    saleActive: boolean; stock: number;
  }
  const [addItemOpen, setAddItemOpen] = React.useState(false);
  const [addItemSearch, setAddItemSearch] = React.useState("");
  const [addItemMatches, setAddItemMatches] = React.useState<ProductHit[]>([]);
  const [addItemSearching, setAddItemSearching] = React.useState(false);
  const [addItemSelected, setAddItemSelected] = React.useState<ProductHit | null>(null);
  const [addItemQty, setAddItemQty] = React.useState(1);
  const [addItemLoading, setAddItemLoading] = React.useState(false);

  React.useEffect(() => {
    if (!addItemOpen) {
      setAddItemSearch(""); setAddItemMatches([]); setAddItemSelected(null); setAddItemQty(1);
      return;
    }
    const q = addItemSearch.trim();
    if (q.length < 2) { setAddItemMatches([]); return; }
    const controller = new AbortController();
    setAddItemSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/v1/admin/products/search?q=${encodeURIComponent(q)}&limit=6`,
          { signal: controller.signal },
        );
        const json = await res.json();
        if (res.ok) setAddItemMatches(json.data.products ?? []);
      } catch { /* user keeps typing */ }
      finally { if (!controller.signal.aborted) setAddItemSearching(false); }
    }, 250);
    return () => { controller.abort(); clearTimeout(t); };
  }, [addItemSearch, addItemOpen]);

  async function submitAddItem() {
    if (!addItemSelected) return;
    setAddItemLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/orders/${params.number}/lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: addItemSelected.id, quantity: addItemQty }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json?.error?.message ?? "Could not add item"); return; }
      toast.success(`${addItemSelected.name} added`);
      setAddItemOpen(false);
      router.refresh();
    } catch { toast.error("Network error"); }
    finally { setAddItemLoading(false); }
  }

  async function submitEditQty() {
    if (!editQtyTarget) return;
    setLineActionLoading(true);
    try {
      const res = await fetch(
        `/api/v1/admin/orders/${params.number}/lines/${editQtyTarget.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity: editQtyValue }),
        },
      );
      const json = await res.json();
      if (!res.ok) { toast.error(json?.error?.message ?? "Could not update"); return; }
      toast.success("Quantity updated");
      setEditQtyTarget(null);
      router.refresh();
    } catch { toast.error("Network error"); }
    finally { setLineActionLoading(false); }
  }

  async function submitRemoveLine() {
    if (!removeTarget) return;
    setLineActionLoading(true);
    try {
      const res = await fetch(
        `/api/v1/admin/orders/${params.number}/lines/${removeTarget.id}`,
        { method: "DELETE" },
      );
      const json = await res.json();
      if (!res.ok) { toast.error(json?.error?.message ?? "Could not remove"); return; }
      toast.success(`${removeTarget.name} removed`);
      setRemoveTarget(null);
      router.refresh();
    } catch { toast.error("Network error"); }
    finally { setLineActionLoading(false); }
  }
  const router = useRouter();

  // Internal notes
  const [notes, setNotes] = React.useState(order.notes);
  const [noteText, setNoteText] = React.useState("");
  const [savingNote, setSavingNote] = React.useState(false);

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
            by: currentStaffName,
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

  async function changeStatus(newStatus: string) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/orders/${params.number}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.status === 404 || res.status === 503) {
        toast.success(`Order ${newStatus} (local)`);
        router.refresh();
        return;
      }

      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error?.message ?? "Couldn't update status");

      toast.success(`Order marked as ${newStatus}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update status");
    } finally {
      setActionLoading(false);
    }
  }

  async function saveNote() {
    const text = noteText.trim();
    if (!text) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/v1/admin/orders/${params.number}/notes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.status === 503 || res.status === 404) {
        // Mock mode — add locally
        setNotes((prev) => [...prev, { id: crypto.randomUUID(), text, author: currentStaffName, createdAt: new Date() }]);
        setNoteText("");
        return;
      }
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error?.message ?? "Couldn't save note");
      setNotes((prev) => [...prev, payload.data]);
      setNoteText("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save note");
    } finally {
      setSavingNote(false);
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
      default:
        return "bank_transfer";
    }
  }

  const placedAt = order.createdAt.toLocaleString("en-NG", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  const customerName = order.customer?.name ?? order.shipping.name;
  const customerPhone = order.customer?.phone ?? order.shipping.phone;
  const customerInitials = customerName
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const timeline: TimelineEvent[] = [
    {
      title: "Order placed",
      subtitle: new Date(order.createdAt).toLocaleString("en-NG", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Africa/Lagos",
      }),
      done: true,
    },
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
      subtitle: isPartiallyPaid
        ? "blocked"
        : order.status === "shipped" || order.status === "delivered"
          ? "shipped"
          : "ready",
      meta: isPartiallyPaid ? "Requires paid in full" : undefined,
      done: order.status === "shipped" || order.status === "delivered",
      current:
        !isPartiallyPaid &&
        order.status !== "shipped" &&
        order.status !== "delivered" &&
        order.status !== "cancelled",
      blocked: isPartiallyPaid,
    },
    {
      title: "Delivered",
      done: order.status === "delivered",
      current: order.status === "shipped",
    },
  ];

  return (
    <>
      <div className="print:hidden contents">
      <AdminTopBar
        breadcrumbs={[
          { label: "Orders", href: "/admin/orders" },
          { label: params.number },
        ]}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 lg:p-8 max-w-[1500px] mx-auto pb-20">
          {/* Header */}
          <div className="flex flex-wrap items-start gap-4 mb-6 lg:mb-8">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h1 className="text-2xl lg:text-3xl font-bold font-mono tracking-tight tabular">
                  #{params.number}
                </h1>
                <OrderStatusPill status={order.status} />
                <PaymentStatusPill status={order.paymentStatus} />
                {(() => {
                  const meta = SOURCE_META[sourceValue] ?? {
                    label: sourceValue,
                    tip: "Order source",
                  };
                  return (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          disabled={changingSource}
                          title={`${meta.tip} — click to change`}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-surface-2 border border-border font-medium capitalize hover:border-border-strong hover:bg-surface disabled:opacity-60 transition-colors"
                        >
                          {changingSource ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            sourceValue === "whatsapp" && (
                              <MessageCircle className="size-3" />
                            )
                          )}
                          {meta.label} source
                          <ChevronDown className="size-3 text-fg-muted" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="min-w-[11rem]">
                        {MANUAL_ORDER_SOURCES.map((s) => (
                          <DropdownMenuItem
                            key={s.value}
                            onClick={() => changeSource(s.value)}
                            className="flex items-center justify-between gap-4"
                          >
                            {s.label}
                            {sourceValue === s.value && (
                              <Check className="size-3.5 text-brand-primary" />
                            )}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  );
                })()}
              </div>
              <div className="text-sm text-fg-muted">
                Placed {placedAt} · {orderItems.length} item{orderItems.length === 1 ? "" : "s"}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {/* Status changer — opens the shared status modal. Only shown for
                  non-terminal statuses. */}
              {canUpdateStatus && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={actionLoading}
                  onClick={() => setStatusOpen(true)}
                >
                  {actionLoading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Truck className="size-3.5" />
                  )}
                  Update status
                </Button>
              )}
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
                  <DropdownMenuItem
                    onClick={() =>
                      window.open(
                        waLink(
                          customerPhone,
                          `Hi ${customerName.split(" ")[0]}, this is Avmall about order #${order.number}.`,
                        ),
                        "_blank",
                      )
                    }
                  >
                    <MessageCircle className="size-3.5" /> WhatsApp customer
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={async () => {
                      const res = await fetch(
                        `/api/v1/admin/orders/${encodeURIComponent(params.number)}/resend-receipt`,
                        { method: "POST" },
                      );
                      const json = await res.json().catch(() => ({}));
                      if (!res.ok) {
                        toast.error(
                          json?.error?.message ?? "Could not send the receipt",
                        );
                        return;
                      }
                      toast.success(`Receipt sent to ${json.data.sentTo}`);
                    }}
                  >
                    <Mail className="size-3.5" /> Email receipt
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

          {/* Two-column layout — workflow on the left, context on the right.
              Three-column was too tight at 1280-1600px; the items table's
              Total column was truncating. */}
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)] gap-5 xl:gap-6">
            {/* MAIN — items, payment status, actions, timeline, notes */}
            <div className="flex flex-col gap-5 lg:gap-6 min-w-0">
              <Card
                title="Items"
                action={
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={order.status === "cancelled" || order.status === "delivered"}
                    onClick={() => setAddItemOpen(true)}
                  >
                    <Plus className="size-3.5" /> Add item
                  </Button>
                }
                padded={false}
              >
                <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="text-[11px] font-bold uppercase tracking-wider text-fg-muted bg-surface-2">
                      <th className="text-left px-5 py-3">Product</th>
                      <th className="text-right px-5 py-3">Qty</th>
                      <th className="text-right px-5 py-3">Unit</th>
                      <th className="text-right px-5 py-3">Discount</th>
                      <th className="text-right px-5 py-3">Total</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {orderItems.map((it) => (
                      <tr key={it.id} className="border-t border-border">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="relative size-12 rounded-md overflow-hidden flex-shrink-0 bg-surface-2">
                              <Image
                                src={it.imageUrl}
                                alt={it.name}
                                fill
                                sizes="48px"
                                className="object-cover"
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold truncate">{it.name}</div>
                              <div className="text-xs text-fg-muted mt-0.5">
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
                        <td className="px-5 py-4 text-right font-semibold tabular">{it.qty}</td>
                        <td className="px-5 py-4 text-right">
                          <Money kobo={it.unitKobo} />
                        </td>
                        <td className="px-5 py-4 text-right">
                          {it.discountKobo > 0 ? (
                            <span className="text-brand-accent">
                              −{formatMoney(it.discountKobo)}
                            </span>
                          ) : (
                            <span className="text-fg-subtle">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right font-bold">
                          <Money kobo={it.unitKobo * it.qty - it.discountKobo} />
                        </td>
                        <td className="px-5 py-4 text-right">
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
                              <DropdownMenuItem
                                disabled={order.status === "cancelled" || order.status === "delivered"}
                                onClick={() => {
                                  setTimeout(() => {
                                    setEditQtyTarget(it);
                                    setEditQtyValue(it.qty);
                                  }, 0);
                                }}
                              >
                                <Pencil className="size-3.5" /> Edit quantity
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                destructive
                                disabled={order.status === "cancelled" || order.status === "delivered" || orderItems.length <= 1}
                                onClick={() => {
                                  setTimeout(() => {
                                    setRemoveTarget(it);
                                  }, 0);
                                }}
                              >
                                <Trash2 className="size-3.5" /> Remove item
                              </DropdownMenuItem>
                              {(order.status === "cancelled" || order.status === "delivered") && (
                                <>
                                  <DropdownMenuSeparator />
                                  <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-fg-muted">
                                    <LockKeyhole className="size-3 flex-shrink-0" />
                                    Items locked on {order.status} orders
                                  </div>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>

                {/* Totals */}
                <div className="flex justify-end px-5 py-5 border-t border-border bg-surface-2/50">
                  <div className="w-full sm:w-auto sm:min-w-[320px] space-y-1.5">
                    <TotalRow label="Subtotal" value={formatMoney(itemsSubtotal)} />
                    <TotalRow
                      label="Bulk discounts"
                      value={`−${formatMoney(totalLineDiscounts)}`}
                      accent
                    />
                    {couponDiscount > 0 && (
                      <TotalRow
                        label={
                          <span>
                            Coupon{" "}
                            {order.appliedCouponCode && (
                              <code className="font-mono text-[10px] text-fg-muted">{order.appliedCouponCode}</code>
                            )}
                          </span>
                        }
                        value={`−${formatMoney(couponDiscount)}`}
                        accent
                      />
                    )}
                    <TotalRow
                      label={
                        <span>
                          Shipping{" "}
                          {shipping > 0 && (
                            <span className="text-[10px] text-fg-muted font-medium">
                              · {order.shipping.state} zone
                            </span>
                          )}
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

              {/* Payment status + next action are paired at md+ so the
                  operator sees "where the money is" and "what to do next"
                  side-by-side. Stacks below md. */}
              <div className="grid md:grid-cols-2 gap-5 lg:gap-6 items-stretch">
                {/* Partial-payment edge case (hidden when an installment plan
                    owns the balance display) */}
                {isPartiallyPaid && !hasPlan && (
                  <div className="rounded-lg p-5 lg:p-6 bg-warning-bg border border-warning/30">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-warning mb-2">
                      Outstanding balance
                    </div>
                    <div className="text-3xl lg:text-4xl font-bold tracking-tight mb-4 tabular">
                      {formatMoney(outstanding)}
                    </div>
                    <div className="flex flex-col gap-2.5">
                      <Button
                        width="full"
                        disabled={generatingLink}
                        onClick={generatePaymentLink}
                      >
                        {generatingLink ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <LinkIcon className="size-3.5" />
                        )}
                        {generatingLink ? "Generating…" : "Generate payment link"}
                      </Button>
                      <Button
                        width="full"
                        variant="secondary"
                        onClick={() => setRecordOpen(true)}
                      >
                        <Plus className="size-3.5" /> Record payment
                      </Button>
                    </div>
                    <p className="text-xs text-fg-muted mt-3.5 leading-relaxed">
                      Fulfilment policy: order must be paid in full before shipping.{" "}
                      <button className="text-brand-primary font-semibold hover:underline">
                        Override
                      </button>
                    </p>
                  </div>
                )}

                {/* Overpaid edge case */}
                {isOverpaid && (
                  <div className="rounded-lg p-5 lg:p-6 bg-info-bg border border-brand-primary/30">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-brand-primary mb-2">
                      Overpaid · refund due
                    </div>
                    <div className="text-3xl lg:text-4xl font-bold tracking-tight mb-4 tabular">
                      {formatMoney(Math.abs(outstanding))}
                    </div>
                    <div className="flex flex-col gap-2.5">
                      <Button width="full">Refund to original method</Button>
                    </div>
                  </div>
                )}

                {/* Paid-in-full happy path */}
                {!isPartiallyPaid && !isOverpaid && !hasPlan && (
                  <div className="rounded-lg p-5 lg:p-6 bg-success-bg border border-brand-accent/30 flex flex-col">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-brand-accent mb-2 inline-flex items-center gap-1.5">
                      <Check className="size-3.5" /> Paid in full
                    </div>
                    <div className="text-3xl lg:text-4xl font-bold tracking-tight mb-2 tabular">
                      {formatMoney(paid)}
                    </div>
                    <p className="text-sm text-fg-muted">
                      Order is settled. Ready to mark shipped.
                    </p>
                  </div>
                )}

                {/* Installment (buy-now-pay-later) plan */}
                <InstallmentPanel
                  orderNumber={order.number}
                  plan={
                    order.installmentPlan
                      ? {
                          id: order.installmentPlan.id,
                          status: order.installmentPlan.status,
                          minPaymentKobo: order.installmentPlan.minPaymentKobo,
                          targetPayoffDate: order.installmentPlan.targetPayoffDate
                            ? new Date(order.installmentPlan.targetPayoffDate).toISOString()
                            : null,
                          note: order.installmentPlan.note,
                        }
                      : null
                  }
                  outstandingKobo={outstanding}
                  totalKobo={Number(order.totals.totalKobo)}
                  paidKobo={paid}
                  customerName={order.customer?.name ?? order.shipping.name}
                  customerPhone={order.customer?.phone ?? order.shipping.phone}
                  onRecordPayment={() => setRecordOpen(true)}
                />
              </div>

              <Card
                title="Payments"
                action={
                  <span className="text-xs text-fg-muted">
                    {payments.length} {payments.length === 1 ? "record" : "records"}
                  </span>
                }
                padded={false}
              >
                <PaymentLedger
                  payments={payments}
                  onPrint={() => window.print()}
                />
              </Card>

              <Card
                title="Status timeline"
                action={
                  canUpdateStatus ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={actionLoading}
                      onClick={() => setStatusOpen(true)}
                    >
                      {actionLoading ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Truck className="size-3.5" />
                      )}
                      Update status
                    </Button>
                  ) : undefined
                }
              >
                <Timeline events={timeline} />
              </Card>

              <Card title="Internal notes">
                <div className="flex flex-col gap-3">
                  {notes.length === 0 ? (
                    <p className="text-xs text-fg-muted">No notes yet. Notes are visible to staff only.</p>
                  ) : (
                    <div className="flex flex-col gap-3 mb-1">
                      {notes.map((n) => (
                        <NoteEntry
                          key={n.id}
                          author={n.author}
                          time={n.createdAt.toLocaleString("en-NG", { timeZone: "Africa/Lagos", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                          text={n.text}
                        />
                      ))}
                    </div>
                  )}
                  <div className="flex flex-col gap-2 pt-1 border-t border-border">
                    <Textarea
                      placeholder="Add a note for the team…"
                      rows={2}
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        disabled={!noteText.trim() || savingNote}
                        loading={savingNote}
                        onClick={saveNote}
                      >
                        <Send className="size-3.5" /> Save note
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* SIDEBAR — customer, shipping, recent orders */}
            <div className="flex flex-col gap-5 lg:gap-6 min-w-0">
              <Card title="Customer">
                <div className="flex items-center gap-3 mb-4">
                  <Avatar size="lg">
                    <AvatarFallback>{customerInitials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-base">{customerName}</div>
                    <div className="text-xs text-fg-muted font-mono tabular mt-0.5">
                      {customerPhone}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <a href={telLink(customerPhone)}>
                    <Button variant="ghost" size="icon" aria-label="Call">
                      <Phone className="size-3.5" />
                    </Button>
                  </a>
                  <a
                    href={waLink(
                      customerPhone,
                      `Hi ${customerName.split(" ")[0]}, this is Avmall about order #${order.number}.`,
                    )}
                    target="_blank"
                    rel="noopener"
                  >
                    <Button variant="ghost" size="icon" aria-label="WhatsApp">
                      <MessageCircle className="size-3.5" />
                    </Button>
                  </a>
                  {order.customer && (
                    <Link href={`/admin/customers/${order.customer.id}`} className="flex-1">
                      <Button variant="secondary" size="sm" width="full">
                        Profile →
                      </Button>
                    </Link>
                  )}
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
                  <div className="font-semibold">{order.shipping.name}</div>
                  <div className="text-fg-muted">{order.shipping.line1}</div>
                  {order.shipping.line2 && (
                    <div className="text-fg-muted">{order.shipping.line2}</div>
                  )}
                  <div className="text-fg-muted">
                    {order.shipping.city}, {order.shipping.state}
                  </div>
                  <div className="text-fg-muted font-mono text-xs tabular mt-1">
                    {order.shipping.phone}
                  </div>
                </div>
                {order.totals.shippingKobo > 0 && (
                  <div className="mt-4 p-3 rounded-md bg-surface-2 flex items-center gap-2.5">
                    <Truck className="size-4 flex-shrink-0" />
                    <div className="text-xs leading-relaxed">
                      <div className="font-semibold">{order.shipping.state}</div>
                      <div className="text-fg-muted">
                        Shipping · <Money kobo={Number(order.totals.shippingKobo)} />
                      </div>
                    </div>
                  </div>
                )}
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

      {/* Status update modal — shared by the header + timeline buttons. */}
      <Dialog
        open={statusOpen}
        onOpenChange={(o) => !actionLoading && setStatusOpen(o)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Update order status</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-fg-muted">Current</span>
              <OrderStatusPill status={order.status} />
            </div>
            {nextStatuses.length === 0 ? (
              <p className="text-sm text-fg-muted">
                This order is {order.status} — there is no further status to
                move it to.
              </p>
            ) : (
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-fg-muted mb-2">
                  Move to
                </div>
                <Select
                  value={statusChoice}
                  onChange={(e) => setStatusChoice(e.target.value)}
                >
                  {nextStatuses.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            {isPartiallyPaid &&
              (statusChoice === "shipped" || statusChoice === "delivered") && (
                <div className="text-xs text-warning bg-warning-bg p-2.5 rounded-md">
                  This order isn&apos;t paid in full — {formatMoney(outstanding)}{" "}
                  is still outstanding. Fulfilment policy normally requires full
                  payment before shipping.
                </div>
              )}
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="ghost"
              onClick={() => setStatusOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={submitStatus}
              disabled={!statusChoice || actionLoading}
            >
              {actionLoading && <Loader2 className="size-4 animate-spin" />}
              Update status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>

      {/* Print-only receipt — hidden on screen, becomes the sole visible
          element when the user hits Print. */}
      <div className="hidden print:block">
        <ReceiptPrintView
          orderNumber={order.number}
          placedAt={placedAt}
          customer={{
            name: order.customer?.name ?? order.shipping.name,
            phone: order.customer?.phone ?? order.shipping.phone,
          }}
          items={orderItems.map((it) => ({
            name: it.name,
            variant: it.variant,
            sku: it.sku,
            qty: it.qty,
            unitKobo: it.unitKobo,
            discountKobo: it.discountKobo,
          }))}
          totals={{
            subtotalKobo: Number(order.totals.subtotalKobo),
            discountKobo:
              Number(order.totals.bulkDiscountKobo) +
              Number(order.totals.couponDiscountKobo) +
              Number(order.totals.manualDiscountKobo),
            shippingKobo: Number(order.totals.shippingKobo),
            totalKobo: Number(order.totals.totalKobo),
            paidKobo: Number(order.totals.paidKobo),
            outstandingKobo: Math.max(0, outstanding),
          }}
          staffName={currentStaffName}
        />
      </div>

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

      {/* Edit quantity dialog */}
      <Dialog open={!!editQtyTarget} onOpenChange={(o) => !o && setEditQtyTarget(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Edit quantity</DialogTitle>
          </DialogHeader>
          {editQtyTarget && (
            <div className="flex flex-col gap-4 mt-2">
              <p className="text-sm text-fg-muted">
                <span className="font-semibold text-fg">{editQtyTarget.name}</span>
                {editQtyTarget.variant !== "—" && ` · ${editQtyTarget.variant}`}
              </p>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-fg-muted mb-2">New quantity</div>
                <NumberInput
                  value={editQtyValue}
                  onChange={setEditQtyValue}
                  min={1}
                  max={999}
                />
              </div>
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setEditQtyTarget(null)} disabled={lineActionLoading}>
              Cancel
            </Button>
            <Button onClick={submitEditQty} disabled={lineActionLoading || editQtyValue === editQtyTarget?.qty}>
              {lineActionLoading && <Loader2 className="size-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove line confirm */}
      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
        title="Remove item?"
        description={
          removeTarget ? (
            <>
              Remove <span className="font-semibold">{removeTarget.name}</span> from this order.
              Order totals will be recalculated and stock will be released.
            </>
          ) : null
        }
        confirmLabel="Remove item"
        cancelLabel="Keep it"
        destructive
        loading={lineActionLoading}
        onConfirm={submitRemoveLine}
      />

      {/* Add item dialog */}
      <Dialog open={addItemOpen} onOpenChange={(o) => !addItemLoading && setAddItemOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add item</DialogTitle>
          </DialogHeader>

          {!addItemSelected ? (
            <div className="flex flex-col gap-3 mt-2">
              <div className="flex items-center gap-2 px-3 h-10 rounded-md border border-border-strong bg-surface">
                <Search className="size-4 text-fg-muted flex-shrink-0" />
                <input
                  autoFocus
                  value={addItemSearch}
                  onChange={(e) => setAddItemSearch(e.target.value)}
                  placeholder="Search by name, brand or SKU…"
                  className="flex-1 bg-transparent text-sm text-fg placeholder:text-fg-subtle outline-none"
                />
                {addItemSearching && <Loader2 className="size-3.5 animate-spin text-fg-muted flex-shrink-0" />}
              </div>

              {addItemSearch.trim().length >= 2 && (
                <div className="rounded-md border border-border overflow-hidden">
                  {addItemMatches.length === 0 && !addItemSearching ? (
                    <div className="px-4 py-6 text-center text-sm text-fg-muted">No products found</div>
                  ) : (
                    addItemMatches.map((hit) => {
                      const price = hit.saleActive && hit.saleKobo != null ? hit.saleKobo : hit.priceKobo;
                      return (
                        <button
                          key={hit.id}
                          type="button"
                          onClick={() => { setAddItemSelected(hit); setAddItemQty(1); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-2 border-b border-border last:border-b-0 text-left"
                        >
                          <img src={hit.imageUrl} alt="" className="size-10 rounded object-cover flex-shrink-0 bg-surface-2" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{hit.name}</div>
                            <div className="text-xs text-fg-muted">{hit.brand}</div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-sm font-semibold tabular">{formatMoney(price)}</div>
                            <div className={`text-xs ${hit.stock <= 0 ? "text-danger" : "text-fg-muted"}`}>
                              {hit.stock <= 0 ? "Out of stock" : `${hit.stock} in stock`}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}

              {addItemSearch.trim().length < 2 && (
                <p className="text-xs text-fg-subtle text-center py-4">Type at least 2 characters to search</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4 mt-2">
              <div className="flex items-center gap-3 p-3 rounded-md border border-border bg-surface-2">
                <img src={addItemSelected.imageUrl} alt="" className="size-12 rounded object-cover flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{addItemSelected.name}</div>
                  <div className="text-xs text-fg-muted">{addItemSelected.brand}</div>
                  <div className="text-sm font-bold tabular mt-0.5">
                    {formatMoney(addItemSelected.saleActive && addItemSelected.saleKobo != null
                      ? addItemSelected.saleKobo : addItemSelected.priceKobo)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAddItemSelected(null)}
                  className="text-xs text-fg-muted hover:text-fg underline flex-shrink-0"
                >
                  Change
                </button>
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-fg-muted mb-2">Quantity</div>
                <NumberInput value={addItemQty} onChange={setAddItemQty} min={1} max={999} />
              </div>
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setAddItemOpen(false)} disabled={addItemLoading}>
              Cancel
            </Button>
            <Button
              onClick={submitAddItem}
              disabled={!addItemSelected || addItemLoading}
            >
              {addItemLoading && <Loader2 className="size-4 animate-spin" />}
              Add to order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
      <div className="px-5 py-4 flex items-center justify-between gap-2">
        <div className="text-sm font-bold tracking-tight">{title}</div>
        {action}
      </div>
      <div className="h-px bg-border" />
      <div className={padded ? "p-5" : ""}>{children}</div>
    </div>
  );
}

function prettyMethod(method: string): string {
  switch (method) {
    case "nuqood":
      return "Nuqood card";
    case "bank_transfer":
      return "Bank transfer";
    case "pos":
      return "POS terminal";
    case "cash":
      return "Cash";
    default:
      return method;
  }
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
    <div className="text-sm leading-relaxed">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="font-bold text-fg">{author}</span>
        <span className="text-xs text-fg-subtle">· {time}</span>
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
