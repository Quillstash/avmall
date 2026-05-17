import Link from "next/link";
import {
  Sparkles,
  MessageCircle,
  Inbox,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NegotiationSettingsCard } from "@/components/admin/negotiation-settings-card";
import { SITE } from "@/lib/site";

/**
 * AI agent admin page.
 *
 * The AI agent itself runs on D-Zero (https://dailzero.com) — they host the
 * widget, the LLM, and the conversation state. This page is our control
 * surface on top of that:
 *
 *   1. Negotiation settings (live)  — what the AI is allowed to settle at.
 *      Per-product overrides + the global default. Both already wired.
 *   2. Conversations  (pending)  — live D-Zero chat history + a way for
 *      staff to qualify each thread (Won / Lost / Follow-up / Spam).
 *      Needs a server-side D-Zero API key + their REST docs to wire up.
 *   3. Channels  (informational)  — which surfaces the embed is live on.
 *
 * Anything that needs the AI to actually take an action against our system
 * (look up a product, place an order, check stock) goes through our own
 * /api/v1/ai/tools/* endpoints — D-Zero calls them with a bearer JWT.
 */

const DZERO_DASHBOARD_URL = "https://dailzero.com/app";

export default function AdminAiPage() {
  return (
    <>
      <AdminTopBar breadcrumbs={[{ label: "AI agent" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1400px] mx-auto">
          <PageHeader
            title="AI agent"
            subtitle={
              <span className="inline-flex items-center gap-2">
                <Sparkles className="size-3.5 text-brand-primary" />
                <span>
                  Powered by D-Zero · negotiation rules, conversation history, and
                  channels managed here
                </span>
              </span>
            }
            actions={
              <a
                href={DZERO_DASHBOARD_URL}
                target="_blank"
                rel="noreferrer noopener"
              >
                <Button variant="secondary" size="sm">
                  Open D-Zero dashboard <ExternalLink className="size-3.5" />
                </Button>
              </a>
            }
          />

          <div className="grid lg:grid-cols-[1.5fr_1fr] gap-4">
            {/* Conversations — placeholder until D-Zero API is wired */}
            <div className="rounded-lg border border-border bg-surface shadow-sm">
              <div className="px-4 py-3 flex items-center justify-between border-b border-border">
                <div className="text-sm font-bold">Conversations</div>
                <Badge tone="warning">Awaiting D-Zero connection</Badge>
              </div>
              <div className="p-6 text-center">
                <div className="mx-auto size-12 rounded-full bg-surface-2 flex items-center justify-center mb-4">
                  <Inbox className="size-5 text-fg-muted" />
                </div>
                <h3 className="font-bold text-sm mb-2">
                  Pull chats + qualify them here
                </h3>
                <p className="text-xs text-fg-muted max-w-md mx-auto leading-relaxed">
                  When the D-Zero server-side API key is added, every WhatsApp + web-chat
                  conversation will land here with a per-thread Won / Lost / Follow-up /
                  Spam picker. Outcomes are stored against our customer record so the
                  tagging survives even if we swap providers.
                </p>
                <div className="mt-5 p-3 rounded-md bg-info-bg text-left max-w-md mx-auto">
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-primary mb-1.5">
                    <AlertCircle className="size-3.5" /> What we still need
                  </div>
                  <ul className="text-[11px] text-fg leading-relaxed space-y-1">
                    <li>· D-Zero server-side API key (sk_live_…) — add to .env.local</li>
                    <li>· REST base URL + endpoint for listing conversations</li>
                    <li>· Webhook secret if D-Zero pushes new messages live</li>
                  </ul>
                </div>
                <a
                  href={DZERO_DASHBOARD_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-primary hover:underline mt-4"
                >
                  Open D-Zero to view chats now <ExternalLink className="size-3" />
                </a>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <NegotiationSettingsCard />

              <div className="rounded-lg border border-border bg-surface shadow-sm">
                <div className="px-4 py-3 border-b border-border">
                  <div className="text-sm font-bold">Channels</div>
                </div>
                <div className="p-4">
                  <ul className="text-sm space-y-2.5">
                    <li className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-2">
                        <Sparkles className="size-3.5" /> Web chat widget
                      </span>
                      <Badge tone="success">Live</Badge>
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-2">
                        <MessageCircle className="size-3.5" /> WhatsApp
                      </span>
                      <Badge tone="neutral">Setup pending</Badge>
                    </li>
                  </ul>
                  <p className="text-[11px] text-fg-muted mt-3 leading-relaxed">
                    The D-Zero widget is embedded in the storefront layout. For WhatsApp,
                    connect the {SITE.social.whatsapp ? "" : "business "}number from the
                    D-Zero dashboard.
                  </p>
                  <Link href="/admin/settings">
                    <Button variant="secondary" size="sm" className="mt-3">
                      Channel settings
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
