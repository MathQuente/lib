/*
  Warnings:

  - You are about to drop the column `game_id` on the `ratings` table. All the data in the column will be lost.
  - You are about to drop the column `gameId` on the `user_game_stats` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `user_game_stats` table. All the data in the column will be lost.
  - You are about to drop the column `dlc_id` on the `user_games` table. All the data in the column will be lost.
  - You are about to drop the column `game_id` on the `user_games` table. All the data in the column will be lost.
  - You are about to drop the `_GameToGameCategory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_GameToGameStudio` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_GameToPlatform` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_GameToPublisher` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `game_categories` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `game_launchers` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `game_studios` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `games` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `platforms` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `publishers` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[user_id,igdb_id]` on the table `ratings` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[user_id,igdb_id]` on the table `user_games` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `igdb_id` to the `ratings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `igdb_id` to the `user_games` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "_GameToGameCategory" DROP CONSTRAINT "_GameToGameCategory_A_fkey";

-- DropForeignKey
ALTER TABLE "_GameToGameCategory" DROP CONSTRAINT "_GameToGameCategory_B_fkey";

-- DropForeignKey
ALTER TABLE "_GameToGameStudio" DROP CONSTRAINT "_GameToGameStudio_A_fkey";

-- DropForeignKey
ALTER TABLE "_GameToGameStudio" DROP CONSTRAINT "_GameToGameStudio_B_fkey";

-- DropForeignKey
ALTER TABLE "_GameToPlatform" DROP CONSTRAINT "_GameToPlatform_A_fkey";

-- DropForeignKey
ALTER TABLE "_GameToPlatform" DROP CONSTRAINT "_GameToPlatform_B_fkey";

-- DropForeignKey
ALTER TABLE "_GameToPublisher" DROP CONSTRAINT "_GameToPublisher_A_fkey";

-- DropForeignKey
ALTER TABLE "_GameToPublisher" DROP CONSTRAINT "_GameToPublisher_B_fkey";

-- DropForeignKey
ALTER TABLE "game_launchers" DROP CONSTRAINT "game_launchers_game_id_fkey";

-- DropForeignKey
ALTER TABLE "game_launchers" DROP CONSTRAINT "game_launchers_plataform_id_fkey";

-- DropForeignKey
ALTER TABLE "games" DROP CONSTRAINT "games_parent_game_id_fkey";

-- DropForeignKey
ALTER TABLE "ratings" DROP CONSTRAINT "ratings_game_id_fkey";

-- DropForeignKey
ALTER TABLE "user_game_stats" DROP CONSTRAINT "user_game_stats_gameId_fkey";

-- DropForeignKey
ALTER TABLE "user_game_stats" DROP CONSTRAINT "user_game_stats_userId_fkey";

-- DropForeignKey
ALTER TABLE "user_games" DROP CONSTRAINT "user_games_game_id_fkey";

-- DropIndex
DROP INDEX "ratings_user_id_game_id_key";

-- DropIndex
DROP INDEX "user_games_user_id_dlc_id_key";

-- DropIndex
DROP INDEX "user_games_user_id_game_id_key";

-- Limpa dados antigos que referenciam jogos removidos
TRUNCATE TABLE "user_game_stats" CASCADE;
TRUNCATE TABLE "ratings" CASCADE;
TRUNCATE TABLE "user_games" CASCADE;

-- AlterTable
ALTER TABLE "ratings" DROP COLUMN "game_id",
ADD COLUMN     "igdb_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "user_game_stats" DROP COLUMN "gameId",
DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "user_games" DROP COLUMN "dlc_id",
DROP COLUMN "game_id",
ADD COLUMN     "igdb_id" INTEGER NOT NULL;

-- DropTable
DROP TABLE "_GameToGameCategory";

-- DropTable
DROP TABLE "_GameToGameStudio";

-- DropTable
DROP TABLE "_GameToPlatform";

-- DropTable
DROP TABLE "_GameToPublisher";

-- DropTable
DROP TABLE "game_categories";

-- DropTable
DROP TABLE "game_launchers";

-- DropTable
DROP TABLE "game_studios";

-- DropTable
DROP TABLE "games";

-- DropTable
DROP TABLE "platforms";

-- DropTable
DROP TABLE "publishers";

-- CreateIndex
CREATE UNIQUE INDEX "ratings_user_id_igdb_id_key" ON "ratings"("user_id", "igdb_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_games_user_id_igdb_id_key" ON "user_games"("user_id", "igdb_id");
