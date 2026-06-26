# Deploying Avmall

This is a **Next.js server app** (SSR, API routes, middleware, Prisma + Postgres).
It needs a Node.js runtime — it **cannot** run on Hostinger shared/Business Web
Hosting (that's PHP/WordPress hosting). The plan below runs the app on **Vercel**
and points your **Hostinger domain** at it. Hostinger keeps doing what it's good
at (domain registration + email); Vercel runs the app.

---

## 0. Before you start — accounts you'll need

The app talks to managed services. Create these (free tiers are fine to start):

| Service | Used for | Required? |
|---|---|---|
| **Neon** (neon.tech) | PostgreSQL database | **Yes** — app won't work without it |
| **Vercel** (vercel.com) | Runs the app | **Yes** |
| **Upstash** (upstash.com) | Redis: rate-limits, idempotency | Strongly recommended |
| **Cloudflare R2** | Product / return image uploads | Recommended |
| **Resend** (resend.com) | Transactional email (receipts) | Recommended |
| **Termii** (termii.com) | SMS OTP for customer login | Recommended |
| **Nuqood** | Online card payments | For online payments |

Sign in to all of these with **GitHub** where possible — it makes the Vercel step easier.

---

## 1. Make sure the deploy branch has the latest code

All recent work lives on the `feat/substore-storefront-and-payment` branch, **not
`main`**. Vercel deploys your *production branch* (usually `main`). So either:

- **Merge** `feat/substore-storefront-and-payment` into `main` (open a PR, review, merge), **or**
- In Vercel, set the **Production Branch** to `feat/substore-storefront-and-payment`.

Pick one before deploying, or the live site won't include the latest changes.

> Note: a recent change made the app **require a database** — there is no longer a
> "no-DB demo mode." `DATABASE_URL` must be set (step 3) or pages render empty.

---

## 2. Create the Vercel project

1. Go to **vercel.com → Add New → Project**.
2. **Import** the GitHub repo `IbrahimDoba/avmall`.
3. Framework: **Next.js** (auto-detected). Leave the build/install commands as-is —
   `vercel.json` already sets the build command to run DB migrations then build:
   `pnpm exec prisma migrate deploy && pnpm run build`.
4. **Don't deploy yet** — add the environment variables first (next step).

---

## 3. Environment variables (Vercel → Project → Settings → Environment Variables)

Add these for the **Production** environment (also tick *Preview* if you use preview deploys).

### Required — the app is broken without these
| Key | Value |
|---|---|
| `DATABASE_URL` | Neon **pooled** connection string (`...-pooler...?sslmode=require`) |
| `DIRECT_URL` | Neon **direct** connection string (used by migrations) |
| `NEXTAUTH_SECRET` | random 32+ chars — generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | your final URL, e.g. `https://avmall.ng` |
| `CUSTOMER_SESSION_SECRET` | another random 32+ chars |
| `NEXT_PUBLIC_APP_URL` | your final URL, e.g. `https://avmall.ng` |

### Recommended — core features
| Key | Used for |
|---|---|
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` | image uploads + serving |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | rate-limiting, idempotency |
| `RESEND_API_KEY` | email receipts/notifications |
| `TERMII_API_KEY` (and/or `AFRICAS_TALKING_API_KEY`, `AFRICAS_TALKING_USERNAME`) | customer login OTP via SMS |
| `NUQOOD_API_KEY`, `NUQOOD_SECRET_KEY`, `NUQOOD_BUSINESS_CODE`, `NUQOOD_API_BASE`, `NUQOOD_WEBHOOK_SECRET` | online payments |
| `BUSINESS_BANK_NUMBER`, `BUSINESS_BANK_NAME`, `BUSINESS_BANK` | bank-transfer checkout details |

### Optional
`META_WA_TOKEN`, `META_WA_PHONE_NUMBER_ID`, `META_WA_VERIFY_TOKEN` (WhatsApp) ·
`OPENAI_API_KEY` / `DEEPSEEK_API_KEY` / `AI_AGENT_TOKEN` (AI agent) ·
`CRON_SECRET` (securing cron endpoints) ·
`SENTRY_DSN`, `NEXT_PUBLIC_POSTHOG_KEY`, `AXIOM_TOKEN` (monitoring).

> The full key list is in `.env.example`.

---

## 4. First deploy

Click **Deploy**. The build will:
1. `pnpm install` → `prisma generate`
2. `prisma migrate deploy` → creates all tables on the Neon DB
3. `next build`

If it fails, it's almost always a missing/typo'd `DATABASE_URL` or `DIRECT_URL`.

---

## 5. Seed the database (one time)

Migrations create empty tables. The app needs an initial **Main store**, roles,
and an admin login. Run the seed **once** from your computer, pointed at the
**production** database:

```bash
# from the project folder, using the SAME values you put in Vercel
DATABASE_URL="<prod pooled url>" DIRECT_URL="<prod direct url>" pnpm prisma db seed
```

This creates the Main store, categories, shipping zones, the demo product
catalogue, and a super-admin user:

- **Email:** `admin@avmall.ng`
- **Password:** `changeme`  ← **change this immediately after first login.**

(You can archive/delete the demo products later from the admin once real products are added.)

---

## 6. Point the Hostinger domain at Vercel

1. In Vercel: **Project → Settings → Domains → Add** your domain (e.g. `avmall.ng`
   and `www.avmall.ng`). Vercel will show you the exact DNS records to add.
2. In **Hostinger hPanel → Domains → (your domain) → DNS / Nameservers → DNS Records**,
   set the records Vercel showed — typically:

   | Type | Name | Value |
   |---|---|---|
   | `A` | `@` | `76.76.21.21` |
   | `CNAME` | `www` | `cname.vercel-dns.com` |

   - Remove/replace any existing `A` record on `@` that points to Hostinger's servers.
   - **Leave `MX` records alone** if your email is on Hostinger — only change the web (`A`/`CNAME`) records.
3. Wait for DNS to propagate (minutes, up to ~24h). Vercel issues the SSL certificate automatically.

> Use whatever exact values Vercel displays for your domain — they can differ from
> the example above.

---

## 7. Finalise

1. Once the custom domain works, set `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` in
   Vercel to that exact `https://` URL, then **redeploy**.
2. Point external webhooks at the live domain:
   - Nuqood payment webhook → `https://<your-domain>/api/v1/webhooks/...`
   - WhatsApp (if used) → the Meta callback URL with your `META_WA_VERIFY_TOKEN`.
3. Log in at `https://<your-domain>/admin` and change the admin password.

---

## Future deploys

Push to the production branch → Vercel auto-builds and runs any new migrations.
No manual upload step.
