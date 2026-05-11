# CLAUDE.md — Avmall E-Commerce Platform

> **Read this entire file before writing a single line of code.** It is the single source of truth for how this codebase is structured, how decisions are made, and what quality bar is expected. When in doubt, re-read this document.

---

## TABLE OF CONTENTS

1. [Project Overview](#1-project-overview)
2. [Core Principles — Non-Negotiables](#2-core-principles--non-negotiables)
3. [Tech Stack & Tooling](#3-tech-stack--tooling)
4. [Repository Structure](#4-repository-structure)
5. [Environment & Configuration](#5-environment--configuration)
6. [Database Conventions](#6-database-conventions)
7. [API Conventions](#7-api-conventions)
8. [Authentication & Authorization](#8-authentication--authorization)
9. [Money & Currency Rules](#9-money--currency-rules)
10. [Design System Implementation](#10-design-system-implementation)
11. [Component Architecture](#11-component-architecture)
12. [State Management](#12-state-management)
13. [Error Handling](#13-error-handling)
14. [Build Sequence — UI-First Strategy](#14-build-sequence--ui-first-strategy)
15. [File Storage (Cloudflare R2)](#15-file-storage-cloudflare-r2)
16. [Deployment — Vercel → AlwaysData Migration Path](#16-deployment--vercel--alwaysdata-migration-path)
17. [Testing Strategy](#17-testing-strategy)
18. [Performance Rules](#18-performance-rules)
19. [Security Checklist](#19-security-checklist)
20. [Edge Cases Catalogue](#20-edge-cases-catalogue)
21. [AI Agent Integration](#21-ai-agent-integration)
22. [Nigerian-Context Rules](#22-nigerian-context-rules)

---

## 1. Project Overview

**Product:** Avmall Ltd — full-custom e-commerce platform migrating from Bumpa.
**Market:** Nigeria (₦, Nigerian shipping zones, Nuqood payment rails).
**Channels:** Web storefront, Admin dashboard, WhatsApp AI agent, Web chat widget.
**Payment:** Nuqood.ng (primary online), Cash, Bank Transfer, POS, Store Credit.

### What We Are Building

Three interconnected surfaces sharing **one database and one source of truth**:

| Surface | Route Prefix | Primary User |
|---|---|---|
| Customer Storefront | `/` | End shoppers |
| Admin Dashboard | `/admin` | Avmall staff |
| AI Agent API | `/api/v1/ai/tools/` | LLM orchestrator (server-to-server) |

The AI agent is **not** a separate system. It reads and writes the same `orders`, `products`, `customers` tables as the storefront and admin. A bulk discount configured in admin applies identically whether reached via AI on WhatsApp, the website widget, the storefront cart, or a staff-created order.

---

## 2. Core Principles — Non-Negotiables

These are architectural laws, not suggestions. Every decision must flow from them.

### 2.1 Nigerian-First

- Naira (₦) is the only currency. Format: `₦34,000` or `₦34,000.00`. NEVER `NGN 34000`.
- Phone numbers: default `+234`, accept and normalise `0803...`, `+234803...`, `234803...` → always store as E.164 (`+234...`).
- Addresses: Nigerian states and LGAs. Never "States/Provinces".
- Shipping zones reflect Nigerian courier reality (intra-Lagos, inter-state, North, South-South).
- SMS via Termii or Africa's Talking (NOT Twilio for Nigeria — local providers are cheaper and have better delivery).

### 2.2 Money Is Always Integers

```typescript
// ✅ CORRECT
const priceKobo: number = 450000; // ₦4,500

// ❌ WRONG — never do this
const price: number = 4500.00;
```

All money is stored as integer **kobo** (1 Naira = 100 kobo). Never use `float`, `decimal`, or `number` division for money. The display layer converts. Use `bigint` in Postgres for amounts that may exceed ~21M Naira.

### 2.3 Every Action Is an Event

Every state-changing action writes an immutable `audit_logs` entry:
```typescript
{
  actor_user_id, actor_type, action, entity_type, entity_id,
  before, after, metadata: { ip, user_agent, channel }
}
```
The audit log is append-only. No code ever DELETEs or UPDATEs audit rows.

### 2.4 Stock Is Reserved, Not Decremented at Cart-Add

- Adding to cart does NOT reduce `on_hand`.
- Proceeding to checkout reserves stock for 15 minutes (configurable).
- Reservation is `SELECT FOR UPDATE` + increment `reserved` in a single transaction.
- Expired reservations auto-release via a cron job.
- Two customers cannot purchase the same last item simultaneously.

### 2.5 Permissions Are Server-Side Always

The UI hides what a user cannot see. The API independently verifies role + permissions on every request. UI-only guards are not security — they are UX. Never skip the server-side check.

### 2.6 Graceful Degradation Everywhere

- Every form autosaves drafts (localStorage or server-side draft).
- Every payment confirmation is idempotent (Idempotency-Key header, always).
- Every webhook retries with exponential backoff (max 5 attempts).
- Every long-running operation (CSV export, migration) runs as a background job, never blocks an HTTP request.
- Network in Nigeria is unreliable — design for it.

### 2.7 Mobile-First Storefront, Tablet-Friendly Admin

- Storefront: perfect at 360px before it is perfect at 1440px.
- Admin: fully usable at 768px tablet, excellent at desktop.
- Every tap target on mobile: ≥44px tall.

---

## 3. Tech Stack & Tooling

### Chosen Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 14+ (App Router), TypeScript strict mode | SSR for storefront SEO |
| Styling | Tailwind CSS v3 + CSS custom properties | Design tokens via CSS vars |
| UI Components | shadcn/ui (base) + custom components | Build the design system on top |
| ORM | Prisma | Type-safe schema, migrations |
| Database | PostgreSQL 15+ on Neon (dev/prod) | `pgvector` for AI embeddings |
| Cache / Queues | Upstash Redis + BullMQ | Rate limiting, cart reservations, background jobs |
| File Storage | Cloudflare R2 | Product images, return photos |
| Image Optimisation | `next/image` + Cloudflare CDN | Critical for mobile perf in Nigeria |
| Auth (Staff) | NextAuth.js — email + password + optional 2FA | |
| Auth (Customer) | OTP via phone/email, no passwords | via NextAuth custom provider |
| Payments | Nuqood.ng behind `PaymentProvider` interface | Pluggable for future providers |
| WhatsApp | Meta Cloud API + Baileys worker (interim) | Behind a single channel adapter |
| AI / LLM | Provider-agnostic orchestrator (DeepSeek/OpenAI/Anthropic) | Tool-calling, RAG via pgvector |
| Email | Resend | Transactional |
| SMS | Termii (primary), Africa's Talking (fallback) | Nigerian providers |
| Search | PostgreSQL FTS + `pg_trgm` | Upgrade to Meilisearch later if needed |
| Icons | Lucide React exclusively | No emoji as primary UI |
| Observability | Sentry (errors), PostHog (analytics), Axiom (logs) | Install on day 1 |

### Version Pinning

Pin all dependencies with exact versions. No `^` or `~` in `package.json` for core dependencies. Use `pnpm` as the package manager.

### TypeScript Configuration

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

Never use `any`. Use `unknown` and narrow. Never use `as` casting unless explicitly justified in a comment.

---

## 4. Repository Structure

```
avmall/
├── CLAUDE.md                        ← This file
├── .env.local                       ← Never committed
├── .env.example                     ← Committed, all keys with empty values
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── public/
│   └── fonts/                       ← Only self-hosted fonts
├── src/
│   ├── app/                         ← Next.js App Router
│   │   ├── (storefront)/            ← Customer-facing route group
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx             ← Home /
│   │   │   ├── category/
│   │   │   ├── product/
│   │   │   ├── cart/
│   │   │   ├── checkout/
│   │   │   ├── orders/
│   │   │   ├── account/
│   │   │   └── auth/
│   │   ├── (admin)/                 ← Admin route group
│   │   │   ├── layout.tsx
│   │   │   ├── admin/
│   │   │   │   ├── page.tsx         ← Dashboard home
│   │   │   │   ├── orders/
│   │   │   │   ├── products/
│   │   │   │   ├── customers/
│   │   │   │   ├── returns/
│   │   │   │   ├── discounts/
│   │   │   │   ├── shipping/
│   │   │   │   ├── staff/
│   │   │   │   ├── reports/
│   │   │   │   ├── ai/
│   │   │   │   └── settings/
│   │   └── api/
│   │       └── v1/
│   │           ├── (public)/        ← Unauthenticated storefront API
│   │           ├── (customer)/      ← Customer-authenticated API
│   │           ├── admin/           ← Staff-authenticated API
│   │           ├── ai/
│   │           │   └── tools/       ← LLM orchestrator server-to-server
│   │           └── webhooks/        ← Nuqood, WhatsApp, courier
│   ├── components/
│   │   ├── ui/                      ← Base design system components
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── money.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── table.tsx
│   │   │   ├── modal.tsx
│   │   │   ├── drawer.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── empty-state.tsx
│   │   │   └── ...
│   │   ├── storefront/              ← Storefront-specific composed components
│   │   │   ├── product-card.tsx
│   │   │   ├── cart-drawer.tsx
│   │   │   ├── nav.tsx
│   │   │   └── ...
│   │   ├── admin/                   ← Admin-specific composed components
│   │   │   ├── order-row.tsx
│   │   │   ├── stat-card.tsx
│   │   │   ├── sidebar.tsx
│   │   │   └── ...
│   │   └── shared/                  ← Cross-surface shared components
│   ├── lib/
│   │   ├── db.ts                    ← Prisma client singleton
│   │   ├── auth.ts                  ← NextAuth config
│   │   ├── money.ts                 ← Kobo ↔ Naira formatting utils
│   │   ├── phone.ts                 ← Nigerian phone normalisation
│   │   ├── audit.ts                 ← Audit log helper
│   │   ├── stock.ts                 ← Reservation helpers
│   │   ├── permissions.ts           ← Permission check helpers
│   │   ├── idempotency.ts           ← Idempotency key handling
│   │   ├── r2.ts                    ← Cloudflare R2 client
│   │   ├── queue.ts                 ← BullMQ queue definitions
│   │   └── errors.ts                ← Typed application errors
│   ├── hooks/                       ← React hooks
│   ├── stores/                      ← Zustand stores (client state only)
│   ├── types/                       ← Shared TypeScript types
│   │   ├── api.ts                   ← API request/response shapes
│   │   ├── domain.ts                ← Domain entity types (derived from Prisma)
│   │   └── permissions.ts           ← Permission key literals
│   ├── workers/                     ← BullMQ job processors
│   │   ├── email.worker.ts
│   │   ├── sms.worker.ts
│   │   ├── cart-abandonment.worker.ts
│   │   └── stock-reservation.worker.ts
│   └── middleware.ts                ← Edge middleware (auth guards, rate limiting)
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

---

## 5. Environment & Configuration

```bash
# .env.example (all values empty — never commit actual values)

# Database
DATABASE_URL=
DIRECT_URL=                          # Neon direct URL for migrations

# Auth
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=                       # CDN URL for serving images

# Payments
NUQOOD_API_KEY=
NUQOOD_WEBHOOK_SECRET=

# WhatsApp
META_WA_TOKEN=
META_WA_PHONE_NUMBER_ID=
META_WA_VERIFY_TOKEN=

# AI
OPENAI_API_KEY=
DEEPSEEK_API_KEY=

# Email
RESEND_API_KEY=

# SMS
TERMII_API_KEY=
AFRICAS_TALKING_API_KEY=
AFRICAS_TALKING_USERNAME=

# Cache / Queues
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Observability
SENTRY_DSN=
NEXT_PUBLIC_POSTHOG_KEY=
AXIOM_TOKEN=
```

**Configuration rule:** All environment access goes through a typed `env.ts` module that validates at startup using `zod`. Never access `process.env.X` directly in application code.

```typescript
// src/lib/env.ts
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  // ... all required vars
});

export const env = envSchema.parse(process.env);
```

---

## 6. Database Conventions

### Schema Rules

- All IDs are UUIDs (`uuid` type, default `gen_random_uuid()`).
- All timestamps are `timestamptz` with UTC server time.
- All money columns are `INT` (kobo) or `BIGINT` (large amounts). Never `DECIMAL` or `FLOAT`.
- Column naming: `snake_case` in SQL, `camelCase` in Prisma/TypeScript.
- Every table has `created_at` and `updated_at` (auto-maintained via Prisma middleware).
- Soft deletes where applicable: use `archived_at timestamptz` instead of `DELETE`.

### Prisma Conventions

```typescript
// Always import from the singleton
import { db } from "@/lib/db";

// lib/db.ts — Prisma singleton pattern for Next.js
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

### Migrations

- Never edit an existing migration file. Create a new one.
- Migration names must be descriptive: `add_bulk_pricing_tiers`, not `migration_001`.
- Run `prisma migrate deploy` in CI, never `prisma db push` in production.
- Before shipping a schema change, check if it requires a data migration step.

### Critical Queries — Stock Reservation

The stock reservation must be transactional and use `SELECT FOR UPDATE`:

```typescript
// src/lib/stock.ts
export async function reserveStock(
  items: { productId: string; variantId?: string; quantity: number }[],
  orderId: string,
  db: PrismaClient
) {
  return db.$transaction(async (tx) => {
    for (const item of items) {
      // Lock the row
      const stock = await tx.$queryRaw<{ on_hand: number; reserved: number }[]>`
        SELECT on_hand, reserved
        FROM product_stock_levels
        WHERE product_id = ${item.productId}
          AND (variant_id = ${item.variantId ?? null} OR (variant_id IS NULL AND ${item.variantId ?? null} IS NULL))
        FOR UPDATE
      `;

      const available = stock[0].on_hand - stock[0].reserved;
      if (available < item.quantity) {
        throw new StockUnavailableError(item.productId, available, item.quantity);
      }

      await tx.productStockLevel.update({
        where: { productId_variantId: { productId: item.productId, variantId: item.variantId ?? "" } },
        data: { reserved: { increment: item.quantity } },
      });

      await tx.stockReservation.create({
        data: {
          productId: item.productId,
          variantId: item.variantId,
          orderId,
          quantity: item.quantity,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
        },
      });
    }
  });
}
```

---

## 7. API Conventions

### URL Structure

```
/api/v1/                             # Public storefront
/api/v1/admin/                       # Admin (staff JWT/session)
/api/v1/ai/tools/                    # AI agent server-to-server (bearer JWT)
/api/v1/webhooks/                    # Inbound webhooks
```

### Standard Response Shapes

```typescript
// types/api.ts

// Success
type ApiSuccess<T> = {
  data: T;
  meta?: Record<string, unknown>;
};

// Paginated
type ApiPaginated<T> = {
  data: T[];
  meta: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
};

// Error
type ApiError = {
  error: {
    code: string;             // e.g. "STOCK_UNAVAILABLE"
    message: string;          // Human-readable
    details?: Record<string, string>; // Field-level errors keyed by field path
  };
};
```

### HTTP Status Codes

| Status | When |
|---|---|
| 200 | Success |
| 201 | Created |
| 204 | No content (DELETE success) |
| 400 | Validation error |
| 401 | Not authenticated |
| 403 | Authenticated but forbidden (wrong role) |
| 404 | Not found |
| 409 | Conflict (idempotency / state machine violation) |
| 422 | Unprocessable entity |
| 429 | Rate limited |
| 500 | Server error (never expose internal details) |

### Idempotency

Every POST that creates state **must** accept an `Idempotency-Key` header:
- Same key + same body → return original response (from Redis cache).
- Different body with same key → 409 Conflict.
- Required on: `/checkout`, `orders/:id/payments`, `payment-link`, all webhooks.

```typescript
// src/lib/idempotency.ts
export async function withIdempotency<T>(
  key: string,
  body: unknown,
  handler: () => Promise<T>
): Promise<T> {
  const cached = await redis.get(`idempotency:${key}`);
  if (cached) {
    const { bodyHash, response } = JSON.parse(cached);
    if (bodyHash !== hashBody(body)) {
      throw new ConflictError("Idempotency key reused with different body");
    }
    return response as T;
  }

  const response = await handler();
  await redis.setex(
    `idempotency:${key}`,
    86400, // 24 hours
    JSON.stringify({ bodyHash: hashBody(body), response })
  );
  return response;
}
```

### Route Handler Pattern

```typescript
// Every API route follows this pattern
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-response";

const bodySchema = z.object({
  // ...
});

export async function POST(req: NextRequest) {
  try {
    // 1. Auth check
    const session = await requireAuth(req);

    // 2. Parse & validate body
    const body = bodySchema.parse(await req.json());

    // 3. Permission check
    requirePermission(session, "orders.create");

    // 4. Business logic (in a service layer, not here)
    const result = await orderService.create(body, session.userId);

    // 5. Audit log
    await audit.log({ ... });

    // 6. Respond
    return NextResponse.json(apiSuccess(result), { status: 201 });

  } catch (err) {
    return handleApiError(err);
  }
}
```

### Field-Level Validation Errors

```typescript
// Return this shape for validation errors
{
  "error": {
    "code": "VALIDATION",
    "message": "Some fields are invalid",
    "details": {
      "items[0].quantity": "Below minimum order quantity (10)",
      "shipping_address.state": "Required"
    }
  }
}
```

### Order Numbers

Generated as `AVM-{YYYY}-{8-digit-zero-padded-sequence}` from a Postgres sequence. **Never expose internal UUIDs to customers.** The UUID is the primary key; the order number is the customer-facing identifier.

---

## 8. Authentication & Authorization

### Two Auth Systems

**Staff (Admin):** NextAuth.js with email + password. Optional TOTP 2FA. Session stored server-side. Roles and permissions loaded from `roles` + `role_permissions` tables.

**Customers:** OTP-based via phone or email. No passwords. Session stored as a signed cookie. Linked to `customers` table, not `users`.

### Permission Checking

```typescript
// src/lib/permissions.ts
const PERMISSIONS = [
  "orders.view", "orders.create", "orders.edit", "orders.cancel",
  "orders.apply_manual_discount", "orders.override_partial_paid",
  "products.view", "products.create", "products.edit", "products.edit_pricing",
  "products.delete", "products.stock_adjust",
  "customers.view", "customers.edit", "customers.blacklist",
  "customers.store_credit",
  "discounts.view", "discounts.create", "discounts.edit", "discounts.delete",
  "shipping.view", "shipping.edit",
  "staff.view", "staff.create", "staff.edit", "staff.disable",
  "reports.view", "reports.export",
  "ai.view", "ai.settings", "ai.handoff",
  "settings.view", "settings.edit",
  "billing.view",
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number];

export function requirePermission(
  session: AdminSession,
  permission: PermissionKey
): void {
  if (!session.permissions.includes(permission)) {
    throw new ForbiddenError(`Missing permission: ${permission}`);
  }
}
```

### JWT for AI Agent

The AI agent LLM orchestrator communicates server-to-server using a bearer JWT. The JWT has a dedicated scope (`ai_agent`) and is rotatable from the admin settings. It has no UI session — it only has access to the `/api/v1/ai/tools/` routes.

---

## 9. Money & Currency Rules

```typescript
// src/lib/money.ts

/** Format kobo integer to ₦ display string */
export function formatMoney(kobo: number, showDecimals = false): string {
  const naira = kobo / 100;
  if (showDecimals || kobo % 100 !== 0) {
    return `₦${naira.toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return `₦${naira.toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

/** Parse a user-entered Naira string to kobo integer */
export function parseToKobo(nairaString: string): number {
  const cleaned = nairaString.replace(/[₦,\s]/g, "");
  const naira = parseFloat(cleaned);
  if (isNaN(naira)) throw new Error("Invalid money value");
  return Math.round(naira * 100); // Use Math.round, never parseInt
}

/** Apply a percentage discount — always rounds down (favour business) */
export function applyPercentageDiscount(
  amountKobo: number,
  percentOff: number
): number {
  return Math.floor(amountKobo * (percentOff / 100));
}
```

**Rules:**
- Never do `price / 100 * discount` — always `Math.floor(price * discount / 100)`.
- Never store money as Naira strings.
- Currency input component: user types Naira, internally stores kobo.
- Price display: always uses tabular numerals (`font-variant-numeric: tabular-nums`).

---

## 10. Design System Implementation

### CSS Custom Properties (Global)

Define all design tokens as CSS variables in `src/app/globals.css`. These are the authoritative values — never hardcode colours, radii, or shadows.

```css
:root {
  /* Brand */
  --brand-primary:        220 90% 56%;
  --brand-primary-hover:  220 90% 48%;
  --brand-primary-fg:     0 0% 100%;
  --brand-accent:         158 64% 40%;
  --brand-accent-hover:   158 64% 32%;

  /* Neutrals */
  --bg:                   210 20% 98%;
  --surface:              0 0% 100%;
  --surface-2:            210 20% 96%;
  --border:               220 13% 91%;
  --border-strong:        220 13% 80%;
  --fg:                   222 47% 11%;
  --fg-muted:             220 9% 46%;
  --fg-subtle:            220 9% 60%;

  /* Semantic */
  --success:              158 64% 40%;
  --success-bg:           158 64% 95%;
  --warning:              38 92% 50%;
  --warning-bg:           38 92% 95%;
  --danger:               0 72% 51%;
  --danger-bg:            0 72% 96%;
  --info:                 220 90% 56%;
  --info-bg:              220 90% 96%;

  /* Order status tokens */
  --status-pending:       38 92% 50%;
  --status-confirmed:     220 90% 56%;
  --status-processing:    262 52% 57%;
  --status-shipped:       199 89% 48%;
  --status-delivered:     158 64% 40%;
  --status-cancelled:     0 72% 51%;
  --status-refunded:      220 9% 46%;

  /* Typography */
  --font-sans: "Geist", system-ui, sans-serif;
  --font-mono: "Geist Mono", monospace;
  --text-xs:   0.75rem;
  --text-sm:   0.875rem;
  --text-base: 1rem;
  --text-lg:   1.125rem;
  --text-xl:   1.25rem;
  --text-2xl:  1.5rem;
  --text-3xl:  1.875rem;
  --text-4xl:  2.25rem;
  --text-5xl:  3rem;

  /* Radii */
  --radius-sm:  6px;
  --radius-md:  10px;
  --radius-lg:  14px;
  --radius-xl:  20px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm:    0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06);
  --shadow-md:    0 4px 6px -1px rgba(15,23,42,0.08), 0 2px 4px -2px rgba(15,23,42,0.06);
  --shadow-lg:    0 10px 15px -3px rgba(15,23,42,0.10), 0 4px 6px -4px rgba(15,23,42,0.08);
  --shadow-focus: 0 0 0 3px hsl(var(--brand-primary) / 0.35);
}
```

### Tailwind Extension

Extend `tailwind.config.ts` to map all CSS variables:

```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "hsl(var(--brand-primary) / <alpha-value>)",
          accent: "hsl(var(--brand-accent) / <alpha-value>)",
        },
        bg: "hsl(var(--bg) / <alpha-value>)",
        surface: "hsl(var(--surface) / <alpha-value>)",
        "surface-2": "hsl(var(--surface-2) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
        fg: "hsl(var(--fg) / <alpha-value>)",
        "fg-muted": "hsl(var(--fg-muted) / <alpha-value>)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
    },
  },
};
```

### Motion Rules

```css
/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

/* Transition durations */
.transition-micro  { transition-duration: 150ms; }  /* hover, focus */
.transition-small  { transition-duration: 200ms; }  /* toast, dropdown */
.transition-medium { transition-duration: 250ms; }  /* drawer slide */
.transition-page   { transition-duration: 300ms; }  /* page-level */

/* Easing */
.ease-out-expo { transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1); }
.ease-in-expo  { transition-timing-function: cubic-bezier(0.7, 0, 0.84, 0); }
```

---

## 11. Component Architecture

### Rule: Build Components Before Screens

The design system components MUST exist before building any screen. Build in this order:
1. `<Money>` (used everywhere)
2. `<Button>` (all variants and sizes)
3. `<Input>`, `<PhoneInput>`, `<CurrencyInput>`, `<Textarea>`, `<Select>`, `<Combobox>`
4. `<Badge>` / `<StatusPill>`
5. `<Table>` (with sort, select, pagination, empty state, skeleton)
6. `<Card>`, `<StatCard>`
7. `<Modal>`, `<Drawer>`, `<Sheet>` (bottom, mobile)
8. `<Toast>` system
9. `<EmptyState>`
10. Navigation components (storefront nav, admin sidebar)

### Component Conventions

```typescript
// Every component:
// 1. Has explicit prop types (no implicit any)
// 2. Has a displayName for React DevTools
// 3. Handles loading, error, and empty states
// 4. Is accessible (ARIA, keyboard nav)
// 5. Exports from the component's index file

// Example: Money component
import { cn } from "@/lib/utils";

interface MoneyProps {
  kobo: number;
  variant?: "default" | "strikethrough" | "large";
  showDecimals?: boolean;
  className?: string;
}

export function Money({
  kobo,
  variant = "default",
  showDecimals = false,
  className,
}: MoneyProps) {
  const formatted = formatMoney(kobo, showDecimals);

  return (
    <span
      className={cn(
        "font-variant-numeric: tabular-nums",
        variant === "strikethrough" && "line-through text-fg-muted",
        variant === "large" && "text-2xl font-bold",
        className
      )}
    >
      {formatted}
    </span>
  );
}

Money.displayName = "Money";
```

### Product Card — Storefront

Must implement:
- Image (1:1 ratio, lazy-loaded, blurhash placeholder)
- Sale badge top-left when active
- "Pre-order" badge top-right for pre-orders
- "Out of stock" overlay when `available === 0` and not pre-order
- Product name (2-line clamp)
- Price block: original struck through if on sale, current price prominent, "From ₦X" if variants
- Bulk pricing hint if any tier exists
- Quick "Add to cart" — hover on desktop, always visible on mobile
- Never navigates to PDP on "Add to cart" click — only on card tap

### Admin Table — Standard Pattern

Every admin list view uses the same `<DataTable>` base:
```typescript
interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading: boolean;
  pagination: PaginationState;
  onPaginationChange: (p: PaginationState) => void;
  onRowClick?: (row: T) => void;
  emptyState: ReactNode;
  bulkActions?: BulkAction<T>[];
  selectedRows?: T[];
  onSelectionChange?: (rows: T[]) => void;
}
```

---

## 12. State Management

### Rule: Minimal Global State

- **Server state (data from API):** Use React Query (`@tanstack/react-query`) exclusively. No manual fetch + useState.
- **UI state (drawers, modals, toasts):** Zustand stores, colocated with the feature.
- **Form state:** React Hook Form + Zod resolvers.
- **URL state (filters, sort, pagination):** `nuqs` (Next.js URL search params).
- **No Redux.** No Context for data that changes frequently.

### React Query Conventions

```typescript
// Consistent query key factory
export const queryKeys = {
  orders: {
    all: ["orders"] as const,
    list: (filters: OrderFilters) => ["orders", "list", filters] as const,
    detail: (id: string) => ["orders", "detail", id] as const,
  },
  products: {
    all: ["products"] as const,
    list: (filters: ProductFilters) => ["products", "list", filters] as const,
    detail: (slug: string) => ["products", "detail", slug] as const,
  },
  // ...
};
```

### Cart State

The cart is managed via the Cart API (server-side) with a local cart ID stored in localStorage / cookie. The client never manages cart totals locally — it always calls `POST /api/v1/cart/:id/quote` to get the authoritative total. The quote endpoint is debounced at 300ms after any cart change.

---

## 13. Error Handling

### Application Error Types

```typescript
// src/lib/errors.ts

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
    public readonly details?: Record<string, string>
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(details: Record<string, string>) {
    super("VALIDATION", "Some fields are invalid", 400, details);
  }
}

export class StockUnavailableError extends AppError {
  constructor(productId: string, available: number, requested: number) {
    super(
      "STOCK_UNAVAILABLE",
      `Only ${available} units available, ${requested} requested`,
      409,
      { productId: `Available: ${available}` }
    );
  }
}

export class ForbiddenError extends AppError {
  constructor(detail?: string) {
    super("FORBIDDEN", detail ?? "You do not have permission", 403);
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string) {
    super("NOT_FOUND", `${entity} not found`, 404);
  }
}
```

### API Error Handler

```typescript
// src/lib/api-response.ts
export function handleApiError(err: unknown): NextResponse {
  if (err instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          code: err.code,
          message: err.message,
          ...(err.details && { details: err.details }),
        },
      },
      { status: err.statusCode }
    );
  }

  // Log unexpected errors to Sentry
  Sentry.captureException(err);

  return NextResponse.json(
    { error: { code: "INTERNAL", message: "Something went wrong" } },
    { status: 500 }
  );
}
```

### Client-Side Error Boundaries

Every route segment has an `error.tsx` file. Admin routes have a more detailed error page (visible to staff). Storefront error pages are customer-friendly without technical details.

---

## 14. Build Sequence — UI-First Strategy

> **CRITICAL:** We implement UI first, then wire up the API and database. This means pages use mock/static data initially, then are progressively connected.

### Phase 1 — Foundation (Week 1)

**Goal:** Design system components fully built. No pages yet.

Deliverables:
- [ ] Global CSS variables and Tailwind config
- [ ] `<Money>` component
- [ ] `<Button>` — all variants, sizes, states (loading, disabled)
- [ ] `<Input>`, `<PhoneInput>` (+234 prefix), `<CurrencyInput>` (₦, kobo internally)
- [ ] `<Textarea>`, `<Select>` (native styled), `<Combobox>` (searchable)
- [ ] `<Badge>` / `<StatusPill>` — all order, payment, stock states
- [ ] `<Table>` — sortable, selectable, paginated, skeleton, empty state
- [ ] `<Card>`, `<StatCard>` (with delta + sparkline)
- [ ] `<Modal>`, `<Drawer>` (right-side), `<Sheet>` (bottom, mobile)
- [ ] `<Toast>` system — all variants, stacking, auto-dismiss
- [ ] `<EmptyState>` — with illustration slots
- [ ] `<Skeleton>` — for all content shapes

### Phase 2 — Storefront UI (Week 2)

All pages with static/mock data. Fully interactive UI, no real API calls.

Order:
1. Storefront Layout: `<Nav>`, `<Footer>`, mobile drawer
2. Home page (`/`) — hero, featured collections, product grids, trust band
3. Category/Listing page — filter rail, product grid, sort, pagination/load more
4. Product Detail page — gallery, variant selectors, quantity stepper, bulk pricing table, price block logic (all 6 states)
5. Cart page — item rows, coupon input, order summary, empty state
6. Checkout — 3 sections (contact, shipping, payment), confirmation page
7. Order Tracking page
8. Account pages (orders, addresses, profile, returns initiation)
9. AI Chat Widget (floating, opens panel, mock conversation)

### Phase 3 — Admin UI (Week 3)

All admin pages with static/mock data.

Order:
1. Admin Layout: sidebar (collapsible), top bar, breadcrumbs
2. Dashboard home — KPI cards, revenue chart, donut, action-needed list, recent orders
3. Orders list — all filters, bulk actions, row drawer
4. Order detail — three-column layout, all state-specific behaviours
5. Create Order — full flow with product search combobox
6. Products list + Product editor
7. Customers list + Customer detail
8. Returns list + Return detail
9. Discounts manager
10. Shipping zones
11. Staff & Roles
12. Reports (all 10 report types)
13. AI Control Panel
14. Settings pages

### Phase 4 — Database & API (Week 4)

- [ ] Prisma schema — all 30+ tables
- [ ] Migrations
- [ ] Seed data (Nigerian states/LGAs, default roles, sample products)
- [ ] All API routes wired up
- [ ] Authentication (staff + customer OTP)
- [ ] Stock reservation system

### Phase 5 — Integrations (Week 5)

- [ ] Nuqood payment integration
- [ ] Cloudflare R2 image upload
- [ ] WhatsApp webhook + Baileys worker
- [ ] AI agent tool API
- [ ] Background job workers (BullMQ)
- [ ] Email (Resend) + SMS (Termii) notifications

### Phase 6 — Testing, Migration & Launch (Week 6)

- [ ] Bumpa migration tool
- [ ] End-to-end tests
- [ ] Performance audit (Lighthouse, Web Vitals)
- [ ] Security audit
- [ ] Staging deploy
- [ ] Launch

---

## 15. File Storage (Cloudflare R2)

### Setup

```typescript
// src/lib/r2.ts
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";

export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

export async function generateUploadUrl(
  key: string,
  contentType: string
): Promise<string> {
  return getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 3600 }
  );
}

export function getPublicUrl(key: string): string {
  return `${env.R2_PUBLIC_URL}/${key}`;
}
```

### Image Key Convention

```
products/{productId}/{uuid}.{ext}          # Product images
returns/{returnId}/{uuid}.{ext}            # Return photos
business/{type}/{uuid}.{ext}              # Logo, banner, etc.
```

### Upload Flow

1. Client requests a presigned URL from our API (`POST /api/v1/admin/upload/presign`).
2. Our API generates a presigned R2 URL and returns it.
3. Client uploads directly to R2 (never through our server).
4. Client POSTs the resulting R2 key to our API to save to DB.
5. Images are served via Cloudflare CDN (never from R2 origin directly in production).

### `next/image` Configuration

```typescript
// next.config.ts
export default {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: new URL(env.R2_PUBLIC_URL).hostname,
      },
    ],
  },
};
```

---

## 16. Deployment — Vercel → AlwaysData Migration Path

### Current: Vercel + Neon

- Next.js deployed to Vercel (serverless functions).
- Database: Neon PostgreSQL (serverless, connection pooling via PgBouncer).
- Redis: Upstash (serverless Redis).
- Images: Cloudflare R2 (unchanged across migrations).

### Future: AlwaysData

AlwaysData is a traditional managed hosting platform. The migration will require:

**Keep architecture portable:**
1. **Never use Vercel-specific APIs** (`@vercel/kv`, `@vercel/postgres`, `@vercel/blob`). Use provider-agnostic equivalents (Upstash, direct PostgreSQL, R2).
2. **Background jobs via BullMQ** (Redis-backed) — not Vercel Cron (which is not portable). On AlwaysData, the BullMQ worker runs as a separate Node.js process.
3. **No Vercel Edge Runtime** in API routes — use `runtime = 'nodejs'` only. Edge runtime is not supported on AlwaysData.
4. **WebSockets:** If needed (real-time admin), use Socket.IO with a standalone server, not Vercel's Pusher integration.

**Migration steps (when ready):**
1. Build the Next.js app with `next build` and `next start` (not `vercel dev`).
2. Point `DATABASE_URL` to AlwaysData PostgreSQL.
3. Run BullMQ workers as PM2-managed Node.js processes on AlwaysData.
4. Configure AlwaysData reverse proxy (Apache/Nginx) to point to Next.js `PORT`.
5. Update environment variables in AlwaysData control panel.

**AlwaysData-specific notes:**
- AlwaysData supports Node.js via their "Node.js" site type.
- PostgreSQL on AlwaysData is traditional managed Postgres — adjust connection settings accordingly (no pgBouncer by default; use connection pooling in Prisma config).
- File system is persistent on AlwaysData (unlike Vercel) — local file operations work for temp files.

---

## 17. Testing Strategy

### Test Types

| Type | Tool | Coverage Target |
|---|---|---|
| Unit | Vitest | Money utils, phone normalisation, discount calc, state machine |
| Integration | Vitest + test DB | API routes, stock reservation transactions |
| E2E | Playwright | Critical user journeys |

### Must-Test Scenarios

**Unit tests (always):**
- `formatMoney` — all edge cases (0 kobo, 99 kobo, 10M Naira, negative)
- `parseToKobo` — handles ₦, commas, spaces, decimals, invalid strings
- `normalisePhone` — all 0803, +234803, 234803 formats
- `applyPercentageDiscount` — no floating point drift
- Order state machine — only valid transitions pass
- Stock reservation logic — concurrent reservation test

**Integration tests (API routes):**
- `POST /checkout` — stock reservation transaction (concurrent requests)
- `POST /cart/:id/quote` — correct discount stacking order
- Idempotency — same key same body returns cached, different body returns 409
- Webhook HMAC validation

**E2E tests (Playwright):**
- Customer journey: browse → PDP → cart → checkout → confirmation
- OTP login flow
- Admin: create order → add payment → mark shipped
- Return initiation
- Staff cannot access admin routes without correct role

---

## 18. Performance Rules

### Storefront

- **Core Web Vitals targets:** LCP < 2.5s, CLS < 0.1, FID < 100ms — on a 3G mobile connection (emulated with DevTools).
- **Images:** Always use `next/image` with explicit `width` and `height`. Never `layout="fill"` without a sized container. Always provide `blurhash` or `blurDataURL` placeholder.
- **Fonts:** Self-host via `next/font`. Never load from Google Fonts (adds a round-trip).
- **Product listing pages:** Use `loading="lazy"` on all images below the fold.
- **SSR vs Client:** Product listing pages, PDPs, and home are SSR. Cart and account are client-side (or ISR). Admin is fully client-side (no SSR needed for auth-gated content).
- **API responses:** Paginate all lists. Maximum 100 items per page, default 25.

### Admin

- **Virtualize long lists:** If a table may have thousands of rows, use `@tanstack/react-virtual`.
- **Heavy queries:** Revenue reports and inventory reports run as async background jobs, not synchronous API calls.
- **Optimistic updates:** Admin actions (confirm order, mark shipped) update the UI optimistically before the API confirms. Roll back on error with a toast.

---

## 19. Security Checklist

Apply every item. No exceptions.

- [ ] All money calculations done server-side. Client-displayed totals are always re-validated on checkout.
- [ ] HMAC signature verified on every inbound webhook (Nuqood, WhatsApp).
- [ ] Rate limiting on all public endpoints: auth routes (5/min per IP), product search (30/min), checkout (3/min per IP).
- [ ] OTP codes: 6 digits, expire in 5 minutes, single-use, 5 attempts max (then lock for 15 min).
- [ ] JWT tokens: short-lived (15 min access, 7-day refresh). AI agent JWTs: 30-day but rotatable.
- [ ] SQL injection: impossible via Prisma parameterised queries. When using `$queryRaw`, parameters are always template-literal interpolated (never string concatenation).
- [ ] XSS: Next.js escapes JSX by default. When using `dangerouslySetInnerHTML` (e.g. rich text product descriptions), always sanitise with DOMPurify before rendering.
- [ ] CSRF: Not required for API routes using bearer token auth. For session-cookie routes, use `SameSite=Strict` cookies.
- [ ] File uploads: validate MIME type server-side (not just file extension). For images, use `sharp` to re-encode and strip EXIF data before storing to R2.
- [ ] Audit log: every destructive action (order cancel, refund, staff disable, price change) is logged with `before` and `after` snapshots.
- [ ] Order tracking endpoint: rate-limited, never reveals whether an order exists (returns same generic error for wrong order number or wrong contact).
- [ ] Admin routes: `middleware.ts` blocks all `/admin` routes at the edge unless session is valid staff session.
- [ ] Error responses: never expose stack traces, DB errors, or internal IDs to clients.
- [ ] Blacklisted customers: orders locked from further action; middleware checks blacklist flag on every customer-related request.

---

## 20. Edge Cases Catalogue

This is a curated list of non-obvious edge cases that MUST be handled. For each, the right behaviour is stated.

### Orders

| Scenario | Required Behaviour |
|---|---|
| Stock disappears between cart add and checkout | `POST /checkout` fails with 409 and per-item stock details. UI shows "X is now out of stock" |
| Coupon hits usage limit at checkout moment | Transaction fails with coupon error. UI removes coupon and recomputes |
| Customer closes tab during Nuqood redirect | Order exists in DB as `pending/unpaid`. Email with payment link sent after 30 min |
| Webhook arrives before customer redirect | Confirmation page already shows paid state (polls for 60s) |
| Webhook arrives twice | Idempotency key on payment record prevents double-counting |
| Cart abandoned >24h | Cron marks `abandoned`, triggers AI follow-up if customer identifiable |
| Adding item to already-paid order | Requires explicit confirmation. Payment status drops to `partially_paid` |
| Removing item from paid order | Triggers refund-or-store-credit decision modal. Never silently keeps overpaid state |
| Order with pre-order + in-stock items | Allowed. Ships in waves. Each item has `is_pre_order` flag |
| Shipping address in unsupported zone | Explicit error at checkout. Never silently fallback without telling customer |
| Customer phone already exists with different name | Ask for consent before updating name. Proceed with existing name if declined |
| Blacklisted customer has pending order | Order locked. Alert banner in admin. Only Manager+ can override |
| Negative outstanding (overpaid) | Show as credit. Offer store credit or refund, never silently absorb |

### Products & Stock

| Scenario | Required Behaviour |
|---|---|
| Product archived after page render | `404 PRODUCT_UNAVAILABLE` on cart-add. Toast: "No longer available" |
| All variants out of stock | CTA becomes "Notify me when back" — collects contact |
| Pre-order MOQ violated | Server rejects with field-level error |
| Rapid double-click "Add to cart" | Debounce client-side + idempotency key server-side |
| Two customers buying last item simultaneously | Only one succeeds via `SELECT FOR UPDATE` transaction |

### Payments

| Scenario | Required Behaviour |
|---|---|
| Partial payment policy violated | "Mark as processing" disabled until paid in full (Manager+ can override with reason) |
| Refund for split-payment order | Refund can be allocated across original payment methods |
| Nuqood payment link generated twice | Idempotent — returns same link if unpaid, creates new one if previous expired |

### Returns

| Scenario | Required Behaviour |
|---|---|
| Item already fully returned | Not selectable, "Already returned" badge |
| Order outside return window (14d default) | "Outside return window. Contact support." |
| Order not yet delivered | "Can only return delivered orders." |
| Condition "damaged" item restock | Defaults OFF. Admin can toggle on. |

### Admin

| Scenario | Required Behaviour |
|---|---|
| Coupon edited after redemptions | Value/scope locked. Only validity, active flag, usage limit editable |
| Overlapping shipping zones | Warning to admin. Must resolve before saving |
| Address matching no shipping zone | Use flat rate fallback if set; else explicit error with WhatsApp contact CTA |
| Manual discount exceeding order total | Server caps at total. UI warns inline |
| Bulk tier recomputation on qty change | Keeps snapshotted tier unless staff explicitly clicks "Recompute" with diff preview |

---

## 21. AI Agent Integration

### Architecture

The AI agent is a separate LLM orchestrator service (or serverless function) that calls Avmall's tool API:

```
WhatsApp / Web Widget
       ↓
 LLM Orchestrator (DeepSeek / OpenAI / Anthropic)
       ↓
 POST /api/v1/ai/tools/*  (server-to-server, bearer JWT)
       ↓
 Same database as storefront + admin
```

### Tool Implementations

Each tool endpoint must:
1. Validate the bearer JWT (`scope: "ai_agent"`).
2. Process the tool call.
3. Return a response the LLM can include in its context.
4. Write an `ai_messages` record with `tool_calls` JSON.

### Negotiation Tool

The `negotiate-price` tool returns:
```typescript
{
  acceptable: boolean;
  counter_offer_kobo?: number;
  floor_kobo: number;      // Never expose this to customer
  message_hint: string;    // What the AI should say
}
```

The `floor_kobo` is internal only — it must never appear in the LLM's response to the customer.

### Conversation State Machine

```
active → handoff_pending → handoff_active → closed
active → closed
```

When a human claims a handoff, the customer's UI shows "Connected to staff" (header colour change, label change). All messages from the staff member flow through the same `ai_messages` table with `role: "staff"`.

---

## 22. Nigerian-Context Rules

These details matter for correctness in the Nigerian market.

### Phone Normalisation

```typescript
// src/lib/phone.ts
export function normaliseNigerianPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");

  if (digits.startsWith("234") && digits.length === 13) {
    return `+${digits}`;
  }
  if (digits.startsWith("0") && digits.length === 11) {
    return `+234${digits.slice(1)}`;
  }
  if (digits.length === 10) {
    return `+234${digits}`;
  }

  throw new ValidationError({ phone: "Invalid Nigerian phone number" });
}
```

### Nigerian States & LGAs

Maintain a static JSON of all 36 states + FCT and their LGAs. Used in:
- Address forms (state select → LGA select, dependent)
- Shipping zone configuration
- Customer address validation

Seed file: `prisma/seed-data/nigeria-states-lgas.json`

### Date/Time

- All DB timestamps in UTC.
- Display layer converts to WAT (West Africa Time, UTC+1) using `Intl.DateTimeFormat` with timezone `"Africa/Lagos"`.
- Never hardcode UTC+1 — use the named timezone.

### Language Handling

- Default language: English.
- Product names in Yoruba, Igbo, Hausa must wrap correctly (long words must break, never overflow).
- The checkout's error messages for unsupported shipping states should be warm and include the WhatsApp contact link.

### Number Formatting

```typescript
// ₦1,234,567 — always use Naira sign, comma separator, no decimal unless pence
// Nigerian formatting: ₦1,234,567 (not ₦1.234.567)
export const NAIRA_FORMATTER = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  currencyDisplay: "symbol",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
// Note: en-NG formats as NGN 1,234,567 — strip "NGN " and prepend ₦
```

---

## Appendix A — Order State Machine

```
pending → confirmed → processing → shipped → delivered → [return flow]
pending → cancelled
confirmed → cancelled
processing → cancelled  (only before shipment, Manager+)
cancelled → [terminal]
delivered → [terminal unless return opened]
```

Invalid transitions are rejected with `409 Conflict`. The UI never shows action buttons for invalid transitions.

## Appendix B — Discount Stacking Order

When multiple discounts apply:
1. Product-level bulk tier (applied per line item, before order total)
2. Sale price override (replaces regular price, before coupon)
3. Coupon — percentage coupons first, then fixed-amount coupons
4. Manual staff discount (applied last)
5. Shipping fee override (separate from product discounts)

Never double-apply: if a sale price and a coupon are both active on the same product, the coupon applies to the sale price (lower base), not the original price.

## Appendix C — Seeded Roles & Permissions

| Role | Key Permissions |
|---|---|
| `super_admin` | All permissions including billing |
| `manager` | All except billing. Can override partial-paid, manage staff |
| `sales` | orders.view, orders.create, customers.view, products.view |
| `inventory` | products.view, products.edit, products.stock_adjust |
| `support` | orders.view, customers.view, customers.edit, returns.* |

System roles cannot be deleted (is_system = true) but can be modified.

---

*Last updated: Project kickoff. Update this document whenever an architectural decision changes.*