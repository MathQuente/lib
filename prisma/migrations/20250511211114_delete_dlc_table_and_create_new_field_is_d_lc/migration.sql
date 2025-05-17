/*
  Warnings:

  - You are about to drop the column `dlc_id` on the `game_launchers` table. All the data in the column will be lost.
  - You are about to drop the column `dLCId` on the `user_game_stats` table. All the data in the column will be lost.
  - You are about to drop the `_DLCToGameCategory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_DLCToGameStudio` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_DLCToPlatform` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_DLCToPublisher` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `dlcs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_DLCToGameCategory" DROP CONSTRAINT "_DLCToGameCategory_A_fkey";

-- DropForeignKey
ALTER TABLE "_DLCToGameCategory" DROP CONSTRAINT "_DLCToGameCategory_B_fkey";

-- DropForeignKey
ALTER TABLE "_DLCToGameStudio" DROP CONSTRAINT "_DLCToGameStudio_A_fkey";

-- DropForeignKey
ALTER TABLE "_DLCToGameStudio" DROP CONSTRAINT "_DLCToGameStudio_B_fkey";

-- DropForeignKey
ALTER TABLE "_DLCToPlatform" DROP CONSTRAINT "_DLCToPlatform_A_fkey";

-- DropForeignKey
ALTER TABLE "_DLCToPlatform" DROP CONSTRAINT "_DLCToPlatform_B_fkey";

-- DropForeignKey
ALTER TABLE "_DLCToPublisher" DROP CONSTRAINT "_DLCToPublisher_A_fkey";

-- DropForeignKey
ALTER TABLE "_DLCToPublisher" DROP CONSTRAINT "_DLCToPublisher_B_fkey";

-- DropForeignKey
ALTER TABLE "dlcs" DROP CONSTRAINT "dlcs_gameId_fkey";

-- DropForeignKey
ALTER TABLE "game_launchers" DROP CONSTRAINT "game_launchers_dlc_id_fkey";

-- DropForeignKey
ALTER TABLE "user_game_stats" DROP CONSTRAINT "user_game_stats_dLCId_fkey";

-- DropForeignKey
ALTER TABLE "user_games" DROP CONSTRAINT "user_games_dlc_id_fkey";

-- AlterTable
ALTER TABLE "game_launchers" DROP COLUMN "dlc_id";

-- AlterTable
ALTER TABLE "games" ADD COLUMN     "is_dlc" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parent_game_id" TEXT;

-- AlterTable
ALTER TABLE "user_game_stats" DROP COLUMN "dLCId";

-- DropTable
DROP TABLE "_DLCToGameCategory";

-- DropTable
DROP TABLE "_DLCToGameStudio";

-- DropTable
DROP TABLE "_DLCToPlatform";

-- DropTable
DROP TABLE "_DLCToPublisher";

-- DropTable
DROP TABLE "dlcs";

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_parent_game_id_fkey" FOREIGN KEY ("parent_game_id") REFERENCES "games"("id") ON DELETE SET NULL ON UPDATE CASCADE;
