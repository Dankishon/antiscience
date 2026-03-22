-- Add email/password authentication support to users and persist refresh-token
-- rotation state separately so sessions can be revoked without invalidating
-- historical survey data.

ALTER TABLE "users"
ADD COLUMN "password_hash" TEXT,
ADD COLUMN "password_updated_at" TIMESTAMPTZ(6);

CREATE TABLE "auth_refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "rotated_at" TIMESTAMPTZ(6),
    "last_used_at" TIMESTAMPTZ(6),
    "replaced_by_token_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_refresh_tokens_token_hash_key"
ON "auth_refresh_tokens"("token_hash");

CREATE INDEX "auth_refresh_tokens_user_id_expires_at_idx"
ON "auth_refresh_tokens"("user_id", "expires_at");

CREATE INDEX "auth_refresh_tokens_family_id_created_at_idx"
ON "auth_refresh_tokens"("family_id", "created_at");

CREATE INDEX "auth_refresh_tokens_replaced_by_token_id_idx"
ON "auth_refresh_tokens"("replaced_by_token_id");

ALTER TABLE "auth_refresh_tokens"
ADD CONSTRAINT "auth_refresh_tokens_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "auth_refresh_tokens"
ADD CONSTRAINT "auth_refresh_tokens_replaced_by_token_id_fkey"
FOREIGN KEY ("replaced_by_token_id") REFERENCES "auth_refresh_tokens"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
