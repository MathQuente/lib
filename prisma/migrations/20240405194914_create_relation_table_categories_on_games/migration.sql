/*
  Warnings:

  - You are about to drop the column `category` on the `game_category` table. All the data in the column will be lost.
  - You are about to drop the column `gameId` on the `game_category` table. All the data in the column will be lost.
  - Added the required column `category_name` to the `game_category` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "CategoriesOnGames" (
    "gameId" TEXT NOT NULL,
    "gameCategoriesId" INTEGER NOT NULL,

    PRIMARY KEY ("gameId", "gameCategoriesId"),
    CONSTRAINT "CategoriesOnGames_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CategoriesOnGames_gameCategoriesId_fkey" FOREIGN KEY ("gameCategoriesId") REFERENCES "game_category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_game_category" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "category_name" TEXT NOT NULL
);
INSERT INTO "new_game_category" ("id") SELECT "id" FROM "game_category";
DROP TABLE "game_category";
ALTER TABLE "new_game_category" RENAME TO "game_category";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
