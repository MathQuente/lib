/*
  Warnings:

  - You are about to drop the column `game_date_release` on the `games` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "GameLaunchers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dateRelease" DATETIME NOT NULL,
    "game_id" TEXT NOT NULL,
    "console_id" TEXT NOT NULL,
    CONSTRAINT "GameLaunchers_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GameLaunchers_console_id_fkey" FOREIGN KEY ("console_id") REFERENCES "consoles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_games" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "game_name" TEXT NOT NULL,
    "game_studio_id" TEXT NOT NULL,
    "game_banner" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "games_game_studio_id_fkey" FOREIGN KEY ("game_studio_id") REFERENCES "game_studio" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_games" ("created_at", "game_banner", "game_name", "game_studio_id", "id", "updated_at") SELECT "created_at", "game_banner", "game_name", "game_studio_id", "id", "updated_at" FROM "games";
DROP TABLE "games";
ALTER TABLE "new_games" RENAME TO "games";
CREATE UNIQUE INDEX "games_game_name_key" ON "games"("game_name");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
