import { Money } from "@/components/ui/money";
import { formatMoney } from "@/lib/money";
import { SITE } from "@/lib/site";

interface ReceiptItem {
  name: string;
  variant: string;
  sku: string;
  qty: number;
  unitKobo: number;
  discountKobo: number;
}

interface ReceiptPrintViewProps {
  orderNumber: string;
  placedAt: string;
  customer: {
    name: string;
    phone: string;
    email?: string;
  };
  items: ReceiptItem[];
  totals: {
    subtotalKobo: number;
    discountKobo: number;
    shippingKobo: number;
    totalKobo: number;
    paidKobo: number;
    outstandingKobo: number;
  };
  /** Staff member who's printing — shown at the bottom. */
  staffName: string;
  /** Optional override for the store location line (defaults to SITE.address). */
  storeLocation?: string;
}

/**
 * Print-only order receipt. Renders monochrome, narrow (80mm thermal-printer
 * friendly with a graceful upper bound for A4). No images — text only.
 *
 * Use with `window.print()` and the global print stylesheet that hides
 * everything else (`[data-print-only]` body modifier).
 */
export function ReceiptPrintView({
  orderNumber,
  placedAt,
  customer,
  items,
  totals,
  staffName,
  storeLocation,
}: ReceiptPrintViewProps) {
  const location =
    storeLocation ??
    `${SITE.address.street}, ${SITE.address.city}, ${SITE.address.state}`;

  return (
    <div className="bg-white text-black mx-auto p-6 max-w-[360px] font-mono text-[12px] leading-snug print:max-w-none print:p-6">
      {/* Header */}
      <div className="text-center border-b border-dashed border-black/40 pb-3 mb-3">
        <div className="font-bold text-base tracking-tight uppercase">
          {SITE.legalName}
        </div>
        <div className="text-[11px]">{location}</div>
        <div className="text-[11px]">{SITE.phone}</div>
      </div>

      {/* Order meta */}
      <div className="mb-3 text-[11px]">
        <div className="flex justify-between">
          <span>Order</span>
          <span className="font-bold">#{orderNumber}</span>
        </div>
        <div className="flex justify-between">
          <span>Date</span>
          <span>{placedAt}</span>
        </div>
        <div className="flex justify-between">
          <span>Cashier</span>
          <span>{staffName}</span>
        </div>
      </div>

      {/* Customer */}
      <div className="border-t border-dashed border-black/40 pt-2 mb-3 text-[11px]">
        <div className="font-bold uppercase text-[10px] tracking-wider mb-1">Customer</div>
        <div>{customer.name}</div>
        {customer.phone && customer.phone !== "Walk-in" && (
          <div>{customer.phone}</div>
        )}
        {customer.email && <div>{customer.email}</div>}
      </div>

      {/* Items */}
      <div className="border-t border-dashed border-black/40 pt-2 mb-2">
        {items.map((it, i) => (
          <div key={i} className="mb-2 last:mb-0">
            <div className="font-semibold">{it.name}</div>
            <div className="flex justify-between text-[11px]">
              <span>
                {it.qty} × <Money kobo={it.unitKobo} />
                {it.variant && it.variant !== "—" && ` (${it.variant})`}
              </span>
              <span>
                <Money kobo={it.unitKobo * it.qty - it.discountKobo} />
              </span>
            </div>
            {it.discountKobo > 0 && (
              <div className="text-[10px]">
                bulk discount −{formatMoney(it.discountKobo)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="border-t border-dashed border-black/40 pt-2 mb-3">
        <Row label="Subtotal" value={formatMoney(totals.subtotalKobo)} />
        {totals.discountKobo > 0 && (
          <Row label="Discounts" value={`−${formatMoney(totals.discountKobo)}`} />
        )}
        {totals.shippingKobo > 0 && (
          <Row label="Shipping" value={formatMoney(totals.shippingKobo)} />
        )}
        <div className="flex justify-between font-bold text-[14px] mt-1.5 pt-1.5 border-t border-black/40">
          <span>TOTAL</span>
          <span>{formatMoney(totals.totalKobo)}</span>
        </div>
        <Row label="Paid" value={formatMoney(totals.paidKobo)} />
        {totals.outstandingKobo > 0 && (
          <Row
            label="Outstanding"
            value={formatMoney(totals.outstandingKobo)}
            bold
          />
        )}
      </div>

      {/* Footer */}
      <div className="text-center border-t border-dashed border-black/40 pt-3 text-[10px]">
        <div>Thank you for shopping with us</div>
        <div>14-day returns · keep this receipt</div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between text-[11px]${bold ? " font-bold" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
