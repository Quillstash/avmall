"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, ShieldAlert, Camera, MessageCircle, CheckCircle2, XCircle } from "lucide-react";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Money } from "@/components/ui/money";
import { Badge } from "@/components/ui/badge";
import { RefundComposer, type RefundLine } from "@/components/admin/refund-composer";
import { toast } from "@/components/ui/toaster";
import type { AdminReturnDetail } from "@/lib/data/returns";

const TERMINAL: AdminReturnDetail["status"][] = ["refunded", "rejected"];

export function ReturnDetailClient({ ret }: { ret: AdminReturnDetail }) {
  const router = useRouter();

  const [lines, setLines] = React.useState<RefundLine[]>(
    ret.lines.map((l) => ({
      id: l.id,
      name: l.name,
      variant: l.variant,
      qty: l.quantity,
      unitKobo: l.unitKobo,
      condition: l.condition,
      selected: true,
      restock: l.restock,
    })),
  );
  const [method, setMethod] = React.useState<"original" | "transfer">(
    ret.refundMethod,
  );
  const [note, setNote] = React.useState(ret.internalNote ?? "");
  const [busy, setBusy] = React.useState<null | "refund" | "approve" | "reject">(null);

  const isTerminal = TERMINAL.includes(ret.status);

  async function issueRefund() {
    setBusy("refund");
    try {
      const res = await fetch(`/api/v1/admin/returns/${ret.number}/refund`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ method }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error?.message ?? "Couldn't issue refund");
      toast.success("Refund issued");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't issue refund");
    } finally {
      setBusy(null);
    }
  }

  async function setStatus(action: "approve" | "reject") {
    setBusy(action);
    try {
      const res = await fetch(`/api/v1/admin/returns/${ret.number}/approve`, {
        method: action === "approve" ? "POST" : "DELETE",
        headers: { "content-type": "application/json" },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error?.message ?? "Action failed");
      toast.success(action === "approve" ? "Return approved" : "Return rejected");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <AdminTopBar
        breadcrumbs={[
          { label: "Returns", href: "/admin/returns" },
          { label: ret.number },
        ]}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1400px] mx-auto pb-20">
          {ret.status === "refunded" && (
            <Alert
              tone="success"
              icon={<CheckCircle2 className="size-5" />}
              title="Refund issued"
              description="This return has been fully refunded. No further action is needed."
              className="mb-4"
            />
          )}
          {ret.status === "rejected" && (
            <Alert
              tone="neutral"
              icon={<XCircle className="size-5" />}
              title="Return rejected"
              description="This return request was rejected."
              className="mb-4"
            />
          )}
          {ret.outsideWindow && !isTerminal && (
            <Alert
              tone="warning"
              icon={<AlertTriangle className="size-5" />}
              title="Outside 14-day return window"
              description="Order delivered more than 14 days ago. Process only with a Manager override and a recorded reason."
              className="mb-4"
            />
          )}
          {ret.fullyReturned && (
            <Alert
              tone="neutral"
              icon={<ShieldAlert className="size-5" />}
              title="All items already returned"
              description="Every line item on the source order has been returned."
              className="mb-4"
            />
          )}

          <PageHeader
            title={ret.number}
            subtitle={
              <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <Badge className="capitalize">{ret.status.replace(/_/g, " ")}</Badge>
                <span>
                  Against order{" "}
                  <Link
                    href={`/admin/orders/${ret.orderNumber}`}
                    className="font-mono font-bold hover:text-brand-primary"
                  >
                    #{ret.orderNumber}
                  </Link>{" "}
                  · {ret.customer.name} · created {ret.createdAt}
                </span>
              </span>
            }
            actions={
              <>
                <Button variant="ghost" size="sm">
                  <MessageCircle className="size-3.5" /> WhatsApp customer
                </Button>
                {ret.status === "requested" && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setStatus("reject")}
                    disabled={busy !== null}
                    loading={busy === "reject"}
                  >
                    Reject
                  </Button>
                )}
                {ret.status === "requested" && (
                  <Button
                    size="sm"
                    onClick={() => setStatus("approve")}
                    disabled={busy !== null}
                    loading={busy === "approve"}
                  >
                    Approve
                  </Button>
                )}
              </>
            }
          />

          <div className="grid lg:grid-cols-[1fr_320px] gap-4">
            <div className="flex flex-col gap-4">
              <Card title="Refund composition">
                {isTerminal ? (
                  <div className="flex flex-col gap-2">
                    {lines.map((l) => (
                      <div
                        key={l.id}
                        className="flex items-center justify-between rounded-md border border-border p-3 text-sm"
                      >
                        <div>
                          <div className="font-semibold">{l.name}</div>
                          {l.variant && (
                            <div className="text-xs text-fg-muted">{l.variant}</div>
                          )}
                        </div>
                        <div className="text-right">
                          <Money kobo={l.unitKobo * l.qty} className="font-bold" />
                          <div className="text-xs text-fg-muted">×{l.qty}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <RefundComposer
                    lines={lines}
                    onLinesChange={setLines}
                    method={method}
                    onMethodChange={setMethod}
                    note={note}
                    onNoteChange={setNote}
                    onSubmit={issueRefund}
                    loading={busy === "refund"}
                  />
                )}
              </Card>

              <Card title="Reason from customer">
                <p className="text-sm whitespace-pre-wrap">{ret.reason}</p>
                {ret.internalNote && (
                  <p className="mt-3 text-xs text-fg-muted">
                    <span className="font-semibold">Internal note:</span>{" "}
                    {ret.internalNote}
                  </p>
                )}
              </Card>

              <Card title="Photos from customer">
                {ret.photos.length > 0 ? (
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                    {ret.photos.map((src, i) => (
                      <a
                        key={i}
                        href={src}
                        target="_blank"
                        rel="noreferrer"
                        className="relative aspect-square rounded-md overflow-hidden bg-surface-2"
                      >
                        <Image src={src} alt={`Return photo ${i + 1}`} fill className="object-cover" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-fg-muted">
                    <Camera className="size-4" /> No photos attached
                  </div>
                )}
              </Card>
            </div>

            <div className="flex flex-col gap-4">
              <Card title="Customer">
                <div className="text-sm">
                  <div className="font-semibold">{ret.customer.name}</div>
                  <div className="text-fg-muted text-xs mt-0.5">{ret.customer.phone}</div>
                </div>
                <Link href={`/admin/customers/${ret.customer.id}`} className="block mt-3">
                  <Button variant="secondary" size="sm" width="full">
                    View customer →
                  </Button>
                </Link>
              </Card>

              <Card title="Refund summary">
                <div className="text-sm">
                  <div className="flex justify-between py-1">
                    <span className="text-fg-muted">Refund amount</span>
                    <Money kobo={ret.refundKobo} className="font-bold" />
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-fg-muted">Method</span>
                    <span className="capitalize">{ret.refundMethod}</span>
                  </div>
                </div>
                <p className="text-xs text-fg-muted mt-3 leading-relaxed">
                  Damaged items default to <strong>write off</strong> per policy. Toggle restock
                  only with explicit approval.
                </p>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface shadow-sm">
      <div className="px-4 py-3 border-b border-border">
        <div className="text-sm font-bold">{title}</div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
