-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_user_games" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "game_id" TEXT,
    "user_id" TEXT NOT NULL,
    "dlc_id" TEXT,
    "userGamesStatusId" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "user_games_userGamesStatusId_fkey" FOREIGN KEY ("userGamesStatusId") REFERENCES "users_games_status" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "user_games_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_games_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_games_dlc_id_fkey" FOREIGN KEY ("dlc_id") REFERENCES "dlcs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_user_games" ("created_at", "dlc_id", "game_id", "id", "updated_at", "userGamesStatusId", "user_id") SELECT "created_at", "dlc_id", "game_id", "id", "updated_at", "userGamesStatusId", "user_id" FROM "user_games";
DROP TABLE "user_games";
ALTER TABLE "new_user_games" RENAME TO "user_games";
CREATE UNIQUE INDEX "user_games_user_id_game_id_key" ON "user_games"("user_id", "game_id");
CREATE UNIQUE INDEX "user_games_user_id_dlc_id_key" ON "user_games"("user_id", "dlc_id");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
