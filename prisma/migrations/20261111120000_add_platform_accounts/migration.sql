-- CreateTable
CREATE TABLE "platform_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "external_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_account_hours" (
    "id" TEXT NOT NULL,
    "user_game_platform_id" TEXT NOT NULL,
    "platform_account_id" TEXT NOT NULL,
    "hours_played" DECIMAL(6,2) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_account_hours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "platform_accounts_user_id_platform_idx" ON "platform_accounts"("user_id", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "platform_accounts_platform_external_id_key" ON "platform_accounts"("platform", "external_id");

-- CreateIndex
CREATE INDEX "platform_account_hours_platform_account_id_idx" ON "platform_account_hours"("platform_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_account_hours_user_game_platform_id_platform_accou_key" ON "platform_account_hours"("user_game_platform_id", "platform_account_id");

-- AddForeignKey
ALTER TABLE "platform_accounts" ADD CONSTRAINT "platform_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_account_hours" ADD CONSTRAINT "platform_account_hours_user_game_platform_id_fkey" FOREIGN KEY ("user_game_platform_id") REFERENCES "user_game_platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_account_hours" ADD CONSTRAINT "platform_account_hours_platform_account_id_fkey" FOREIGN KEY ("platform_account_id") REFERENCES "platform_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Copy the Xbox accounts and their hours, keeping the same ids
INSERT INTO "platform_accounts" ("id", "user_id", "platform", "external_id", "display_name", "created_at")
SELECT "id", "user_id", 'XBOX', "xuid", "gamertag", "created_at"
FROM "xbox_accounts";

INSERT INTO "platform_account_hours" ("id", "user_game_platform_id", "platform_account_id", "hours_played", "updated_at")
SELECT "id", "user_game_platform_id", "xbox_account_id", "hours_played", "updated_at"
FROM "xbox_account_hours";

-- DropForeignKey
ALTER TABLE "xbox_account_hours" DROP CONSTRAINT "xbox_account_hours_user_game_platform_id_fkey";

-- DropForeignKey
ALTER TABLE "xbox_account_hours" DROP CONSTRAINT "xbox_account_hours_xbox_account_id_fkey";

-- DropForeignKey
ALTER TABLE "xbox_accounts" DROP CONSTRAINT "xbox_accounts_user_id_fkey";

-- DropTable
DROP TABLE "xbox_account_hours";

-- DropTable
DROP TABLE "xbox_accounts";
