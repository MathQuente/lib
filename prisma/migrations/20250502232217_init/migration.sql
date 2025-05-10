-- CreateEnum
CREATE TYPE "Status" AS ENUM ('PLAYED', 'PLAYING', 'REPLAYING', 'BACKLOG', 'WISHLIST');

-- CreateTable
CREATE TABLE "refresh_token" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT NOT NULL,

    CONSTRAINT "refresh_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dlcs" (
    "id" TEXT NOT NULL,
    "dlc_banner" TEXT NOT NULL,
    "dlc_name" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,

    CONSTRAINT "dlcs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "games" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "game_banner" TEXT NOT NULL,
    "game_name" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_categories" (
    "id" SERIAL NOT NULL,
    "category_name" TEXT NOT NULL,

    CONSTRAINT "game_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_launchers" (
    "id" TEXT NOT NULL,
    "dateRelease" TIMESTAMP(3) NOT NULL,
    "game_id" TEXT NOT NULL,
    "plataform_id" TEXT NOT NULL,
    "dlc_id" TEXT,

    CONSTRAINT "game_launchers_pkey" PRIMARY KEY ("plataform_id","game_id")
);

-- CreateTable
CREATE TABLE "game_studios" (
    "id" TEXT NOT NULL,
    "studio_name" TEXT NOT NULL,

    CONSTRAINT "game_studios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platforms" (
    "id" TEXT NOT NULL,
    "plataform_name" TEXT NOT NULL,

    CONSTRAINT "platforms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publishers" (
    "id" TEXT NOT NULL,
    "publisher_name" TEXT NOT NULL,

    CONSTRAINT "publishers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "user_name" TEXT,
    "password" TEXT NOT NULL,
    "profile_picture" TEXT,
    "user_banner" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_games" (
    "id" TEXT NOT NULL,
    "game_id" TEXT,
    "user_id" TEXT NOT NULL,
    "dlc_id" TEXT,
    "userGamesStatusId" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users_games_status" (
    "id" SERIAL NOT NULL,
    "status" "Status" NOT NULL,

    CONSTRAINT "users_games_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_DLCToGameStudio" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_DLCToPublisher" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_DLCToGameCategory" (
    "A" TEXT NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "_DLCToPlatform" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_GameToGameStudio" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_GameToPublisher" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_GameToGameCategory" (
    "A" TEXT NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "_GameToPlatform" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "refresh_token_token_key" ON "refresh_token"("token");

-- CreateIndex
CREATE UNIQUE INDEX "dlcs_dlc_name_key" ON "dlcs"("dlc_name");

-- CreateIndex
CREATE UNIQUE INDEX "games_game_name_key" ON "games"("game_name");

-- CreateIndex
CREATE UNIQUE INDEX "game_categories_category_name_key" ON "game_categories"("category_name");

-- CreateIndex
CREATE UNIQUE INDEX "game_studios_studio_name_key" ON "game_studios"("studio_name");

-- CreateIndex
CREATE UNIQUE INDEX "platforms_plataform_name_key" ON "platforms"("plataform_name");

-- CreateIndex
CREATE UNIQUE INDEX "publishers_publisher_name_key" ON "publishers"("publisher_name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_games_user_id_game_id_key" ON "user_games"("user_id", "game_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_games_user_id_dlc_id_key" ON "user_games"("user_id", "dlc_id");

-- CreateIndex
CREATE UNIQUE INDEX "_DLCToGameStudio_AB_unique" ON "_DLCToGameStudio"("A", "B");

-- CreateIndex
CREATE INDEX "_DLCToGameStudio_B_index" ON "_DLCToGameStudio"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_DLCToPublisher_AB_unique" ON "_DLCToPublisher"("A", "B");

-- CreateIndex
CREATE INDEX "_DLCToPublisher_B_index" ON "_DLCToPublisher"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_DLCToGameCategory_AB_unique" ON "_DLCToGameCategory"("A", "B");

-- CreateIndex
CREATE INDEX "_DLCToGameCategory_B_index" ON "_DLCToGameCategory"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_DLCToPlatform_AB_unique" ON "_DLCToPlatform"("A", "B");

-- CreateIndex
CREATE INDEX "_DLCToPlatform_B_index" ON "_DLCToPlatform"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_GameToGameStudio_AB_unique" ON "_GameToGameStudio"("A", "B");

-- CreateIndex
CREATE INDEX "_GameToGameStudio_B_index" ON "_GameToGameStudio"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_GameToPublisher_AB_unique" ON "_GameToPublisher"("A", "B");

-- CreateIndex
CREATE INDEX "_GameToPublisher_B_index" ON "_GameToPublisher"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_GameToGameCategory_AB_unique" ON "_GameToGameCategory"("A", "B");

-- CreateIndex
CREATE INDEX "_GameToGameCategory_B_index" ON "_GameToGameCategory"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_GameToPlatform_AB_unique" ON "_GameToPlatform"("A", "B");

-- CreateIndex
CREATE INDEX "_GameToPlatform_B_index" ON "_GameToPlatform"("B");

-- AddForeignKey
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dlcs" ADD CONSTRAINT "dlcs_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_launchers" ADD CONSTRAINT "game_launchers_plataform_id_fkey" FOREIGN KEY ("plataform_id") REFERENCES "platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_launchers" ADD CONSTRAINT "game_launchers_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_launchers" ADD CONSTRAINT "game_launchers_dlc_id_fkey" FOREIGN KEY ("dlc_id") REFERENCES "dlcs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_games" ADD CONSTRAINT "user_games_userGamesStatusId_fkey" FOREIGN KEY ("userGamesStatusId") REFERENCES "users_games_status"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_games" ADD CONSTRAINT "user_games_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_games" ADD CONSTRAINT "user_games_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_games" ADD CONSTRAINT "user_games_dlc_id_fkey" FOREIGN KEY ("dlc_id") REFERENCES "dlcs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DLCToGameStudio" ADD CONSTRAINT "_DLCToGameStudio_A_fkey" FOREIGN KEY ("A") REFERENCES "dlcs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DLCToGameStudio" ADD CONSTRAINT "_DLCToGameStudio_B_fkey" FOREIGN KEY ("B") REFERENCES "game_studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DLCToPublisher" ADD CONSTRAINT "_DLCToPublisher_A_fkey" FOREIGN KEY ("A") REFERENCES "dlcs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DLCToPublisher" ADD CONSTRAINT "_DLCToPublisher_B_fkey" FOREIGN KEY ("B") REFERENCES "publishers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DLCToGameCategory" ADD CONSTRAINT "_DLCToGameCategory_A_fkey" FOREIGN KEY ("A") REFERENCES "dlcs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DLCToGameCategory" ADD CONSTRAINT "_DLCToGameCategory_B_fkey" FOREIGN KEY ("B") REFERENCES "game_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DLCToPlatform" ADD CONSTRAINT "_DLCToPlatform_A_fkey" FOREIGN KEY ("A") REFERENCES "dlcs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DLCToPlatform" ADD CONSTRAINT "_DLCToPlatform_B_fkey" FOREIGN KEY ("B") REFERENCES "platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GameToGameStudio" ADD CONSTRAINT "_GameToGameStudio_A_fkey" FOREIGN KEY ("A") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GameToGameStudio" ADD CONSTRAINT "_GameToGameStudio_B_fkey" FOREIGN KEY ("B") REFERENCES "game_studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GameToPublisher" ADD CONSTRAINT "_GameToPublisher_A_fkey" FOREIGN KEY ("A") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GameToPublisher" ADD CONSTRAINT "_GameToPublisher_B_fkey" FOREIGN KEY ("B") REFERENCES "publishers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GameToGameCategory" ADD CONSTRAINT "_GameToGameCategory_A_fkey" FOREIGN KEY ("A") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GameToGameCategory" ADD CONSTRAINT "_GameToGameCategory_B_fkey" FOREIGN KEY ("B") REFERENCES "game_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GameToPlatform" ADD CONSTRAINT "_GameToPlatform_A_fkey" FOREIGN KEY ("A") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GameToPlatform" ADD CONSTRAINT "_GameToPlatform_B_fkey" FOREIGN KEY ("B") REFERENCES "platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
