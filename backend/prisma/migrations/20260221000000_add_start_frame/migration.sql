-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Team" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "ownerId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "storageUsed" BIGINT NOT NULL DEFAULT 0,
    "storageLimit" BIGINT,
    "startFrame" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Team_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Team" ("createdAt", "id", "name", "ownerId", "slug", "storageLimit", "storageUsed", "updatedAt") SELECT "createdAt", "id", "name", "ownerId", "slug", "storageLimit", "storageUsed", "updatedAt" FROM "Team";
DROP TABLE "Team";
ALTER TABLE "new_Team" RENAME TO "Team";
CREATE UNIQUE INDEX "Team_slug_key" ON "Team"("slug");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
