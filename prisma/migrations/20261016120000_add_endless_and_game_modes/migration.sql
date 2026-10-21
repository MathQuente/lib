-- AlterTable
ALTER TABLE "games_cache" ADD COLUMN     "game_modes" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- AlterTable
ALTER TABLE "user_games" ADD COLUMN     "endless" BOOLEAN NOT NULL DEFAULT false;
