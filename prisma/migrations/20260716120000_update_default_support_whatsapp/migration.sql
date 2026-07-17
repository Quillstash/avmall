-- Update the default support/WhatsApp number for the storefront.
-- Change the column default for fresh rows...
ALTER TABLE "site_settings" ALTER COLUMN "store_whatsapp" SET DEFAULT '+2347034486614';

-- ...and migrate any existing row that still holds the old default (i.e. no one
-- ever changed it in /admin/settings) to the new number.
UPDATE "site_settings" SET "store_whatsapp" = '+2347034486614' WHERE "store_whatsapp" = '+2348034217790';
