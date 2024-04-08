/*
  Warnings:

  - A unique constraint covering the columns `[game_name]` on the table `games` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "games_game_name_key" ON "games"("game_name");
