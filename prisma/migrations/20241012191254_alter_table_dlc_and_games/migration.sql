/*
  Warnings:

  - Added the required column `summary` to the `dlcs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `summary` to the `games` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_dlcs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dlc_banner" TEXT NOT NULL,
    "dlc_name" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    CONSTRAINT "dlcs_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_dlcs" ("dlc_banner", "dlc_name", "gameId", "id") SELECT "dlc_banner", "dlc_name", "gameId", "id" FROM "dlcs";
DROP TABLE "dlcs";
ALTER TABLE "new_dlcs" RENAME TO "dlcs";
CREATE UNIQUE INDEX "dlcs_dlc_name_key" ON "dlcs"("dlc_name");
CREATE TABLE "new_games" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "game_banner" TEXT NOT NULL,
    "game_name" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_games" ("created_at", "game_banner", "game_name", "id", "updated_at") SELECT "created_at", "game_banner", "game_name", "id", "updated_at" FROM "games";
DROP TABLE "games";
ALTER TABLE "new_games" RENAME TO "games";
CREATE UNIQUE INDEX "games_game_name_key" ON "games"("game_name");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
