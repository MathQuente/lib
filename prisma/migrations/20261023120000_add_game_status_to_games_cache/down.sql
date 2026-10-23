-- Manual rollback for migration.sql (Prisma has no down). Run with: psql -f down.sql
-- Then delete the row from _prisma_migrations:
-- DELETE FROM "_prisma_migrations" WHERE migration_name = '20261023120000_add_game_status_to_games_cache';
BEGIN;
DROP INDEX "games_cache_game_status_idx";
ALTER TABLE "games_cache" DROP COLUMN "game_status";
COMMIT;
