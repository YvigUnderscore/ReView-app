-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Video" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "versionName" TEXT NOT NULL DEFAULT 'V01',
    "mimeType" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "frameRate" REAL NOT NULL DEFAULT 24.0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "size" BIGINT NOT NULL DEFAULT 0,
    "uploaderId" INTEGER,
    CONSTRAINT "Video_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Video_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Video" ("createdAt", "filename", "frameRate", "id", "mimeType", "originalName", "path", "projectId", "size", "versionName") SELECT "createdAt", "filename", "frameRate", "id", "mimeType", "originalName", "path", "projectId", "size", "versionName" FROM "Video";
DROP TABLE "Video";
ALTER TABLE "new_Video" RENAME TO "Video";
CREATE TABLE "new_ImageBundle" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "versionName" TEXT NOT NULL DEFAULT 'V01',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaderId" INTEGER,
    CONSTRAINT "ImageBundle_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ImageBundle_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ImageBundle" ("createdAt", "id", "projectId", "versionName") SELECT "createdAt", "id", "projectId", "versionName" FROM "ImageBundle";
DROP TABLE "ImageBundle";
ALTER TABLE "new_ImageBundle" RENAME TO "ImageBundle";
CREATE TABLE "new_ThreeDAsset" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "versionName" TEXT NOT NULL DEFAULT 'V01',
    "mimeType" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "size" BIGINT NOT NULL DEFAULT 0,
    "uploaderId" INTEGER,
    CONSTRAINT "ThreeDAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ThreeDAsset_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ThreeDAsset" ("createdAt", "filename", "id", "mimeType", "originalName", "path", "projectId", "size", "versionName") SELECT "createdAt", "filename", "id", "mimeType", "originalName", "path", "projectId", "size", "versionName" FROM "ThreeDAsset";
DROP TABLE "ThreeDAsset";
ALTER TABLE "new_ThreeDAsset" RENAME TO "ThreeDAsset";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
