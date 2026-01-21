-- Multi-Image Attachments Migration
-- Rename attachmentPath to attachmentPaths and convert to JSON array format

-- SQLite doesn't support ALTER COLUMN RENAME directly, so we create a migration that:
-- 1. Renames the column (SQLite 3.25+ supports this)
ALTER TABLE "Comment" RENAME COLUMN "attachmentPath" TO "attachmentPaths";
