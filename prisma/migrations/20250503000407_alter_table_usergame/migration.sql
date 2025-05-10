/*
  Warnings:

  - You are about to drop the column `userGamesStatusId` on the `user_games` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "user_games" DROP CONSTRAINT "user_games_userGamesStatusId_fkey";

-- AlterTable
ALTER TABLE "user_games" DROP COLUMN "userGamesStatusId";

-- CreateTable
CREATE TABLE "_UserGameToUserGamesStatus" (
    "A" TEXT NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_UserGameToUserGamesStatus_AB_unique" ON "_UserGameToUserGamesStatus"("A", "B");

-- CreateIndex
CREATE INDEX "_UserGameToUserGamesStatus_B_index" ON "_UserGameToUserGamesStatus"("B");

-- AddForeignKey
ALTER TABLE "_UserGameToUserGamesStatus" ADD CONSTRAINT "_UserGameToUserGamesStatus_A_fkey" FOREIGN KEY ("A") REFERENCES "user_games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserGameToUserGamesStatus" ADD CONSTRAINT "_UserGameToUserGamesStatus_B_fkey" FOREIGN KEY ("B") REFERENCES "users_games_status"("id") ON DELETE CASCADE ON UPDATE CASCADE;
