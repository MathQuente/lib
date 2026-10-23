-- CreateEnum
CREATE TYPE "Console" AS ENUM ('UNKNOWN', 'PS1', 'PS2', 'PS3', 'PS4', 'PS5', 'PSP', 'PS_VITA', 'XBOX_ORIGINAL', 'XBOX_360', 'XBOX_ONE', 'XBOX_SERIES', 'NES', 'SNES', 'N64', 'GAMECUBE', 'WII', 'WII_U', 'SWITCH', 'SWITCH_2', 'GAME_BOY', 'GAME_BOY_COLOR', 'GAME_BOY_ADVANCE', 'DS', 'N3DS', 'PC', 'STEAM_DECK', 'MASTER_SYSTEM', 'MEGA_DRIVE', 'SEGA_CD', 'SATURN', 'DREAMCAST', 'GAME_GEAR', 'ATARI_2600', 'ATARI_7800', 'NEO_GEO', 'TURBOGRAFX', 'MOBILE', 'ARCADE');

-- AlterTable
ALTER TABLE "user_game_platforms" ADD COLUMN "console" "Console" NOT NULL DEFAULT 'UNKNOWN';

-- CreateIndex
CREATE UNIQUE INDEX "user_game_platforms_user_game_id_platform_console_key" ON "user_game_platforms"("user_game_id", "platform", "console");

-- DropIndex
DROP INDEX "user_game_platforms_user_game_id_platform_key";
