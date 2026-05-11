"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Lock, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/ui/phone-input";
import { Field } from "@/components/ui/field";
import { Money } from "@/components/ui/money";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AddressPicker } from "@/components/ui/address-picker";
import { Stepper, type StepperItem } from "@/components/ui/stepper";
import { useCart, resolveCart, computeTotals } from "@/stores/cart-store";
import { cn } from "@/lib/utils";

type PaymentMethod = "nuqood" | "transfer" | "pod";

const PAYMENT_OPTIONS: { id: PaymentMethod; name: string; sub: string }[] = [
  { id: "nuqood", name: "Card · Nuqood", sub: "Pay with Visa, Mastercard, Verve" },
  { id: "transfer", name: "Bank transfer", sub: "Pay to our verified account" },
  { id: "pod", name: "Pay on delivery", sub: "Cash or POS · Lagos only" },
];

export default function CheckoutPage() {
  const router = useRouter();
  const lines = useCart((s) => s.lines);
  const resolved = React.useMemo(() => resolveCart(lines), [lines]);
  const totals = computeTotals(resolved, { shippingKobo: 0 });

  const [step, setStep] = React.useState(1);
  const [phone, setPhone] = React.useState("803 421 7790");
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("Tolu Adeniyi");
  const [state, setState] = React.useState("Lagos");
  const [city, setCity] = React.useState("Ikoyi");
  const [address, setAddress] = React.useState("14 Bourdillon Road, Apt 3B");
  const [pay, setPay] = React.useState<PaymentMethod>("nuqood");

  const stepperSteps: StepperItem[] = [
    { id: "1", label: "Contact" },
    { id: "2", label: "Shipping" },
    { id: "3", label: "Payment" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 lg:px-6 py-6 lg:py-10">
      <h1 className="font-display text-3xl lg:text-4xl font-semibold tracking-tight mb-6">
        Checkout
      </h1>

      <Stepper
        steps={stepperSteps}
        current={String(step)}
        completed={step > 1 ? (step > 2 ? ["1", "2"] : ["1"]) : []}
        onStepClick={(id) => {
          const n = Number(id);
          if (n < step) setStep(n);
        }}
        className="mb-8 max-w-xl"
      />

      <div className="grid lg:grid-cols-[1fr_400px] gap-8 lg:gap-12">
        {/* Left — sections */}
        <div className="flex flex-col gap-4">
          <Section
            step={1}
            title="Contact & delivery"
            active={step === 1}
            done={step > 1}
            onEdit={() => setStep(1)}
          >
            {step === 1 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field id="phone" label="Phone number" className="sm:col-span-2 sm:max-w-md">
                  <PhoneInput
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </Field>
                <Field id="email" label="Email" optional>
                  <Input
                    id="email"
                    type="email"
                    placeholder="for receipts"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
                <Field id="name" label="Recipient name" className="sm:col-span-2">
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <div className="sm:col-span-2">
                  <AddressPicker
                    state={state}
                    city={city}
                    onStateChange={setState}
                    onCityChange={setCity}
                  />
                </div>
                <Field
                  id="address"
                  label="Street address"
                  className="sm:col-span-2"
                >
                  <Textarea
                    id="address"
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Button onClick={() => setStep(2)} size="lg">
                    Continue to shipping
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-fg-muted">
                <div className="text-fg font-semibold">
                  {name} · +234 {phone}
                </div>
                <div>
                  {address}, {city}, {state}
                </div>
              </div>
            )}
          </Section>

          <Section
            step={2}
            title="Shipping"
            active={step === 2}
            done={step > 2}
            onEdit={() => setStep(2)}
          >
            {step === 2 ? (
              <div>
                <div className="flex items-start gap-3 p-4 rounded-md bg-success-bg mb-4 max-w-md">
                  <Check className="size-5 text-success flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-sm text-success">Free shipping unlocked</div>
                    <div className="text-xs text-fg-muted mt-0.5">
                      Lagos zone · arrives in 24 hours
                    </div>
                  </div>
                </div>
                <Button onClick={() => setStep(3)} size="lg">
                  Continue to payment
                </Button>
              </div>
            ) : step > 2 ? (
              <div className="text-sm text-fg-muted">
                Lagos zone · 24h ·{" "}
                <span className="text-success font-bold">FREE</span>
              </div>
            ) : null}
          </Section>

          <Section step={3} title="Payment" active={step === 3} done={false}>
            {step === 3 && (
              <div className="flex flex-col gap-3">
                <RadioGroup
                  value={pay}
                  onValueChange={(v) => setPay(v as PaymentMethod)}
                  className="flex flex-col gap-2"
                >
                  {PAYMENT_OPTIONS.map((opt) => (
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
                <Button
                  size="lg"
                  className="mt-2"
                  onClick={() => router.push("/orders/AVM-2841")}
                >
                  <Lock className="size-4" /> Place order ·{" "}
                  <Money kobo={totals.totalKobo} className="text-brand-primary-fg" />
                </Button>
                <p className="text-xs text-fg-muted">
                  You&apos;ll be redirected to Nuqood to complete payment.
                </p>
              </div>
            )}
          </Section>
        </div>

        {/* Right — summary */}
        <aside className="lg:sticky lg:top-28 self-start">
          <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
            <h2 className="font-bold text-base mb-4">Order summary</h2>

            <div className="flex flex-col gap-3 mb-4 max-h-80 overflow-y-auto -mx-2 px-2">
              {resolved.map((l) => (
                <div
                  key={`${l.productId}-${l.variantId}`}
                  className="flex items-center gap-3"
                >
                  <div
                    className="relative size-14 flex-shrink-0 rounded-md overflow-hidden"
                    style={{ background: l.product.bg }}
                  >
                    <Image
                      src={l.product.imageUrl}
                      alt={l.product.name}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                    <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-fg text-bg text-[10px] font-bold tabular">
                      {l.qty}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold leading-snug line-clamp-1">
                      {l.product.name}
                    </div>
                    <div className="text-[11px] text-fg-muted">{l.variant.label}</div>
                  </div>
                  <Money kobo={l.lineTotalKobo} className="text-xs font-semibold flex-shrink-0" />
                </div>
              ))}
            </div>

            <div className="h-px bg-border mb-3" />

            <div className="flex flex-col gap-1">
              <SummaryRow
                label="Subtotal"
                value={<Money kobo={totals.subtotalKobo - totals.bulkDiscountKobo} />}
              />
              <SummaryRow
                label="Shipping"
                value={<span className="text-brand-accent font-bold">Free</span>}
              />
            </div>

            <div className="h-px bg-border my-3" />
            <SummaryRow label="Total" value={<Money kobo={totals.totalKobo} />} strong />

            <div className="flex items-center gap-2 justify-center mt-4 text-[11px] text-fg-muted">
              <Shield className="size-3" /> Secure · Nuqood PCI-DSS · 256-bit SSL
            </div>

            <Link href="/cart" className="block mt-4 text-center text-xs font-semibold text-brand-primary hover:underline">
              ← Edit cart
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Section({
  step,
  title,
  active,
  done,
  children,
  onEdit,
}: {
  step: number;
  title: string;
  active: boolean;
  done: boolean;
  children?: React.ReactNode;
  onEdit?: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "size-7 rounded-full flex items-center justify-center text-xs font-bold",
              done
                ? "bg-brand-accent text-white"
                : active
                  ? "bg-fg text-bg"
                  : "bg-surface-2 text-fg-muted",
            )}
          >
            {done ? <Check className="size-4" strokeWidth={3} /> : step}
          </span>
          <span className="text-base font-bold">{title}</span>
        </div>
        {done && onEdit && (
          <button
            onClick={onEdit}
            className="text-sm font-semibold text-brand-primary hover:underline"
          >
            Edit
          </button>
        )}
      </div>
      {(active || done) && children && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between",
        strong ? "text-base font-bold" : "text-sm",
      )}
    >
      <span className={strong ? "text-fg" : "text-fg-muted"}>{label}</span>
      <span className={cn("tabular", strong ? "font-bold" : "font-semibold")}>{value}</span>
    </div>
  );
}
