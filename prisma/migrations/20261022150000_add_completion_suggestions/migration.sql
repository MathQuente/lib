-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DISMISSED');

-- CreateTable
CREATE TABLE "completion_suggestions" (
    "id" TEXT NOT NULL,
    "user_game_id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "evidence" JSONB NOT NULL,
    "low_confidence" BOOLEAN NOT NULL DEFAULT false,
    "undo_snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "completion_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "completion_suggestions_user_game_id_key" ON "completion_suggestions"("user_game_id");

-- AddForeignKey
ALTER TABLE "completion_suggestions" ADD CONSTRAINT "completion_suggestions_user_game_id_fkey" FOREIGN KEY ("user_game_id") REFERENCES "user_games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
