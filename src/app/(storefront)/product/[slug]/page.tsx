import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Star, Truck, RefreshCcw, Shield } from "lucide-react";
import { ProductCard } from "@/components/storefront/product-card";
import {
  getProductBySlug,
  getRelatedProducts,
} from "@/lib/data/products";
import { formatMoney } from "@/lib/money";
import { SITE } from "@/lib/site";
import { getStorefrontStoreId } from "@/lib/store";
import { PDPDetail } from "./detail";

// PDPs are DB-backed (price, stock, variants change). Defer to runtime + ISR.
export const revalidate = 300;
export const dynamic = "force-dynamic";

interface PDPProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: PDPProps): Promise<Metadata> {
  const product = await getProductBySlug(params.slug);
  if (!product) {
    return { title: "Product not found" };
  }
  const priceKobo = product.saleActive && product.sale != null ? product.sale : product.price;
  const description = `${product.short} · From ${formatMoney(priceKobo)} · ${product.brand} on ${SITE.name}.`;
  const url = `/product/${product.slug}`;
  return {
    title: `${product.name} · ${product.brand}`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title: `${product.name} · ${product.brand}`,
      description,
      ...(product.imageUrl && {
        images: [{ url: product.imageUrl, alt: product.name }],
      }),
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.name} · ${product.brand}`,
      description,
      ...(product.imageUrl && { images: [product.imageUrl] }),
    },
  };
}

export default async function PDPPage({ params }: PDPProps) {
  const storeId = (await getStorefrontStoreId()) ?? undefined;
  const product = await getProductBySlug(params.slug, storeId);
  if (!product) notFound();

  const related = await getRelatedProducts(product, 4);
  const gallery = product.gallery ?? [product.imageUrl];

  // Schema.org Product — feeds Google rich snippets (price, availability, rating).
  const priceKobo = product.saleActive && product.sale != null ? product.sale : product.price;
  const inStock = (product.stock ?? 0) > 0 || product.preorder;
  const productSchema = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: product.name,
    description: product.short,
    sku: product.slug.toUpperCase(),
    brand: { "@type": "Brand", name: product.brand },
    ...(product.imageUrl && { image: gallery.filter(Boolean) }),
    offers: {
      "@type": "Offer",
      url: `${SITE.url}/product/${product.slug}`,
      priceCurrency: "NGN",
      price: (priceKobo / 100).toFixed(2),
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
    ...(product.rating != null && product.reviews != null && product.reviews > 0 && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: product.rating,
        reviewCount: product.reviews,
      },
    }),
  };

  return (
    <div className="mx-auto max-w-7xl px-4 lg:px-6 py-6 lg:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-fg-muted mb-5">
        <Link href="/" className="hover:text-fg">
          Home
        </Link>
        <ChevronRight className="size-3" />
        <Link href={`/category/${product.category}`} className="hover:text-fg capitalize">
          {product.category}
        </Link>
        <ChevronRight className="size-3" />
        <span className="text-fg font-medium truncate">{product.name}</span>
      </nav>

      <div className="grid lg:grid-cols-[minmax(0,520px)_1fr] gap-8 lg:gap-14 items-start">
        {/* Gallery — capped so it doesn't dominate the viewport on wide screens */}
        <div className="flex flex-col lg:flex-row-reverse gap-3 lg:gap-4 lg:sticky lg:top-24">
          <div className="relative w-full aspect-square overflow-hidden rounded-xl bg-surface-2 max-h-[520px]">
            <Image
              src={gallery[0]!}
              alt={product.name}
              fill
              priority
              sizes="(min-width: 1024px) 520px, 100vw"
              className="object-cover"
            />
          </div>
          {gallery.length > 1 && (
            <div className="flex lg:flex-col gap-2 lg:w-20 flex-shrink-0">
              {gallery.slice(0, 4).map((g, i) => (
                <div
                  key={i}
                  className={`relative size-16 lg:size-20 rounded-md overflow-hidden border-2 cursor-pointer flex-shrink-0 ${
                    i === 0 ? "border-fg" : "border-transparent"
                  }`}
                >
                  <Image src={g} alt="" fill sizes="80px" className="object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-fg-muted">
            {product.brand}
          </div>
          <h1 className="font-display text-3xl lg:text-4xl font-semibold tracking-tight leading-tight mt-2 mb-3">
            {product.name}
          </h1>
          <p className="text-base text-fg-muted leading-relaxed mb-4">{product.short}</p>

          <div className="flex items-center gap-2 mb-5">
            <div className="flex gap-0.5 text-warning">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} className="size-4 fill-current" strokeWidth={0} />
              ))}
            </div>
            <span className="text-sm font-semibold">{product.rating}</span>
            <span className="text-xs text-fg-muted">({product.reviews} reviews)</span>
          </div>

          <PDPDetail product={product} />

          {/* Reassurance */}
          <div className="grid grid-cols-3 gap-2 mt-8 pt-6 border-t border-border text-xs">
            <Feature icon={Truck} title="Free Lagos" subtitle="over ₦25k" />
            <Feature icon={RefreshCcw} title="14-day" subtitle="returns" />
            <Feature icon={Shield} title="Secure" subtitle="Nuqood" />
          </div>
        </div>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-16 lg:mt-24">
          <h2 className="font-display text-2xl lg:text-3xl font-semibold tracking-tight mb-6">
            You may also like
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof Truck;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-4 text-fg-muted" />
      <div>
        <div className="font-semibold">{title}</div>
        <div className="text-fg-muted">{subtitle}</div>
      </div>
    </div>
  );
}
