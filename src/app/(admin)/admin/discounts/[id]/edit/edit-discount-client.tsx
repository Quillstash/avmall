"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import type { DiscountKind, DiscountValueType } from "@prisma/client";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import { NumberInput } from "@/components/ui/number-input";
import { toast } from "@/components/ui/toaster";

export interface DiscountInput {
  id: string;
  kind: DiscountKind;
  code: string | null;
  name: string;
  valueType: DiscountValueType;
  value: number;
  scope: string;
  usage: number;
  usageLimit: number | null;
  validFrom: string | null;
  validUntil: string | null;
  active: boolean;
  locked: boolean;
}

/** ISO → "YYYY-MM-DDTHH:mm" for <input type="datetime-local">. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function EditDiscountClient({ discount }: { discount: DiscountInput }) {
  const router = useRouter();
  const locked = discount.locked;

  const productScope = discount.scope.startsWith("product:");
  const initialScopeType: "all" | "category" | "products" = productScope
    ? "products"
    : discount.scope.startsWith("category:")
      ? "category"
      : "all";

  const [name, setName] = React.useState(discount.name);
  const [code, setCode] = React.useState(discount.code ?? "");
  const [valueType, setValueType] = React.useState<DiscountValueType>(discount.valueType);
  const [percentValue, setPercentValue] = React.useState(
    discount.valueType === "percentage" ? discount.value : 10,
  );
  const [fixedKobo, setFixedKobo] = React.useState<number | null>(
    discount.valueType === "fixed" ? discount.value : null,
  );
  const [scopeType, setScopeType] = React.useState(initialScopeType);
  const [categorySlug, setCategorySlug] = React.useState(
    discount.scope.startsWith("category:") ? discount.scope.slice("category:".length) : "",
  );
  const [usageLimit, setUsageLimit] = React.useState<number | null>(discount.usageLimit);
  const [validFrom, setValidFrom] = React.useState(toLocalInput(discount.validFrom));
  const [validUntil, setValidUntil] = React.useState(toLocalInput(discount.validUntil));
  const [active, setActive] = React.useState(discount.active);
  const [saving, setSaving] = React.useState(false);

  // Scope is editable only when unlocked and not a specific-products discount
  // (editing the product set needs the full picker — recreate for that).
  const scopeEditable = !locked && !productScope;

  async function save() {
    if (!locked) {
      if (!name.trim()) return toast.error("Name is required.");
      if (discount.kind === "coupon" && !code.trim())
        return toast.error("Coupons must have a code.");
      if (valueType === "fixed" && (fixedKobo == null || fixedKobo <= 0))
        return toast.error("Fixed amount must be greater than zero.");
    }

    const body: Record<string, unknown> = {
      usageLimit: usageLimit ?? null,
      validFrom: validFrom ? new Date(validFrom).toISOString() : null,
      validUntil: validUntil ? new Date(validUntil).toISOString() : null,
      active,
    };
    if (!locked) {
      body.name = name.trim();
      if (discount.kind === "coupon") body.code = code.trim().toUpperCase();
      body.valueType = valueType;
      body.value =
        valueType === "percentage"
          ? percentValue
          : valueType === "fixed"
            ? (fixedKobo ?? 0)
            : 0;
      if (scopeEditable) {
        body.scope =
          scopeType === "category"
            ? `category:${categorySlug.trim() || "all"}`
            : "all";
      }
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/v1/admin/discounts/${discount.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not update discount");
        return;
      }
      toast.success(`Discount "${discount.name}" updated`);
      router.push("/admin/discounts");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <AdminTopBar
        breadcrumbs={[
          { label: "Discounts", href: "/admin/discounts" },
          { label: discount.name },
          { label: "Edit" },
        ]}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[760px] mx-auto pb-20">
          <PageHeader
            title={`Edit ${discount.name}`}
            subtitle={
              discount.kind === "coupon"
                ? "Coupon customers redeem at checkout"
                : "Automatic site-wide rule"
            }
            actions={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/admin/discounts")}
              >
                Cancel
              </Button>
            }
          />

          {locked && (
            <div className="mb-4 flex items-start gap-2 p-3 rounded-md bg-warning-bg text-warning text-sm">
              <Lock className="size-4 flex-shrink-0 mt-0.5" />
              <span>
                Redeemed {discount.usage} time{discount.usage === 1 ? "" : "s"} — the
                value, code, type and scope are locked. You can still change validity,
                usage limit, and the active status.
              </span>
            </div>
          )}

          <div className="rounded-lg border border-border bg-surface shadow-sm p-5 flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field id="d-name" label="Name">
                <Input
                  id="d-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={locked}
                />
              </Field>
              {discount.kind === "coupon" && (
                <Field id="d-code" label="Code">
                  <Input
                    id="d-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    disabled={locked}
                    className="font-mono"
                  />
                </Field>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field id="d-type" label="Discount type">
                <Select
                  id="d-type"
                  value={valueType}
                  onChange={(e) => setValueType(e.target.value as DiscountValueType)}
                  disabled={locked}
                >
                  <option value="percentage">Percentage off</option>
                  <option value="fixed">Fixed amount off</option>
                  <option value="free_shipping">Free shipping</option>
                </Select>
              </Field>
              {valueType === "percentage" && (
                <Field id="d-pct" label="Percent off">
                  <NumberInput
                    value={percentValue}
                    onChange={setPercentValue}
                    min={0}
                    max={100}
                    disabled={locked}
                  />
                </Field>
              )}
              {valueType === "fixed" && (
                <Field id="d-fixed" label="Amount off">
                  <CurrencyInput
                    {...(fixedKobo != null ? { valueKobo: fixedKobo } : {})}
                    onValueChange={setFixedKobo}
                    disabled={locked}
                  />
                </Field>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field id="d-scope" label="Applies to">
                {scopeEditable ? (
                  <Select
                    id="d-scope"
                    value={scopeType}
                    onChange={(e) =>
                      setScopeType(e.target.value as "all" | "category" | "products")
                    }
                  >
                    <option value="all">All products</option>
                    <option value="category">A category</option>
                  </Select>
                ) : (
                  <Input
                    id="d-scope"
                    value={
                      productScope
                        ? `Specific products (${discount.scope.slice("product:".length).split(",").filter(Boolean).length})`
                        : discount.scope === "all"
                          ? "All products"
                          : discount.scope
                    }
                    disabled
                  />
                )}
              </Field>
              {scopeEditable && scopeType === "category" && (
                <Field id="d-cat" label="Category slug">
                  <Input
                    id="d-cat"
                    value={categorySlug}
                    onChange={(e) => setCategorySlug(e.target.value)}
                    placeholder="e.g. phones"
                  />
                </Field>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field id="d-limit" label="Usage limit" hint="Blank = unlimited">
                <NumberInput
                  value={usageLimit ?? 0}
                  onChange={(n) => setUsageLimit(n > 0 ? n : null)}
                  min={0}
                />
              </Field>
              <Field id="d-from" label="Valid from">
                <input
                  id="d-from"
                  type="datetime-local"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm"
                />
              </Field>
              <Field id="d-until" label="Valid until">
                <input
                  id="d-until"
                  type="datetime-local"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm"
                />
              </Field>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="size-4 accent-[hsl(var(--brand-primary))]"
              />
              <span className="text-sm font-semibold">Active</span>
              <span className="text-sm text-fg-muted">
                — customers can redeem / the rule applies
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="ghost"
              onClick={() => router.push("/admin/discounts")}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Save changes
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
