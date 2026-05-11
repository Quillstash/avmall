# Avmall

> Confident commerce for Nigerian merchants — full-custom e-commerce platform replacing Bumpa for Avmall Ltd.

[![Next.js](https://img.shields.io/badge/Next.js-14-000?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v3-38BDF8?logo=tailwindcss)](https://tailwindcss.com)
[![pnpm](https://img.shields.io/badge/pnpm-10-F69220?logo=pnpm)](https://pnpm.io)

Three interconnected surfaces sharing one database and one source of truth:

| Surface | Route | Primary user |
|---|---|---|
| Customer storefront | `/` | End shoppers |
| Admin dashboard | `/admin` | Avmall staff |
| AI agent API | `/api/v1/ai/tools/` | LLM orchestrator (server-to-server) |

A bulk discount configured in admin applies identically whether reached via AI on WhatsApp, the website widget, the storefront cart, or a staff-created order.

> **Before contributing — read [CLAUDE.md](./CLAUDE.md) in full.** It is the single source of truth for architecture, conventions, and the build sequence.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) · TypeScript strict |
| Styling | Tailwind v3 + CSS custom properties (token-driven) |
| UI base | shadcn/ui + custom design-system primitives |
| ORM | Prisma |
| Database | PostgreSQL (Neon) + pgvector for AI |
| Cache / Queues | Upstash Redis + BullMQ |
| File storage | Cloudflare R2 |
| Auth | NextAuth (staff) · OTP via phone/email (customer) |
| Payments | Nuqood.ng (pluggable behind `PaymentProvider` interface) |
| AI | Provider-agnostic — DeepSeek / OpenAI / Anthropic |
| Email / SMS | Resend · Termii · Africa's Talking |
| Observability | Sentry · PostHog · Axiom |

---

## Getting started

```bash
nvm use                 # Node 20 LTS (pinned via .nvmrc)
pnpm install
cp .env.example .env.local
pnpm dev                # http://localhost:3000
```

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm build` | Production build |
| `pnpm start` | Run prod build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |

---

## Project structure

```
src/
├── app/                    Next.js App Router
│   ├── (storefront)/       Customer routes
│   ├── (admin)/            Staff routes
│   └── api/v1/             Public · customer · admin · ai · webhooks
├── components/
│   ├── ui/                 Base design system (Button, Money, Table…)
│   ├── storefront/         Storefront-specific composed components
│   ├── admin/              Admin-specific composed components
│   └── shared/             Cross-surface
├── lib/                    db · auth · money · phone · audit · stock · …
├── hooks/                  React hooks
├── stores/                 Zustand (client state only)
├── types/                  Shared types (api, domain, permissions)
└── workers/                BullMQ job processors
```

Full canonical layout in [CLAUDE.md §4](./CLAUDE.md#4-repository-structure).

---

## Core principles (non-negotiable)

- **Money is always integers (kobo).** No floats, no `decimal`. `1 Naira = 100 kobo`. Display layer converts.
- **Stock is reserved, not decremented.** `SELECT FOR UPDATE` at checkout, 15-min reservation, auto-release.
- **Every state change writes an `audit_logs` entry.** Append-only.
- **Permissions checked server-side on every request.** UI guards are UX only.
- **Idempotency-Key header required** on every state-mutating POST.
- **Nigerian-first.** ₦, +234 phone normalisation, states + LGAs, Termii/Africa's Talking SMS.
- **Mobile-first storefront** (perfect at 360px), tablet-friendly admin (≥768px).

See [CLAUDE.md §2](./CLAUDE.md#2-core-principles--non-negotiables).

---

## Build phases

| Phase | Scope | Status |
|---|---|---|
| **1** | Design system primitives (tokens, Button, Money, Input, Table, …) | 🟡 In progress |
| **2** | Storefront UI with mock data (Home → PDP → Cart → Checkout → Confirm) | ⏳ |
| **3** | Admin UI with mock data (Dashboard → Orders → Products → Returns → …) | ⏳ |
| **4** | Database + API (Prisma schema, migrations, auth, stock reservation) | ⏳ |
| **5** | Integrations (Nuqood · WhatsApp · AI agent · R2 · BullMQ · email/SMS) | ⏳ |
| **6** | Testing, Bumpa migration, launch | ⏳ |

Detailed deliverables per phase in [CLAUDE.md §14](./CLAUDE.md#14-build-sequence--ui-first-strategy).

---

## Design reference

Spec documents (parts 1–5) live in [`docs/`](./docs/). The Figma-style HTML prototypes from the design handoff are in `~/Downloads/doba/` (not committed — local design artifacts).

---

## License

Proprietary · © Avmall Ltd 2026
