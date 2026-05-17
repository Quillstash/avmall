-- Single-use staff password-reset tokens. 30-minute expiry handled in app
-- code; rows are kept after `used_at` is set so we can audit re-use attempts.

CREATE TABLE "password_resets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_resets_token_key" ON "password_resets"("token");
CREATE INDEX "password_resets_user_id_idx" ON "password_resets"("user_id");
CREATE INDEX "password_resets_expires_at_idx" ON "password_resets"("expires_at");

ALTER TABLE "password_resets"
  ADD CONSTRAINT "password_resets_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
