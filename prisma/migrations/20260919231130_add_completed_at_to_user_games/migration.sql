-- AlterTable
ALTER TABLE "user_games" ADD COLUMN     "completed_at" TIMESTAMP(3);

UPDATE "user_games" ug
SET "completed_at" = ug."updated_at"
FROM "users_games_status" ugs
WHERE ugs.id = ug."user_games_status_id" AND ugs."status" = 'PLAYED';
