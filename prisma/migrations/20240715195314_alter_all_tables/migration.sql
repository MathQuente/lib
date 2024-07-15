/*
  Warnings:

  - You are about to drop the `GameLaunchers` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Publisher` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `game_category` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `game_studio` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_games_status` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `publisherId` on table `games` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "game_category_category_name_key";

-- DropIndex
DROP INDEX "game_studio_studio_name_key";

-- DropIndex
DROP INDEX "user_email_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "GameLaunchers";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Publisher";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "game_category";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "game_studio";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "user";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "user_games_status";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "game_categories" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "category_name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "game_launchers" (
    "id" TEXT NOT NULL,
    "dateRelease" DATETIME NOT NULL,
    "game_id" TEXT NOT NULL,
    "plataform_id" TEXT NOT NULL,

    PRIMARY KEY ("plataform_id", "game_id"),
    CONSTRAINT "game_launchers_plataform_id_fkey" FOREIGN KEY ("plataform_id") REFERENCES "platforms" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "game_launchers_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "game_studios" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studio_name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "publishers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publisher_name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "user_name" TEXT,
    "password" TEXT NOT NULL,
    "profile_picture" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "users_games_status" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "status" TEXT NOT NULL
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_user_games" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "userGamesStatusId" INTEGER NOT NULL,

    PRIMARY KEY ("game_id", "user_id"),
    CONSTRAINT "user_games_userGamesStatusId_fkey" FOREIGN KEY ("userGamesStatusId") REFERENCES "users_games_status" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "user_games_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_games_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_user_games" ("game_id", "id", "userGamesStatusId", "user_id") SELECT "game_id", "id", "userGamesStatusId", "user_id" FROM "user_games";
DROP TABLE "user_games";
ALTER TABLE "new_user_games" RENAME TO "user_games";
CREATE TABLE "new__GameToGameCategory" (
    "A" TEXT NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_GameToGameCategory_A_fkey" FOREIGN KEY ("A") REFERENCES "games" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_GameToGameCategory_B_fkey" FOREIGN KEY ("B") REFERENCES "game_categories" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new__GameToGameCategory" ("A", "B") SELECT "A", "B" FROM "_GameToGameCategory";
DROP TABLE "_GameToGameCategory";
ALTER TABLE "new__GameToGameCategory" RENAME TO "_GameToGameCategory";
CREATE UNIQUE INDEX "_GameToGameCategory_AB_unique" ON "_GameToGameCategory"("A", "B");
CREATE INDEX "_GameToGameCategory_B_index" ON "_GameToGameCategory"("B");
CREATE TABLE "new_games" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "game_banner" TEXT NOT NULL,
    "game_name" TEXT NOT NULL,
    "game_studio_id" TEXT NOT NULL,
    "publisherId" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "games_game_studio_id_fkey" FOREIGN KEY ("game_studio_id") REFERENCES "game_studios" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "games_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "publishers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_games" ("created_at", "game_banner", "game_name", "game_studio_id", "id", "publisherId", "updated_at") SELECT "created_at", "game_banner", "game_name", "game_studio_id", "id", "publisherId", "updated_at" FROM "games";
DROP TABLE "games";
ALTER TABLE "new_games" RENAME TO "games";
CREATE UNIQUE INDEX "games_game_name_key" ON "games"("game_name");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE UNIQUE INDEX "game_categories_category_name_key" ON "game_categories"("category_name");

-- CreateIndex
CREATE UNIQUE INDEX "game_studios_studio_name_key" ON "game_studios"("studio_name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
