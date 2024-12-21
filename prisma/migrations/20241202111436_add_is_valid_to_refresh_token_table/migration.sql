-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_refresh_token" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT NOT NULL,
    CONSTRAINT "refresh_token_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_refresh_token" ("createdAt", "expiresAt", "id", "token", "userId") SELECT "createdAt", "expiresAt", "id", "token", "userId" FROM "refresh_token";
DROP TABLE "refresh_token";
ALTER TABLE "new_refresh_token" RENAME TO "refresh_token";
CREATE UNIQUE INDEX "refresh_token_token_key" ON "refresh_token"("token");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
