-- AlterTable
ALTER TABLE "games_cache" ADD COLUMN "game_status" INTEGER;

-- CreateIndex
CREATE INDEX "games_cache_game_status_idx" ON "games_cache"("game_status");
