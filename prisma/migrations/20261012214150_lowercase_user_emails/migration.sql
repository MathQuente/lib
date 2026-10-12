DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "users" GROUP BY lower("email") HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot lowercase emails: some accounts differ only by letter case';
  END IF;
END $$;

UPDATE "users" SET "email" = lower("email") WHERE "email" <> lower("email");
