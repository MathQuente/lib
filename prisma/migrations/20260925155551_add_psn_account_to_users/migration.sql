-- AlterTable
ALTER TABLE "users" ADD COLUMN     "psn_account_id" TEXT,
ADD COLUMN     "psn_online_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_psn_account_id_key" ON "users"("psn_account_id");
