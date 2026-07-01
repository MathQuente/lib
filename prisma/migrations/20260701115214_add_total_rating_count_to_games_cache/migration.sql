-- AlterTable
ALTER TABLE "games_cache" ADD COLUMN     "total_rating_count" INTEGER;

-- CreateIndex
CREATE INDEX "games_cache_total_rating_count_idx" ON "games_cache"("total_rating_count");
