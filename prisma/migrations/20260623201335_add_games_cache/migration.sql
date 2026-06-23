-- CreateTable
CREATE TABLE "games_cache" (
    "igdb_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "cover_url" TEXT,
    "summary" TEXT,
    "genres" TEXT[],
    "platforms" TEXT[],
    "release_date" INTEGER,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "games_cache_pkey" PRIMARY KEY ("igdb_id")
);

-- CreateIndex
CREATE INDEX "games_cache_name_idx" ON "games_cache"("name");

-- CreateIndex
CREATE INDEX "games_cache_release_date_idx" ON "games_cache"("release_date");
