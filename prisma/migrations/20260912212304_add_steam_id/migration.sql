-- AlterTable
ALTER TABLE "users" ADD COLUMN     "steam_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_steam_id_key" ON "users"("steam_id");
