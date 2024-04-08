/*
  Warnings:

  - You are about to drop the column `userGamesGameId` on the `user_games_status` table. All the data in the column will be lost.
  - You are about to drop the column `userGamesUserId` on the `user_games_status` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_user_games" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "userGamesStatusId" INTEGER,

    PRIMARY KEY ("game_id", "user_id"),
    CONSTRAINT "user_games_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_games_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_games_userGamesStatusId_fkey" FOREIGN KEY ("userGamesStatusId") REFERENCES "user_games_status" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_user_games" ("game_id", "id", "user_id") SELECT "game_id", "id", "user_id" FROM "user_games";
DROP TABLE "user_games";
ALTER TABLE "new_user_games" RENAME TO "user_games";
CREATE TABLE "new_user_games_status" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "status" TEXT NOT NULL
);
INSERT INTO "new_user_games_status" ("id", "status") SELECT "id", "status" FROM "user_games_status";
DROP TABLE "user_games_status";
ALTER TABLE "new_user_games_status" RENAME TO "user_games_status";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
