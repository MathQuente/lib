/*
  Warnings:

  - You are about to drop the column `game_id` on the `user_game_stats` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `user_game_stats` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[user_game_id]` on the table `user_game_stats` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `user_game_id` to the `user_game_stats` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "user_game_stats" DROP CONSTRAINT "user_game_stats_game_id_fkey";

-- DropForeignKey
ALTER TABLE "user_game_stats" DROP CONSTRAINT "user_game_stats_user_id_fkey";

-- DropIndex
DROP INDEX "user_game_stats_user_id_game_id_key";

-- AlterTable
ALTER TABLE "user_game_stats" DROP COLUMN "game_id",
DROP COLUMN "user_id",
ADD COLUMN     "gameId" TEXT,
ADD COLUMN     "userId" TEXT,
ADD COLUMN     "user_game_id" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "user_game_stats_user_game_id_key" ON "user_game_stats"("user_game_id");

-- AddForeignKey
ALTER TABLE "user_game_stats" ADD CONSTRAINT "user_game_stats_user_game_id_fkey" FOREIGN KEY ("user_game_id") REFERENCES "user_games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_game_stats" ADD CONSTRAINT "user_game_stats_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_game_stats" ADD CONSTRAINT "user_game_stats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
