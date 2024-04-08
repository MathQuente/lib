/*
  Warnings:

  - Added the required column `gameId` to the `game_category` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_games" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "game_name" TEXT NOT NULL,
    "game_date_release" DATETIME NOT NULL,
    "game_studio_id" TEXT NOT NULL,
    "game_banner" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gameCategoriesId" INTEGER,
    CONSTRAINT "games_game_studio_id_fkey" FOREIGN KEY ("game_studio_id") REFERENCES "game_studio" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_games" ("created_at", "gameCategoriesId", "game_banner", "game_date_release", "game_name", "game_studio_id", "id", "updated_at") SELECT "created_at", "gameCategoriesId", "game_banner", "game_date_release", "game_name", "game_studio_id", "id", "updated_at" FROM "games";
DROP TABLE "games";
ALTER TABLE "new_games" RENAME TO "games";
CREATE TABLE "new_game_category" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "category" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    CONSTRAINT "game_category_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_game_category" ("category", "id") SELECT "category", "id" FROM "game_category";
DROP TABLE "game_category";
ALTER TABLE "new_game_category" RENAME TO "game_category";
CREATE UNIQUE INDEX "game_category_category_key" ON "game_category"("category");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
