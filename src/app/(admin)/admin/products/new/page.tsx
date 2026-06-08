"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Save, Eye, Plus, Sparkles } from "lucide-react";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { NumberInput } from "@/components/ui/number-input";
import { BulkTierEditor } from "@/components/ui/bulk-tier-editor";
import { ImageUploader, type UploadedImage } from "@/components/ui/image-uploader";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { CodeInput } from "@/components/ui/code-input";
import { TagInput } from "@/components/ui/tag-input";
import { toast } from "@/components/ui/toaster";
import { CATEGORIES, type BulkTier } from "@/lib/mock-data";
import { Money } from "@/components/ui/money";
import { ProfitDisplay } from "@/components/admin/profit-display";
import {
  VariantMatrix,
  emptyMatrix,
  type VariantMatrixValue,
} from "@/components/admin/variant-matrix";
import { applyPercentageDiscount } from "@/lib/money";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

type FieldKey = "name" | "brand" | "price" | "sale" | "images";

export default function AdminNewProductPage() {
  const router = useRouter();

  const [name, setName] = React.useState("");
  const [brand, setBrand] = React.useState("");
  const [category, setCategory] = React.useState<string>("home");
  const [categories, setCategories] = React.useState<{ slug: string; name: string }[]>(
    () => CATEGORIES.map((c) => ({ slug: c.id, name: c.name })),
  );
  const [addingCat, setAddingCat] = React.useState(false);
  const [newCatName, setNewCatName] = React.useState("");
  const [catSaving, setCatSaving] = React.useState(false);
  const [genCopy, setGenCopy] = React.useState(false);
  const [genImage, setGenImage] = React.useState(false);

  // AI: generate short/full description + tags from the product name.
  async function generateCopy() {
    if (!name.trim()) {
      toast.error("Enter a product name first.");
      return;
    }
    setGenCopy(true);
    try {
      const res = await fetch("/api/v1/admin/products/ai/generate-copy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          ...(brand.trim() && { brand: brand.trim() }),
          category,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not generate copy");
        return;
      }
      const d = json.data ?? {};
      if (d.shortDesc) setShort(d.shortDesc);
      if (d.longDesc) setLongDesc(d.longDesc);
      if (Array.isArray(d.tags) && d.tags.length) setTags(d.tags);
      toast.success("Generated description, short text & tags");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setGenCopy(false);
    }
  }

  // AI: generate a clean studio image from an uploaded photo.
  async function generateImage() {
    const source =
      images.find((i) => i.primary && i.url && !i.progress) ??
      images.find((i) => i.url && !i.progress);
    if (!source?.url) {
      toast.error("Upload a product photo first.");
      return;
    }
    setGenImage(true);
    try {
      const res = await fetch("/api/v1/admin/products/ai/generate-image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: source.url, name: name.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not generate image");
        return;
      }
      const img = json.data?.image;
      if (img?.url) {
        setImages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            url: img.url,
            key: img.key,
            primary: prev.length === 0,
          },
        ]);
        markTouched("images");
        toast.success("AI product image added");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setGenImage(false);
    }
  }
  const [short, setShort] = React.useState("");
  const [longDesc, setLongDesc] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [priceKobo, setPriceKobo] = React.useState<number | null>(null);
  const [saleKobo, setSaleKobo] = React.useState<number | null>(null);
  const [costKobo, setCostKobo] = React.useState<number | null>(null);
  const [stock, setStock] = React.useState(0);
  const [moq, setMoq] = React.useState(1);
  const [tags, setTags] = React.useState<string[]>([]);
  const [preorder, setPreorder] = React.useState(false);
  const [featured, setFeatured] = React.useState(false);
  const [published, setPublished] = React.useState(false);
  const [bulk, setBulk] = React.useState<BulkTier[]>([]);
  const [images, setImages] = React.useState<UploadedImage[]>([]);
  const [saving, setSaving] = React.useState(false);

  // Negotiation: per-product overrides. "global" leaves both null and lets the
  // AiSettings default apply.
  const [negotiate, setNegotiate] = React.useState(false);
  const [negotiationMode, setNegotiationMode] = React.useState<"global" | "pct" | "floor">("global");
  const [negotiateMaxPct, setNegotiateMaxPct] = React.useState<number>(10);
  const [negotiateFloorKobo, setNegotiateFloorKobo] = React.useState<number | null>(null);

  // Variant matrix. Empty by default → single default variant on save.
  const [matrix, setMatrix] = React.useState<VariantMatrixValue>(() => emptyMatrix());
  const hasMatrix = matrix.variants.length > 0;

  // Effective floor price the AI is allowed to settle at, given the current
  // negotiation mode. Null when we can't compute it (global mode, no price set).
  const negotiationFloorKobo: number | null =
    !negotiate || priceKobo == null
      ? null
      : negotiationMode === "pct"
        ? priceKobo - applyPercentageDiscount(priceKobo, negotiateMaxPct)
        : negotiationMode === "floor"
          ? negotiateFloorKobo
          : null;

  // Track touched state per field so errors only show after interaction
  // (or after a publish attempt — see `attemptedPublish`).
  const [touched, setTouched] = React.useState<Record<FieldKey, boolean>>({
    name: false,
    brand: false,
    price: false,
    sale: false,
    images: false,
  });
  const [attemptedPublish, setAttemptedPublish] = React.useState(false);

  function markTouched(k: FieldKey) {
    setTouched((prev) => ({ ...prev, [k]: true }));
  }

  // Auto-derive slug from name until the user edits it manually
  React.useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  // Load real categories from the DB so any newly-created ones appear too.
  React.useEffect(() => {
    let alive = true;
    fetch("/api/v1/admin/categories")
      .then((r) => r.json())
      .then((j) => {
        if (alive && Array.isArray(j?.data?.categories) && j.data.categories.length) {
          setCategories(j.data.categories);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function addCategory() {
    const nm = newCatName.trim();
    if (!nm) return;
    setCatSaving(true);
    try {
      const res = await fetch("/api/v1/admin/categories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: nm }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not add category");
        return;
      }
      const cat = json.data.category as { slug: string; name: string };
      setCategories((prev) =>
        prev.some((c) => c.slug === cat.slug) ? prev : [...prev, cat],
      );
      setCategory(cat.slug);
      setAddingCat(false);
      setNewCatName("");
      toast.success(`Category "${cat.name}" added`);
    } catch {
      toast.error("Network error");
    } finally {
      setCatSaving(false);
    }
  }

  // Per-field validation
  const fieldErrors = {
    name: !name.trim() ? "Required" : null,
    brand: null, // optional
    price:
      priceKobo == null || priceKobo <= 0
        ? "Required — must be greater than zero"
        : null,
    sale:
      saleKobo != null && priceKobo != null && saleKobo >= priceKobo
        ? "Sale price must be lower than regular price"
        : null,
    images: images.length === 0 ? "Add at least one product photo" : null,
  };
  const canPublish = Object.values(fieldErrors).every((e) => e == null);

  /** Show the error only after the field has been touched or after a publish attempt. */
  function showErr(k: FieldKey): string | undefined {
    if (!touched[k] && !attemptedPublish) return undefined;
    return fieldErrors[k] ?? undefined;
  }

  async function save(asDraft: boolean) {
    if (!asDraft) {
      // Mark everything touched so all errors surface
      setAttemptedPublish(true);
      if (!canPublish) {
        toast.error("Fix the highlighted fields before publishing");
        return;
      }
    }
    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          brand,
          categorySlug: category,
          shortDesc: short,
          longDesc,
          priceKobo: priceKobo ?? 0,
          costPriceKobo: costKobo ?? 0,
          ...(saleKobo != null && { saleKobo, saleActive: true }),
          // Stock applies to the single default variant when no matrix is set.
          stock: hasMatrix ? 0 : stock,
          ...(slug && { slug }),
          negotiate,
          ...(negotiate &&
            negotiationMode === "pct" && { negotiateMaxPct }),
          ...(negotiate &&
            negotiationMode === "floor" &&
            negotiateFloorKobo != null && { negotiateFloorKobo }),
          preorder,
          ...(preorder && { moq }),
          tags,
          published: !asDraft && published,
          featured,
          bulkTiers: bulk.map((t) => ({
            min: t.min,
            max: t.max,
            type: t.type,
            value: t.value,
          })),
          // R2 image keys — only entries that finished uploading get the
          // `key` field. Local-only entries (pending / errored) are dropped.
          images: images
            .filter((img) => !!img.key)
            .map((img) => ({
              key: img.key!,
              ...(img.alt && { alt: img.alt }),
              ...(img.primary && { primary: true }),
            })),
          // Variant matrix — only send when there's at least one combo.
          ...(hasMatrix && {
            option1Name: matrix.option1Name,
            option2Name: matrix.option2Name,
            variants: matrix.variants.map((v) => ({
              label: v.label,
              sku: v.sku,
              ...(v.option1Value && { option1Value: v.option1Value }),
              ...(v.option2Value && { option2Value: v.option2Value }),
              stock: v.stock,
              ...(v.priceOverrideKobo != null && {
                priceOverrideKobo: v.priceOverrideKobo,
              }),
            })),
          }),
        }),
      });

      if (res.status === 503 || res.status === 401) {
        toast.success(asDraft ? "Draft saved (local)" : "Product saved (local)");
        router.push("/admin/products");
        return;
      }

      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error?.message ?? "Couldn't save product");
      toast.success(asDraft ? "Draft saved" : "Product published");
      router.push("/admin/products");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <AdminTopBar
        breadcrumbs={[
          { label: "Products", href: "/admin/products" },
          { label: "New product" },
        ]}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1400px] mx-auto pb-20">
          <PageHeader
            title="New product"
            subtitle="Add a product to the catalogue. Save as draft to come back later."
            actions={
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push("/admin/products")}
                >
                  Cancel
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => save(true)}
                  loading={saving}
                >
                  Save as draft
                </Button>
                <Button
                  size="sm"
                  onClick={() => save(false)}
                  loading={saving}
                >
                  <Save className="size-3.5" /> Publish
                </Button>
              </>
            }
          />

          <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
            <div className="flex flex-col gap-4 min-w-0">
              <Card title="Basics">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field
                    id="name"
                    label="Product name"
                    required
                    error={showErr("name")}
                    className="md:col-span-2"
                  >
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onBlur={() => markTouched("name")}
                      placeholder="Whipped Shea Body Balm"
                      invalid={!!showErr("name")}
                      autoFocus
                    />
                  </Field>
                  <Field id="brand" label="Brand" optional>
                    <Input
                      id="brand"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      placeholder="e.g. Oraimo, Itel, Kenwood"
                    />
                  </Field>
                  <Field id="category" label="Category" required>
                    {addingCat ? (
                      <div className="flex gap-2">
                        <Input
                          id="new-category"
                          autoFocus
                          value={newCatName}
                          onChange={(e) => setNewCatName(e.target.value)}
                          placeholder="New category name"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void addCategory();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={addCategory}
                          disabled={catSaving || !newCatName.trim()}
                          loading={catSaving}
                        >
                          Add
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setAddingCat(false);
                            setNewCatName("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Select
                          id="category"
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                          className="flex-1"
                        >
                          {categories.map((c) => (
                            <option key={c.slug} value={c.slug}>
                              {c.name}
                            </option>
                          ))}
                        </Select>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => setAddingCat(true)}
                        >
                          <Plus className="size-3.5" /> New
                        </Button>
                      </div>
                    )}
                  </Field>
                  <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-2 px-3 py-2">
                    <span className="text-xs text-fg-muted inline-flex items-center gap-1.5">
                      <Sparkles className="size-3.5 text-brand-primary" />
                      Let AI draft the description, short text &amp; tags from the name.
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={generateCopy}
                      disabled={!name.trim() || genCopy}
                      loading={genCopy}
                    >
                      <Sparkles className="size-3.5" /> Generate with AI
                    </Button>
                  </div>
                  <Field
                    id="short"
                    label="Short description"
                    optional
                    hint="One sentence shown in product cards and search"
                    className="md:col-span-2"
                  >
                    <Input
                      id="short"
                      value={short}
                      onChange={(e) => setShort(e.target.value)}
                      placeholder="Whipped in small batches with unrefined Nigerian shea"
                    />
                  </Field>
                  <Field
                    id="long"
                    label="Full description"
                    optional
                    className="md:col-span-2"
                  >
                    <RichTextEditor value={longDesc} onChange={setLongDesc} rows={6} />
                  </Field>
                  <Field id="tags" label="Tags" optional className="md:col-span-2">
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
                <Field
                  id="images"
                  label="Product photos"
                  required
                  error={showErr("images")}
                  hint="JPEG, PNG, WebP · up to 5 MB each · first image is the primary"
                >
                  <ImageUploader
                    images={images}
                    onChange={(next) => {
                      setImages(next);
                      markTouched("images");
                    }}
                    scope="product"
                    scopeId={slug || slugify(name) || "new"}
                    max={8}
                  />
                </Field>
                {images.some((i) => i.url && !i.progress) && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={generateImage}
                      disabled={genImage}
                      loading={genImage}
                    >
                      <Sparkles className="size-3.5" /> Generate AI product image
                    </Button>
                    <span className="text-[11px] text-fg-muted">
                      A clean studio shot generated from your uploaded photo.
                    </span>
                  </div>
                )}
              </Card>

              <Card title="Pricing">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Field id="price" label="Regular price" required error={showErr("price")}>
                    <CurrencyInput
                      id="price"
                      {...(priceKobo != null ? { valueKobo: priceKobo } : {})}
                      onValueChange={(v) => {
                        setPriceKobo(v);
                        if (v != null) markTouched("price");
                      }}
                      invalid={!!showErr("price")}
                    />
                  </Field>
                  <Field id="sale" label="Sale price" optional error={showErr("sale")}>
                    <CurrencyInput
                      id="sale"
                      {...(saleKobo != null ? { valueKobo: saleKobo } : {})}
                      onValueChange={(v) => {
                        setSaleKobo(v);
                        markTouched("sale");
                      }}
                      invalid={!!showErr("sale")}
                    />
                  </Field>
                  <Field
                    id="cost"
                    label="Cost"
                    optional
                    hint="Internal — for margin reports"
                  >
                    <CurrencyInput
                      id="cost"
                      {...(costKobo != null ? { valueKobo: costKobo } : {})}
                      onValueChange={(v) => setCostKobo(v)}
                    />
                  </Field>
                </div>

                {/* Profit at retail / sale — internal only */}
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

              {/* Negotiation — per-product cap that overrides the global default */}
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
                      The AI never reveals this value. {negotiationMode === "global" && "Leave on global to fall back to the AI Control Panel default."}
                    </p>
                  </div>
                )}
              </Card>

              <Card title="Inventory & variants">
                <p className="text-xs text-fg-muted mb-3 leading-relaxed">
                  Leave variant groups empty for a single-stock product. Otherwise,
                  every combination of Size × Color becomes its own variant with its
                  own stock count and SKU.
                </p>
                <VariantMatrix
                  value={matrix}
                  onChange={setMatrix}
                  productPriceKobo={priceKobo ?? 0}
                  productCostKobo={costKobo ?? 0}
                  skuPrefix={
                    (((brand.trim() || name).replace(/[^a-zA-Z0-9]/g, "").slice(0, 3) || "AVM") +
                      "-" +
                      (slug || slugify(name))).toUpperCase()
                  }
                />
                {!hasMatrix && (
                  <div className="mt-4 max-w-sm">
                    <Field id="stock" label="Stock on hand (default variant)" optional>
                      <NumberInput value={stock} onChange={setStock} min={0} />
                    </Field>
                  </div>
                )}
              </Card>
            </div>

            <div className="flex flex-col gap-4">
              <Card title="Status">
                <div className="flex flex-col gap-3">
                  <SwitchRow
                    label="Published"
                    description="Visible on the storefront immediately"
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
                    <Field id="moq" label="MOQ (minimum order qty)" required>
                      <NumberInput value={moq} onChange={setMoq} min={1} />
                    </Field>
                  )}
                </div>
              </Card>

              <Card title="SEO">
                <Field id="slug" label="URL slug" hint="Auto-generated from the product name">
                  <CodeInput
                    id="slug"
                    value={slug}
                    onChange={(v) => {
                      setSlug(v);
                      setSlugTouched(true);
                    }}
                    uppercase={false}
                    pattern={/[a-z0-9-]/i}
                    placeholder="whipped-shea-body-balm"
                  />
                </Field>
                <Field id="meta" label="Meta description" className="mt-3" optional>
                  <Input id="meta" placeholder="For search engines" />
                </Field>
              </Card>

              <Card title="After save">
                <ul className="text-xs text-fg-muted space-y-1.5 leading-relaxed">
                  <li className="inline-flex items-start gap-1.5">
                    <Plus className="size-3 mt-0.5 text-fg-muted flex-shrink-0" /> Add variants
                  </li>
                  <li className="inline-flex items-start gap-1.5">
                    <Eye className="size-3 mt-0.5 text-fg-muted flex-shrink-0" /> Preview on the
                    storefront
                  </li>
                  <li className="inline-flex items-start gap-1.5">
                    <Save className="size-3 mt-0.5 text-fg-muted flex-shrink-0" /> Set up bulk
                    pricing tiers
                  </li>
                </ul>
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
