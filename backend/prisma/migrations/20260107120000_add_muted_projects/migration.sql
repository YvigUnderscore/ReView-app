-- CreateTable
CREATE TABLE "_MutedProjects" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_MutedProjects_A_fkey" FOREIGN KEY ("A") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_MutedProjects_B_fkey" FOREIGN KEY ("B") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "_MutedProjects_AB_unique" ON "_MutedProjects"("A", "B");

-- CreateIndex
CREATE INDEX "_MutedProjects_B_index" ON "_MutedProjects"("B");
