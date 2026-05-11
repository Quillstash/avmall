"use client";

import * as React from "react";
import { notFound, useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ShieldAlert, Camera, MessageCircle } from "lucide-react";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Money } from "@/components/ui/money";
import { RefundComposer, type RefundLine } from "@/components/admin/refund-composer";
import { toast } from "@/components/ui/toaster";
import { RETURNS } from "@/lib/admin-mock-data";

interface PageProps {
  params: { id: string };
}

export default function AdminReturnDetailPage({ params }: PageProps) {
  const router = useRouter();
  const r = RETURNS.find((r) => r.id === params.id);
  if (!r) notFound();

  const [lines, setLines] = React.useState<RefundLine[]>([
    {
      id: "rl1",
      name: "Whipped Shea Body Balm",
      variant: "250g",
      qty: 2,
      unitKobo: 1800000,
      condition: "unopened",
      selected: true,
      restock: true,
    },
    {
      id: "rl2",
      name: "Harmattan Incense Set",
      variant: "24 sticks",
      qty: 1,
      unitKobo: 480000,
      condition: "damaged",
      selected: true,
      restock: false, // spec §20 — damaged defaults OFF
    },
  ]);
  const [method, setMethod] = React.useState<"original" | "credit" | "transfer">("original");
  const [note, setNote] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  function issueRefund() {
    setLoading(true);
    window.setTimeout(() => {
      setLoading(false);
      toast.success("Refund issued");
      router.push("/admin/returns");
    }, 600);
  }

  return (
    <>
      <AdminTopBar
        breadcrumbs={[
          { label: "Returns", href: "/admin/returns" },
          { label: r.id },
        ]}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1400px] mx-auto pb-20">
          {/* Edge case banners */}
          {r.outsideWindow && (
            <Alert
              tone="warning"
              icon={<AlertTriangle className="size-5" />}
              title="Outside 14-day return window"
              description="Order delivered more than 14 days ago. Returns can only be processed with a Manager override and a recorded reason."
              action={
                <Button variant="ghost" size="sm" className="text-warning">
                  Request Manager override
                </Button>
              }
              className="mb-4"
            />
          )}

          {r.fullyReturned && (
            <Alert
              tone="neutral"
              icon={<ShieldAlert className="size-5" />}
              title="All items already returned"
              description="Every line item on this order has been returned. No additional refund is owed."
              className="mb-4"
            />
          )}

          <PageHeader
            title={r.id}
            subtitle={
              <span>
                Against order{" "}
                <Link
                  href={`/admin/orders/${r.orderNumber}`}
                  className="font-mono font-bold hover:text-brand-primary"
                >
                  #{r.orderNumber}
                </Link>{" "}
                · {r.customerName} · created {r.createdAt}
              </span>
            }
            actions={
              <>
                <Button variant="ghost" size="sm">
                  <MessageCircle className="size-3.5" /> WhatsApp customer
                </Button>
                {r.status === "requested" && (
                  <Button variant="secondary" size="sm">
                    Reject
                  </Button>
                )}
              </>
            }
          />

          <div className="grid lg:grid-cols-[1fr_320px] gap-4">
            <div className="flex flex-col gap-4">
              <Card title="Refund composition">
                <RefundComposer
                  lines={lines}
                  onLinesChange={setLines}
                  method={method}
                  onMethodChange={setMethod}
                  note={note}
                  onNoteChange={setNote}
                  onSubmit={issueRefund}
                  loading={loading}
                />
              </Card>

              <Card title="Reason from customer">
                <p className="text-sm mb-3">{r.reason}</p>
                <Textarea placeholder="Add internal note…" rows={3} />
              </Card>

              <Card title="Photos from customer">
                <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="aspect-square rounded-md bg-surface-2 flex items-center justify-center text-fg-subtle"
                    >
                      <Camera className="size-5" />
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <div className="flex flex-col gap-4">
              <Card title="Customer">
                <div className="text-sm">
                  <div className="font-semibold">{r.customerName}</div>
                  <div className="text-fg-muted text-xs mt-0.5">
                    Order placed on 24 Dec 2025
                  </div>
                </div>
                <Link href={`/admin/customers/c1`} className="block mt-3">
                  <Button variant="secondary" size="sm" width="full">
                    View customer →
                  </Button>
                </Link>
              </Card>

              <Card title="Refund summary">
                <div className="text-sm">
                  <div className="flex justify-between py-1">
                    <span className="text-fg-muted">Requested</span>
                    <Money kobo={r.refundKobo} className="font-bold" />
                  </div>
                </div>
                <p className="text-xs text-fg-muted mt-3 leading-relaxed">
                  Damaged items default to <strong>Write off</strong> per policy. Toggle restock
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
