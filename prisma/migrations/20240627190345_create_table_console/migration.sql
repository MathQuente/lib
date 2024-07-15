-- CreateTable
CREATE TABLE "consoles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "console_name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_ConsoleToGame" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_ConsoleToGame_A_fkey" FOREIGN KEY ("A") REFERENCES "consoles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ConsoleToGame_B_fkey" FOREIGN KEY ("B") REFERENCES "games" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "consoles_console_name_key" ON "consoles"("console_name");

-- CreateIndex
CREATE UNIQUE INDEX "_ConsoleToGame_AB_unique" ON "_ConsoleToGame"("A", "B");

-- CreateIndex
CREATE INDEX "_ConsoleToGame_B_index" ON "_ConsoleToGame"("B");
