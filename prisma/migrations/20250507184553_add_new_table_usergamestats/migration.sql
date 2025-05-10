-- CreateTable
CREATE TABLE "user_game_stats" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "game_id" TEXT,
    "completions" INTEGER NOT NULL DEFAULT 0,
    "dLCId" TEXT,

    CONSTRAINT "user_game_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_game_stats_user_id_game_id_key" ON "user_game_stats"("user_id", "game_id");

-- AddForeignKey
ALTER TABLE "user_game_stats" ADD CONSTRAINT "user_game_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_game_stats" ADD CONSTRAINT "user_game_stats_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_game_stats" ADD CONSTRAINT "user_game_stats_dLCId_fkey" FOREIGN KEY ("dLCId") REFERENCES "dlcs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
