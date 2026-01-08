const { PrismaClient } = require('@prisma/client');
const { updateStorage } = require('../utils/storage');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const DATA_PATH = process.env.DATA_PATH || path.join(__dirname, '../storage');

async function runCleanup() {
    try {
        const retentionSetting = await prisma.systemSetting.findUnique({ where: { key: 'trash_retention_days' } });
        const retentionDays = retentionSetting ? parseInt(retentionSetting.value) : 7;

        if (retentionDays < 0) return; // Disabled?

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        const expiredProjects = await prisma.project.findMany({
            where: {
                deletedAt: {
                    lt: cutoffDate
                }
            }
        });

        console.log(`[Cleanup] Found ${expiredProjects.length} expired projects (older than ${retentionDays} days).`);

        for (const project of expiredProjects) {
            console.log(`[Cleanup] Permanently deleting project ${project.id} (${project.name})...`);
            try {
                // Reuse Permanent Delete Logic
                // We could extract this to a service function, but for now duplicate logic to avoid route dependencies
                const projectId = project.id;

                let teamBytesToRelease = 0;

                // 1. Videos
                const videos = await prisma.video.findMany({ where: { projectId } });
                for (const video of videos) {
                   teamBytesToRelease += Number(video.size);
                   if (video.path && fs.existsSync(video.path)) {
                       try { fs.unlinkSync(video.path); } catch(e) {}
                   }
                }

                // 2. ThreeDAssets
                const assets = await prisma.threeDAsset.findMany({ where: { projectId } });
                for (const asset of assets) {
                    teamBytesToRelease += Number(asset.size);
                    if (asset.path && fs.existsSync(asset.path)) {
                        try { fs.unlinkSync(asset.path); } catch(e) {}
                    }
                }

                // 3. ImageBundles / Images
                const bundles = await prisma.imageBundle.findMany({ where: { projectId }, include: { images: true } });
                for (const bundle of bundles) {
                    for (const img of bundle.images) {
                        teamBytesToRelease += Number(img.size);
                        if (img.path && fs.existsSync(img.path)) {
                            try { fs.unlinkSync(img.path); } catch(e) {}
                        }
                    }
                }

                // 4. Comments (Attachments/Screenshots)
                const videoIds = videos.map(v => v.id);
                const assetIds = assets.map(a => a.id);
                const imageIds = bundles.flatMap(b => b.images.map(i => i.id));

                const comments = await prisma.comment.findMany({
                    where: {
                        OR: [
                            { videoId: { in: videoIds } },
                            { threeDAssetId: { in: assetIds } },
                            { imageId: { in: imageIds } }
                        ]
                    }
                });

                for (const c of comments) {
                    // Release User Storage
                    if (c.userId && c.size > 0) {
                        await updateStorage({ userId: c.userId, teamId: null, deltaBytes: -Number(c.size) });
                    }
                    // Delete files
                    if (c.attachmentPath) {
                         const p = path.join(DATA_PATH, 'media', c.attachmentPath);
                         try { if(fs.existsSync(p)) fs.unlinkSync(p); } catch(e) {}
                    }
                    if (c.screenshotPath) {
                         const p = path.join(DATA_PATH, 'comments', c.screenshotPath);
                         try { if(fs.existsSync(p)) fs.unlinkSync(p); } catch(e) {}
                    }
                }

                // Update Team Storage
                if (project.teamId && teamBytesToRelease > 0) {
                    await updateStorage({ teamId: project.teamId, deltaBytes: -teamBytesToRelease });
                }

                await prisma.project.delete({ where: { id: projectId } });
                console.log(`[Cleanup] Deleted project ${projectId}.`);

            } catch (err) {
                console.error(`[Cleanup] Failed to delete project ${project.id}:`, err);
            }
        }

    } catch (e) {
        console.error('[Cleanup] Error running cleanup:', e);
    }
}

module.exports = { runCleanup };
