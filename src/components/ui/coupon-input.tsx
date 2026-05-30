"use client";

import * as React from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CouponInputProps {
  /** Currently applied coupon code. */
  value: string | null;
  /** Called when user submits a code. Should validate server-side; for now sync. */
  onApply: (code: string) => void;
  /** Called when user removes the applied coupon. */
  onRemove: () => void;
  hint?: React.ReactNode;
  /** Validation error from the server (e.g. "Coupon expired or used up"). */
  error?: string;
  className?: string;
}

export function CouponInput({ value, onApply, onRemove, hint, error, className }: CouponInputProps) {
  const [draft, setDraft] = React.useState("");

  if (value) {
    return (
      <div className={cn("flex items-center justify-between px-3 py-2 rounded-md bg-success-bg text-success text-sm font-semibold", className)}>
        <span className="inline-flex items-center gap-2">
          <Check className="size-3.5" /> Coupon <code className="font-mono">{value}</code>
        </span>
        <button onClick={onRemove} className="hover:bg-success/10 p-1 rounded" aria-label="Remove coupon">
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className={className}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) onApply(draft.trim().toUpperCase());
        }}
        className="flex gap-2"
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value.toUpperCase())}
          placeholder="Coupon code"
          className="flex-1 font-mono uppercase"
        />
        <Button type="submit" variant="secondary">
          Apply
        </Button>
      </form>
      {error ? (
        <p className="text-[11px] text-danger mt-1.5">{error}</p>
      ) : hint ? (
        <p className="text-[11px] text-fg-subtle mt-1.5">{hint}</p>
      ) : null}
    </div>
  );
}
