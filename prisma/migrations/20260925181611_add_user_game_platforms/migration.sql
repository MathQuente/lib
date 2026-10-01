-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('STEAM', 'PLAYSTATION', 'XBOX', 'NINTENDO', 'EPIC', 'GOG', 'OTHER');

-- CreateTable
CREATE TABLE "user_game_platforms" (
    "id" TEXT NOT NULL,
    "user_game_id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "hours_played" DECIMAL(6,2),
    "completions" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_game_platforms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_game_platforms_user_game_id_platform_key" ON "user_game_platforms"("user_game_id", "platform");

-- AddForeignKey
ALTER TABLE "user_game_platforms" ADD CONSTRAINT "user_game_platforms_user_game_id_fkey" FOREIGN KEY ("user_game_id") REFERENCES "user_games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

