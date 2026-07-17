"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Lock, Shield, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/ui/phone-input";
import { Field } from "@/components/ui/field";
import { Money } from "@/components/ui/money";
import { EmptyState } from "@/components/ui/empty-state";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AddressPicker } from "@/components/ui/address-picker";
import { Stepper, type StepperItem } from "@/components/ui/stepper";
import { BankTransferModal } from "@/components/storefront/bank-transfer-modal";
import { useCart, resolveCart, computeTotals } from "@/stores/cart-store";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

// Bank transfer is available everywhere.
// POS is Kaduna-only — enforced here and at the API level.
type PaymentMethod = "bank_transfer" | "pos";

const BANK_TRANSFER_OPTION = {
  id: "bank_transfer" as const,
  name: "Pay by bank transfer",
  sub: "Transfer to a PalmPay account · Powered by Nuqood",
};
const POS_OPTION = {
  id: "pos" as const,
  name: "Pay on delivery (POS / Cash)",
  sub: "Kaduna only · Agent collects on arrival",
};

interface ServerQuote {
  subtotalKobo: number;
  bulkDiscountKobo: number;
  couponDiscountKobo: number;
  shippingKobo: number;
  totalKobo: number;
  itemCount: number;
}

interface ServerQuoteResponse {
  quote: ServerQuote;
  shippingZone?: { name: string; etaDays: string };
}

// localStorage key for a live bank-transfer session
const SESSION_STORAGE_KEY = "avmall-pending-checkout-session";

export default function CheckoutPage() {
  const router = useRouter();
  const lines = useCart((s) => s.lines);
  const clearCart = useCart((s) => s.clear);
  const resolved = React.useMemo(() => resolveCart(lines), [lines]);

  const [step, setStep] = React.useState(1);
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [state, setState] = React.useState("Kaduna");
  const [city, setCity] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [pay, setPay] = React.useState<PaymentMethod>("bank_transfer");
  const [placing, setPlacing] = React.useState(false);

  // Bank-transfer modal state
  const [pendingSessionId, setPendingSessionId] = React.useState<string | null>(null);

  // Payment options — POS only visible for Kaduna
  const isKaduna = state === "Kaduna";
  const paymentOptions = isKaduna
    ? [BANK_TRANSFER_OPTION, POS_OPTION]
    : [BANK_TRANSFER_OPTION];

  // If state changes away from Kaduna while POS is selected, reset to bank transfer
  React.useEffect(() => {
    if (!isKaduna && pay === "pos") setPay("bank_transfer");
  }, [isKaduna, pay]);

  // Restore a live session from a previous page load
  React.useEffect(() => {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) setPendingSessionId(stored);
  }, []);

  // Server quote
  const [serverQuote, setServerQuote] = React.useState<ServerQuoteResponse | null>(null);
  const [quoteLoading, setQuoteLoading] = React.useState(false);
  const optimistic = computeTotals(resolved);

  const prevStateRef = React.useRef(state);
  React.useEffect(() => {
    if (prevStateRef.current !== state) {
      prevStateRef.current = state;
      setServerQuote(null);
    }
  }, [state]);

  React.useEffect(() => {
    if (resolved.length === 0) { setServerQuote(null); return; }
    setQuoteLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/v1/cart/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: resolved.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.qty })),
            ...(state && { state }),
            // LGA enables sub-state (area-level) delivery pricing.
            ...(state && city && { lga: city }),
          }),
          signal: controller.signal,
        });
        const json = await res.json();
        if (res.ok) setServerQuote(json.data as ServerQuoteResponse);
      } catch (err) {
        if ((err as Error).name !== "AbortError") { /* network blip */ }
      } finally { setQuoteLoading(false); }
    }, 300);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [resolved, state, city]);

  const totals = serverQuote?.quote ?? optimistic;
  const shippingZone = serverQuote?.shippingZone ?? null;

  // ── Bank transfer: initiate session ─────────────────────────────────────
  async function startBankTransfer() {
    if (resolved.length === 0) { toast.error("Your cart is empty"); return; }
    if (!name.trim() || !phone.trim() || !address.trim() || !city.trim()) {
      toast.error("Fill in your contact and delivery details first.");
      setStep(1); return;
    }
    setPlacing(true);
    try {
      const res = await fetch("/api/v1/checkout/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: resolved.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.qty })),
          contact: { name: name.trim(), phone: phone.trim(), ...(email.trim() && { email: email.trim() }) },
          shipping: { line1: address.trim(), city: city.trim(), state },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Couldn't start payment");

      const sessionId: string = data.data.sessionId;
      localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
      setPendingSessionId(sessionId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't start payment");
    } finally {
      setPlacing(false);
    }
  }

  // ── POS: create order immediately ────────────────────────────────────────
  async function placePosOrder() {
    if (resolved.length === 0) { toast.error("Your cart is empty"); return; }
    if (!name.trim() || !phone.trim() || !address.trim() || !city.trim()) {
      toast.error("Fill in your contact and delivery details first.");
      setStep(1); return;
    }
    setPlacing(true);
    try {
      const res = await fetch("/api/v1/checkout", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({
          items: resolved.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.qty })),
          contact: { name: name.trim(), phone: phone.trim(), ...(email.trim() && { email: email.trim() }) },
          shipping: { line1: address.trim(), city: city.trim(), state },
          paymentMethod: "pos",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Couldn't place order");
      clearCart();
      router.push(`/orders/${data.data.order.number}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't place order");
    } finally {
      setPlacing(false);
    }
  }

  function handlePlaceOrder() {
    if (pay === "bank_transfer") startBankTransfer();
    else placePosOrder();
  }

  // ── Modal callbacks ───────────────────────────────────────────────────────
  function onPaymentSuccess(orderNumber: string) {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    clearCart();
    router.push(`/orders/${orderNumber}`);
  }

  function onModalClose() {
    // Keep sessionId in localStorage so user can re-open it via the "Resume" banner
    setPendingSessionId(null);
  }

  function onModalRetry() {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setPendingSessionId(null);
    // Re-trigger immediately
    startBankTransfer();
  }

  // ── Guards ───────────────────────────────────────────────────────────────
  if (resolved.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 lg:px-6 py-16">
        <EmptyState
          icon={<Lock className="size-8" />}
          title="Your cart is empty"
          description="Pick something out before you check out."
          action={<Link href="/"><Button>Continue shopping</Button></Link>}
        />
      </div>
    );
  }

  const stepperSteps: StepperItem[] = [
    { id: "1", label: "Contact" },
    { id: "2", label: "Shipping" },
    { id: "3", label: "Payment" },
  ];

  return (
    <>
      {/* Bank transfer modal — rendered outside the page layout so it overlays everything */}
      {pendingSessionId && (
        <BankTransferModal
          sessionId={pendingSessionId}
          onSuccess={onPaymentSuccess}
          onClose={onModalClose}
          onRetry={onModalRetry}
        />
      )}

      <div className="mx-auto max-w-7xl px-4 lg:px-6 py-6 lg:py-10">
        <h1 className="font-display text-3xl lg:text-4xl font-semibold tracking-tight mb-6">
          Checkout
        </h1>

        <Stepper
          steps={stepperSteps}
          current={String(step)}
          completed={step > 1 ? (step > 2 ? ["1", "2"] : ["1"]) : []}
          onStepClick={(id) => { const n = Number(id); if (n < step) setStep(n); }}
          className="mb-8 max-w-xl"
        />

        <div className="grid lg:grid-cols-[1fr_400px] gap-8 lg:gap-12">
          {/* Left */}
          <div className="flex flex-col gap-4">
            {/* Step 1: Contact */}
            <Section step={1} title="Contact & delivery" active={step === 1} done={step > 1} onEdit={() => setStep(1)}>
              {step === 1 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field id="name" label="Recipient name" className="sm:col-span-2">
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
                  </Field>
                  <Field id="phone" label="Phone number">
                    <PhoneInput id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </Field>
                  <Field id="email" label="Email" optional>
                    <Input id="email" type="email" placeholder="For receipts" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </Field>
                  <div className="sm:col-span-2">
                    <AddressPicker state={state} city={city} onStateChange={setState} onCityChange={setCity} />
                  </div>
                  <Field id="address" label="Street address" className="sm:col-span-2">
                    <Textarea id="address" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House number, street, area" />
                  </Field>
                  <div className="sm:col-span-2">
                    <Button onClick={() => setStep(2)} size="lg">Continue to shipping</Button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-fg-muted">
                  <div className="text-fg font-semibold">{name} · {phone}</div>
                  <div>{address}, {city}, {state}</div>
                </div>
              )}
            </Section>

            {/* Step 2: Shipping */}
            <Section step={2} title="Shipping" active={step === 2} done={step > 2} onEdit={() => setStep(2)}>
              {step === 2 ? (
                <div>
                  {quoteLoading ? (
                    <div className="flex items-center gap-2 p-4 rounded-md bg-surface-2 text-sm text-fg-muted mb-4 max-w-md">
                      <Loader2 className="size-4 animate-spin" />
                      Calculating shipping for {state}…
                    </div>
                  ) : shippingZone ? (
                    <div className="flex items-start gap-3 p-4 rounded-md bg-info-bg mb-4 max-w-md">
                      <Check className="size-5 text-brand-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-sm">{shippingZone.name}</div>
                        <div className="text-xs text-fg-muted mt-0.5">
                          Arrives in {shippingZone.etaDays} ·{" "}
                          {totals.shippingKobo === 0
                            ? <span className="text-success font-bold">FREE</span>
                            : <Money kobo={totals.shippingKobo} className="font-bold" />}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-md bg-warning-bg border border-warning/30 text-sm mb-4 max-w-md">
                      <div className="font-bold text-warning mb-1">No shipping zone for {state}</div>
                      <div className="text-fg-muted text-xs">Contact us on WhatsApp for a delivery quote.</div>
                    </div>
                  )}
                  <Button onClick={() => setStep(3)} size="lg" disabled={quoteLoading || !shippingZone}>
                    Continue to payment
                  </Button>
                </div>
              ) : step > 2 ? (
                <div className="text-sm text-fg-muted">
                  {shippingZone?.name ?? "—"} · {shippingZone?.etaDays ?? ""} ·{" "}
                  {totals.shippingKobo === 0
                    ? <span className="text-success font-bold">FREE</span>
                    : <Money kobo={totals.shippingKobo} className="font-bold" />}
                </div>
              ) : null}
            </Section>

            {/* Step 3: Payment */}
            <Section step={3} title="Payment" active={step === 3} done={false}>
              {step === 3 && (
                <div className="flex flex-col gap-3">
                  <RadioGroup value={pay} onValueChange={(v) => setPay(v as PaymentMethod)} className="flex flex-col gap-2">
                    {paymentOptions.map((opt) => (
                      <label
                        key={opt.id}
                        className={cn(
                          "flex items-center gap-3 p-4 rounded-md border cursor-pointer transition-colors",
                          pay === opt.id
                            ? "border-brand-primary bg-info-bg"
                            : "border-border bg-surface hover:border-border-strong",
                        )}
                      >
                        <RadioGroupItem value={opt.id} id={`pay-${opt.id}`} />
                        <div className="flex-1">
                          <div className="text-sm font-semibold">{opt.name}</div>
                          <div className="text-xs text-fg-muted mt-0.5">{opt.sub}</div>
                        </div>
                      </label>
                    ))}
                  </RadioGroup>

                  {!isKaduna && (
                    <p className="text-xs text-fg-muted">
                      Pay on delivery is only available for Kaduna orders.
                    </p>
                  )}

                  <Button size="lg" className="mt-1" loading={placing} onClick={handlePlaceOrder}>
                    <Lock className="size-4" />
                    {pay === "bank_transfer" ? "Pay now · " : "Place order · "}
                    <Money kobo={totals.totalKobo} className="text-brand-primary-fg" />
                  </Button>
                  <p className="text-xs text-fg-muted">
                    {pay === "bank_transfer"
                      ? "You'll see a PalmPay account number to transfer the exact amount to."
                      : "An agent will collect cash or POS payment on delivery."}
                  </p>
                </div>
              )}
            </Section>
          </div>

          {/* Right — order summary */}
          <aside className="lg:sticky lg:top-28 self-start">
            <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
              <h2 className="font-bold text-base mb-4">Order summary</h2>
              <div className="flex flex-col gap-3 mb-4 max-h-80 overflow-y-auto -mx-2 px-2">
                {resolved.map((l) => (
                  <div key={`${l.productId}-${l.variantId}`} className="flex items-center gap-3">
                    <div className="relative size-14 flex-shrink-0 rounded-md overflow-hidden" style={{ background: l.snapshot.bg }}>
                      {l.snapshot.imageUrl && (
                        <Image src={l.snapshot.imageUrl} alt={l.snapshot.name} fill sizes="56px" className="object-cover" />
                      )}
                      <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-fg text-bg text-[10px] font-bold tabular">
                        {l.qty}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold leading-snug line-clamp-1">{l.snapshot.name}</div>
                      <div className="text-[11px] text-fg-muted">{l.snapshot.variantLabel}</div>
                    </div>
                    <Money kobo={l.lineTotalKobo} className="text-xs font-semibold flex-shrink-0" />
                  </div>
                ))}
              </div>
              <div className="h-px bg-border mb-3" />
              <div className="flex flex-col gap-1">
                <SummaryRow label="Subtotal" value={<Money kobo={totals.subtotalKobo - totals.bulkDiscountKobo} />} />
                <SummaryRow
                  label="Shipping"
                  value={
                    !shippingZone ? <span className="text-fg-muted">—</span>
                      : totals.shippingKobo === 0 ? <span className="text-success font-bold">Free</span>
                        : <Money kobo={totals.shippingKobo} />
                  }
                />
              </div>
              <div className="h-px bg-border my-3" />
              <SummaryRow label="Total" value={<Money kobo={totals.totalKobo} />} strong />
              <div className="flex items-center gap-2 justify-center mt-4 text-[11px] text-fg-muted">
                <Shield className="size-3" /> Secure · Nuqood · PalmPay
              </div>
              <Link href="/cart" className="block mt-4 text-center text-xs font-semibold text-brand-primary hover:underline">
                ← Edit cart
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

function Section({ step, title, active, done, children, onEdit }: {
  step: number; title: string; active: boolean; done: boolean;
  children?: React.ReactNode; onEdit?: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={cn(
            "size-7 rounded-full flex items-center justify-center text-xs font-bold",
            done ? "bg-brand-accent text-white" : active ? "bg-fg text-bg" : "bg-surface-2 text-fg-muted",
          )}>
            {done ? <Check className="size-4" strokeWidth={3} /> : step}
          </span>
          <span className="text-base font-bold">{title}</span>
        </div>
        {done && onEdit && (
          <button onClick={onEdit} className="text-sm font-semibold text-brand-primary hover:underline">Edit</button>
        )}
      </div>
      {(active || done) && children && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between", strong ? "text-base font-bold" : "text-sm")}>
      <span className={strong ? "text-fg" : "text-fg-muted"}>{label}</span>
      <span className={cn("tabular", strong ? "font-bold" : "font-semibold")}>{value}</span>
    </div>
  );
}
