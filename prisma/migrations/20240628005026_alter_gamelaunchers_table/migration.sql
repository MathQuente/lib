/*
  Warnings:

  - You are about to drop the `_ConsoleToGame` table. If the table is not empty, all the data it contains will be lost.
  - The primary key for the `GameLaunchers` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropIndex
DROP INDEX "_ConsoleToGame_B_index";

-- DropIndex
DROP INDEX "_ConsoleToGame_AB_unique";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "_ConsoleToGame";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GameLaunchers" (
    "id" TEXT NOT NULL,
    "dateRelease" DATETIME NOT NULL,
    "game_id" TEXT NOT NULL,
    "console_id" TEXT NOT NULL,

    PRIMARY KEY ("console_id", "game_id"),
    CONSTRAINT "GameLaunchers_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GameLaunchers_console_id_fkey" FOREIGN KEY ("console_id") REFERENCES "consoles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_GameLaunchers" ("console_id", "dateRelease", "game_id", "id") SELECT "console_id", "dateRelease", "game_id", "id" FROM "GameLaunchers";
DROP TABLE "GameLaunchers";
ALTER TABLE "new_GameLaunchers" RENAME TO "GameLaunchers";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
