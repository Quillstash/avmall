-- Extend site_settings with an editable RC number, social links, and homepage
-- wholesale copy.
ALTER TABLE "site_settings" ADD COLUMN "rc_number" TEXT NOT NULL DEFAULT '7798804';
ALTER TABLE "site_settings" ADD COLUMN "social_instagram" TEXT;
ALTER TABLE "site_settings" ADD COLUMN "social_twitter" TEXT;
ALTER TABLE "site_settings" ADD COLUMN "social_tiktok" TEXT;
ALTER TABLE "site_settings" ADD COLUMN "wholesale_title" TEXT;
ALTER TABLE "site_settings" ADD COLUMN "wholesale_subtext" TEXT;
