-- Storefront newsletter signups. Email is unique; re-submits are no-ops.

CREATE TABLE "newsletter_subscribers" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "source" TEXT,
    "unsubscribed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "newsletter_subscribers_email_key" ON "newsletter_subscribers"("email");
