-- CreateTable
CREATE TABLE "xbox_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "xuid" TEXT NOT NULL,
    "gamertag" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xbox_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xbox_account_hours" (
    "id" TEXT NOT NULL,
    "user_game_platform_id" TEXT NOT NULL,
    "xbox_account_id" TEXT NOT NULL,
    "hours_played" DECIMAL(6,2) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "xbox_account_hours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "xbox_accounts_xuid_key" ON "xbox_accounts"("xuid");

-- CreateIndex
CREATE INDEX "xbox_accounts_user_id_idx" ON "xbox_accounts"("user_id");

-- CreateIndex
CREATE INDEX "xbox_account_hours_xbox_account_id_idx" ON "xbox_account_hours"("xbox_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "xbox_account_hours_user_game_platform_id_xbox_account_id_key" ON "xbox_account_hours"("user_game_platform_id", "xbox_account_id");

-- AddForeignKey
ALTER TABLE "xbox_accounts" ADD CONSTRAINT "xbox_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xbox_account_hours" ADD CONSTRAINT "xbox_account_hours_user_game_platform_id_fkey" FOREIGN KEY ("user_game_platform_id") REFERENCES "user_game_platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xbox_account_hours" ADD CONSTRAINT "xbox_account_hours_xbox_account_id_fkey" FOREIGN KEY ("xbox_account_id") REFERENCES "xbox_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill accounts
INSERT INTO "xbox_accounts" ("id", "user_id", "xuid", "gamertag")
SELECT gen_random_uuid()::text, "id", "xbox_xuid", COALESCE("xbox_gamertag", "xbox_xuid")
FROM "users"
WHERE "xbox_xuid" IS NOT NULL;

-- Backfill hours: existing XBOX rows belong to the migrated account
INSERT INTO "xbox_account_hours" ("id", "user_game_platform_id", "xbox_account_id", "hours_played", "updated_at")
SELECT gen_random_uuid()::text, p."id", a."id", p."hours_played", CURRENT_TIMESTAMP
FROM "user_game_platforms" p
JOIN "user_games" g ON g."id" = p."user_game_id"
JOIN "xbox_accounts" a ON a."user_id" = g."user_id"
WHERE p."platform" = 'XBOX' AND p."hours_played" IS NOT NULL;

-- DropIndex
DROP INDEX "users_xbox_xuid_key";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "xbox_gamertag",
DROP COLUMN "xbox_xuid";
