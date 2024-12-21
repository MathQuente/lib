/*
  Warnings:

  - You are about to drop the column `game_studio_id` on the `games` table. All the data in the column will be lost.
  - You are about to drop the column `publisherId` on the `games` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_games" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "game_banner" TEXT NOT NULL,
    "game_name" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_games" ("created_at", "game_banner", "game_name", "id", "updated_at") SELECT "created_at", "game_banner", "game_name", "id", "updated_at" FROM "games";
DROP TABLE "games";
ALTER TABLE "new_games" RENAME TO "games";
CREATE UNIQUE INDEX "games_game_name_key" ON "games"("game_name");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
