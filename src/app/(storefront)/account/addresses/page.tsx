import { Plus, MapPin, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const ADDRESSES = [
  {
    id: "a1",
    label: "Home",
    name: "Tolu Adeniyi",
    line1: "14 Bourdillon Road, Apt 3B",
    city: "Ikoyi, Lagos",
    phone: "+234 803 421 7790",
    primary: true,
  },
  {
    id: "a2",
    label: "Office",
    name: "Tolu Adeniyi",
    line1: "Plot 12, Idejo Street",
    city: "Victoria Island, Lagos",
    phone: "+234 803 421 7790",
  },
];

export default function AddressesPage() {
  return (
    <div>
      <div className="flex items-end justify-between mb-6 gap-4">
        <div>
          <h1 className="font-display text-3xl lg:text-4xl font-semibold tracking-tight">
            Addresses
          </h1>
          <p className="text-sm text-fg-muted mt-1">
            Saved delivery destinations · {ADDRESSES.length} on file
          </p>
        </div>
        <Button size="md">
          <Plus className="size-4" /> Add address
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {ADDRESSES.map((a) => (
          <div
            key={a.id}
            className="p-5 rounded-lg border border-border bg-surface hover:border-border-strong transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-fg-muted" />
                <span className="font-bold text-sm">{a.label}</span>
                {a.primary && <Badge tone="brand">Default</Badge>}
              </div>
              <button className="p-1.5 text-fg-muted hover:text-fg rounded-md hover:bg-surface-2" aria-label="More">
                <MoreHorizontal className="size-4" />
              </button>
            </div>
            <div className="text-sm space-y-0.5">
              <div className="font-semibold">{a.name}</div>
              <div className="text-fg-muted">{a.line1}</div>
              <div className="text-fg-muted">{a.city}</div>
              <div className="text-fg-muted font-mono text-xs tabular mt-1">{a.phone}</div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button size="sm" variant="secondary">
                Edit
              </Button>
              {!a.primary && (
                <Button size="sm" variant="ghost">
                  Make default
                </Button>
              )}
            </div>
          </div>
        ))}

        {/* Add card */}
        <button className="p-5 rounded-lg border-2 border-dashed border-border bg-transparent hover:border-brand-primary hover:bg-info-bg text-fg-muted hover:text-brand-primary transition-colors flex flex-col items-center justify-center gap-2 min-h-[180px]">
          <Plus className="size-6" />
          <span className="text-sm font-semibold">Add new address</span>
        </button>
      </div>
    </div>
  );
}
