"use client";

import * as React from "react";
import { Sparkles, Loader2, Lightbulb, TrendingUp, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

interface Insights {
  summary?: string;
  insights?: string[];
  advice?: string[];
  risks?: string[];
}

/** On-demand AI analysis of the current profit range. Fetches once clicked so
 *  we don't burn an LLM call on every page load. */
export function ProfitInsights({ query }: { query: { range?: number; from?: string; to?: string } }) {
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState<Insights | null>(null);

  async function run() {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/reports/profit-insights", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(query),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not generate insights");
        return;
      }
      setData(json.data.insights as Insights);
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface shadow-sm">
      <div className="px-4 py-3.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Sparkles className="size-4 text-brand-primary" /> AI Profit Analysis
        </div>
        <Button size="sm" onClick={run} loading={loading} {...(data && { variant: "secondary" as const })}>
          {data ? "Re-analyze" : "Generate insights"}
        </Button>
      </div>
      <div className="h-px bg-border" />
      <div className="p-4">
        {loading && !data ? (
          <div className="flex items-center gap-2 text-sm text-fg-muted py-6 justify-center">
            <Loader2 className="size-4 animate-spin" /> Analysing your P&L, products and stock…
          </div>
        ) : !data ? (
          <p className="text-sm text-fg-muted">
            Click <span className="font-semibold">Generate insights</span> for an AI breakdown of profit drivers,
            discount impact, dead stock and concrete advice for this period.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {data.summary && <p className="text-sm leading-relaxed font-medium">{data.summary}</p>}
            {!!data.insights?.length && (
              <Section icon={<TrendingUp className="size-3.5 text-brand-accent" />} title="Findings" items={data.insights} />
            )}
            {!!data.advice?.length && (
              <Section icon={<Lightbulb className="size-3.5 text-warning" />} title="Advice" items={data.advice} />
            )}
            {!!data.risks?.length && (
              <Section icon={<AlertTriangle className="size-3.5 text-danger" />} title="Watch-outs" items={data.risks} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-fg-muted mb-1.5">
        {icon} {title}
      </div>
      <ul className="flex flex-col gap-1.5">
        {items.map((t, i) => (
          <li key={i} className="text-sm leading-snug flex gap-2">
            <span className="text-fg-subtle mt-1.5 size-1 rounded-full bg-current flex-shrink-0" aria-hidden />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
