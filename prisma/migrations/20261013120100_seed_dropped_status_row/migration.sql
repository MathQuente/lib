INSERT INTO "users_games_status" ("id", "status")
VALUES (6, 'DROPPED')
ON CONFLICT ("id") DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('users_games_status', 'id'),
  (SELECT MAX("id") FROM "users_games_status")
);
