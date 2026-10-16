UPDATE "user_game_stats" AS s
SET "completions" = 0
FROM "user_games" AS g
WHERE s."user_game_id" = g."id"
  AND g."user_games_status_id" <> 1
  AND s."completions" > 0
  AND NOT EXISTS (
    SELECT 1 FROM "user_game_platforms" AS p WHERE p."user_game_id" = g."id"
  );
