"use client";

import { MapPin } from "lucide-react";
import {
  gotoStore,
  type StoreOption,
} from "@/components/storefront/store-switcher";

/**
 * Footer "Our stores" column. Lets shoppers hop between the main store and any
 * sub-store from any page. Uses the shared `gotoStore` handler (cookie + full
 * navigation) rather than plain links so switching back to Main works — see
 * gotoStore for why. Renders nothing when there's only one store.
 */
export function FooterStores({
  stores,
  currentSlug,
}: {
  stores: StoreOption[];
  currentSlug: string | null;
}) {
  if (stores.length <= 1) return null;

  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wider mb-3">
        Our stores
      </div>
      <div className="flex flex-col gap-2 text-sm text-fg-muted">
        {stores.map((s) => {
          const isCurrent = s.slug === currentSlug;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                if (!isCurrent) gotoStore(s);
              }}
              aria-current={isCurrent ? "true" : undefined}
              className={
                "inline-flex items-center gap-1.5 text-left hover:text-fg transition-colors" +
                (isCurrent ? " text-fg font-semibold" : "")
              }
            >
              <MapPin className="size-3 flex-shrink-0" />
              <span>
                {s.name}
                {s.isMain && (
                  <span className="text-fg-muted font-normal"> · Main</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
