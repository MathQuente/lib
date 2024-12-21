-- CreateTable
CREATE TABLE "DLC" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dlc_banner" TEXT NOT NULL,
    "dlc_name" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    CONSTRAINT "DLC_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_DLCToGameStudio" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_DLCToGameStudio_A_fkey" FOREIGN KEY ("A") REFERENCES "DLC" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_DLCToGameStudio_B_fkey" FOREIGN KEY ("B") REFERENCES "game_studios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_DLCToPublisher" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_DLCToPublisher_A_fkey" FOREIGN KEY ("A") REFERENCES "DLC" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_DLCToPublisher_B_fkey" FOREIGN KEY ("B") REFERENCES "publishers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_DLCToGameCategory" (
    "A" TEXT NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_DLCToGameCategory_A_fkey" FOREIGN KEY ("A") REFERENCES "DLC" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_DLCToGameCategory_B_fkey" FOREIGN KEY ("B") REFERENCES "game_categories" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_DLCToPlatform" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_DLCToPlatform_A_fkey" FOREIGN KEY ("A") REFERENCES "DLC" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_DLCToPlatform_B_fkey" FOREIGN KEY ("B") REFERENCES "platforms" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_user_games" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "dlc_id" TEXT,
    "userGamesStatusId" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,

    PRIMARY KEY ("game_id", "user_id"),
    CONSTRAINT "user_games_userGamesStatusId_fkey" FOREIGN KEY ("userGamesStatusId") REFERENCES "users_games_status" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "user_games_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_games_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_games_dlc_id_fkey" FOREIGN KEY ("dlc_id") REFERENCES "DLC" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_user_games" ("created_at", "game_id", "id", "updated_at", "userGamesStatusId", "user_id") SELECT "created_at", "game_id", "id", "updated_at", "userGamesStatusId", "user_id" FROM "user_games";
DROP TABLE "user_games";
ALTER TABLE "new_user_games" RENAME TO "user_games";
CREATE TABLE "new_game_launchers" (
    "id" TEXT NOT NULL,
    "dateRelease" DATETIME NOT NULL,
    "game_id" TEXT NOT NULL,
    "plataform_id" TEXT NOT NULL,
    "dlc_id" TEXT,

    PRIMARY KEY ("plataform_id", "game_id"),
    CONSTRAINT "game_launchers_plataform_id_fkey" FOREIGN KEY ("plataform_id") REFERENCES "platforms" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "game_launchers_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "game_launchers_dlc_id_fkey" FOREIGN KEY ("dlc_id") REFERENCES "DLC" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_game_launchers" ("dateRelease", "game_id", "id", "plataform_id") SELECT "dateRelease", "game_id", "id", "plataform_id" FROM "game_launchers";
DROP TABLE "game_launchers";
ALTER TABLE "new_game_launchers" RENAME TO "game_launchers";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE UNIQUE INDEX "DLC_dlc_name_key" ON "DLC"("dlc_name");

-- CreateIndex
CREATE UNIQUE INDEX "_DLCToGameStudio_AB_unique" ON "_DLCToGameStudio"("A", "B");

-- CreateIndex
CREATE INDEX "_DLCToGameStudio_B_index" ON "_DLCToGameStudio"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_DLCToPublisher_AB_unique" ON "_DLCToPublisher"("A", "B");

-- CreateIndex
CREATE INDEX "_DLCToPublisher_B_index" ON "_DLCToPublisher"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_DLCToGameCategory_AB_unique" ON "_DLCToGameCategory"("A", "B");

-- CreateIndex
CREATE INDEX "_DLCToGameCategory_B_index" ON "_DLCToGameCategory"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_DLCToPlatform_AB_unique" ON "_DLCToPlatform"("A", "B");

-- CreateIndex
CREATE INDEX "_DLCToPlatform_B_index" ON "_DLCToPlatform"("B");
