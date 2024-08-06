/*
  Warnings:

  - Added the required column `updated_at` to the `user_games` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_user_games" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "userGamesStatusId" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,

    PRIMARY KEY ("game_id", "user_id"),
    CONSTRAINT "user_games_userGamesStatusId_fkey" FOREIGN KEY ("userGamesStatusId") REFERENCES "users_games_status" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "user_games_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_games_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_user_games" ("created_at", "game_id", "id", "userGamesStatusId", "user_id") SELECT "created_at", "game_id", "id", "userGamesStatusId", "user_id" FROM "user_games";
DROP TABLE "user_games";
ALTER TABLE "new_user_games" RENAME TO "user_games";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
