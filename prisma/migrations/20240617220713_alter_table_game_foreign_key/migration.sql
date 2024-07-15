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
    CONSTRAINT "games_game_studio_id_fkey" FOREIGN KEY ("game_studio_id") REFERENCES "game_studio" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_games" ("created_at", "game_banner", "game_date_release", "game_name", "game_studio_id", "id", "updated_at") SELECT "created_at", "game_banner", "game_date_release", "game_name", "game_studio_id", "id", "updated_at" FROM "games";
DROP TABLE "games";
ALTER TABLE "new_games" RENAME TO "games";
CREATE UNIQUE INDEX "games_game_name_key" ON "games"("game_name");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
