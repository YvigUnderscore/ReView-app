-- CreateTable
CREATE TABLE "TeamMembership" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamMembership_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamMembership_userId_teamId_key" ON "TeamMembership"("userId", "teamId");

-- Migrate Data from implicit table _TeamMembers
-- Implicit tables usually have columns "A" and "B" pointing to the IDs.
-- Alphabetically: T (Team) comes before U (User).
-- So "A" is TeamId, "B" is UserId.
INSERT INTO "TeamMembership" ("teamId", "userId", "role")
SELECT "A", "B", 'MEMBER' FROM "_TeamMembers";

-- DropTable
DROP TABLE "_TeamMembers";
