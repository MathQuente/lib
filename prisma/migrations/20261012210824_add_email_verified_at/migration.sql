-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email_verified_at" TIMESTAMP(3);

UPDATE "users"
SET "email_verified_at" = "created_at"
WHERE "google_id" IS NOT NULL OR "discord_id" IS NOT NULL;
