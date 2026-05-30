-- "Notify me when back" signups from the PDP. Either email or phone is
-- captured; the (product_id, email) and (product_id, phone) uniques prevent
-- duplicate subscriptions from the same person on the same product.
-- Postgres treats NULLs as distinct in unique indexes, so anonymous phone-only
-- and email-only rows for the same product can still coexist.

CREATE TABLE "stock_notifications" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "source" TEXT,
    "notified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stock_notifications_product_id_email_key" ON "stock_notifications"("product_id", "email");
CREATE UNIQUE INDEX "stock_notifications_product_id_phone_key" ON "stock_notifications"("product_id", "phone");
CREATE INDEX "stock_notifications_product_id_idx" ON "stock_notifications"("product_id");
CREATE INDEX "stock_notifications_notified_at_idx" ON "stock_notifications"("notified_at");

ALTER TABLE "stock_notifications" ADD CONSTRAINT "stock_notifications_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
