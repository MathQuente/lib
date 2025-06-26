/*
  Warnings:

  - You are about to drop the `_UserGameToUserGamesStatus` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `user_games_status_id` to the `user_games` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "_UserGameToUserGamesStatus" DROP CONSTRAINT "_UserGameToUserGamesStatus_A_fkey";

-- DropForeignKey
ALTER TABLE "_UserGameToUserGamesStatus" DROP CONSTRAINT "_UserGameToUserGamesStatus_B_fkey";

-- AlterTable
ALTER TABLE "user_games" ADD COLUMN     "user_games_status_id" INTEGER NOT NULL;

-- DropTable
DROP TABLE "_UserGameToUserGamesStatus";

-- AddForeignKey
ALTER TABLE "user_games" ADD CONSTRAINT "user_games_user_games_status_id_fkey" FOREIGN KEY ("user_games_status_id") REFERENCES "users_games_status"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
