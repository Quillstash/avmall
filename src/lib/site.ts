/**
 * Site-wide constants used by metadata, structured data, and the footer.
 * Centralised here so SEO tags stay consistent.
 */

export const SITE = {
  name: "Avmall",
  legalName: "Almubaarak Variety Mall",
  shortName: "Avmall",
  domain: "www.avmall.com.ng",
  url: "https://www.avmall.com.ng",
  // SEO-friendly title — aim for 50–60 chars so it doesn't get truncated in
  // search results or social cards. Used as the default <title> and as the
  // OG/Twitter title on the home + every page without its own title.
  tagline: "Phones, audio, power & home goods · Same-day Zaria",
  description:
    "Goods made by Nigerian hands, delivered nationwide. Same-day Zaria delivery, secure checkout via Nuqood, 14-day returns.",
  themeColor: "#0a0a0a",
  locale: "en_NG",
  email: "avmallbusiness@gmail.com",
  supportEmail: "avmallbusiness@gmail.com",
  // Default support/WhatsApp number. Admin-editable at /admin/settings — the
  // storefront reads the DB value via getStoreContact(); this is the fallback.
  whatsappNumber: "+2347034486614",
  // Display phone — international format
  phone: "+234 703 448 6614",
  address: {
    street: "Sokoto Road",
    city: "Zaria",
    state: "Kaduna",
    country: "NG",
  },
  social: {
    instagram: "https://instagram.com/avmall.ng",
    twitter: "https://twitter.com/avmall_ng",
    whatsapp: "https://wa.me/2347034486614",
    tiktok: "https://tiktok.com/@avmall.ng",
  },
} as const;

export const SITE_KEYWORDS = [
  "Nigerian e-commerce",
  "shop Nigeria",
  "Zaria delivery",
  "Nigerian makers",
  "beauty Nigeria",
  "home goods Nigeria",
  "fashion Nigeria",
  "Avmall",
  "Almubaarak Variety Mall",
  "Nuqood checkout",
];
