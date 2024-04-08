/*
  Warnings:

  - You are about to drop the `_GameToGameCategory` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "_GameToGameCategory";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "GameCategoryOnGame" (
    "gameId" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,

    PRIMARY KEY ("gameId", "categoryId"),
    CONSTRAINT "GameCategoryOnGame_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GameCategoryOnGame_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "game_category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
