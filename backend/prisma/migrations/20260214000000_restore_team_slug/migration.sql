-- AlterTable
ALTER TABLE "Team" ADD COLUMN "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Team_slug_key" ON "Team"("slug");
