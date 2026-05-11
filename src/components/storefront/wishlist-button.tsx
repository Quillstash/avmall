"use client";

import { Heart } from "lucide-react";

export function WishlistButton() {
  return (
    <button
      className="hidden lg:flex absolute top-3 right-3 items-center justify-center size-9 rounded-full bg-white/95 text-fg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
      aria-label="Save to wishlist"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <Heart className="size-4" />
    </button>
  );
}
