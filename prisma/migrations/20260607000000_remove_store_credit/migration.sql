-- Remove store credit from the platform.
-- Both enum values are verified unused (0 rows), but the UPDATEs make the
-- migration safe even if a value slipped in. Postgres can't DROP an enum value
-- in place, so each enum is recreated and its single column retyped.

-- 1. ReturnRefundMethod: drop 'credit'
ALTER TABLE "returns" ALTER COLUMN "refund_method" DROP DEFAULT;
UPDATE "returns" SET "refund_method" = 'original' WHERE "refund_method" = 'credit';

ALTER TYPE "ReturnRefundMethod" RENAME TO "ReturnRefundMethod_old";
CREATE TYPE "ReturnRefundMethod" AS ENUM ('original', 'transfer');
ALTER TABLE "returns"
  ALTER COLUMN "refund_method" TYPE "ReturnRefundMethod"
  USING ("refund_method"::text::"ReturnRefundMethod");
ALTER TABLE "returns" ALTER COLUMN "refund_method" SET DEFAULT 'original';
DROP TYPE "ReturnRefundMethod_old";

-- 2. PaymentMethod: drop 'store_credit' (fall back any stray rows to cash)
UPDATE "order_payments" SET "method" = 'cash' WHERE "method" = 'store_credit';

ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_old";
CREATE TYPE "PaymentMethod" AS ENUM ('nuqood', 'bank_transfer', 'pos', 'cash');
ALTER TABLE "order_payments"
  ALTER COLUMN "method" TYPE "PaymentMethod"
  USING ("method"::text::"PaymentMethod");
DROP TYPE "PaymentMethod_old";
