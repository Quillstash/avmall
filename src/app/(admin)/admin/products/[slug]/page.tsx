import { notFound } from "next/navigation";
import Image from "next/image";
import { Save, Trash2, Eye, Plus, Upload } from "lucide-react";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Money } from "@/components/ui/money";
import { Badge } from "@/components/ui/badge";
import { PRODUCTS, getProduct, CATEGORIES } from "@/lib/mock-data";

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

interface PageProps {
  params: { slug: string };
}

export default function AdminProductEditorPage({ params }: PageProps) {
  const product = getProduct(params.slug);
  if (!product) notFound();

  return (
    <>
      <AdminTopBar
        breadcrumbs={[
          { label: "Products", href: "/admin/products" },
          { label: product.name },
        ]}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1400px] mx-auto pb-20">
          <PageHeader
            title={product.name}
            subtitle={
              <span className="inline-flex items-center gap-2">
                <span className="font-mono text-xs text-fg-muted tabular">{product.brand.slice(0, 3).toUpperCase()}-{product.id.toUpperCase()}</span>
                <Badge tone="success">Published</Badge>
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
                <Button size="sm">
                  <Save className="size-3.5" /> Save
                </Button>
              </>
            }
          />

          <div className="grid lg:grid-cols-[1fr_320px] gap-4">
            {/* Main */}
            <div className="flex flex-col gap-4">
              <Card title="Basics">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field id="name" label="Product name" className="md:col-span-2">
                    <Input id="name" defaultValue={product.name} />
                  </Field>
                  <Field id="brand" label="Brand">
                    <Input id="brand" defaultValue={product.brand} />
                  </Field>
                  <Field id="category" label="Category">
                    <Select id="category" defaultValue={product.category}>
                      {CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field id="short" label="Short description" className="md:col-span-2">
                    <Textarea id="short" rows={2} defaultValue={product.short} />
                  </Field>
                  <Field id="long" label="Full description" className="md:col-span-2">
                    <Textarea
                      id="long"
                      rows={5}
                      defaultValue="Crafted in small batches with sustainably-sourced ingredients."
                    />
                  </Field>
                </div>
              </Card>

              <Card title="Media">
                <div className="grid grid-cols-3 md:grid-cols-5 gap-2.5">
                  {(product.gallery ?? [product.imageUrl]).map((src, i) => (
                    <div
                      key={i}
                      className="relative aspect-square rounded-md overflow-hidden border-2 border-border"
                    >
                      <Image src={src} alt="" fill sizes="200px" className="object-cover" />
                    </div>
                  ))}
                  <button className="aspect-square rounded-md border-2 border-dashed border-border-strong text-fg-muted hover:border-brand-primary hover:text-brand-primary flex flex-col items-center justify-center gap-1.5">
                    <Upload className="size-5" />
                    <span className="text-[10px] font-semibold">Upload</span>
                  </button>
                </div>
              </Card>

              <Card title="Pricing">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Field id="price" label="Regular price (₦)">
                    <Input
                      id="price"
                      defaultValue={(product.price / 100).toLocaleString("en-NG")}
                      className="tabular text-right"
                    />
                  </Field>
                  <Field id="sale" label="Sale price (₦)">
                    <Input
                      id="sale"
                      defaultValue={product.sale ? (product.sale / 100).toLocaleString("en-NG") : ""}
                      placeholder="Optional"
                      className="tabular text-right"
                    />
                  </Field>
                  <Field id="cost" label="Cost (₦)" hint="Internal — for margin reports">
                    <Input
                      id="cost"
                      placeholder="0"
                      className="tabular text-right"
                    />
                  </Field>
                </div>

                <div className="mt-5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-fg-muted mb-2">
                    Bulk pricing tiers
                  </div>
                  {product.bulk.length === 0 ? (
                    <button className="w-full py-3 border-2 border-dashed border-border rounded-md text-sm text-fg-muted hover:border-brand-primary hover:text-brand-primary">
                      + Add bulk tier
                    </button>
                  ) : (
                    <div className="border border-border rounded-md overflow-hidden">
                      {product.bulk.map((tier, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 px-3.5 py-2.5 border-t border-border first:border-t-0 text-sm"
                        >
                          <span className="font-semibold tabular w-28">
                            {tier.min}
                            {tier.max ? `–${tier.max}` : "+"} units
                          </span>
                          <span className="text-fg-muted">{tier.value}% off</span>
                          <button className="ml-auto text-xs text-brand-primary font-semibold hover:underline">
                            Edit
                          </button>
                        </div>
                      ))}
                      <button className="w-full px-3.5 py-2.5 text-xs font-semibold text-brand-primary hover:bg-surface-2 border-t border-border text-left">
                        + Add tier
                      </button>
                    </div>
                  )}
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

            {/* Right sidebar */}
            <div className="flex flex-col gap-4">
              <Card title="Status">
                <Field id="status" label="Visibility">
                  <Select id="status" defaultValue="published">
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                    <option value="archived">Archived</option>
                  </Select>
                </Field>
                <Field id="featured" label="Featured" className="mt-3">
                  <Select id="featured" defaultValue="no">
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </Select>
                </Field>
              </Card>

              <Card title="SEO">
                <Field id="slug" label="URL slug">
                  <Input id="slug" defaultValue={product.slug} className="font-mono text-xs" />
                </Field>
                <Field id="meta" label="Meta description" className="mt-3">
                  <Textarea id="meta" rows={3} placeholder="Optional" />
                </Field>
              </Card>

              <Card title="Pre-order">
                <Field id="preorder" label="Pre-order only">
                  <Select id="preorder" defaultValue={product.preorder ? "yes" : "no"}>
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </Select>
                </Field>
                {product.preorder && (
                  <>
                    <Field id="moq" label="MOQ (minimum order quantity)" className="mt-3">
                      <Input id="moq" type="number" defaultValue={product.moq} className="tabular" />
                    </Field>
                    <Field id="eta" label="ETA" className="mt-3">
                      <Input id="eta" defaultValue={product.eta} />
                    </Field>
                  </>
                )}
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
