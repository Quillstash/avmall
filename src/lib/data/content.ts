/**
 * CMS content layer for the editable storefront pages (About / Makers /
 * Careers) and the Journal blog.
 *
 * Each page's content is a single `ContentPage` row (JSON), validated against a
 * zod schema whose fields all carry the built-in defaults below — so a missing
 * DB row, or a partial one, still yields fully-populated, on-brand content.
 * The storefront never renders blank; admins edit from /admin/content.
 */

import "server-only";

import { z } from "zod";
import { db, hasDatabase, withRetry } from "@/lib/db";
import { SITE } from "@/lib/site";

// ── Shared field shapes ─────────────────────────────────────────────────────

const hero = z.object({
  eyebrow: z.string(),
  title: z.string(),
  description: z.string(),
});

const titleBody = z.object({ title: z.string(), body: z.string() });

// ── About ───────────────────────────────────────────────────────────────────

export const ABOUT_DEFAULT = {
  hero: {
    eyebrow: "About",
    title: "Made in Nigeria, for the country",
    description: `${SITE.legalName} exists to give small-batch Nigerian makers a fair shot at the national market — without forcing them onto Instagram DMs or marketplaces that take half their revenue.`,
  },
  storyHeading: "The short version",
  storyParagraphs: [
    "Avmall started in 2024 with one Aba leather workshop and a spreadsheet of WhatsApp orders. The maker, Ade, was selling great work but losing hours every week to customers asking for prices, photos, delivery quotes, and tracking — the same questions, over and over.",
    "We built a website. Then a payment flow. Then a stock system that wouldn’t oversell. Other makers started asking to be added. Today we work with 47 of them across beauty, home goods, fashion, and pantry — every product in our Zaria warehouse before it goes live.",
    "We’re not a marketplace. There’s a single curator on staff (hi, that’s Tolu) who decides what goes on Avmall. We say no to far more makers than we say yes to — because saying yes means committing to ship their work flawlessly.",
  ],
  pillarsHeading: "What we stand for",
  pillars: [
    { title: "Makers first", body: "We pay our makers within seven days, every time. Margins are transparent — the maker chooses the wholesale price, we agree the retail markup together." },
    { title: "No drop-shipping", body: "Every product on Avmall is in our warehouse before it goes on sale. If we say it ships in 24 hours, it ships in 24 hours." },
    { title: "Pay the way you want", body: "Nuqood card, bank transfer, POS on delivery, cash on delivery, split payment for wholesale. The same prices apply across all of them." },
    { title: "Honest returns", body: "14 days, no questions, free pickup in Zaria. The only items we can’t take back are opened beauty and bespoke goods." },
  ],
  cta: {
    eyebrow: "Become a maker",
    title: "Sell your work without losing your weekends to DMs",
    body: "If you’re a small-batch maker in Nigeria and you think you’d be a fit, we want to hear from you. We onboard 4–6 new makers a quarter.",
    imageUrl: "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=1200&q=80&auto=format&fit=crop",
    buttonLabel: "Apply to sell",
    buttonHref: "/makers",
  },
};

export const aboutSchema = z.object({
  hero: hero.default(ABOUT_DEFAULT.hero),
  storyHeading: z.string().default(ABOUT_DEFAULT.storyHeading),
  storyParagraphs: z.array(z.string()).default(ABOUT_DEFAULT.storyParagraphs),
  pillarsHeading: z.string().default(ABOUT_DEFAULT.pillarsHeading),
  pillars: z.array(titleBody).default(ABOUT_DEFAULT.pillars),
  cta: z
    .object({
      eyebrow: z.string(),
      title: z.string(),
      body: z.string(),
      imageUrl: z.string(),
      buttonLabel: z.string(),
      buttonHref: z.string(),
    })
    .default(ABOUT_DEFAULT.cta),
});
export type AboutContent = z.infer<typeof aboutSchema>;

// ── Makers ────────────────────────────────────────────────────────────────

export const MAKERS_DEFAULT = {
  hero: {
    eyebrow: "For makers",
    title: "Sell your work on Avmall",
    description: "If you make in small batches and want a national audience without losing your weekends to DMs — let’s talk.",
  },
  onboardingCta: {
    eyebrow: "Currently onboarding",
    title: "Q2 2026 maker cohort — 6 spots left",
    buttonLabel: "Open WhatsApp",
  },
  benefitsHeading: "What you get",
  benefits: [
    { title: "Paid in 7 days", body: "We hold stock and pay you on net-7 terms after the order ships. No three-month payment holds." },
    { title: "Photography on us", body: "We bring your stock to our studio and shoot it for the site. Photos are yours to keep and reuse." },
    { title: "Storage in our warehouse", body: "Warehouse storage at no monthly fee. We pick, pack, and ship — you keep making." },
    { title: "One curator margin", body: "30% blended margin (lower for higher volume). No listing fees, no platform fees, no surprise deductions." },
    { title: "Cross-channel reach", body: "Customers find your work from the storefront, our WhatsApp AI agent, and our wholesale buyer network." },
    { title: "You set the price", body: "We never undercut you. The price on Avmall is the price you and we agreed at onboarding." },
  ],
  stepsHeading: "How onboarding works",
  steps: [
    "Send us a few photos and a description of your work on WhatsApp",
    "We’ll set up a 30-min call within 3 working days",
    "If it’s a fit, we onboard 4–6 new makers a quarter",
    "Photography, listing, and first stock delivery happens in week 2",
  ],
  lookForHeading: "What we look for",
  lookFor: [
    "You make your own work — we don’t resell wholesale imports.",
    "Your batch size and stock are something you can commit to consistently.",
    "Pricing, ingredients, and process are transparent — we tell our customers everything.",
    "You’re registered (CAC) or willing to register during onboarding. We help with this.",
  ],
  finalCta: {
    intro: "Already convinced?",
    buttonLabel: "Apply on WhatsApp",
  },
};

export const makersSchema = z.object({
  hero: hero.default(MAKERS_DEFAULT.hero),
  onboardingCta: z
    .object({ eyebrow: z.string(), title: z.string(), buttonLabel: z.string() })
    .default(MAKERS_DEFAULT.onboardingCta),
  benefitsHeading: z.string().default(MAKERS_DEFAULT.benefitsHeading),
  benefits: z.array(titleBody).default(MAKERS_DEFAULT.benefits),
  stepsHeading: z.string().default(MAKERS_DEFAULT.stepsHeading),
  steps: z.array(z.string()).default(MAKERS_DEFAULT.steps),
  lookForHeading: z.string().default(MAKERS_DEFAULT.lookForHeading),
  lookFor: z.array(z.string()).default(MAKERS_DEFAULT.lookFor),
  finalCta: z
    .object({ intro: z.string(), buttonLabel: z.string() })
    .default(MAKERS_DEFAULT.finalCta),
});
export type MakersContent = z.infer<typeof makersSchema>;

// ── Careers ───────────────────────────────────────────────────────────────

export const CAREERS_DEFAULT = {
  hero: {
    eyebrow: "Join us",
    title: "Build the Nigerian retail platform",
    description: "We’re a small team in Zaria shipping a serious amount of software, warehouse ops, and maker partnerships. Open roles below.",
  },
  valuesHeading: "How we work",
  values: [
    { title: "Ship the thing", body: "Move quickly, but never at the expense of the maker or the customer." },
    { title: "Honesty over polish", body: "If the photo doesn’t match the product, fix the photo. If the timeline slips, tell the customer." },
    { title: "Compound the warehouse", body: "Every process improvement we ship lives forever. Documentation is a feature." },
    { title: "Hire for trust", body: "Senior or junior, we ship things that affect real customers and real makers from day one." },
  ],
  rolesHeading: "Open roles",
  rolesUpdated: "1 May 2026",
  roles: [
    { title: "Warehouse Operations Lead", team: "Operations", location: "Zaria, Kaduna", type: "Full-time · On-site", body: "Own the warehouse end-to-end: picking, packing, returns, and the team of 4 dispatch riders. Inventory accuracy is the metric." },
    { title: "Senior Backend Engineer", team: "Engineering", location: "Zaria / Remote", type: "Full-time · Hybrid", body: "Next.js + PostgreSQL + Prisma. You’ll own the order pipeline — checkout, payments, returns — and the AI agent tool API." },
    { title: "Maker Partnerships Manager", team: "Partnerships", location: "Zaria, Kaduna", type: "Full-time · On-site", body: "Source, evaluate, and onboard new makers. Travel within Nigeria once a month — workshop visits, photoshoots, contracting." },
    { title: "Customer Care Specialist (WhatsApp)", team: "Support", location: "Zaria", type: "Full-time · Shift", body: "Front-line for WhatsApp tickets. Quick, kind, accurate — and unafraid to escalate when a maker or a customer needs more than a quick reply." },
  ],
  speculative: {
    title: "Don’t see your role?",
    body: "If you think you’d be exceptional here, tell us how. Speculative applications get read by our founders, every one of them.",
    buttonLabel: "Email the founders",
  },
};

export const careersSchema = z.object({
  hero: hero.default(CAREERS_DEFAULT.hero),
  valuesHeading: z.string().default(CAREERS_DEFAULT.valuesHeading),
  values: z.array(titleBody).default(CAREERS_DEFAULT.values),
  rolesHeading: z.string().default(CAREERS_DEFAULT.rolesHeading),
  rolesUpdated: z.string().default(CAREERS_DEFAULT.rolesUpdated),
  roles: z
    .array(
      z.object({
        title: z.string(),
        team: z.string(),
        location: z.string(),
        type: z.string(),
        body: z.string(),
      }),
    )
    .default(CAREERS_DEFAULT.roles),
  speculative: z
    .object({ title: z.string(), body: z.string(), buttonLabel: z.string() })
    .default(CAREERS_DEFAULT.speculative),
});
export type CareersContent = z.infer<typeof careersSchema>;

// ── Registry + readers ──────────────────────────────────────────────────────

export type ContentKey = "about" | "makers" | "careers";

const SCHEMAS = {
  about: aboutSchema,
  makers: makersSchema,
  careers: careersSchema,
} as const;

/** Read + validate one content page, falling back to defaults for any missing
 *  DB row / field. Never throws — a corrupt row yields the defaults. */
async function readContent<K extends ContentKey>(
  key: K,
): Promise<z.infer<(typeof SCHEMAS)[K]>> {
  const schema = SCHEMAS[key];
  if (!hasDatabase) return schema.parse({}) as z.infer<(typeof SCHEMAS)[K]>;
  try {
    const row = await withRetry(() =>
      db.contentPage.findUnique({ where: { key } }),
    );
    const raw = row?.content ?? {};
    const parsed = schema.safeParse(raw);
    return (parsed.success ? parsed.data : schema.parse({})) as z.infer<
      (typeof SCHEMAS)[K]
    >;
  } catch {
    return schema.parse({}) as z.infer<(typeof SCHEMAS)[K]>;
  }
}

export const getAboutContent = () => readContent("about");
export const getMakersContent = () => readContent("makers");
export const getCareersContent = () => readContent("careers");

/** Generic reader used by the admin editor — merged content for any key. */
export function getContentByKey(key: ContentKey) {
  return readContent(key);
}

export const CONTENT_KEYS: ContentKey[] = ["about", "makers", "careers"];

export function isContentKey(k: string): k is ContentKey {
  return (CONTENT_KEYS as string[]).includes(k);
}

/** For the admin editor + PUT validation: the zod schema by key. */
export function contentSchemaFor(key: ContentKey) {
  return SCHEMAS[key];
}

// ── Journal ─────────────────────────────────────────────────────────────────

export interface JournalListItem {
  slug: string;
  title: string;
  excerpt: string;
  coverImage: string | null;
  category: string;
  readTime: string | null;
  publishedAt: Date | null;
}

export interface JournalPostView extends JournalListItem {
  id: string;
  body: string;
  author: string | null;
  published: boolean;
}

function toListItem(p: {
  slug: string;
  title: string;
  excerpt: string;
  coverImage: string | null;
  category: string;
  readTime: string | null;
  publishedAt: Date | null;
}): JournalListItem {
  return {
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    coverImage: p.coverImage,
    category: p.category,
    readTime: p.readTime,
    publishedAt: p.publishedAt,
  };
}

/** Published posts, newest first — for the storefront /journal list. */
export async function listPublishedJournalPosts(): Promise<JournalListItem[]> {
  if (!hasDatabase) return [];
  try {
    const rows = await withRetry(() =>
      db.journalPost.findMany({
        where: { published: true },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      }),
    );
    return rows.map(toListItem);
  } catch {
    return [];
  }
}

/** A single published post by slug — for /journal/[slug]. */
export async function getPublishedJournalPost(
  slug: string,
): Promise<JournalPostView | null> {
  if (!hasDatabase) return null;
  try {
    const p = await withRetry(() =>
      db.journalPost.findUnique({ where: { slug } }),
    );
    if (!p || !p.published) return null;
    return {
      ...toListItem(p),
      id: p.id,
      body: p.body,
      author: p.author,
      published: p.published,
    };
  } catch {
    return null;
  }
}

export interface JournalAdminRow extends JournalPostView {
  updatedAt: Date;
}

function toAdminRow(p: {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  coverImage: string | null;
  category: string;
  author: string | null;
  readTime: string | null;
  published: boolean;
  publishedAt: Date | null;
  updatedAt: Date;
}): JournalAdminRow {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    body: p.body,
    coverImage: p.coverImage,
    category: p.category,
    author: p.author,
    readTime: p.readTime,
    published: p.published,
    publishedAt: p.publishedAt,
    updatedAt: p.updatedAt,
  };
}

/** All posts (published + drafts), newest-edited first — for the admin list. */
export async function listAllJournalPosts(): Promise<JournalAdminRow[]> {
  if (!hasDatabase) return [];
  try {
    const rows = await withRetry(() =>
      db.journalPost.findMany({ orderBy: { updatedAt: "desc" } }),
    );
    return rows.map(toAdminRow);
  } catch {
    return [];
  }
}

/** One post by id — for the admin editor. */
export async function getJournalPostForAdmin(
  id: string,
): Promise<JournalAdminRow | null> {
  if (!hasDatabase) return null;
  try {
    const p = await withRetry(() =>
      db.journalPost.findUnique({ where: { id } }),
    );
    return p ? toAdminRow(p) : null;
  } catch {
    return null;
  }
}
