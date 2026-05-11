import { Sparkles, MessageCircle, Clock, ArrowRight, Settings, AlertTriangle } from "lucide-react";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const HANDOFFS = [
  {
    customer: "Henry W.",
    phone: "+234 802 999 0011",
    reason: "Asked about wholesale terms above tier 3",
    waitMin: 6,
    channel: "WhatsApp",
    breached: true,
  },
  {
    customer: "Aisha M.",
    phone: "+234 814 220 6688",
    reason: "Wants to negotiate price below floor",
    waitMin: 2,
    channel: "WhatsApp",
  },
];

export default function AdminAIPage() {
  return (
    <>
      <AdminTopBar breadcrumbs={[{ label: "AI agent" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1400px] mx-auto">
          <PageHeader
            title="AI agent — Ada"
            subtitle={
              <span className="inline-flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-success font-semibold">
                  <span className="size-1.5 rounded-full bg-success" />
                  Online
                </span>
                <span>· 142 conversations today · 38 orders placed</span>
              </span>
            }
            actions={
              <Button variant="secondary" size="sm">
                <Settings className="size-3.5" /> Configure
              </Button>
            }
          />

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-5">
            {[
              { l: "Conversations today", v: "142", s: "vs 128 yesterday" },
              { l: "Orders placed", v: "38", s: "27% of all today" },
              { l: "Avg response", v: "1.4s", s: "tool calls included" },
              { l: "Handoff rate", v: "1.4%", s: "2 pending now" },
            ].map((k) => (
              <div key={k.l} className="rounded-lg border border-border bg-surface p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
                  {k.l}
                </div>
                <div className="text-2xl font-bold tracking-tight mt-1 tabular">{k.v}</div>
                <div className="text-[11px] text-fg-muted mt-0.5">{k.s}</div>
              </div>
            ))}
          </div>

          {/* Handoff queue + settings */}
          <div className="grid lg:grid-cols-[1.5fr_1fr] gap-4">
            <Card
              title="Handoff queue"
              action={<Badge tone="warning">{HANDOFFS.length} pending</Badge>}
            >
              {HANDOFFS.length === 0 ? (
                <div className="text-sm text-fg-muted text-center py-8">
                  No customers waiting. ✨
                </div>
              ) : (
                <div className="flex flex-col">
                  {HANDOFFS.map((h, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-3 p-3 ${i > 0 ? "border-t border-border" : ""} ${h.breached ? "bg-warning-bg/50" : ""}`}
                    >
                      <div className="size-10 rounded-full bg-gradient-to-br from-brand-primary to-[hsl(262_60%_48%)] text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                        {h.customer
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold text-sm">{h.customer}</div>
                          {h.breached && (
                            <Badge tone="danger" className="inline-flex items-center gap-1">
                              <AlertTriangle className="size-2.5" /> SLA
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-fg-muted">{h.reason}</div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-fg-muted">
                        <Clock className="size-3.5" />
                        <span className="tabular">{h.waitMin}m</span>
                        <Badge>{h.channel}</Badge>
                      </div>
                      <Button size="sm">
                        Claim <ArrowRight className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <div className="flex flex-col gap-4">
              <Card title="Floor pricing">
                <p className="text-xs text-fg-muted mb-3 leading-relaxed">
                  Below-floor prices trigger handoff. Floor values are never exposed to the
                  customer or the LLM&apos;s response.
                </p>
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span>Default floor</span>
                    <span className="font-bold tabular">10% below sale</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Wholesale floor</span>
                    <span className="font-bold tabular">15% below sale</span>
                  </div>
                </div>
                <Button variant="secondary" size="sm" width="full" className="mt-3">
                  Edit floors
                </Button>
              </Card>

              <Card title="Channels">
                <ul className="text-sm space-y-2">
                  <li className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2">
                      <MessageCircle className="size-3.5" /> WhatsApp
                    </span>
                    <Badge tone="success">Active</Badge>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2">
                      <Sparkles className="size-3.5" /> Web chat
                    </span>
                    <Badge tone="success">Active</Badge>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-fg-muted">
                      Email (future)
                    </span>
                    <Badge tone="neutral">Off</Badge>
                  </li>
                </ul>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface shadow-sm">
      <div className="px-4 py-3 flex items-center justify-between border-b border-border">
        <div className="text-sm font-bold">{title}</div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
