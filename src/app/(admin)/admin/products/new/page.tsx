"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Save, Eye, Plus } from "lucide-react";
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
import { CATEGORIES, type BulkTier, type ProductCategoryId } from "@/lib/mock-data";

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
  const [category, setCategory] = React.useState<ProductCategoryId>("home");
  const [short, setShort] = React.useState("");
  const [longDesc, setLongDesc] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [priceKobo, setPriceKobo] = React.useState<number | null>(null);
  const [saleKobo, setSaleKobo] = React.useState<number | null>(null);
  const [stock, setStock] = React.useState(0);
  const [moq, setMoq] = React.useState(1);
  const [tags, setTags] = React.useState<string[]>([]);
  const [preorder, setPreorder] = React.useState(false);
  const [featured, setFeatured] = React.useState(false);
  const [published, setPublished] = React.useState(false);
  const [bulk, setBulk] = React.useState<BulkTier[]>([]);
  const [images, setImages] = React.useState<UploadedImage[]>([]);
  const [saving, setSaving] = React.useState(false);

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

  // Per-field validation
  const fieldErrors = {
    name: !name.trim() ? "Required" : null,
    brand: !brand.trim() ? "Required" : null,
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

  function save(asDraft: boolean) {
    if (!asDraft) {
      // Mark everything touched so all errors surface
      setAttemptedPublish(true);
      if (!canPublish) {
        toast.error("Fix the highlighted fields before publishing");
        return;
      }
    }
    setSaving(true);
    window.setTimeout(() => {
      setSaving(false);
      toast.success(asDraft ? "Draft saved" : "Product published");
      router.push("/admin/products");
    }, 500);
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

          <div className="grid lg:grid-cols-[1fr_320px] gap-4">
            <div className="flex flex-col gap-4">
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
                  <Field id="brand" label="Brand" required error={showErr("brand")}>
                    <Input
                      id="brand"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      onBlur={() => markTouched("brand")}
                      placeholder="Omolewa"
                      invalid={!!showErr("brand")}
                    />
                  </Field>
                  <Field id="category" label="Category" required>
                    <Select
                      id="category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value as ProductCategoryId)}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
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
                    max={8}
                  />
                </Field>
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
                    <CurrencyInput id="cost" placeholder="0" />
                  </Field>
                </div>

                <div className="mt-5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-fg-muted mb-2">
                    Bulk pricing tiers
                  </div>
                  <BulkTierEditor tiers={bulk} onChange={setBulk} />
                </div>
              </Card>

              <Card title="Inventory">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field id="stock" label="Stock on hand" optional>
                    <NumberInput value={stock} onChange={setStock} min={0} />
                  </Field>
                  <Field
                    id="reorder"
                    label="Low stock threshold"
                    optional
                    hint="Triggers a low-stock badge"
                  >
                    <NumberInput value={20} onChange={() => undefined} min={0} />
                  </Field>
                </div>
                <p className="text-xs text-fg-muted mt-3 leading-relaxed">
                  Add variants (sizes, colours) after the product is saved. Each variant gets its
                  own stock count and SKU.
                </p>
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
