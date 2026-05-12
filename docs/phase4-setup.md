# Phase 4 setup — Neon + Prisma

This is the one-time setup to connect Avmall to a real database. Once done, the
storefront and admin start reading from Postgres instead of the mock data.

## 1. Create a Neon project (5 min)

1. Go to <https://console.neon.tech> and sign up (free tier is fine).
2. **Create a project** → name it `avmall`, region `EU West (Ireland)` (closest
   to Lagos with full pgvector support).
3. On the dashboard, click **Connection details** in the side panel.
4. You'll see two URLs:
   - **Pooled connection** — use this as `DATABASE_URL`. It uses PgBouncer and
     is what every Next.js serverless request will hit.
   - **Direct connection** — use this as `DIRECT_URL`. Prisma needs an
     unpooled connection for migrations and the seed script.

## 2. Add the env vars

Create `.env.local` if you haven't already:

```bash
cp .env.example .env.local
```

Then fill in:

```bash
# .env.local
DATABASE_URL="postgresql://...@ep-xxxxx-pooler.eu-west-1.aws.neon.tech/avmall?sslmode=require"
DIRECT_URL="postgresql://...@ep-xxxxx.eu-west-1.aws.neon.tech/avmall?sslmode=require"

# Generate with:  openssl rand -base64 33
NEXTAUTH_SECRET="paste-a-long-random-string-here-32-chars-min"
NEXTAUTH_URL="http://localhost:3000"
CUSTOMER_SESSION_SECRET="another-32-char-min-random-string"
```

## 3. Push the schema + seed data

```bash
# Generate the Prisma client (also runs on postinstall)
pnpm db:generate

# Apply migrations against Neon — creates all tables
pnpm db:migrate

# Seed: categories, products, shipping zones, super admin, sample discounts
pnpm db:seed
```

After the seed runs:

- Visit **`http://localhost:3000`** — products now come from Postgres
- **`/admin-login`** with `admin@avmall.ng` / `changeme` (you'll be prompted
  to set up 2FA on first sign-in)
- **`pnpm db:studio`** opens Prisma Studio at <http://localhost:5555> so you
  can browse the data

## 4. Useful commands

| Command | Purpose |
|---|---|
| `pnpm db:generate` | Re-run after editing `prisma/schema.prisma` |
| `pnpm db:migrate` | Create + apply a new migration (dev only) |
| `pnpm db:deploy` | Apply pending migrations in CI/prod |
| `pnpm db:seed` | Re-run the seed (idempotent) |
| `pnpm db:studio` | Browse the DB |

## 5. Production notes

- Neon's free tier auto-suspends after 5 min idle — first request after that
  takes ~500ms to wake. Fine for prod; not great for cold dashboards.
- Bump to the **Launch** tier ($19/mo) before launch — gives you point-in-time
  recovery and removes auto-suspend.
- Never `prisma db push` in production. Always `prisma migrate deploy`.

## 6. Troubleshooting

**`PrismaClientInitializationError`**
→ `DATABASE_URL` not set or unreachable. Check `.env.local` is loaded
(`pnpm dev` reads it automatically; tests need `dotenv -e .env.local`).

**`Can't reach database server at...`** during `pnpm db:migrate`
→ Use the **direct** (non-pooled) URL in `DIRECT_URL`, not the pooled one.
PgBouncer drops the prepared statements Prisma migrations need.

**`relation "X" does not exist`** on a running endpoint
→ You wrote a schema change but didn't run `pnpm db:migrate` yet. The codebase
won't compile against a stale Prisma client — re-run `pnpm db:generate`.

**Auto fallback to mock data**
→ When `DATABASE_URL` is unset, storefront endpoints return mock fixtures
instead of querying Postgres. This lets the UI work during design iterations
without provisioning Neon. Look for `hasDatabase` in `src/lib/db.ts`.
