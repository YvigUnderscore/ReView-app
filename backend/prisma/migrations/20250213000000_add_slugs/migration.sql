-- AlterTable
ALTER TABLE "Team" ADD COLUMN "slug" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Team_slug_key" ON "Team"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Project_teamId_slug_key" ON "Project"("teamId", "slug");
