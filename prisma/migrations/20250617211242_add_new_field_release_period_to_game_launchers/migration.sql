/*
  Warnings:

  - You are about to drop the column `dateRelease` on the `game_launchers` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "game_launchers" DROP COLUMN "dateRelease",
ADD COLUMN     "date_release" TIMESTAMP(3),
ADD COLUMN     "release_period" TEXT;
