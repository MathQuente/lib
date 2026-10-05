DELETE FROM "refresh_token";

DROP INDEX "refresh_token_token_key";

ALTER TABLE "refresh_token" RENAME COLUMN "token" TO "tokenHash";

CREATE UNIQUE INDEX "refresh_token_tokenHash_key" ON "refresh_token"("tokenHash");
