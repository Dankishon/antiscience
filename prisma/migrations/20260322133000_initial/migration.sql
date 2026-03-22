-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
CREATE TYPE "role_code" AS ENUM ('owner', 'admin', 'editor', 'analyst', 'respondent');

-- CreateEnum
CREATE TYPE "session_status" AS ENUM ('draft', 'in_progress', 'completed', 'abandoned', 'expired');

-- CreateEnum
CREATE TYPE "asset_visibility" AS ENUM ('private', 'internal', 'public');

-- CreateEnum
CREATE TYPE "tie_break_strategy" AS ENUM ('first_match', 'highest_z_score', 'flower_priority');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "display_name" TEXT,
    "avatar_url" TEXT,
    "profile" JSONB,
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" "role_code" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "provider_email" TEXT,
    "profile" JSONB,
    "token_set" JSONB,
    "last_used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surveys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "version" SMALLINT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "algorithm_version" TEXT NOT NULL,
    "tie_break_strategy" "tie_break_strategy" NOT NULL DEFAULT 'highest_z_score',
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "settings" JSONB,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flowers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "survey_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "priority" SMALLINT NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "flowers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scales" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "survey_id" UUID NOT NULL,
    "flower_id" UUID,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "min_score" SMALLINT NOT NULL DEFAULT 0,
    "max_score" SMALLINT NOT NULL DEFAULT 100,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "scales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "survey_id" UUID NOT NULL,
    "scale_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "help_text" TEXT,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "weight" SMALLINT NOT NULL DEFAULT 1,
    "min_value" SMALLINT NOT NULL DEFAULT 1,
    "max_value" SMALLINT NOT NULL DEFAULT 5,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "is_reverse_scored" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "response_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "survey_id" UUID NOT NULL,
    "user_id" UUID,
    "status" "session_status" NOT NULL DEFAULT 'draft',
    "client_fingerprint" TEXT,
    "metadata" JSONB,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "response_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "response_session_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "value_smallint" SMALLINT,
    "value_text" TEXT,
    "value_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "computed_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "response_session_id" UUID NOT NULL,
    "survey_id" UUID NOT NULL,
    "primary_flower_id" UUID,
    "algorithm_version" TEXT NOT NULL,
    "tie_break_strategy" "tie_break_strategy" NOT NULL,
    "result_payload" JSONB NOT NULL,
    "computed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "computed_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scale_scores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "computed_result_id" UUID NOT NULL,
    "scale_id" UUID NOT NULL,
    "z_level_id" UUID,
    "raw_score" SMALLINT NOT NULL,
    "normalized_score" SMALLINT,
    "score_rank" SMALLINT,
    "details" JSONB,

    CONSTRAINT "scale_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "z_levels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "survey_id" UUID NOT NULL,
    "scale_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "z_from" SMALLINT NOT NULL,
    "z_to" SMALLINT NOT NULL,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "z_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flower_interpretations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "survey_id" UUID NOT NULL,
    "flower_id" UUID NOT NULL,
    "z_level_id" UUID,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "narrative" JSONB,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "flower_interpretations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "traits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "flower_interpretation_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "polarity" SMALLINT NOT NULL DEFAULT 0,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "traits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT,
    "alt_text" TEXT,
    "storage_key" TEXT NOT NULL,
    "public_url" TEXT,
    "mime_type" TEXT NOT NULL,
    "checksum" TEXT,
    "visibility" "asset_visibility" NOT NULL DEFAULT 'internal',
    "metadata" JSONB,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_user_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "before_state" JSONB,
    "after_state" JSONB,
    "metadata" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- ColumnComments
COMMENT ON COLUMN "surveys"."version" IS 'Increment for every questionnaire revision that must preserve historical reproducibility.';
COMMENT ON COLUMN "surveys"."algorithm_version" IS 'Scoring algorithm version bound to this survey revision.';
COMMENT ON COLUMN "computed_results"."algorithm_version" IS 'Snapshot of the algorithm version used to compute this result.';

-- CreateCheckConstraints
ALTER TABLE "surveys"
  ADD CONSTRAINT "surveys_version_positive_check" CHECK ("version" > 0),
  ADD CONSTRAINT "surveys_algorithm_version_not_blank_check" CHECK (btrim("algorithm_version") <> '');

ALTER TABLE "flowers"
  ADD CONSTRAINT "flowers_sort_order_non_negative_check" CHECK ("sort_order" >= 0),
  ADD CONSTRAINT "flowers_priority_non_negative_check" CHECK ("priority" >= 0);

ALTER TABLE "scales"
  ADD CONSTRAINT "scales_sort_order_non_negative_check" CHECK ("sort_order" >= 0),
  ADD CONSTRAINT "scales_score_bounds_check" CHECK ("min_score" <= "max_score");

ALTER TABLE "questions"
  ADD CONSTRAINT "questions_sort_order_non_negative_check" CHECK ("sort_order" >= 0),
  ADD CONSTRAINT "questions_weight_positive_check" CHECK ("weight" > 0),
  ADD CONSTRAINT "questions_value_bounds_check" CHECK ("min_value" <= "max_value");

ALTER TABLE "response_sessions"
  ADD CONSTRAINT "response_sessions_completion_state_check" CHECK (
    ("status" <> 'completed') OR ("completed_at" IS NOT NULL)
  );

ALTER TABLE "answers"
  ADD CONSTRAINT "answers_single_value_payload_check" CHECK (
    num_nonnulls("value_smallint", "value_text", "value_json") = 1
  );

ALTER TABLE "computed_results"
  ADD CONSTRAINT "computed_results_algorithm_version_not_blank_check" CHECK (btrim("algorithm_version") <> '');

ALTER TABLE "scale_scores"
  ADD CONSTRAINT "scale_scores_rank_positive_check" CHECK ("score_rank" IS NULL OR "score_rank" > 0);

ALTER TABLE "z_levels"
  ADD CONSTRAINT "z_levels_bounds_check" CHECK ("z_from" <= "z_to"),
  ADD CONSTRAINT "z_levels_sort_order_non_negative_check" CHECK ("sort_order" >= 0);

ALTER TABLE "flower_interpretations"
  ADD CONSTRAINT "flower_interpretations_sort_order_non_negative_check" CHECK ("sort_order" >= 0);

ALTER TABLE "traits"
  ADD CONSTRAINT "traits_sort_order_non_negative_check" CHECK ("sort_order" >= 0);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_key" ON "user_roles"("user_id", "role_id");

-- CreateIndex
CREATE INDEX "oauth_accounts_user_id_idx" ON "oauth_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_accounts_provider_provider_account_id_key" ON "oauth_accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE INDEX "surveys_code_is_active_idx" ON "surveys"("code", "is_active");

-- CreateIndex
CREATE INDEX "surveys_published_at_idx" ON "surveys"("published_at");

-- CreateIndex
CREATE UNIQUE INDEX "surveys_code_version_key" ON "surveys"("code", "version");

-- CreateIndex
CREATE UNIQUE INDEX "surveys_code_active_unique_idx" ON "surveys"("code") WHERE "is_active" = true;

-- CreateIndex
CREATE INDEX "flowers_survey_id_sort_order_idx" ON "flowers"("survey_id", "sort_order");

-- CreateIndex
CREATE INDEX "flowers_survey_id_priority_idx" ON "flowers"("survey_id", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "flowers_survey_id_code_key" ON "flowers"("survey_id", "code");

-- CreateIndex
CREATE INDEX "scales_survey_id_sort_order_idx" ON "scales"("survey_id", "sort_order");

-- CreateIndex
CREATE INDEX "scales_flower_id_idx" ON "scales"("flower_id");

-- CreateIndex
CREATE UNIQUE INDEX "scales_survey_id_code_key" ON "scales"("survey_id", "code");

-- CreateIndex
CREATE INDEX "questions_survey_id_sort_order_idx" ON "questions"("survey_id", "sort_order");

-- CreateIndex
CREATE INDEX "questions_scale_id_idx" ON "questions"("scale_id");

-- CreateIndex
CREATE UNIQUE INDEX "questions_survey_id_code_key" ON "questions"("survey_id", "code");

-- CreateIndex
CREATE INDEX "response_sessions_survey_id_status_started_at_idx" ON "response_sessions"("survey_id", "status", "started_at");

-- CreateIndex
CREATE INDEX "response_sessions_user_id_started_at_idx" ON "response_sessions"("user_id", "started_at");

-- CreateIndex
CREATE INDEX "answers_question_id_idx" ON "answers"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "answers_response_session_id_question_id_key" ON "answers"("response_session_id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "computed_results_response_session_id_key" ON "computed_results"("response_session_id");

-- CreateIndex
CREATE INDEX "computed_results_survey_id_computed_at_idx" ON "computed_results"("survey_id", "computed_at");

-- CreateIndex
CREATE INDEX "computed_results_primary_flower_id_idx" ON "computed_results"("primary_flower_id");

-- CreateIndex
CREATE INDEX "scale_scores_scale_id_idx" ON "scale_scores"("scale_id");

-- CreateIndex
CREATE INDEX "scale_scores_z_level_id_idx" ON "scale_scores"("z_level_id");

-- CreateIndex
CREATE UNIQUE INDEX "scale_scores_computed_result_id_scale_id_key" ON "scale_scores"("computed_result_id", "scale_id");

-- CreateIndex
CREATE INDEX "z_levels_survey_id_scale_id_sort_order_idx" ON "z_levels"("survey_id", "scale_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "z_levels_scale_id_code_key" ON "z_levels"("scale_id", "code");

-- CreateIndex
CREATE INDEX "flower_interpretations_flower_id_z_level_id_idx" ON "flower_interpretations"("flower_id", "z_level_id");

-- CreateIndex
CREATE UNIQUE INDEX "flower_interpretations_survey_id_code_key" ON "flower_interpretations"("survey_id", "code");

-- CreateIndex
CREATE INDEX "traits_flower_interpretation_id_sort_order_idx" ON "traits"("flower_interpretation_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "traits_flower_interpretation_id_code_key" ON "traits"("flower_interpretation_id", "code");

-- CreateIndex
CREATE INDEX "assets_entity_type_entity_id_idx" ON "assets"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "assets_visibility_idx" ON "assets"("visibility");

-- CreateIndex
CREATE INDEX "assets_created_by_user_id_idx" ON "assets"("created_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "assets_entity_type_entity_id_storage_key_key" ON "assets"("entity_type", "entity_id", "storage_key");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_created_at_idx" ON "audit_log"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_actor_user_id_created_at_idx" ON "audit_log"("actor_user_id", "created_at");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flowers" ADD CONSTRAINT "flowers_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scales" ADD CONSTRAINT "scales_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scales" ADD CONSTRAINT "scales_flower_id_fkey" FOREIGN KEY ("flower_id") REFERENCES "flowers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_scale_id_fkey" FOREIGN KEY ("scale_id") REFERENCES "scales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "response_sessions" ADD CONSTRAINT "response_sessions_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "response_sessions" ADD CONSTRAINT "response_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_response_session_id_fkey" FOREIGN KEY ("response_session_id") REFERENCES "response_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "computed_results" ADD CONSTRAINT "computed_results_response_session_id_fkey" FOREIGN KEY ("response_session_id") REFERENCES "response_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "computed_results" ADD CONSTRAINT "computed_results_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "computed_results" ADD CONSTRAINT "computed_results_primary_flower_id_fkey" FOREIGN KEY ("primary_flower_id") REFERENCES "flowers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scale_scores" ADD CONSTRAINT "scale_scores_computed_result_id_fkey" FOREIGN KEY ("computed_result_id") REFERENCES "computed_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scale_scores" ADD CONSTRAINT "scale_scores_scale_id_fkey" FOREIGN KEY ("scale_id") REFERENCES "scales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scale_scores" ADD CONSTRAINT "scale_scores_z_level_id_fkey" FOREIGN KEY ("z_level_id") REFERENCES "z_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "z_levels" ADD CONSTRAINT "z_levels_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "z_levels" ADD CONSTRAINT "z_levels_scale_id_fkey" FOREIGN KEY ("scale_id") REFERENCES "scales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flower_interpretations" ADD CONSTRAINT "flower_interpretations_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flower_interpretations" ADD CONSTRAINT "flower_interpretations_flower_id_fkey" FOREIGN KEY ("flower_id") REFERENCES "flowers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flower_interpretations" ADD CONSTRAINT "flower_interpretations_z_level_id_fkey" FOREIGN KEY ("z_level_id") REFERENCES "z_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traits" ADD CONSTRAINT "traits_flower_interpretation_id_fkey" FOREIGN KEY ("flower_interpretation_id") REFERENCES "flower_interpretations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
