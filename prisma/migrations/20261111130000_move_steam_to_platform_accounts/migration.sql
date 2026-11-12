-- Copy each linked Steam profile into platform_accounts (the persona name replaces the id on the next link or import)
INSERT INTO "platform_accounts" ("id", "user_id", "platform", "external_id", "display_name")
SELECT gen_random_uuid()::text, "id", 'STEAM', "steam_id", "steam_id"
FROM "users"
WHERE "steam_id" IS NOT NULL;

-- Existing STEAM rows of those users belong to the migrated account
INSERT INTO "platform_account_hours" ("id", "user_game_platform_id", "platform_account_id", "hours_played", "updated_at")
SELECT gen_random_uuid()::text, p."id", a."id", p."hours_played", CURRENT_TIMESTAMP
FROM "user_game_platforms" p
JOIN "user_games" g ON g."id" = p."user_game_id"
JOIN "platform_accounts" a ON a."user_id" = g."user_id" AND a."platform" = 'STEAM'
WHERE p."platform" = 'STEAM' AND p."hours_played" IS NOT NULL;

-- DropIndex
DROP INDEX "users_steam_id_key";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "steam_id";
