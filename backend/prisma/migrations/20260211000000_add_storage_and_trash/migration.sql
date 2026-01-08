-- AlterTable
ALTER TABLE "Project" ADD COLUMN "deletedAt" DATETIME;

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "avatarPath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "preferences" TEXT DEFAULT '{}',
    "storageUsed" BIGINT NOT NULL DEFAULT 0
);
INSERT INTO "new_User" ("avatarPath", "createdAt", "email", "id", "name", "password", "preferences", "role", "updatedAt") SELECT "avatarPath", "createdAt", "email", "id", "name", "password", "preferences", "role", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE TABLE "new_Team" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "storageUsed" BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT "Team_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Team" ("createdAt", "id", "name", "ownerId", "updatedAt") SELECT "createdAt", "id", "name", "ownerId", "updatedAt" FROM "Team";
DROP TABLE "Team";
ALTER TABLE "new_Team" RENAME TO "Team";
CREATE TABLE "new_Image" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bundleId" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "size" BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT "Image_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "ImageBundle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Image" ("bundleId", "filename", "id", "mimeType", "order", "originalName", "path") SELECT "bundleId", "filename", "id", "mimeType", "order", "originalName", "path" FROM "Image";
DROP TABLE "Image";
ALTER TABLE "new_Image" RENAME TO "Image";
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
    CONSTRAINT "Video_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Video" ("createdAt", "filename", "frameRate", "id", "mimeType", "originalName", "path", "projectId", "versionName") SELECT "createdAt", "filename", "frameRate", "id", "mimeType", "originalName", "path", "projectId", "versionName" FROM "Video";
DROP TABLE "Video";
ALTER TABLE "new_Video" RENAME TO "Video";
CREATE TABLE "new_Comment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "videoId" INTEGER,
    "imageId" INTEGER,
    "threeDAssetId" INTEGER,
    "userId" INTEGER,
    "guestName" TEXT,
    "content" TEXT NOT NULL,
    "timestamp" REAL NOT NULL,
    "duration" REAL,
    "annotation" TEXT,
    "cameraState" TEXT,
    "screenshotPath" TEXT,
    "attachmentPath" TEXT,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "isVisibleToClient" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parentId" INTEGER,
    "assigneeId" INTEGER,
    "size" BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT "Comment_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_threeDAssetId_fkey" FOREIGN KEY ("threeDAssetId") REFERENCES "ThreeDAsset" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Comment" ("annotation", "assigneeId", "attachmentPath", "cameraState", "content", "createdAt", "duration", "guestName", "id", "imageId", "isResolved", "isVisibleToClient", "parentId", "screenshotPath", "threeDAssetId", "timestamp", "userId", "videoId") SELECT "annotation", "assigneeId", "attachmentPath", "cameraState", "content", "createdAt", "duration", "guestName", "id", "imageId", "isResolved", "isVisibleToClient", "parentId", "screenshotPath", "threeDAssetId", "timestamp", "userId", "videoId" FROM "Comment";
DROP TABLE "Comment";
ALTER TABLE "new_Comment" RENAME TO "Comment";
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
    CONSTRAINT "ThreeDAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ThreeDAsset" ("createdAt", "filename", "id", "mimeType", "originalName", "path", "projectId", "versionName") SELECT "createdAt", "filename", "id", "mimeType", "originalName", "path", "projectId", "versionName" FROM "ThreeDAsset";
DROP TABLE "ThreeDAsset";
ALTER TABLE "new_ThreeDAsset" RENAME TO "ThreeDAsset";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
