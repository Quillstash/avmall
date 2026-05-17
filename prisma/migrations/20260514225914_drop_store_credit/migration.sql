-- Drop the store credit column. Avmall doesn't offer store credit, so the
-- field is being removed from the Customer model entirely.
ALTER TABLE "customers" DROP COLUMN "store_credit_kobo";
