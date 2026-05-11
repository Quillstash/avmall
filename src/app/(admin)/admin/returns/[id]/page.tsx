import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ShieldAlert, Camera, MessageCircle } from "lucide-react";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RETURNS } from "@/lib/admin-mock-data";

interface PageProps {
  params: { id: string };
}

export default function AdminReturnDetailPage({ params }: PageProps) {
  const r = RETURNS.find((r) => r.id === params.id);
  if (!r) notFound();

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
            <div className="mb-4 p-4 rounded-lg bg-warning-bg border border-warning/30 flex items-start gap-3">
              <AlertTriangle className="size-5 text-warning flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-bold text-sm text-warning mb-1">
                  Outside 14-day return window
                </div>
                <p className="text-xs text-fg-muted">
                  Order delivered more than 14 days ago. Returns can only be processed with a Manager override and a recorded reason.
                </p>
                <Button variant="ghost" size="sm" className="mt-2 text-warning">
                  Request Manager override
                </Button>
              </div>
            </div>
          )}

          {r.fullyReturned && (
            <div className="mb-4 p-4 rounded-lg bg-surface-2 border border-border flex items-start gap-3">
              <ShieldAlert className="size-5 text-fg-muted flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-bold text-sm mb-1">All items already returned</div>
                <p className="text-xs text-fg-muted">
                  Every line item on this order has been returned. No additional refund is owed.
                </p>
              </div>
            </div>
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
                  <>
                    <Button variant="secondary" size="sm">
                      Reject
                    </Button>
                    <Button size="sm">Approve return</Button>
                  </>
                )}
                {r.status === "approved" && <Button size="sm">Issue refund</Button>}
              </>
            }
          />

          <div className="grid lg:grid-cols-[1fr_320px] gap-4">
            {/* Left */}
            <div className="flex flex-col gap-4">
              <Card title="Items returned">
                <table className="w-full text-sm">
                  <thead className="bg-surface-2">
                    <tr className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                      <th className="text-left px-3 py-2">Item</th>
                      <th className="text-right px-3 py-2">Qty</th>
                      <th className="text-left px-3 py-2">Condition</th>
                      <th className="text-left px-3 py-2">Restock</th>
                      <th className="text-right px-3 py-2">Refund</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      {
                        name: "Whipped Shea Body Balm",
                        variant: "250g",
                        qty: 2,
                        condition: "Unopened",
                        restock: true,
                        refundKobo: 3600000,
                      },
                      {
                        name: "Harmattan Incense Set",
                        variant: "24 sticks",
                        qty: 1,
                        condition: "Damaged",
                        restock: false,
                        refundKobo: 480000,
                      },
                    ].map((item, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-2.5">
                          <div className="font-semibold">{item.name}</div>
                          <div className="text-[11px] text-fg-muted">{item.variant}</div>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular">{item.qty}</td>
                        <td className="px-3 py-2.5">
                          <Badge tone={item.condition === "Damaged" ? "danger" : "success"}>
                            {item.condition}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5">
                          <label className="inline-flex items-center gap-2 cursor-pointer">
                            <Checkbox defaultChecked={item.restock} />
                            <span className="text-xs">
                              {item.restock ? "Restock" : "Write off"}
                            </span>
                          </label>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Money kobo={item.refundKobo} className="font-bold" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border bg-surface-2 font-bold">
                      <td colSpan={4} className="px-3 py-2.5 text-right">
                        Total refund
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Money kobo={r.refundKobo} />
                      </td>
                    </tr>
                  </tfoot>
                </table>
                <p className="text-[11px] text-fg-muted mt-3">
                  &ldquo;Damaged&rdquo; items default to{" "}
                  <span className="font-semibold">Write off</span> — restock requires explicit
                  staff toggle per policy.
                </p>
              </Card>

              <Card title="Reason">
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

            {/* Right */}
            <div className="flex flex-col gap-4">
              <Card title="Refund method">
                <div className="space-y-2">
                  {["Original payment method", "Store credit (+5% bonus)", "Bank transfer"].map(
                    (m, i) => (
                      <label
                        key={m}
                        className="flex items-center gap-2 p-2.5 rounded-md border border-border hover:border-border-strong cursor-pointer text-sm"
                      >
                        <input
                          type="radio"
                          name="refund-method"
                          defaultChecked={i === 0}
                          className="accent-brand-primary"
                        />
                        {m}
                      </label>
                    ),
                  )}
                </div>
              </Card>

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
