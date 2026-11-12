ALTER TABLE "games_cache" ADD COLUMN "game_modes_checked_at" TIMESTAMP(3);

UPDATE "games_cache"
SET "game_modes_checked_at" = NOW()
WHERE cardinality("game_modes") > 0;
