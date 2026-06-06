-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "custom_fields" JSONB;
