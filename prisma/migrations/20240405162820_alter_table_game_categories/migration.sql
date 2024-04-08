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
    "gameCategoryId" INTEGER NOT NULL,
    "gameCategoriesId" INTEGER,
    CONSTRAINT "games_game_studio_id_fkey" FOREIGN KEY ("game_studio_id") REFERENCES "game_studio" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "games_gameCategoriesId_fkey" FOREIGN KEY ("gameCategoriesId") REFERENCES "game_category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_games" ("created_at", "gameCategoryId", "game_banner", "game_date_release", "game_name", "game_studio_id", "id", "updated_at") SELECT "created_at", "gameCategoryId", "game_banner", "game_date_release", "game_name", "game_studio_id", "id", "updated_at" FROM "games";
DROP TABLE "games";
ALTER TABLE "new_games" RENAME TO "games";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
