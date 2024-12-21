-- CreateTable
CREATE TABLE "_GameToGameStudio" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_GameToGameStudio_A_fkey" FOREIGN KEY ("A") REFERENCES "games" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_GameToGameStudio_B_fkey" FOREIGN KEY ("B") REFERENCES "game_studios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_GameToPublisher" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_GameToPublisher_A_fkey" FOREIGN KEY ("A") REFERENCES "games" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_GameToPublisher_B_fkey" FOREIGN KEY ("B") REFERENCES "publishers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_games" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "game_banner" TEXT NOT NULL,
    "game_name" TEXT NOT NULL,
    "game_studio_id" TEXT NOT NULL,
    "publisherId" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_games" ("created_at", "game_banner", "game_name", "game_studio_id", "id", "publisherId", "updated_at") SELECT "created_at", "game_banner", "game_name", "game_studio_id", "id", "publisherId", "updated_at" FROM "games";
DROP TABLE "games";
ALTER TABLE "new_games" RENAME TO "games";
CREATE UNIQUE INDEX "games_game_name_key" ON "games"("game_name");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE UNIQUE INDEX "_GameToGameStudio_AB_unique" ON "_GameToGameStudio"("A", "B");

-- CreateIndex
CREATE INDEX "_GameToGameStudio_B_index" ON "_GameToGameStudio"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_GameToPublisher_AB_unique" ON "_GameToPublisher"("A", "B");

-- CreateIndex
CREATE INDEX "_GameToPublisher_B_index" ON "_GameToPublisher"("B");
