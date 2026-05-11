# AVMALL — ECOMMERCE PLATFORM BUILDER PROMPT

> **How to use this document:** This is a complete build specification for the Avmall ecommerce platform. Feed this entire document to Claude (or any capable AI builder) as context, then ask it to build sections in sequence. Every screen, model, edge case, and rule it needs is in here. Where you see `[BUILD INSTRUCTION]` blocks, those are direct, unambiguous instructions to the builder. Where you see `[EDGE CASE]` blocks, the builder must handle that case explicitly — do not skip them.

> **Project:** Avmall Ltd — full custom ecommerce platform, migrating from Bumpa.
> **Market:** Nigeria (Naira-denominated, Nigerian shipping zones, Nigerian payment rails).
> **Channels:** Web storefront, Admin dashboard, WhatsApp AI agent, Web chat widget.
> **Payment provider:** Nuqood.ng (primary online), plus Cash, Bank Transfer, POS, Store Credit.

---

## TABLE OF CONTENTS

1. Build Philosophy & Non-Negotiables
2. Tech Stack (Recommended)
3. Design System (Tokens, Typography, Components)
4. Information Architecture
5. Core Domain Models (Database Schema)
6. API Contracts (REST endpoints, request/response shapes)
7. Storefront — Screen Specifications
8. Admin Dashboard — Screen Specifications
9. Order Lifecycle — State Machine & Edge Cases
10. Payments & Split Payment — Full Logic
11. Returns Management — Full Flow
12. Discounts & Promotions Engine
13. Shipping Engine (Nigerian Context)
14. Staff, Roles & Permissions Matrix
15. AI Agent — Architecture & Conversation Flows
16. WhatsApp Channel — Implementation
17. Notifications System
18. Analytics & Reporting
19. Bumpa Migration Strategy
20. Edge Cases & Failure Modes Master List
21. Security, Audit & Compliance
22. Build Sequence (6-week roadmap)

---

## 1. BUILD PHILOSOPHY & NON-NEGOTIABLES

The builder must internalise these principles. Every decision flows from them.

**1.1 Nigerian-first, not Nigerian-as-an-afterthought.**
Naira (₦) is the only currency. Format `₦34,000` or `₦34,000.00`, never `NGN 34000`. Phone numbers default to `+234` international format but accept and normalise `0803...`, `+234803...`, and `234803...`. Addresses use Nigerian states and LGAs (Local Government Areas), not "States/Provinces". Shipping zones reflect Nigerian courier reality (intra-Lagos vs. inter-state vs. North vs. South-South).

**1.2 Money is integers, never floats.**
All money is stored as integer **kobo** (1 Naira = 100 kobo). Never use floating-point for any price, discount, fee, or tax. Display layer converts to Naira. This eliminates rounding bugs in bulk pricing, split payments, and partial refunds.

**1.3 Every action is an event, every change is auditable.**
Order modifications, price changes, stock adjustments, role changes, refund decisions — all of these write an immutable audit log entry with `{actor_id, action, entity_type, entity_id, before, after, timestamp, ip, user_agent}`. The audit log is append-only and cannot be edited by anyone, including Super Admin.

**1.4 Stock is reserved, not just decremented.**
The moment a customer adds an item to cart and proceeds to checkout, stock is **reserved** (held) for a configurable window (default 15 minutes). Reserved stock is invisible to other shoppers. This prevents two customers from "buying" the last item simultaneously. Reservations expire automatically and return stock to the pool.

**1.5 The AI agent shares one source of truth with the website.**
There is no separate inventory, separate pricing, or separate order system for the AI. The agent reads from and writes to the exact same database as the storefront and admin. A bulk discount configured on a product applies identically whether the customer reaches it via the AI on WhatsApp, the AI on the website widget, the storefront cart, or a staff-created order.

**1.6 Mobile-first storefront, tablet-friendly admin.**
The storefront must be excellent on a 360px-wide Android phone before it is excellent on desktop — most Nigerian online shoppers buy from mobile. The admin dashboard must be fully usable on a 768px tablet (counter staff use tablets), and excellent on desktop.

**1.7 Graceful degradation everywhere.**
Network is unreliable in Nigeria. Every form submission must survive a refresh (autosave drafts). Every payment confirmation must be idempotent (never double-charge if a customer hits the link twice). Every webhook must be retried with exponential backoff. Every long-running operation (CSV export, migration) must run in a background job, not block a request.

**1.8 Permissions checked server-side, always.**
The UI hides what a user cannot do, but every API endpoint independently re-verifies the user's role and permissions. UI-only permissions are not security.

---

## 2. RECOMMENDED TECH STACK

The builder may substitute equivalents, but if substituting, must justify the change and ensure all features below remain implementable.

| Layer | Recommendation | Why |
|---|---|---|
| Frontend (storefront + admin) | Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui | SSR for SEO, fast on mobile, large component library |
| Backend API | Next.js API routes OR a separate Node/Express service, TypeScript | Co-located with frontend or scalable separately |
| Database | PostgreSQL 15+ (Neon or Supabase managed) | Relational integrity for orders/payments/inventory; JSON columns for flexibility |
| ORM | Prisma | Type-safe schema, migrations, good DX |
| File storage | Cloudflare R2 or AWS S3 | Product images, return photos, receipts |
| Image optimisation | Cloudflare Images or `next/image` with a CDN | Critical for mobile performance in Nigeria |
| Cache / queues | Redis (Upstash) | Rate limiting, session, background job queue, cart reservations |
| Background jobs | BullMQ (on Redis) | Email/SMS sending, abandoned cart recovery, report generation |
| Search | PostgreSQL full-text + `pg_trgm` for fuzzy product search; upgrade to Meilisearch later if needed | Avoid premature complexity |
| Authentication | NextAuth.js or Clerk; OTP via SMS for customers; email+password for staff with optional 2FA | Customers should not need passwords (use OTP); staff need stronger auth |
| Payments | Nuqood.ng API (primary). Abstract behind a `PaymentProvider` interface so additional providers (Paystack fallback, etc.) can plug in | Provider may be swapped later |
| WhatsApp | WhatsApp Business Cloud API (Meta), or a Baileys-based worker as interim | Both must be supported behind one channel adapter |
| AI Agent | LLM-agnostic orchestrator (DeepSeek/OpenAI/Anthropic) with tool-calling. RAG over product catalogue via pgvector | Avoid vendor lock-in |
| Notifications | Email via Resend or Postmark; SMS via Termii or Africa's Talking (Nigerian providers) | Local SMS providers are cheaper and have better delivery |
| Hosting | Vercel (frontend) + a managed Postgres (Neon/Supabase) + Upstash Redis | Low ops overhead |
| Observability | Sentry (errors), PostHog (product analytics), Better Stack or Axiom (logs) | Must be installed from day one |

---

## 3. DESIGN SYSTEM

This section is authoritative. Do not invent new colours, fonts, or spacing values not listed here. If a need arises that this system does not cover, extend the system in a documented way — do not freelance.

### 3.1 Brand Voice

Confident, calm, and slightly premium. Avmall is migrating *off* Bumpa precisely because they need something more capable; the platform should feel like an upgrade — modern, fast, considered. Never cutesy. Never childish. Never overly playful. Trust signals (security badges, clear pricing, transparent shipping) are more valuable than emoji-laden marketing copy.

### 3.2 Colour Tokens

All colours defined as CSS variables in HSL for easy theming.

```css
:root {
  /* Brand */
  --brand-primary:        220 90% 56%;   /* #2563EB — confident blue, primary CTAs */
  --brand-primary-hover:  220 90% 48%;
  --brand-primary-fg:     0 0% 100%;     /* text on primary */

  --brand-accent:         158 64% 40%;   /* #1F8A5C — success green, "in stock", paid */
  --brand-accent-hover:   158 64% 32%;

  /* Neutrals (warm-cool blend) */
  --bg:                   210 20% 98%;   /* page background */
  --surface:              0 0% 100%;     /* cards */
  --surface-2:            210 20% 96%;   /* subtle surfaces, table headers */
  --border:               220 13% 91%;
  --border-strong:        220 13% 80%;

  --fg:                   222 47% 11%;   /* near-black, body text */
  --fg-muted:             220 9% 46%;    /* secondary text */
  --fg-subtle:            220 9% 60%;    /* placeholders, disabled */

  /* Semantic */
  --success:              158 64% 40%;
  --success-bg:           158 64% 95%;
  --warning:              38 92% 50%;    /* low stock, partially paid */
  --warning-bg:           38 92% 95%;
  --danger:               0 72% 51%;     /* out of stock, refunded, errors */
  --danger-bg:            0 72% 96%;
  --info:                 220 90% 56%;
  --info-bg:              220 90% 96%;

  /* Status pill colours (orders) */
  --status-pending:       38 92% 50%;
  --status-confirmed:     220 90% 56%;
  --status-processing:    262 83% 58%;
  --status-shipped:       190 90% 48%;
  --status-delivered:     158 64% 40%;
  --status-cancelled:     220 9% 46%;
  --status-returned:      0 72% 51%;
  --status-refunded:      220 9% 46%;
}

[data-theme="dark"] {
  --bg:                   222 47% 8%;
  --surface:              222 47% 11%;
  --surface-2:            222 47% 14%;
  --border:               220 13% 20%;
  --border-strong:        220 13% 30%;
  --fg:                   210 20% 98%;
  --fg-muted:             220 9% 70%;
  --fg-subtle:            220 9% 55%;
  /* Brand and semantic colours stay the same hue, lightnesses adjust slightly */
}
```

### 3.3 Typography

```css
--font-sans: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
--font-display: 'Inter', system-ui, sans-serif;  /* same family, used at large weights */
--font-mono: 'JetBrains Mono', ui-monospace, monospace;  /* for SKUs, order IDs */

/* Type scale (rem) */
--text-xs:   0.75rem;   /* 12px — labels, captions */
--text-sm:   0.875rem;  /* 14px — body small, table cells */
--text-base: 1rem;      /* 16px — body */
--text-lg:   1.125rem;  /* 18px — emphasised body, section intros */
--text-xl:   1.25rem;   /* 20px — card titles */
--text-2xl:  1.5rem;    /* 24px — page section titles */
--text-3xl:  1.875rem;  /* 30px — page titles */
--text-4xl:  2.25rem;   /* 36px — hero / dashboard headings */
--text-5xl:  3rem;      /* 48px — landing hero only */

/* Line heights */
--leading-tight:   1.2;
--leading-snug:    1.35;
--leading-normal:  1.5;
--leading-relaxed: 1.65;
```

Body text on the storefront is `--text-base` with `--leading-normal`. Product titles on listings are `--text-base` weight 600. Product titles on detail pages are `--text-2xl` weight 700. Money is always rendered in tabular figures — add `font-variant-numeric: tabular-nums` to all price elements so they align in tables.

### 3.4 Spacing Scale

Tailwind-compatible 4px base. Use these values; do not interpolate.

`0, 1 (4px), 2 (8px), 3 (12px), 4 (16px), 5 (20px), 6 (24px), 8 (32px), 10 (40px), 12 (48px), 16 (64px), 20 (80px), 24 (96px)`.

Card padding: 16px on mobile, 24px on desktop. Page gutter: 16px on mobile, 24px on tablet, 32px on desktop. Grid gap on product listings: 12px mobile, 16px tablet, 24px desktop.

### 3.5 Radii, Shadows, Borders

```css
--radius-sm:  6px;   /* small badges, inline pills */
--radius-md:  10px;  /* buttons, inputs */
--radius-lg:  14px;  /* cards, modals */
--radius-xl:  20px;  /* hero panels */
--radius-full: 9999px;

--shadow-sm:  0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06);
--shadow-md:  0 4px 6px -1px rgba(15,23,42,0.08), 0 2px 4px -2px rgba(15,23,42,0.06);
--shadow-lg:  0 10px 15px -3px rgba(15,23,42,0.10), 0 4px 6px -4px rgba(15,23,42,0.08);
--shadow-focus: 0 0 0 3px hsl(var(--brand-primary) / 0.35);
```

Default border is 1px solid `var(--border)`. Strong border (form fields, dividers in tables) uses `var(--border-strong)`. Focus ring is `--shadow-focus`, applied via `:focus-visible` not `:focus` (so keyboard users get rings, mouse users do not).

### 3.6 Component Library (build these first)

The builder must implement each of these as a reusable component before building any screen. If a screen needs a variant not listed, the variant goes into the component, not the screen.

**Buttons**
- Variants: `primary`, `secondary`, `ghost`, `destructive`, `link`
- Sizes: `sm` (32px), `md` (40px), `lg` (48px)
- States: default, hover, focus-visible, active, disabled, loading (spinner replaces icon, label dims)
- Icon support: leading and/or trailing, sized 16px (sm), 18px (md), 20px (lg)
- Mobile rule: any button reachable by thumb must be ≥44px tall

**Inputs**
- Text, email, tel (with `+234` prefix component), number (with stepper for quantity), textarea, search (with leading icon and clear button)
- States: default, focus, error (red border + helper text), disabled, read-only
- Always have a visible label above (never inside as placeholder-only — accessibility)
- Helper text slot below for hints/errors
- Currency input: leading `₦`, integer kobo internally, formatted display

**Selects & Combos**
- Native `<select>` styled to match
- Searchable Combobox (for product search in order creation, customer lookup)
- Multi-select with chips (for tags, categories)

**Money display**
- A `<Money>` component that takes `kobo: number` and renders `₦XX,XXX` or `₦XX,XXX.XX`
- Variants: default, strikethrough (for original price next to sale price), large (for order totals)
- Always uses tabular numerals

**Status Pill / Badge**
- Maps order status → colour from `--status-*` tokens
- Maps stock status → `In Stock`, `Low Stock` (yellow), `Out of Stock` (red), `Pre-Order` (purple)
- Maps payment status → `Unpaid`, `Partially Paid`, `Paid`, `Refunded`, `Partially Refunded`

**Tables**
- Sticky header row
- Sortable columns (click header)
- Selectable rows (checkbox column, leading)
- Sticky action column on the right (mobile: collapses to a `…` menu)
- Empty state with illustration + CTA
- Loading skeleton rows (don't show a spinner over a half-rendered table)
- Pagination: page-size selector (25/50/100), page nav, total count

**Cards**
- Default card (`--surface`, `--radius-lg`, `--shadow-sm`, padding 24px)
- Stat card (label, big number, delta arrow + percentage, sparkline)
- Product card (storefront): image (1:1), title (2-line clamp), price block, "Add to cart" button
- Order card (mobile admin): order ID, customer, total, status pill, time

**Modals & Drawers**
- Modal: confirmations, forms ≤8 fields. Backdrop, ESC to close, traps focus.
- Drawer (right side): product editor, order detail, customer detail. Wider than modal, scrolls internally.
- Sheet (bottom, mobile): mobile equivalent of drawer; slides up.
- Confirm dialog: for destructive actions, requires explicit "Yes, delete" — never just "OK".

**Toasts**
- Positions: bottom-right desktop, top-center mobile
- Variants: info, success, warning, error
- Auto-dismiss 4s for info/success, 8s for warning, manual-only for error
- Stack max 3; oldest dismisses first

**Empty states**
- Illustration (line-art, brand colour), heading, supporting text, single CTA
- Used on every list view that can be empty

**Form patterns**
- Field group: label, input, helper text, error message
- Section divider: heavier border + section heading + optional description
- Sticky save bar at the bottom of long forms (product editor, settings) — disappears when no changes

**Navigation**
- Storefront: top nav with logo, search, cart icon (badge with count), account link; mobile drawer
- Admin: left sidebar (collapsed on mobile to a hamburger), top bar with search + user menu, breadcrumbs

**Notifications & alerts**
- Inline alert (banner) — info, warning, error, success — at top of section
- Notification bell (admin) — count badge, dropdown panel showing latest 10

### 3.7 Iconography

Use **Lucide React** as the single icon library. No emoji as primary UI. Icon sizes: 16px (in compact UI), 20px (default), 24px (large/header). Icons in buttons must always have an accessible label (visible or `aria-label`).

### 3.8 Motion

Subtle, never decorative. Transitions: 150ms for micro (hover, focus), 200ms for small (toast in, dropdown open), 250ms for medium (drawer slide), 300ms for page-level. Easing: `cubic-bezier(0.16, 1, 0.3, 1)` (out-expo) for incoming, `cubic-bezier(0.7, 0, 0.84, 0)` (in-expo) for outgoing. Respect `prefers-reduced-motion: reduce` — disable all non-essential motion.

### 3.9 Accessibility (non-negotiable)

- Colour contrast ≥4.5:1 for body text, ≥3:1 for large text and UI controls
- Every interactive element keyboard-reachable; focus rings always visible on `:focus-visible`
- Every form input has a `<label>`, every icon-only button has `aria-label`
- Modals trap focus and return it on close
- Tables use `<th scope="col">`, `<th scope="row">` correctly
- Status colours always paired with text or icon (never colour alone)
- Alt text on every product image (the SEO field doubles as alt)
