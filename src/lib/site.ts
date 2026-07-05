/**
 * Site-wide constants used by metadata, structured data, and the footer.
 * Centralised here so SEO tags stay consistent.
 */

export const SITE = {
  name: "Avmall",
  legalName: "Almubaarak Variety Mall",
  shortName: "Avmall",
  domain: "avmall-nine.vercel.app",
  url: "https://avmall-nine.vercel.app",
  // SEO-friendly title — aim for 50–60 chars so it doesn't get truncated in
  // search results or social cards. Used as the default <title> and as the
  // OG/Twitter title on the home + every page without its own title.
  tagline: "Phones, audio, power & home goods · Same-day Lagos",
  description:
    "Goods made by Nigerian hands, delivered nationwide. Same-day Lagos delivery, secure checkout via Nuqood, 14-day returns.",
  themeColor: "#0a0a0a",
  locale: "en_NG",
  email: "hello@avmall.com.ng",
  supportEmail: "support@avmall.com.ng",
  whatsappNumber: "+2348034217790",
  // Display phone — international format
  phone: "+234 803 421 7790",
  address: {
    street: "14 Bourdillon Road",
    city: "Ikoyi",
    state: "Lagos",
    country: "NG",
  },
  social: {
    instagram: "https://instagram.com/avmall.ng",
    twitter: "https://twitter.com/avmall_ng",
    whatsapp: "https://wa.me/2348034217790",
    tiktok: "https://tiktok.com/@avmall.ng",
  },
} as const;

export const SITE_KEYWORDS = [
  "Nigerian e-commerce",
  "shop Nigeria",
  "Lagos delivery",
  "Nigerian makers",
  "beauty Nigeria",
  "home goods Nigeria",
  "fashion Nigeria",
  "Avmall",
  "Almubaarak Variety Mall",
  "Nuqood checkout",
];
