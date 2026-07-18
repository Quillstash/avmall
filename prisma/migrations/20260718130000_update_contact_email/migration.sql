-- Update the store contact email from the template placeholder to the real
-- business address, and update the column default so fresh installs match.
-- The UPDATE only touches the row while it still holds the old template value,
-- so a custom email set in /admin/settings is never overwritten.

ALTER TABLE "site_settings" ALTER COLUMN "store_email" SET DEFAULT 'avmallbusiness@gmail.com';

UPDATE "site_settings"
  SET "store_email" = 'avmallbusiness@gmail.com'
  WHERE "store_email" = 'hello@avmall.com.ng';
