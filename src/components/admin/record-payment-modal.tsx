"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { Money } from "@/components/ui/money";
import { AlertTriangle } from "lucide-react";

interface RecordPaymentModalProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Outstanding balance on the order. */
  outstandingKobo: number;
  onSubmit: (data: {
    amountKobo: number;
    method: string;
    reference: string;
    note: string;
  }) => void;
  loading?: boolean;
}

const METHODS = [
  "Nuqood card",
  "Bank transfer",
  "POS terminal",
  "Cash",
  "Other",
] as const;

export function RecordPaymentModal({
  open,
  onOpenChange,
  outstandingKobo,
  onSubmit,
  loading,
}: RecordPaymentModalProps) {
  const [amountKobo, setAmountKobo] = React.useState<number | null>(outstandingKobo);
  const [method, setMethod] = React.useState<(typeof METHODS)[number]>("Bank transfer");
  const [reference, setReference] = React.useState("");
  const [note, setNote] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setAmountKobo(outstandingKobo);
      setReference("");
      setNote("");
    }
  }, [open, outstandingKobo]);

  const overpay = amountKobo != null && amountKobo > outstandingKobo;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            Outstanding balance: <Money kobo={outstandingKobo} className="font-bold" />
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (amountKobo == null || amountKobo <= 0) return;
            onSubmit({ amountKobo, method, reference, note });
          }}
          className="flex flex-col gap-4 mt-2"
        >
          <Field id="amount" label="Amount" hint="In Naira — stored as kobo internally">
            <CurrencyInput
              id="amount"
              {...(amountKobo != null ? { valueKobo: amountKobo } : {})}
              onValueChange={setAmountKobo}
            />
          </Field>

          {overpay && (
            <Alert
              tone="warning"
              icon={<AlertTriangle className="size-4" />}
              title="Amount exceeds outstanding"
              description="The customer will be overpaid. You can refund the difference."
            />
          )}

          <Field id="method" label="Method">
            <Select
              id="method"
              value={method}
              onChange={(e) => setMethod(e.target.value as (typeof METHODS)[number])}
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </Field>

          <Field id="reference" label="Reference" optional>
            <Input
              id="reference"
              placeholder="Bank reference / receipt number"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="font-mono"
            />
          </Field>

          <Field id="note" label="Internal note" optional>
            <Textarea
              id="note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={loading ?? false}>
              Record payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
