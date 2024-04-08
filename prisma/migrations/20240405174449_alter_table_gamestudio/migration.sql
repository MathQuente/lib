/*
  Warnings:

  - A unique constraint covering the columns `[studio_name]` on the table `game_studio` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "game_studio_studio_name_key" ON "game_studio"("studio_name");
