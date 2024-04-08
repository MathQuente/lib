/*
  Warnings:

  - You are about to drop the `CategoriesOnGames` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CategoriesOnGames";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "_GameToGameCategory" (
    "A" TEXT NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_GameToGameCategory_A_fkey" FOREIGN KEY ("A") REFERENCES "games" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_GameToGameCategory_B_fkey" FOREIGN KEY ("B") REFERENCES "game_category" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "_GameToGameCategory_AB_unique" ON "_GameToGameCategory"("A", "B");

-- CreateIndex
CREATE INDEX "_GameToGameCategory_B_index" ON "_GameToGameCategory"("B");
