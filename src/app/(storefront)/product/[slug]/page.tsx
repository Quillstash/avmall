import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Star, Truck, RefreshCcw, Shield } from "lucide-react";
import { PRODUCTS, getProduct } from "@/lib/mock-data";
import { ProductCard } from "@/components/storefront/product-card";
import { PDPDetail } from "./detail";

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

interface PDPProps {
  params: { slug: string };
}

export default function PDPPage({ params }: PDPProps) {
  const product = getProduct(params.slug);
  if (!product) notFound();

  const related = PRODUCTS.filter(
    (p) => p.category === product.category && p.id !== product.id,
  ).slice(0, 4);
  const gallery = product.gallery ?? [product.imageUrl];

  return (
    <div className="mx-auto max-w-7xl px-4 lg:px-6 py-6 lg:py-10">
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

      <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-8 lg:gap-14">
        {/* Gallery */}
        <div className="flex flex-col lg:flex-row-reverse gap-3 lg:gap-4">
          <div className="relative w-full aspect-square overflow-hidden rounded-xl bg-surface-2">
            <Image
              src={gallery[0]!}
              alt={product.name}
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
          {gallery.length > 1 && (
            <div className="flex lg:flex-col gap-2 lg:w-20 flex-shrink-0">
              {gallery.slice(0, 4).map((g, i) => (
                <div
                  key={i}
                  className={`relative size-16 lg:size-20 rounded-md overflow-hidden border-2 cursor-pointer ${
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
