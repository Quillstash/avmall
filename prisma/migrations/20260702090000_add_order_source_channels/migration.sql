-- Add social + manual order channels to OrderSource so staff can tag where a
-- sale came from (register / create-order screens). Additive only; existing
-- rows are unaffected. IF NOT EXISTS keeps this safe to re-run.
ALTER TYPE "OrderSource" ADD VALUE IF NOT EXISTS 'facebook';
ALTER TYPE "OrderSource" ADD VALUE IF NOT EXISTS 'instagram';
ALTER TYPE "OrderSource" ADD VALUE IF NOT EXISTS 'manual';
