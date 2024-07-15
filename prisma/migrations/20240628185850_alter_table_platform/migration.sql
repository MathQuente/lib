/*
  Warnings:

  - You are about to drop the `_GameToPlataform` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `plataforms` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX "_GameToPlataform_B_index";

-- DropIndex
DROP INDEX "_GameToPlataform_AB_unique";

-- DropIndex
DROP INDEX "plataforms_plataform_name_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "_GameToPlataform";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "plataforms";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "platforms" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plataform_name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_GameToPlatform" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_GameToPlatform_A_fkey" FOREIGN KEY ("A") REFERENCES "games" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_GameToPlatform_B_fkey" FOREIGN KEY ("B") REFERENCES "platforms" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GameLaunchers" (
    "id" TEXT NOT NULL,
    "dateRelease" DATETIME NOT NULL,
    "game_id" TEXT NOT NULL,
    "plataform_id" TEXT NOT NULL,

    PRIMARY KEY ("plataform_id", "game_id"),
    CONSTRAINT "GameLaunchers_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GameLaunchers_plataform_id_fkey" FOREIGN KEY ("plataform_id") REFERENCES "platforms" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_GameLaunchers" ("dateRelease", "game_id", "id", "plataform_id") SELECT "dateRelease", "game_id", "id", "plataform_id" FROM "GameLaunchers";
DROP TABLE "GameLaunchers";
ALTER TABLE "new_GameLaunchers" RENAME TO "GameLaunchers";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE UNIQUE INDEX "platforms_plataform_name_key" ON "platforms"("plataform_name");

-- CreateIndex
CREATE UNIQUE INDEX "_GameToPlatform_AB_unique" ON "_GameToPlatform"("A", "B");

-- CreateIndex
CREATE INDEX "_GameToPlatform_B_index" ON "_GameToPlatform"("B");
