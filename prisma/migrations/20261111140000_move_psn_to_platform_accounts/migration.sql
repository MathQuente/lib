-- Copy each linked PlayStation profile into platform_accounts (the online id becomes the display name)
INSERT INTO "platform_accounts" ("id", "user_id", "platform", "external_id", "display_name")
SELECT gen_random_uuid()::text, "id", 'PLAYSTATION', "psn_account_id", COALESCE("psn_online_id", "psn_account_id")
FROM "users"
WHERE "psn_account_id" IS NOT NULL;

-- Existing PLAYSTATION rows of those users belong to the migrated account
INSERT INTO "platform_account_hours" ("id", "user_game_platform_id", "platform_account_id", "hours_played", "updated_at")
SELECT gen_random_uuid()::text, p."id", a."id", p."hours_played", CURRENT_TIMESTAMP
FROM "user_game_platforms" p
JOIN "user_games" g ON g."id" = p."user_game_id"
JOIN "platform_accounts" a ON a."user_id" = g."user_id" AND a."platform" = 'PLAYSTATION'
WHERE p."platform" = 'PLAYSTATION' AND p."hours_played" IS NOT NULL;

-- DropIndex
DROP INDEX "users_psn_account_id_key";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "psn_account_id",
DROP COLUMN "psn_online_id";
