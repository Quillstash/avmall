"use client";

import * as React from "react";
import { Save, Trash2, Eye } from "lucide-react";
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
import { CATEGORIES, type BulkTier, type Product } from "@/lib/mock-data";
import type { ProductAuditSummary } from "@/lib/data/products";
import { ProfitDisplay } from "@/components/admin/profit-display";
import { StockAdjust } from "@/components/admin/stock-adjust";
import { applyPercentageDiscount } from "@/lib/money";

interface EditorClientProps {
  product: Product;
  audit: ProductAuditSummary;
}

export function ProductEditorClient({ product, audit }: EditorClientProps) {
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
                <Button variant="ghost" size="sm">
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

          <div className="grid lg:grid-cols-[1fr_320px] gap-4">
            <div className="flex flex-col gap-4">
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
                      {CATEGORIES.map((c) => (
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
                    <div className="grid grid-cols-3 gap-2">
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
                  {product.variants.map((v) => {
                    const effectiveKobo = v.price ?? priceKobo ?? product.price;
                    return (
                      <div
                        key={v.id}
                        className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 p-3 rounded-md border border-border"
                      >
                        <div className="flex flex-col gap-2 min-w-0">
                          <div className="flex items-baseline justify-between gap-3">
                            <div className="font-semibold text-sm truncate">{v.label}</div>
                            <Money kobo={effectiveKobo} className="text-sm font-bold" />
                          </div>
                          <div className="text-[11px] font-mono text-fg-muted truncate">
                            {product.brand.slice(0, 3).toUpperCase()}-{v.id.toUpperCase()}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-fg-muted">
                              Stock: <span className="font-bold tabular">{v.stock}</span>
                            </span>
                            {costKobo != null && (
                              <ProfitDisplay
                                priceKobo={effectiveKobo}
                                costKobo={costKobo}
                                size="compact"
                              />
                            )}
                          </div>
                        </div>
                        <div className="lg:w-72">
                          <StockAdjust
                            productSlug={product.slug}
                            variantId={v.id}
                            variantLabel={v.label}
                            currentStock={v.stock}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 text-[11px] text-fg-muted">
                  Add new variants from the create-product page — variant matrix edits on
                  existing products land in a future revision.
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
