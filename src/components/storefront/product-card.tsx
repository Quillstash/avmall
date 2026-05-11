import Link from "next/link";
import { Tag } from "lucide-react";
import { PriceBlock } from "@/components/ui/price-block";
import { ProductVisual } from "@/components/ui/product-visual";
import { WishlistButton } from "@/components/storefront/wishlist-button";
import type { Product } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  product: Product;
  priority?: boolean;
  className?: string;
}

export function ProductCard({ product, priority, className }: ProductCardProps) {
  const onSale = product.saleActive && product.sale != null;
  const oos = product.stock === 0 && !product.preorder;
  const lowStock = product.stock > 0 && product.stock < 10;
  const displayKobo = onSale ? product.sale! : product.price;

  return (
    <Link
      href={`/product/${product.slug}`}
      className={cn("group block", className)}
    >
      <div className="relative overflow-hidden rounded-lg">
        <ProductVisual
          product={product}
          aspect="square"
          priority={priority ?? false}
          className="transition-transform duration-medium ease-out-expo group-hover:scale-105"
        />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {onSale && (
            <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-danger text-white rounded">
              Save {Math.round((1 - product.sale! / product.price) * 100)}%
            </span>
          )}
          {product.preorder && (
            <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-status-processing text-white rounded">
              Pre-order
            </span>
          )}
        </div>

        <WishlistButton />


        {oos && (
          <div className="absolute inset-0 bg-fg/55 flex items-center justify-center text-white font-bold text-sm uppercase tracking-wider">
            Out of stock
          </div>
        )}
      </div>

      <div className="pt-3 px-0.5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
          {product.brand}
        </div>
        <div className="text-sm font-semibold leading-snug mt-1 line-clamp-2 min-h-[2.5rem] group-hover:text-brand-primary transition-colors">
          {product.name}
        </div>
        <PriceBlock
          priceKobo={displayKobo}
          {...(onSale ? { comparePriceKobo: product.price, onSale: true } : {})}
          size="sm"
          className="mt-1.5"
        />
        <div className="flex items-center gap-2 mt-1 min-h-[1rem]">
          {product.bulk.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-accent">
              <Tag className="size-2.5" /> Bulk
            </span>
          )}
          {lowStock && !product.preorder && (
            <span className="text-[10px] font-semibold text-warning">
              Only {product.stock} left
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
