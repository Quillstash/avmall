"use client";

import * as React from "react";
import { Check, Copy, AlertCircle, Loader2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";

interface AccountDetails {
  bank: string;
  number: string;
  name: string;
}

type SessionStatus =
  | { kind: "loading" }
  | { kind: "pending"; account: AccountDetails; amountKobo: number; secondsLeft: number }
  | { kind: "paid"; orderNumber: string }
  | { kind: "expired" };

interface BankTransferModalProps {
  sessionId: string;
  /** Called when user confirms payment (modal shows success) */
  onSuccess: (orderNumber: string) => void;
  /** Called when user explicitly closes the modal */
  onClose: () => void;
  /** Called when user clicks "Try again" after expiry — parent restarts the flow */
  onRetry: () => void;
}

const POLL_INTERVAL_MS = 3000;

export function BankTransferModal({
  sessionId,
  onSuccess,
  onClose,
  onRetry,
}: BankTransferModalProps) {
  const [status, setStatus] = React.useState<SessionStatus>({ kind: "loading" });
  const [copied, setCopied] = React.useState<string | null>(null);

  // ── Fetch + poll ────────────────────────────────────────────────────────
  const fetchStatus = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/checkout/status/${sessionId}`);
      const json = await res.json();
      const data = json?.data;
      if (!data) return;

      if (data.status === "paid") {
        setStatus({ kind: "paid", orderNumber: data.orderNumber ?? "" });
        return;
      }
      if (data.status === "expired") {
        setStatus({ kind: "expired" });
        return;
      }
      // pending
      setStatus({
        kind: "pending",
        account: data.account,
        amountKobo: data.amountKobo,
        secondsLeft: data.secondsLeft ?? 1800,
      });
    } catch {
      // network blip — keep current state
    }
  }, [sessionId]);

  React.useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchStatus]);

  // Countdown tick (local, doesn't re-poll)
  React.useEffect(() => {
    if (status.kind !== "pending") return;
    if (status.secondsLeft <= 0) {
      setStatus({ kind: "expired" });
      return;
    }
    const id = setTimeout(() => {
      if (status.kind === "pending") {
        setStatus({ ...status, secondsLeft: status.secondsLeft - 1 });
      }
    }, 1000);
    return () => clearTimeout(id);
  }, [status]);

  // Auto-advance to success
  React.useEffect(() => {
    if (status.kind === "paid") {
      const id = setTimeout(() => onSuccess(status.orderNumber), 1500);
      return () => clearTimeout(id);
    }
  }, [status, onSuccess]);

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  return (
    // Backdrop
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-fg/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-surface shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="font-bold text-base">Bank Transfer</div>
          {status.kind !== "paid" && (
            <button
              onClick={onClose}
              className="size-8 flex items-center justify-center rounded-md hover:bg-surface-2 text-fg-muted"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          {/* Loading */}
          {status.kind === "loading" && (
            <div className="flex flex-col items-center gap-3 py-8 text-fg-muted">
              <Loader2 className="size-8 animate-spin" />
              <div className="text-sm">Setting up your account…</div>
            </div>
          )}

          {/* Pending — show account */}
          {status.kind === "pending" && (
            <>
              <div className="text-center mb-5">
                <div className="text-xs font-bold uppercase tracking-widest text-fg-muted mb-1">
                  Transfer exactly
                </div>
                <div className="text-3xl font-bold tabular">
                  <Money kobo={status.amountKobo} />
                </div>
                <div
                  className={cn(
                    "inline-flex items-center gap-1.5 mt-2 text-sm font-semibold tabular",
                    status.secondsLeft <= 120 ? "text-danger" : "text-fg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      status.secondsLeft <= 120 ? "bg-danger animate-pulse" : "bg-brand-accent",
                    )}
                  />
                  Account expires in {formatTime(status.secondsLeft)}
                </div>
              </div>

              <div className="rounded-lg border border-border overflow-hidden divide-y divide-border mb-5">
                <CopyRow
                  label="Bank"
                  value={status.account.bank}
                  copied={copied === "bank"}
                  onCopy={(v) => copy(v, "bank")}
                />
                <CopyRow
                  label="Account number"
                  value={status.account.number}
                  mono
                  highlight
                  copied={copied === "number"}
                  onCopy={(v) => copy(v, "number")}
                />
                <CopyRow
                  label="Account name"
                  value={status.account.name}
                  copied={copied === "name"}
                  onCopy={(v) => copy(v, "name")}
                />
              </div>

              <div className="flex items-start gap-2 p-3 rounded-md bg-info-bg text-info text-xs leading-relaxed mb-3">
                <AlertCircle className="size-4 flex-shrink-0 mt-0.5" />
                <div>
                  This account is provided by{" "}
                  <strong>{status.account.name}</strong>, Avmall&apos;s trusted
                  payment partner, so that name is normal — please don&apos;t
                  worry. Your payment is secure and goes straight to your Avmall
                  order.
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-md bg-warning-bg text-warning text-xs leading-relaxed">
                <AlertCircle className="size-4 flex-shrink-0 mt-0.5" />
                <div>
                  Transfer the <strong>exact amount</strong> shown above to this one-time account.
                  Do <strong>not</strong> use this account for future payments — a new one is created per order.
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4 text-[11px] text-fg-muted justify-center">
                <Loader2 className="size-3 animate-spin" />
                Checking for payment…
              </div>
            </>
          )}

          {/* Paid — success */}
          {status.kind === "paid" && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="size-16 rounded-full bg-brand-accent flex items-center justify-center text-white">
                <Check className="size-8" strokeWidth={3} />
              </div>
              <div className="text-center">
                <div className="text-xl font-bold mb-1">Payment received!</div>
                <div className="text-sm text-fg-muted">
                  Your order <span className="font-mono font-bold">#{status.orderNumber}</span> has been confirmed.
                </div>
              </div>
              <div className="text-xs text-fg-muted animate-pulse">Redirecting…</div>
            </div>
          )}

          {/* Expired */}
          {status.kind === "expired" && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="size-16 rounded-full bg-warning-bg flex items-center justify-center text-warning">
                <AlertCircle className="size-8" />
              </div>
              <div className="text-center">
                <div className="text-xl font-bold mb-1">Account expired</div>
                <div className="text-sm text-fg-muted">
                  The 30-minute window has passed. Generate a new account to complete your payment.
                </div>
              </div>
              <div className="flex gap-3 w-full">
                <Button onClick={onRetry} className="flex-1">
                  <RefreshCw className="size-4" /> Try again
                </Button>
                <Button variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CopyRow({
  label,
  value,
  mono,
  highlight,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
  copied: boolean;
  onCopy: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">{label}</div>
        <div className={cn("font-semibold mt-0.5 truncate", mono && "font-mono tabular", highlight && "text-lg")}>
          {value}
        </div>
      </div>
      <button
        onClick={() => onCopy(value)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface-2 border border-border text-xs font-semibold hover:bg-bg flex-shrink-0"
      >
        {copied ? (
          <><Check className="size-3.5 text-success" /> Copied</>
        ) : (
          <><Copy className="size-3.5" /> Copy</>
        )}
      </button>
    </div>
  );
}
