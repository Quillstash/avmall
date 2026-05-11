# Avmall E-Commerce Platform

Full-custom e-commerce platform for Avmall Ltd (Nigeria). Migrating from Bumpa.

**Surfaces:** Storefront (`/`) · Admin (`/admin`) · AI agent API (`/api/v1/ai/tools/`)
**Stack:** Next.js 14 · TypeScript strict · Tailwind v3 · Prisma · PostgreSQL · BullMQ · Cloudflare R2

> Read [CLAUDE.md](./CLAUDE.md) before writing code. It is the single source of truth.

## Getting started

```bash
nvm use            # Node 20 LTS
pnpm install
cp .env.example .env.local
pnpm dev           # http://localhost:3000
```

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm build` | Production build |
| `pnpm start` | Run prod build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |

## Project structure

See [CLAUDE.md §4](./CLAUDE.md#4-repository-structure) for the canonical layout.

## Build phases

Phase 1 — Design system primitives (current)
Phase 2 — Storefront UI with mock data
Phase 3 — Admin UI with mock data
Phase 4 — Database + API
Phase 5 — Integrations (Nuqood, WhatsApp, AI, R2, BullMQ)
Phase 6 — Testing, Bumpa migration, launch

## Design reference

The Figma-style HTML prototypes from the design handoff live in `/Users/barbieee/Downloads/doba/`. Spec documents (parts 1-5) live in [docs/](./docs/).
