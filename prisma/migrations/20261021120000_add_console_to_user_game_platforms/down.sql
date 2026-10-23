-- Manual rollback for migration.sql (Prisma has no down). Run with: psql -f down.sql
-- Folds the rows of each (user_game_id, platform) into the oldest one, so the
-- old unique index can be rebuilt. Hours and completions are summed, the earliest
-- completion date is kept. user_game_stats totals do not change.
BEGIN;

WITH agg AS (
  SELECT
    user_game_id,
    platform,
    (array_agg(id ORDER BY created_at, id))[1] AS keep_id,
    SUM(hours_played) AS hours_played,
    SUM(completions) AS completions,
    MIN(completed_at) AS completed_at
  FROM "user_game_platforms"
  GROUP BY user_game_id, platform
  HAVING COUNT(*) > 1
)
UPDATE "user_game_platforms" p
SET
  hours_played = a.hours_played,
  completions = a.completions,
  completed_at = a.completed_at
FROM agg a
WHERE p.id = a.keep_id;

DELETE FROM "user_game_platforms"
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY user_game_id, platform ORDER BY created_at, id) AS rn
    FROM "user_game_platforms"
  ) ranked
  WHERE rn > 1
);

CREATE UNIQUE INDEX "user_game_platforms_user_game_id_platform_key" ON "user_game_platforms"("user_game_id", "platform");
DROP INDEX "user_game_platforms_user_game_id_platform_console_key";
ALTER TABLE "user_game_platforms" DROP COLUMN "console";
DROP TYPE "Console";

-- Then remove the row from _prisma_migrations:
-- DELETE FROM "_prisma_migrations" WHERE migration_name = '20261021120000_add_console_to_user_game_platforms';

COMMIT;
