const { PrismaClient } = require('@prisma/client');
const { sendEmail } = require('./emailService');
const prisma = new PrismaClient();

// Helper to resolve Public URL (reused from discordService logic)
async function getPublicUrl() {
    const setting = await prisma.systemSetting.findUnique({ where: { key: 'public_url' } });
    return setting ? setting.value.replace(/\/$/, '') : 'http://localhost:3000';
}

/**
 * Process Email Queue
 * Checks for users with pending email notifications where the last item is older than 5 minutes.
 */
const { generateDigestEmail } = require('./templateService');
const { generateDigestGif } = require('./digestGifService');
const path = require('path');
const fs = require('fs');

const DATA_PATH = process.env.DATA_PATH || path.join(__dirname, '../storage');

async function sendDigestEmail(user, items, publicUrl) {
    // Sort oldest first for reading order
    items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    // Prepare attachment
    const attachments = [];
    console.log(`[Email Batch] preparing digest for user ${user.id} with ${items.length} items.`);

    // Try to generate GIF if we have comments
    try {
        const comments = [];
        let targetProjectId = null;

        for (const item of items) {
            if (item.type === 'COMMENT' && item.payload) {
                try {
                    const data = JSON.parse(item.payload);
                    // Log data validation
                    // console.log('[Email Batch] Item data:', data.id, 'Time:', data.timestamp, 'PID:', data.projectId);

                    if (data.timestamp && data.projectId && !data.parentId) {
                        comments.push({ ...data, id: data.id || item.id });
                        if (!targetProjectId) targetProjectId = data.projectId; // Pick first project found
                    }
                } catch (e) { }
            }
        }

        console.log(`[Email Batch] Found ${comments.length} timed comments for GIF generation. ProjectID: ${targetProjectId}`);

        if (comments.length > 0 && targetProjectId) {
            // Use DATA_PATH/media/digests for storage
            const mediaDir = path.join(DATA_PATH, 'media', 'digests');
            if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });

            // Limit to first 10 comments to keep GIF size manageable
            const limitedComments = comments.slice(0, 10);

            console.log(`[Email Batch] Calling generateDigestGif for Project ${targetProjectId}...`);
            const gifPath = await generateDigestGif(limitedComments, targetProjectId, mediaDir);
            console.log(`[Email Batch] generateDigestGif result: ${gifPath}`);

            if (gifPath) {
                attachments.push({
                    filename: path.basename(gifPath),
                    path: gifPath,
                    cid: 'digest-gif' // Content ID for embedding if needed
                });
            }
        } else {
            console.log('[Email Batch] No timed comments or Project ID found. Skipping GIF.');
        }
    } catch (e) {
        console.error('[Email Batch] Digest GIF generation failed:', e);
    }

    // Generate HTML using the new Template Service
    const htmlContent = generateDigestEmail(user, items, publicUrl);
    const subject = `ReView Activity: ${items.length} new updates`;

    await sendEmail(user.email, subject, "Please enable HTML to view this email.", htmlContent, attachments);
    console.log(`Email Batch: Sent digest to ${user.email} with ${items.length} items. Attachments: ${attachments.length}`);
}

/**
 * Process Email Queue
 * Checks for users with pending email notifications where the last item is older than 5 minutes.
 * @param {boolean} force - If true, ignores the 5 minute debounce
 */
async function processEmailQueue(force = false) {
    try {
        // Find users who have at least one queue item.
        const pendingItems = await prisma.emailQueue.findMany({
            orderBy: { createdAt: 'desc' },
            include: { user: true }
        });

        if (pendingItems.length === 0) return;

        // Group by User
        const byUser = {};
        pendingItems.forEach(item => {
            if (!byUser[item.userId]) byUser[item.userId] = [];
            byUser[item.userId].push(item);
        });

        const publicUrl = await getPublicUrl();

        // Check debounce and Send
        for (const [userId, items] of Object.entries(byUser)) {
            // items are ordered desc (newest first)
            const lastItem = items[0];
            const lastTime = new Date(lastItem.createdAt).getTime();
            const now = Date.now();

            // 5 Minutes Debounce OR Force
            if (force || (now - lastTime) > 5 * 60 * 1000) {
                const user = items[0].user;
                if (user && user.email) {
                    await sendDigestEmail(user, items, publicUrl);
                }

                // Cleanup processed items
                await prisma.emailQueue.deleteMany({
                    where: { id: { in: items.map(i => i.id) } }
                });
            }
        }

    } catch (error) {
        console.error("Error processing email queue:", error);
    }
}

module.exports = {
    processEmailQueue,
    sendDigestEmail,
    getPublicUrl
};
