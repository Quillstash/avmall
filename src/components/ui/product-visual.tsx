import Image from "next/image";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/mock-data";

type Aspect = "square" | "portrait" | "landscape";

interface ProductVisualProps {
  product: Pick<Product, "imageUrl" | "name" | "bg">;
  aspect?: Aspect;
  priority?: boolean;
  sizes?: string;
  className?: string;
}

const aspectClass: Record<Aspect, string> = {
  square: "aspect-square",
  portrait: "aspect-[4/5]",
  landscape: "aspect-[4/3]",
};

/**
 * Product image with a tinted gradient backdrop (visible through whitespace / while loading).
 */
export function ProductVisual({
  product,
  aspect = "square",
  priority = false,
  sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw",
  className,
}: ProductVisualProps) {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-md",
        aspectClass[aspect],
        className,
      )}
      style={{ background: product.bg }}
    >
      <Image
        src={product.imageUrl}
        alt={product.name}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
      />
    </div>
  );
}
