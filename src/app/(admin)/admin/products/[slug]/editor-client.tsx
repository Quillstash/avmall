"use client";

import * as React from "react";
import { Save, Trash2, Eye, Pencil } from "lucide-react";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { NumberInput } from "@/components/ui/number-input";
import { Money } from "@/components/ui/money";
import { Badge } from "@/components/ui/badge";
import { BulkTierEditor } from "@/components/ui/bulk-tier-editor";
import { ImageUploader, type UploadedImage } from "@/components/ui/image-uploader";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { CodeInput } from "@/components/ui/code-input";
import { TagInput } from "@/components/ui/tag-input";
import { toast } from "@/components/ui/toaster";
import { useRouter } from "next/navigation";
import {
  type BulkTier,
  type Category,
  type Product,
  type ProductVariant,
} from "@/lib/mock-data";
import type { ProductAuditSummary } from "@/lib/data/products";
import { ProfitDisplay } from "@/components/admin/profit-display";
import { StockAdjust } from "@/components/admin/stock-adjust";
import { applyPercentageDiscount } from "@/lib/money";

interface EditorClientProps {
  product: Product;
  audit: ProductAuditSummary;
  categories: Category[];
}

export function ProductEditorClient({ product, audit, categories }: EditorClientProps) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [archiving, setArchiving] = React.useState(false);

  const [name, setName] = React.useState(product.name);
  const [brand, setBrand] = React.useState(product.brand);
  const [category, setCategory] = React.useState(product.category);
  const [short, setShort] = React.useState(product.short);
  const [longDesc, setLongDesc] = React.useState(
    "Crafted in small batches with sustainably-sourced ingredients.",
  );
  const [slug, setSlug] = React.useState(product.slug);
  const [priceKobo, setPriceKobo] = React.useState<number | null>(product.price);
  const [saleKobo, setSaleKobo] = React.useState<number | null>(product.sale ?? null);
  const [costKobo, setCostKobo] = React.useState<number | null>(product.cost);
  const [moq, setMoq] = React.useState(product.moq ?? 1);
  const [tags, setTags] = React.useState<string[]>(["handmade", "lagos"]);
  const [preorder, setPreorder] = React.useState(!!product.preorder);
  const [featured, setFeatured] = React.useState(!!product.featured);
  const [published, setPublished] = React.useState(product.published ?? true);
  const [bulk, setBulk] = React.useState<BulkTier[]>([...product.bulk]);

  // Negotiation overrides — same shape as the create page.
  const [negotiate, setNegotiate] = React.useState(!!product.negotiate);
  const [negotiationMode, setNegotiationMode] = React.useState<"global" | "pct" | "floor">(
    product.negotiateFloor != null
      ? "floor"
      : product.negotiateMaxPct != null
        ? "pct"
        : "global",
  );
  const [negotiateMaxPct, setNegotiateMaxPct] = React.useState<number>(
    product.negotiateMaxPct ?? 10,
  );
  const [negotiateFloorKobo, setNegotiateFloorKobo] = React.useState<number | null>(
    product.negotiateFloor ?? null,
  );

  // Effective AI settle-floor for the current mode + price.
  const negotiationFloorKobo: number | null =
    !negotiate || priceKobo == null
      ? null
      : negotiationMode === "pct"
        ? priceKobo - applyPercentageDiscount(priceKobo, negotiateMaxPct)
        : negotiationMode === "floor"
          ? negotiateFloorKobo
          : null;
  const [images, setImages] = React.useState<UploadedImage[]>(
    product.imageRecords && product.imageRecords.length > 0
      ? // Real uploaded images — seed with their R2 key so they survive a save.
        product.imageRecords.map((img, i) => ({
          id: `img-${i}`,
          url: img.url,
          key: img.key,
          alt: img.alt ?? product.name,
          primary: img.primary ?? i === 0,
        }))
      : // Slug-resolved fallback imagery (no ProductImage row) — no key to carry.
        (product.gallery ?? [product.imageUrl]).map((url, i) => ({
          id: `img-${i}`,
          url,
          alt: product.name,
          primary: i === 0,
        })),
  );

  return (
    <>
      <AdminTopBar
        breadcrumbs={[
          { label: "Products", href: "/admin/products" },
          { label: name },
        ]}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1400px] mx-auto pb-20">
          <PageHeader
            title={name}
            subtitle={
              <span className="inline-flex items-center gap-2">
                <code className="font-mono text-xs text-fg-muted tabular">
                  {product.brand.slice(0, 3).toUpperCase()}-{product.id.toUpperCase()}
                </code>
                <Badge tone={published ? "success" : "neutral"}>
                  {published ? "Published" : "Draft"}
                </Badge>
              </span>
            }
            actions={
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    window.open(`/product/${product.slug}`, "_blank", "noopener")
                  }
                >
                  <Eye className="size-3.5" /> Preview
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  loading={archiving}
                  onClick={async () => {
                    setArchiving(true);
                    try {
                      const res = await fetch(
                        `/api/v1/admin/products/${slug}/archive`,
                        { method: "POST" },
                      );
                      if (res.status === 404 || res.status === 503) {
                        toast.success("Archived (local)");
                      } else if (res.ok) {
                        toast.success("Archived");
                        router.push("/admin/products");
                      } else {
                        const p = await res.json();
                        toast.error(p.error?.message ?? "Failed");
                      }
                    } finally {
                      setArchiving(false);
                    }
                  }}
                >
                  <Trash2 className="size-3.5" /> Archive
                </Button>
                <Button
                  size="sm"
                  loading={saving}
                  onClick={async () => {
                    // Only block while an upload is actually in flight
                    // (`progress` set). A settled image has either a key
                    // (uploaded) or an error (failed); slug-resolved fallback
                    // imagery has neither and must not block an unrelated save.
                    if (images.some((i) => i.progress != null)) {
                      toast.error("Please wait for images to finish uploading.");
                      return;
                    }
                    setSaving(true);
                    try {
                      const res = await fetch(
                        `/api/v1/admin/products/${product.slug}`,
                        {
                          method: "PATCH",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({
                            name,
                            brand,
                            categorySlug: category,
                            shortDesc: short,
                            longDesc,
                            ...(priceKobo != null && { priceKobo }),
                            ...(costKobo != null && { costPriceKobo: costKobo }),
                            ...(saleKobo != null
                              ? { saleKobo, saleActive: true }
                              : { saleKobo: null, saleActive: false }),
                            negotiate,
                            negotiateMaxPct:
                              negotiate && negotiationMode === "pct" ? negotiateMaxPct : null,
                            negotiateFloorKobo:
                              negotiate && negotiationMode === "floor"
                                ? negotiateFloorKobo
                                : null,
                            preorder,
                            ...(preorder && { moq }),
                            tags,
                            published,
                            featured,
                            bulkTiers: bulk.map((t) => ({
                              min: t.min,
                              max: t.max,
                              type: t.type,
                              value: t.value,
                            })),
                            // R2 image keys — entries without a key (legacy
                            // CloudFront fallbacks) are dropped.
                            images: images
                              .filter((img) => !!img.key)
                              .map((img) => ({
                                key: img.key!,
                                ...(img.alt && { alt: img.alt }),
                                ...(img.primary && { primary: true }),
                              })),
                          }),
                        },
                      );
                      if (res.status === 404 || res.status === 503) {
                        toast.success("Saved (local)");
                      } else if (res.ok) {
                        toast.success("Saved");
                        router.refresh();
                      } else {
                        const p = await res.json();
                        toast.error(p.error?.message ?? "Couldn't save");
                      }
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  <Save className="size-3.5" /> Save
                </Button>
              </>
            }
          />

          <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
            <div className="flex flex-col gap-4 min-w-0">
              <Card title="Basics">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field id="name" label="Product name" className="md:col-span-2">
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                  </Field>
                  <Field id="brand" label="Brand">
                    <Input id="brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
                  </Field>
                  <Field id="category" label="Category">
                    <Select
                      id="category"
                      value={category}
                      onChange={(e) =>
                        setCategory(e.target.value as typeof category)
                      }
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field id="short" label="Short description" className="md:col-span-2">
                    <Input
                      id="short"
                      value={short}
                      onChange={(e) => setShort(e.target.value)}
                    />
                  </Field>
                  <Field id="long" label="Full description" className="md:col-span-2">
                    <RichTextEditor value={longDesc} onChange={setLongDesc} rows={6} />
                  </Field>
                  <Field id="tags" label="Tags" className="md:col-span-2">
                    <TagInput
                      value={tags}
                      onChange={setTags}
                      lowercase
                      suggestions={["handmade", "small-batch", "lagos", "vegan", "organic"]}
                    />
                  </Field>
                </div>
              </Card>

              <Card title="Media">
                <ImageUploader
                  images={images}
                  onChange={setImages}
                  scope="product"
                  scopeId={product.slug}
                  max={8}
                />
              </Card>

              <Card title="Pricing">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Field id="price" label="Regular price">
                    <CurrencyInput
                      id="price"
                      {...(priceKobo != null ? { valueKobo: priceKobo } : {})}
                      onValueChange={setPriceKobo}
                    />
                  </Field>
                  <Field id="sale" label="Sale price" hint="Optional">
                    <CurrencyInput
                      id="sale"
                      {...(saleKobo != null ? { valueKobo: saleKobo } : {})}
                      onValueChange={setSaleKobo}
                    />
                  </Field>
                  <Field id="cost" label="Cost" hint="Internal — for margin reports">
                    <CurrencyInput
                      id="cost"
                      {...(costKobo != null ? { valueKobo: costKobo } : {})}
                      onValueChange={(v) => setCostKobo(v)}
                    />
                  </Field>
                </div>

                {priceKobo != null && costKobo != null && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <ProfitDisplay
                      priceKobo={priceKobo}
                      costKobo={costKobo}
                      label="Profit at retail"
                    />
                    {saleKobo != null && (
                      <ProfitDisplay
                        priceKobo={saleKobo}
                        costKobo={costKobo}
                        label="Profit at sale price"
                      />
                    )}
                  </div>
                )}

                <div className="mt-5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-fg-muted mb-2">
                    Bulk pricing tiers
                  </div>
                  <BulkTierEditor
                    tiers={bulk}
                    onChange={setBulk}
                    {...(priceKobo != null && costKobo != null && {
                      priceKobo: saleKobo ?? priceKobo,
                      costKobo,
                    })}
                  />
                </div>
              </Card>

              <Card title="Negotiation">
                <SwitchRow
                  label="Open to negotiation"
                  description="Customers can propose a price via the AI / WhatsApp"
                  checked={negotiate}
                  onChange={setNegotiate}
                />
                {negotiate && (
                  <div className="mt-4 flex flex-col gap-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                      Negotiation cap
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {(
                        [
                          { id: "global", label: "Use global default" },
                          { id: "pct", label: "% off retail" },
                          { id: "floor", label: "Flat ₦ floor" },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setNegotiationMode(opt.id)}
                          className={
                            negotiationMode === opt.id
                              ? "px-3 py-2 text-xs font-semibold rounded-md bg-brand-primary text-brand-primary-fg"
                              : "px-3 py-2 text-xs font-semibold rounded-md bg-surface-2 text-fg hover:bg-bg"
                          }
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {negotiationMode === "pct" && (
                      <Field id="negPct" label="Max % off retail">
                        <NumberInput
                          value={negotiateMaxPct}
                          onChange={(n) => setNegotiateMaxPct(Math.max(0, Math.min(50, n)))}
                          min={0}
                          max={50}
                          suffix="%"
                        />
                      </Field>
                    )}
                    {negotiationMode === "floor" && (
                      <Field id="negFloor" label="Minimum acceptable price">
                        <CurrencyInput
                          id="negFloor"
                          {...(negotiateFloorKobo != null
                            ? { valueKobo: negotiateFloorKobo }
                            : {})}
                          onValueChange={(v) => setNegotiateFloorKobo(v)}
                        />
                      </Field>
                    )}
                    {negotiationFloorKobo != null && costKobo != null && (
                      <div className="rounded-md border border-warning/30 bg-warning-bg/30 p-3">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-fg-muted mb-1.5">
                          If the AI settles at this floor
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[10px] text-fg-muted">Floor price</div>
                            <Money kobo={negotiationFloorKobo} className="text-sm font-bold" />
                          </div>
                          <ProfitDisplay
                            priceKobo={negotiationFloorKobo}
                            costKobo={costKobo}
                            size="compact"
                          />
                        </div>
                      </div>
                    )}
                    <p className="text-[11px] text-fg-muted">
                      The AI never reveals this value.
                    </p>
                  </div>
                )}
              </Card>

              <Card title="Variants & inventory">
                <div className="flex flex-col gap-3">
                  {product.variants.map((v) => (
                    <VariantRow
                      key={v.id}
                      productSlug={product.slug}
                      productBrand={product.brand}
                      variant={v}
                      option1Name={product.option1Name ?? null}
                      option2Name={product.option2Name ?? null}
                      fallbackPriceKobo={priceKobo ?? product.price}
                      costKobo={costKobo}
                      isOnlyVariant={product.variants.length <= 1}
                    />
                  ))}
                </div>
                <AddVariantInline
                  productSlug={product.slug}
                  option1Name={product.option1Name ?? null}
                  option2Name={product.option2Name ?? null}
                />
                <p className="mt-3 text-[11px] text-fg-muted">
                  Existing variants can&apos;t be deleted (the SKU is on past order
                  lines). Use Stock adjust to bring stock to zero, or archive the
                  whole product.
                </p>
              </Card>
            </div>

            <div className="flex flex-col gap-4">
              <Card title="Status">
                <div className="flex flex-col gap-3">
                  <SwitchRow
                    label="Published"
                    description="Visible on the storefront"
                    checked={published}
                    onChange={setPublished}
                  />
                  <SwitchRow
                    label="Featured"
                    description="Highlighted on the home page"
                    checked={featured}
                    onChange={setFeatured}
                  />
                  <SwitchRow
                    label="Pre-order only"
                    description="MOQ enforced — won't reserve stock"
                    checked={preorder}
                    onChange={setPreorder}
                  />
                  {preorder && (
                    <Field id="moq" label="MOQ (minimum order qty)">
                      <NumberInput value={moq} onChange={setMoq} min={1} />
                    </Field>
                  )}
                </div>
              </Card>

              <Card title="SEO">
                <Field id="slug" label="URL slug">
                  <CodeInput
                    id="slug"
                    value={slug}
                    onChange={setSlug}
                    uppercase={false}
                    pattern={/[a-z0-9-]/i}
                  />
                </Field>
                <Field id="meta" label="Meta description" className="mt-3">
                  <Input id="meta" placeholder="Optional" />
                </Field>
              </Card>

              <Card title="Audit">
                <dl className="text-xs space-y-1.5">
                  <div className="flex justify-between gap-2">
                    <dt className="text-fg-muted">Created</dt>
                    <dd className="text-right">
                      {formatLagosDate(audit.createdAt)}
                      {audit.createdBy && (
                        <span className="text-fg-muted"> by {audit.createdBy}</span>
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-fg-muted">Last edit</dt>
                    <dd className="text-right">
                      {timeAgo(audit.updatedAt)}
                      {audit.updatedBy && (
                        <span className="text-fg-muted"> by {audit.updatedBy}</span>
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-fg-muted">Sales (30d)</dt>
                    <dd className="font-bold tabular">
                      {audit.sales30d} {audit.sales30d === 1 ? "unit" : "units"}
                    </dd>
                  </div>
                </dl>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface shadow-sm">
      <div className="px-4 py-3 border-b border-border">
        <div className="text-sm font-bold">{title}</div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function SwitchRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <Switch checked={checked} onCheckedChange={onChange} className="mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{label}</div>
        {description && <div className="text-xs text-fg-muted">{description}</div>}
      </div>
    </label>
  );
}

// Format absolute date in Africa/Lagos. Used for the "Created" line.
function formatLagosDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Lagos",
  });
}

// Relative time for the "Last edit" line. Falls back to absolute >30 days.
function timeAgo(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}h ago`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day}d ago`;
  return formatLagosDate(date);
}

/** A single variant row. View mode shows the price/stock and edit/delete
 *  actions; edit mode exposes the label, option values, and price override.
 *  Editing is safe on ordered variants (order lines snapshot their own copy);
 *  deletion is gated to variants with no order history and never the last one. */
function VariantRow({
  productSlug,
  productBrand,
  variant,
  option1Name,
  option2Name,
  fallbackPriceKobo,
  costKobo,
  isOnlyVariant,
}: {
  productSlug: string;
  productBrand: string;
  variant: ProductVariant;
  option1Name: string | null;
  option2Name: string | null;
  fallbackPriceKobo: number;
  costKobo: number | null;
  isOnlyVariant: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [label, setLabel] = React.useState(variant.label);
  const [option1Value, setOption1Value] = React.useState(variant.option1Value ?? "");
  const [option2Value, setOption2Value] = React.useState(variant.option2Value ?? "");
  // null = inherit the product price.
  const [priceOverride, setPriceOverride] = React.useState<number | null>(variant.price);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const effectiveKobo = (editing ? priceOverride : variant.price) ?? fallbackPriceKobo;
  const hasOrders = (variant.orderLineCount ?? 0) > 0;

  function resetFromVariant() {
    setLabel(variant.label);
    setOption1Value(variant.option1Value ?? "");
    setOption2Value(variant.option2Value ?? "");
    setPriceOverride(variant.price);
  }

  async function save() {
    if (!label.trim()) {
      toast.error("Label is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        `/api/v1/admin/products/${encodeURIComponent(productSlug)}/variants/${variant.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: label.trim(),
            // Empty clears the option value; only send keys the product uses.
            ...(option1Name ? { option1Value: option1Value.trim() || null } : {}),
            ...(option2Name ? { option2Value: option2Value.trim() || null } : {}),
            // number sets the override, null clears it (inherit product price).
            priceOverrideKobo: priceOverride,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not update variant");
        return;
      }
      toast.success("Variant updated");
      setEditing(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    if (!window.confirm(`Delete variant "${variant.label}"? This can't be undone.`)) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/v1/admin/products/${encodeURIComponent(productSlug)}/variants/${variant.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        toast.error(json?.error?.message ?? "Could not delete variant");
        return;
      }
      toast.success(`Variant "${variant.label}" deleted`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 p-3 rounded-md border border-border">
      <div className="flex flex-col gap-2 min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <div className="font-semibold text-sm truncate">{variant.label}</div>
          <Money kobo={effectiveKobo} className="text-sm font-bold" />
        </div>
        <div className="text-[11px] font-mono text-fg-muted truncate">
          {productBrand.slice(0, 3).toUpperCase()}-{variant.id.toUpperCase()}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-fg-muted">
            Stock: <span className="font-bold tabular">{variant.stock}</span>
          </span>
          {costKobo != null && (
            <ProfitDisplay priceKobo={effectiveKobo} costKobo={costKobo} size="compact" />
          )}
        </div>

        {editing ? (
          <div className="mt-1 rounded-md border border-border bg-surface-2 p-3 flex flex-col gap-2.5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {option1Name && (
                <Field id={`v-${variant.id}-o1`} label={option1Name}>
                  <Input
                    id={`v-${variant.id}-o1`}
                    value={option1Value}
                    onChange={(e) => setOption1Value(e.target.value)}
                  />
                </Field>
              )}
              {option2Name && (
                <Field id={`v-${variant.id}-o2`} label={option2Name}>
                  <Input
                    id={`v-${variant.id}-o2`}
                    value={option2Value}
                    onChange={(e) => setOption2Value(e.target.value)}
                  />
                </Field>
              )}
              <Field id={`v-${variant.id}-label`} label="Display label">
                <Input
                  id={`v-${variant.id}-label`}
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </Field>
              <Field id={`v-${variant.id}-price`} label="Price override">
                <CurrencyInput
                  id={`v-${variant.id}-price`}
                  {...(priceOverride != null ? { valueKobo: priceOverride } : {})}
                  onValueChange={setPriceOverride}
                  placeholder="Inherit product price"
                />
              </Field>
            </div>
            <p className="text-[11px] text-fg-muted">
              Leave the price blank to inherit the product price (
              <Money kobo={fallbackPriceKobo} />
              ). The SKU can&apos;t be changed.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={saving}
                onClick={() => {
                  resetFromVariant();
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
              <Button type="button" size="sm" loading={saving} onClick={save}>
                Save variant
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 mt-0.5">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-primary hover:underline"
            >
              <Pencil className="size-3" /> Edit
            </button>
            <button
              type="button"
              onClick={del}
              disabled={hasOrders || isOnlyVariant || deleting}
              title={
                hasOrders
                  ? "On past orders — can't delete. Set stock to zero instead."
                  : isOnlyVariant
                    ? "A product must keep at least one variant."
                    : "Delete this variant"
              }
              className="inline-flex items-center gap-1 text-xs font-semibold text-danger hover:underline disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
            >
              <Trash2 className="size-3" /> Delete
            </button>
          </div>
        )}
      </div>
      <div className="lg:w-72">
        <StockAdjust
          productSlug={productSlug}
          variantId={variant.id}
          variantLabel={variant.label}
          currentStock={variant.stock}
        />
      </div>
    </div>
  );
}

/** Inline "Add new variant" form on the edit page. */
function AddVariantInline({
  productSlug,
  option1Name,
  option2Name,
}: {
  productSlug: string;
  option1Name: string | null;
  option2Name: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [label, setLabel] = React.useState("");
  const [sku, setSku] = React.useState("");
  const [option1Value, setOption1Value] = React.useState("");
  const [option2Value, setOption2Value] = React.useState("");
  const [stock, setStock] = React.useState(0);
  // null = inherit the product's price.
  const [priceOverride, setPriceOverride] = React.useState<number | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Auto-derive label from option values when both are filled, so staff
  // don't have to type "Small / Red" themselves.
  React.useEffect(() => {
    if (option1Name || option2Name) {
      const parts = [option1Value, option2Value].filter(Boolean);
      if (parts.length > 0) setLabel(parts.join(" / "));
    }
  }, [option1Value, option2Value, option1Name, option2Name]);

  async function submit() {
    if (!label.trim() || !sku.trim()) {
      toast.error("Label and SKU are required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/v1/admin/products/${encodeURIComponent(productSlug)}/variants`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: label.trim(),
            sku: sku.trim().toUpperCase(),
            ...(option1Name && option1Value.trim() && { option1Value: option1Value.trim() }),
            ...(option2Name && option2Value.trim() && { option2Value: option2Value.trim() }),
            stock,
            ...(priceOverride != null && { priceOverrideKobo: priceOverride }),
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not create variant");
        return;
      }
      toast.success(`Variant "${label}" added`);
      setOpen(false);
      setLabel("");
      setSku("");
      setOption1Value("");
      setOption2Value("");
      setStock(0);
      setPriceOverride(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-primary hover:underline"
      >
        + Add variant
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-md border border-border bg-surface-2 p-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {option1Name && (
          <Field id="v-o1" label={option1Name}>
            <Input
              id="v-o1"
              value={option1Value}
              onChange={(e) => setOption1Value(e.target.value)}
              placeholder={`e.g. Small`}
            />
          </Field>
        )}
        {option2Name && (
          <Field id="v-o2" label={option2Name}>
            <Input
              id="v-o2"
              value={option2Value}
              onChange={(e) => setOption2Value(e.target.value)}
              placeholder="e.g. Red"
            />
          </Field>
        )}
        <Field id="v-label" label="Display label">
          <Input
            id="v-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Shown to customers"
          />
        </Field>
        <Field id="v-sku" label="SKU">
          <Input
            id="v-sku"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="Must be globally unique"
          />
        </Field>
        <Field id="v-stock" label="Initial stock">
          <NumberInput value={stock} onChange={setStock} min={0} />
        </Field>
        <Field id="v-price" label="Price override (optional)">
          <CurrencyInput
            id="v-price"
            {...(priceOverride != null ? { valueKobo: priceOverride } : {})}
            onValueChange={setPriceOverride}
            placeholder="Inherit product price"
          />
        </Field>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setOpen(false)}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="button" size="sm" disabled={submitting} onClick={submit}>
          Add variant
        </Button>
      </div>
    </div>
  );
}
