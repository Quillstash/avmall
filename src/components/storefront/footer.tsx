import Link from "next/link";
import Image from "next/image";
import { SocialIcon, type SocialPlatform } from "@/components/ui/social-icon";
import { SITE } from "@/lib/site";
import { FooterStores } from "@/components/storefront/footer-stores";
import type { StoreOption } from "@/components/storefront/store-switcher";
import { getSiteSettings, getSocialLinks } from "@/lib/data/settings";

const COLUMNS: { heading: string; items: { label: string; href: string }[] }[] = [
  {
    heading: "Company",
    items: [
      { label: "About", href: "/about" },
      { label: "Makers", href: "/makers" },
      { label: "Journal", href: "/journal" },
      { label: "Careers", href: "/careers" },
    ],
  },
  {
    heading: "Help",
    items: [
      { label: "Contact", href: "/contact" },
      { label: "Shipping", href: "/shipping" },
      { label: "Returns", href: "/returns" },
      { label: "FAQ", href: "/faq" },
      { label: "Track order", href: "/track-order" },
    ],
  },
  {
    heading: "Legal",
    items: [
      { label: "Terms", href: "/terms" },
      { label: "Privacy", href: "/privacy" },
      { label: "Cookies", href: "/cookies" },
    ],
  },
];

export async function StorefrontFooter({
  categories = [],
  stores = [],
  currentStoreSlug = null,
  whatsappHref = SITE.social.whatsapp,
}: {
  /** Store categories for the "Shop" column — fetched per store. */
  categories?: { slug: string; name: string }[];
  /** Active stores for the "Our stores" column. */
  stores?: StoreOption[];
  currentStoreSlug?: string | null;
  /** Support WhatsApp link — admin-editable, passed from the layout. */
  whatsappHref?: string;
}) {
  // Social links + RC number are admin-editable at /admin/settings. Blank
  // social links are omitted, so only configured platforms show an icon.
  const [socialLinks, settings] = await Promise.all([
    getSocialLinks(),
    getSiteSettings(),
  ]);
  const social: { platform: SocialPlatform; label: string; href: string }[] = [
    ...socialLinks.map((s) => ({ platform: s.platform, label: s.label, href: s.url })),
    { platform: "whatsapp" as const, label: "WhatsApp", href: whatsappHref },
  ];
  // Prepend a per-store "Shop" column; the rest are static site links.
  const columns =
    categories.length > 0
      ? [
          {
            heading: "Shop",
            items: categories
              .slice(0, 6)
              .map((c) => ({ label: c.name, href: `/category/${c.slug}` })),
          },
          ...COLUMNS,
        ]
      : COLUMNS;
  return (
    <footer className="mt-12 border-t border-border bg-surface">
      <div className="mx-auto max-w-7xl px-5 py-10 grid grid-cols-2 md:grid-cols-5 gap-8">
        <div className="col-span-2">
          <Link href="/" className="flex items-center gap-1.5 font-bold text-lg mb-3">
            <Image
              src="/brand/monogram.png"
              alt="Avmall"
              width={24}
              height={24}
              className="size-6 rounded-md"
            />
            <span>mall</span>
          </Link>
          <p className="text-xs text-fg-muted leading-relaxed max-w-xs">
            Goods made by Nigerian hands, delivered across the country. {SITE.legalName} Ltd · RC
            {" "}{settings.rcNumber} · {SITE.address.city}, {SITE.address.state}.
          </p>
          <div className="flex gap-2 mt-4" aria-label="Social media">
            {social.map((s) => (
              <a
                key={s.platform}
                href={s.href}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={s.label}
                className="inline-flex items-center justify-center size-9 rounded-full border border-border text-fg-muted hover:text-fg hover:border-fg/40 transition-colors"
              >
                <SocialIcon platform={s.platform} />
              </a>
            ))}
          </div>
        </div>
        {columns.map((col) => (
          <div key={col.heading}>
            <div className="text-[11px] font-bold uppercase tracking-wider mb-3">{col.heading}</div>
            <div className="flex flex-col gap-2 text-sm text-fg-muted">
              {col.items.map((i) => (
                <Link key={i.label} href={i.href} className="hover:text-fg">
                  {i.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
        <FooterStores stores={stores} currentSlug={currentStoreSlug} />
      </div>
      <div className="border-t border-border">
        <div className="mx-auto max-w-7xl px-5 py-4 flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-fg-muted">
          <span>© {new Date().getFullYear()} {SITE.legalName} Ltd. All rights reserved.</span>
          <span>Powered by Nuqood · Made in {SITE.address.city}.</span>
        </div>
      </div>
    </footer>
  );
}
