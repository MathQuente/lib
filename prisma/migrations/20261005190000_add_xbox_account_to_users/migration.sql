-- AlterTable
ALTER TABLE "users" ADD COLUMN     "xbox_xuid" TEXT,
ADD COLUMN     "xbox_gamertag" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_xbox_xuid_key" ON "users"("xbox_xuid");
