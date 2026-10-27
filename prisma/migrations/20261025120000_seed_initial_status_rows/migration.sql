INSERT INTO "users_games_status" ("id", "status")
VALUES
  (1, 'PLAYED'),
  (2, 'PAUSED'),
  (3, 'PLAYING'),
  (4, 'BACKLOG'),
  (5, 'WISHLIST')
ON CONFLICT ("id") DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('users_games_status', 'id'),
  (SELECT MAX("id") FROM "users_games_status")
);
