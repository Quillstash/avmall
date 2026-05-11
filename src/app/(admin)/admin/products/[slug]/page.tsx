"use client";

import * as React from "react";
import { notFound } from "next/navigation";
import { Save, Trash2, Eye, Plus } from "lucide-react";
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
import { getProduct, CATEGORIES, type BulkTier } from "@/lib/mock-data";

interface PageProps {
  params: { slug: string };
}

export default function AdminProductEditorPage({ params }: PageProps) {
  const product = getProduct(params.slug);
  if (!product) notFound();

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
  const [moq, setMoq] = React.useState(product.moq ?? 1);
  const [tags, setTags] = React.useState<string[]>(["handmade", "lagos"]);
  const [preorder, setPreorder] = React.useState(!!product.preorder);
  const [featured, setFeatured] = React.useState(false);
  const [published, setPublished] = React.useState(true);
  const [bulk, setBulk] = React.useState<BulkTier[]>([...product.bulk]);
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
                <Button variant="ghost" size="sm">
                  <Trash2 className="size-3.5" /> Archive
                </Button>
                <Button size="sm" onClick={() => toast.success("Saved")}>
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
                <ImageUploader images={images} onChange={setImages} max={8} />
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

              <Card title="Variants & inventory">
                <table className="w-full text-sm">
                  <thead className="bg-surface-2">
                    <tr className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                      <th className="text-left px-3 py-2">Label</th>
                      <th className="text-right px-3 py-2">Price</th>
                      <th className="text-right px-3 py-2">Stock</th>
                      <th className="text-right px-3 py-2">Reserved</th>
                      <th className="text-left px-3 py-2">SKU</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {product.variants.map((v) => (
                      <tr key={v.id} className="border-t border-border">
                        <td className="px-3 py-2.5 font-semibold">{v.label}</td>
                        <td className="px-3 py-2.5 text-right">
                          <Money kobo={v.price ?? product.price} />
                        </td>
                        <td className="px-3 py-2.5 text-right tabular font-semibold">
                          {v.stock}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular text-fg-muted">0</td>
                        <td className="px-3 py-2.5 font-mono text-[11px] text-fg-muted tabular">
                          {product.brand.slice(0, 3).toUpperCase()}-{v.id.toUpperCase()}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button className="text-xs text-brand-primary font-semibold hover:underline">
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-primary hover:underline">
                  <Plus className="size-3.5" /> Add variant
                </button>
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
                  <div className="flex justify-between">
                    <dt className="text-fg-muted">Created</dt>
                    <dd>3 Oct 2025 by Funmi A.</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-fg-muted">Last edit</dt>
                    <dd>2h ago by Tunde I.</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-fg-muted">Sales (30d)</dt>
                    <dd className="font-bold">147 units</dd>
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
