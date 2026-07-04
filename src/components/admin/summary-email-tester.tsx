"use client";

import * as React from "react";
import { Mail, Loader2, CalendarDays, CalendarRange, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

type Period = "daily" | "weekly" | "monthly";

const PERIODS: { value: Period; label: string; icon: typeof CalendarDays }[] = [
  { value: "daily", label: "Daily", icon: CalendarDays },
  { value: "weekly", label: "Weekly", icon: CalendarRange },
  { value: "monthly", label: "Monthly", icon: CalendarClock },
];

export function SummaryEmailTester() {
  const [busy, setBusy] = React.useState<Period | null>(null);

  async function send(period: Period) {
    setBusy(period);
    try {
      const res = await fetch("/api/v1/admin/reports/email-summary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ period }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Couldn't send the summary");
        return;
      }
      toast.success(`${period[0]!.toUpperCase()}${period.slice(1)} summary sent to ${json.data.sentTo}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-start gap-3 mb-3">
        <div className="size-10 rounded-md bg-info-bg text-brand-primary flex items-center justify-center flex-shrink-0">
          <Mail className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm">Sales summary emails</div>
          <p className="text-xs text-fg-muted leading-relaxed mt-0.5">
            Managers &amp; super-admins get an automatic recap — <b>daily</b>, every{" "}
            <b>Monday</b> for the week, and on the <b>1st</b> for the month. Send yourself a
            preview to see one now.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => {
          const Icon = p.icon;
          return (
            <Button
              key={p.value}
              size="sm"
              variant="secondary"
              disabled={busy !== null}
              onClick={() => send(p.value)}
            >
              {busy === p.value ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Icon className="size-3.5" />
              )}
              Preview {p.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

SummaryEmailTester.displayName = "SummaryEmailTester";
