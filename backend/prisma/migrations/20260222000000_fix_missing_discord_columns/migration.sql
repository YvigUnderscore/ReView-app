-- AlterTable
ALTER TABLE "Team" ADD COLUMN "discordWebhookUrl" TEXT;
ALTER TABLE "Team" ADD COLUMN "discordBotName" TEXT;
ALTER TABLE "Team" ADD COLUMN "discordBotAvatar" TEXT;
ALTER TABLE "Team" ADD COLUMN "discordTiming" TEXT NOT NULL DEFAULT 'REALTIME';
ALTER TABLE "Team" ADD COLUMN "discordBurnAnnotations" BOOLEAN NOT NULL DEFAULT true;
