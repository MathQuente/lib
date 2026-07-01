-- AlterTable
ALTER TABLE "games_cache" ADD COLUMN     "hypes" INTEGER;

-- CreateIndex
CREATE INDEX "games_cache_hypes_idx" ON "games_cache"("hypes");
