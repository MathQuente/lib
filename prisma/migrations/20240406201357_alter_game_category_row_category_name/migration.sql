/*
  Warnings:

  - A unique constraint covering the columns `[category_name]` on the table `game_category` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "game_category_category_name_key" ON "game_category"("category_name");
