"use client";

import * as React from "react";
import { Money } from "@/components/ui/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MoreHorizontal, Receipt, Printer, Check, Copy } from "lucide-react";
import type { OrderPayment } from "@/lib/admin-mock-data";
import { cn } from "@/lib/utils";

interface PaymentLedgerProps {
  payments: readonly OrderPayment[];
  /** Called when "View receipt" is clicked — parent triggers window.print() */
  onPrint?: () => void;
  className?: string;
}

const STATUS_TONE = {
  completed: "success",
  pending: "warning",
  failed: "danger",
} as const;

export function PaymentLedger({ payments, onPrint, className }: PaymentLedgerProps) {
  const [receiptPayment, setReceiptPayment] = React.useState<OrderPayment | null>(null);
  const [copiedRef, setCopiedRef] = React.useState<string | null>(null);

  function copyRef(ref: string) {
    if (ref === "—") return;
    navigator.clipboard.writeText(ref).then(() => {
      setCopiedRef(ref);
      setTimeout(() => setCopiedRef(null), 1500);
    });
  }

  return (
    <>
      <div className={cn("flex flex-col", className)}>
        {payments.map((p, i) => (
          <div
            key={i}
            className={cn(
              "px-4 py-3 flex items-start gap-3",
              i > 0 && "border-t border-border",
            )}
          >
            <div
              className={cn(
                "size-9 rounded-md flex items-center justify-center flex-shrink-0",
                p.status === "completed"
                  ? "bg-success-bg text-success"
                  : p.status === "pending"
                    ? "bg-warning-bg text-warning"
                    : "bg-danger-bg text-danger",
              )}
            >
              <Receipt className="size-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold">{p.method}</span>
                <Badge tone={STATUS_TONE[p.status]}>
                  {p.status[0]!.toUpperCase() + p.status.slice(1)}
                </Badge>
              </div>
              <div className="text-[11px] text-fg-muted">
                <span className="font-mono tabular">{p.txRef}</span> · by {p.by} · {p.time}
              </div>
            </div>
            <div className="text-right">
              <Money kobo={p.amountKobo} className="font-bold text-sm" />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="p-1.5 text-fg-muted hover:text-fg rounded-md hover:bg-surface-2"
                  aria-label="Payment actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => setReceiptPayment(p)}
                >
                  <Receipt className="size-3.5" /> View receipt
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={p.txRef === "—"}
                  onClick={() => copyRef(p.txRef)}
                >
                  {copiedRef === p.txRef
                    ? <><Check className="size-3.5 text-success" /> Copied</>
                    : <><Copy className="size-3.5" /> Copy reference</>
                  }
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive disabled>
                  Reverse payment — contact support
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>

      {/* Receipt modal */}
      <Dialog open={!!receiptPayment} onOpenChange={(o) => !o && setReceiptPayment(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Payment receipt</DialogTitle>
          </DialogHeader>
          {receiptPayment && (
            <div className="flex flex-col gap-4">
              {/* Payment summary */}
              <div className="rounded-lg bg-surface-2 p-4 font-mono text-sm space-y-2">
                <Row label="Method" value={receiptPayment.method} />
                <Row label="Amount" value={<Money kobo={receiptPayment.amountKobo} className="font-bold" />} />
                <Row label="Status">
                  <Badge tone={STATUS_TONE[receiptPayment.status]}>
                    {receiptPayment.status[0]!.toUpperCase() + receiptPayment.status.slice(1)}
                  </Badge>
                </Row>
                {receiptPayment.txRef !== "—" && (
                  <Row label="Reference">
                    <span className="font-mono text-xs tabular break-all">{receiptPayment.txRef}</span>
                  </Row>
                )}
                <Row label="By" value={receiptPayment.by} />
                <Row label="Time" value={receiptPayment.time} />
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => {
                    setReceiptPayment(null);
                    setTimeout(() => onPrint?.(), 100);
                  }}
                >
                  <Printer className="size-3.5" /> Print order receipt
                </Button>
                {receiptPayment.txRef !== "—" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyRef(receiptPayment.txRef)}
                  >
                    {copiedRef === receiptPayment.txRef
                      ? <Check className="size-3.5 text-success" />
                      : <Copy className="size-3.5" />
                    }
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Row({ label, value, children }: { label: string; value?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="text-fg-muted flex-shrink-0">{label}</span>
      <span className="text-right font-semibold">{value ?? children}</span>
    </div>
  );
}
