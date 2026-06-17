import Link from "next/link";
import Image from "next/image";
import { SocialIcon, type SocialPlatform } from "@/components/ui/social-icon";
import { SITE } from "@/lib/site";

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

const SOCIAL: { platform: SocialPlatform; label: string; href: string }[] = [
  { platform: "instagram", label: "Instagram", href: SITE.social.instagram },
  { platform: "twitter", label: "X / Twitter", href: SITE.social.twitter },
  { platform: "whatsapp", label: "WhatsApp", href: SITE.social.whatsapp },
  { platform: "tiktok", label: "TikTok", href: SITE.social.tiktok },
];

export function StorefrontFooter({
  categories = [],
}: {
  /** Store categories for the "Shop" column — fetched per store. */
  categories?: { slug: string; name: string }[];
}) {
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
            1842901 · {SITE.address.city}, {SITE.address.state}.
          </p>
          <div className="flex gap-2 mt-4" aria-label="Social media">
            {SOCIAL.map((s) => (
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
