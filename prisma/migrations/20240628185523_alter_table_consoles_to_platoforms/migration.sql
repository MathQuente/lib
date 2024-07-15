/*
  Warnings:

  - You are about to drop the `consoles` table. If the table is not empty, all the data it contains will be lost.
  - The primary key for the `GameLaunchers` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `console_id` on the `GameLaunchers` table. All the data in the column will be lost.
  - Added the required column `plataform_id` to the `GameLaunchers` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "consoles_console_name_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "consoles";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "plataforms" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plataform_name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_GameToPlataform" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_GameToPlataform_A_fkey" FOREIGN KEY ("A") REFERENCES "games" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_GameToPlataform_B_fkey" FOREIGN KEY ("B") REFERENCES "plataforms" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    CONSTRAINT "GameLaunchers_plataform_id_fkey" FOREIGN KEY ("plataform_id") REFERENCES "plataforms" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_GameLaunchers" ("dateRelease", "game_id", "id") SELECT "dateRelease", "game_id", "id" FROM "GameLaunchers";
DROP TABLE "GameLaunchers";
ALTER TABLE "new_GameLaunchers" RENAME TO "GameLaunchers";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE UNIQUE INDEX "plataforms_plataform_name_key" ON "plataforms"("plataform_name");

-- CreateIndex
CREATE UNIQUE INDEX "_GameToPlataform_AB_unique" ON "_GameToPlataform"("A", "B");

-- CreateIndex
CREATE INDEX "_GameToPlataform_B_index" ON "_GameToPlataform"("B");
