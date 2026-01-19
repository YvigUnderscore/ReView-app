const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { generateDigestVideo, buildDigestItems } = require('./digestVideoService');
const prisma = new PrismaClient();

const DATA_PATH = process.env.DATA_PATH || path.join(__dirname, '../storage');

// Lock to prevent concurrent digest processing per team
const processingTeams = new Set();

// Helper to get Public URL
async function getPublicUrl() {
    const setting = await prisma.systemSetting.findUnique({ where: { key: 'public_url' } });
    return setting ? setting.value.replace(/\/$/, '') : 'http://localhost:3000'; // Default fallback
}

// Helper to resolve file path
function getFilePath(relativePath, type = 'media') {
    if (!relativePath) return null;
    if (type === 'comment') return path.join(DATA_PATH, 'comments', relativePath);
    if (type === 'media') return path.join(DATA_PATH, 'media', relativePath);
    if (type === 'thumbnail') return path.join(DATA_PATH, 'thumbnails', relativePath);
    return null;
}

// 1. Send Immediately
async function sendToDiscord(webhookUrl, payload, files = [], botName = null, botAvatar = null) {
    if (!webhookUrl) return;

    try {
        const formData = new FormData();

        // Override Bot Name/Avatar
        if (botName) payload.username = botName;
        if (botAvatar) payload.avatar_url = botAvatar;

        // If files exist, we must use multipart/form-data
        if (files.length > 0) {
            // Discord expects 'payload_json' field for the JSON body when using multipart
            formData.append('payload_json', JSON.stringify(payload));

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (fs.existsSync(file.path)) {
                    formData.append(`files[${i}]`, fs.createReadStream(file.path), {
                        filename: file.name
                    });
                }
            }
        } else {
            // Standard JSON request
            return await axios.post(webhookUrl, payload);
        }

        return await axios.post(webhookUrl, formData, {
            headers: formData.getHeaders()
        });
    } catch (error) {
        console.error('Discord Webhook Error:', error.response ? error.response.data : error.message);
        // Don't throw, just log. We don't want to break the app flow.
    }
}

// 2. Queue Logic
async function addToQueue(teamId, type, data) {
    await prisma.discordQueue.create({
        data: {
            teamId,
            type,
            payload: JSON.stringify(data)
        }
    });
}

// 3. Main Notify Function
async function notifyDiscord(teamId, eventType, data) {
    if (!teamId) return;

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team || !team.discordWebhookUrl) return;

    const timing = team.discordTiming || 'REALTIME';

    // MAJOR Logic: Only notify major events
    if (timing === 'MAJOR') {
        const majorEvents = ['STATUS_CHANGE', 'VIDEO_VERSION', 'PROJECT_CREATE'];
        if (!majorEvents.includes(eventType)) return;
        // If major, send immediately
        await processInstantNotification(team, eventType, data);
        return;
    }

    // HYBRID Logic
    if (timing === 'HYBRID') {
        const instantEvents = ['MENTION', 'STATUS_CHANGE', 'VIDEO_VERSION', 'PROJECT_CREATE'];
        if (instantEvents.includes(eventType)) {
            await processInstantNotification(team, eventType, data);
        } else {
            // Queue everything else (Comments)
            await addToQueue(team.id, eventType, data);
        }
        return;
    }

    // GROUPED / HOURLY Logic
    if (timing === 'GROUPED' || timing === 'HOURLY') {
        await addToQueue(team.id, eventType, data);
        return;
    }

    // REALTIME (Default)
    await processInstantNotification(team, eventType, data);
}

// Helper to construct payload and send
async function processInstantNotification(team, eventType, data) {
    const publicUrl = await getPublicUrl();
    const { content, embed, files } = await constructDiscordMessage(eventType, data, publicUrl, team);

    await sendToDiscord(
        team.discordWebhookUrl,
        { content, embeds: embed ? [embed] : [] },
        files,
        team.discordBotName,
        team.discordBotAvatar
    );
}

// Construct Message Payload
// Construct Message Payload
async function constructDiscordMessage(eventType, data, publicUrl, team) {
    let content = '';
    const projectLink = data.projectSlug ? `${publicUrl}/#/${team.slug}/project/${data.projectSlug}` : `${publicUrl}/#/${team.slug}/dashboard`;

    let embed = {
        color: 3891958, // Default Blue #3b82f6
        footer: { text: `ReView • ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, icon_url: `${publicUrl}/logo_icon.png` },
        timestamp: new Date().toISOString(),
        fields: []
    };
    let files = [];

    // Common Author logic
    if (data.user) {
        embed.author = {
            name: data.user.name || 'User',
            icon_url: data.user.avatarPath ? `${publicUrl}/api/media/avatars/${data.user.avatarPath}` : null
        };
    } else if (data.guestName) {
        embed.author = { name: `${data.guestName} (Guest)` };
    } else {
        embed.author = { name: `ReView Bot`, icon_url: `${publicUrl}/logo_icon.png` };
    }

    switch (eventType) {
        case 'COMMENT':
        case 'MENTION':
        case 'REPLY':
            embed.title = `💬 New Comment on "${data.projectName}"`;
            embed.url = `${publicUrl}/?commentId=${data.id}`;
            embed.description = `"${data.content}"\n\n[Jump to Comment](${embed.url})`;
            embed.color = 3447003; // Blue #3498db

            // Handle Screenshot Attachment (Rich Media)
            if (data.screenshotPath || data.annotationScreenshotPath) {
                const useBurned = team.discordBurnAnnotations;
                let imagePath = null;
                if (useBurned && data.annotationScreenshotPath) {
                    imagePath = getFilePath(data.annotationScreenshotPath, 'comment');
                } else if (data.screenshotPath) {
                    imagePath = getFilePath(data.screenshotPath, 'comment');
                }

                if (imagePath && fs.existsSync(imagePath)) {
                    const filename = path.basename(imagePath);
                    files.push({ path: imagePath, name: filename });
                    embed.image = { url: `attachment://${filename}` }; // Detailed large preview
                }
            }
            break;

        case 'PROJECT_CREATE':
            embed.title = `🚀 New Project: ${data.name}`;
            embed.url = data.slug ? `${publicUrl}/#/${team.slug}/project/${data.slug}` : projectLink;
            embed.description = data.description || 'No description provided.';
            embed.color = 3066993; // Green #2ecc71
            embed.fields.push({ name: 'Created By', value: data.userName || 'Admin', inline: true });

            // Thumbnail OR GIF (prefer GIF if available)
            if (data.gifPath) {
                // Try media first (standard location for GIFs)
                let gifFullPath = getFilePath(data.gifPath, 'media');

                // Fallback: Check if it's already an absolute path or relative to DATA_PATH root?
                // But usually it's in media.

                if (gifFullPath && fs.existsSync(gifFullPath)) {
                    const filename = path.basename(gifFullPath);
                    files.push({ path: gifFullPath, name: filename });
                    embed.image = { url: `attachment://${filename}` };
                } else {
                    // If GIF missing, try thumbnail fallback immediately below
                }
            }

            // Fallback to Thumbnail if GIF failed or not present
            if (!embed.image && data.thumbnailPath) {
                // Try 'thumbnails' dir first (standard video thumbnails)
                let thumbPath = getFilePath(data.thumbnailPath, 'thumbnail');
                if (!thumbPath || !fs.existsSync(thumbPath)) {
                    // Try 'media' dir (Image Bundle "thumbnails" are just the image file)
                    thumbPath = getFilePath(data.thumbnailPath, 'media');
                }

                if (thumbPath && fs.existsSync(thumbPath)) {
                    const filename = path.basename(thumbPath);
                    files.push({ path: thumbPath, name: filename });
                    embed.image = { url: `attachment://${filename}` };
                }
            }
            break;

        case 'VIDEO_VERSION':
            embed.title = `🎬 New Version Uploaded`;
            embed.url = projectLink;
            embed.description = `A new version **${data.versionName}** is available for **${data.projectName}**.`;
            embed.color = 10181046; // Purple #9b59b6
            embed.fields.push(
                { name: 'Project', value: `[${data.projectName}](${projectLink})`, inline: true },
                { name: 'Uploader', value: data.user ? data.user.name : 'Unknown', inline: true }
            );

            // GIF Turnaround
            if (data.gifPath) {
                // Try media first (standard location for GIFs)
                let gifFullPath = getFilePath(data.gifPath, 'media');

                if (gifFullPath && fs.existsSync(gifFullPath)) {
                    const filename = path.basename(gifFullPath);
                    files.push({ path: gifFullPath, name: filename });
                    embed.image = { url: `attachment://${filename}` };
                }
            }

            // Fallback to Thumbnail if GIF failed or not present
            if (!embed.image && data.thumbnailPath) {
                // Try 'thumbnails' dir first
                let thumbPath = getFilePath(data.thumbnailPath, 'thumbnail');
                if (!thumbPath || !fs.existsSync(thumbPath)) {
                    // Try 'media' dir
                    thumbPath = getFilePath(data.thumbnailPath, 'media');
                }

                if (thumbPath && fs.existsSync(thumbPath)) {
                    const filename = path.basename(thumbPath);
                    files.push({ path: thumbPath, name: filename });
                    embed.image = { url: `attachment://${filename}` };
                }
            }
            break;

        case 'STATUS_CHANGE':
            embed.title = `🔄 Status Changed`;
            embed.url = projectLink;
            embed.description = `**${data.projectName}** has been updated.`;
            embed.color = 15105570; // Orange #e67e22
            embed.fields.push(
                { name: 'New Status', value: `**${data.status}**`, inline: true }
            );
            break;
    }

    // Fallback if fields is empty
    if (embed.fields && embed.fields.length === 0) delete embed.fields;

    // Validate Image/Files integrity
    // If we have an image url starting with attachment:// but no files, delete the image
    if (embed.image && embed.image.url && embed.image.url.startsWith('attachment://')) {
        const hasFile = files.some(f => embed.image.url === `attachment://${f.name}`);
        if (!hasFile) {
            console.warn('[Discord] Removed embed.image because attachment is missing');
            delete embed.image;
        }
    }

    return { content, embed, files };
}

// 4. Cron Process Function (Called by server.js/cronService.js)
// Re-export as processDiscordQueue for consistency with team.routes.js

async function processDiscordQueue(force = false) {
    await processDebouncedQueue(force);
}

// Function specifically for Debounce/Grouped flush
async function processDebouncedQueue(force = false) {
    const teams = await prisma.team.findMany({
        where: {
            discordTiming: { in: ['GROUPED', 'HYBRID'] },
            discordQueue: { some: {} }
        },
        include: {
            discordQueue: { orderBy: { createdAt: 'desc' } }
        }
    });

    const publicUrl = await getPublicUrl();

    for (const team of teams) {
        if (team.discordQueue.length === 0) continue;

        // Check "silence" duration
        const lastItem = team.discordQueue[0]; // Descending
        const lastTime = new Date(lastItem.createdAt).getTime();
        const now = Date.now();

        // 5 Minutes Debounce OR Force
        if (force || (now - lastTime) > 5 * 60 * 1000) {
            await flushQueue(team, team.discordQueue, publicUrl);
        }
    }
}

// Function specifically for Hourly flush
async function processHourlyQueue() {
    const teams = await prisma.team.findMany({
        where: {
            discordTiming: 'HOURLY',
            discordQueue: { some: {} }
        },
        include: {
            discordQueue: { orderBy: { createdAt: 'desc' } }
        }
    });

    const publicUrl = await getPublicUrl();

    for (const team of teams) {
        if (team.discordQueue.length > 0) {
            await flushQueue(team, team.discordQueue, publicUrl);
        }
    }
}

// Flush Helper: Combine messages into Digest
async function flushQueue(team, queueItems, publicUrl) {
    // Prevent concurrent processing for the same team
    if (processingTeams.has(team.id)) {
        console.log(`[Discord Digest] Team ${team.id} already processing, skipping...`);
        return;
    }

    processingTeams.add(team.id);
    console.log(`[Discord Digest] Acquired lock for team ${team.id}`);

    try {
        // Sort oldest first for display
        const items = [...queueItems].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        // Group by Project
        const byProject = {};
        items.forEach(item => {
            const data = JSON.parse(item.payload);
            const pid = data.projectName || 'Unknown Project';
            if (!byProject[pid]) byProject[pid] = { items: [], id: data.projectId };
            byProject[pid].items.push({ type: item.type, data });
        });

        let description = '';
        const potentialImageFiles = []; // Changed: Store images separately
        let fileCounter = 0;

        // Track comments for GIF generation
        let potentialGifComments = [];
        let bestProjectId = null;
        let maxComments = 0;

        for (const [projectName, projectData] of Object.entries(byProject)) {
            console.log(`[Discord Digest] Processing project: ${projectName} (${projectData.items.length} items)`);
            description += `**${projectName}**\n`;

            let projectComments = [];

            for (const event of projectData.items) {
                const d = event.data;
                let line = '';
                if (event.type === 'COMMENT') {
                    const author = d.user ? d.user.name : (d.guestName || 'User');
                    line = `• ${author}: "${d.content.substring(0, 50)}${d.content.length > 50 ? '...' : ''}"`;

                    // Add link
                    const link = `${publicUrl}/?commentId=${d.id}`;
                    line += ` [View](${link})\n`;

                    // Collect for GIF
                    if (d.timestamp != null && d.projectId && !d.parentId) {
                        console.log(`[Discord Digest] Found timed comment: ID ${d.id}, Time: ${d.timestamp}`);
                        projectComments.push({ ...d, id: d.id });
                    }

                    // We typically don't attach ALL images in a digest as it breaks discord limits (10 files max).
                    // LIMIT: 4 images per flush (if no video)
                    if (fileCounter < 4 && (d.screenshotPath || d.annotationScreenshotPath)) {
                        const useBurned = team.discordBurnAnnotations;
                        let imagePath = null;
                        if (useBurned && d.annotationScreenshotPath) imagePath = getFilePath(d.annotationScreenshotPath, 'comment');
                        else if (d.screenshotPath) imagePath = getFilePath(d.screenshotPath, 'comment');

                        if (imagePath && fs.existsSync(imagePath)) {
                            const fname = `img_${fileCounter}_${path.basename(imagePath)}`;
                            potentialImageFiles.push({ path: imagePath, name: fname });
                            fileCounter++;
                        }
                    }
                } else if (event.type === 'STATUS_CHANGE') {
                    line = `• Status changed to ${d.status}\n`;
                } else {
                    line = `• ${event.type}\n`;
                }
                description += line;
            }
            description += '\n';

            if (projectComments.length > maxComments) {
                maxComments = projectComments.length;
                bestProjectId = projectData.id;
                potentialGifComments = projectComments;
            }
        }

        const finalFiles = [];
        let videoGenerated = false;

        // Generate WebM for the project with most comments
        if (potentialGifComments.length > 0 && bestProjectId) {
            console.log(`[Discord Digest] Attempting WebM video generation for Project ${bestProjectId} with ${potentialGifComments.length} comments.`);
            try {
                // Fetch the project to get the actual asset path
                const projectForDigest = await prisma.project.findUnique({
                    where: { id: bestProjectId },
                    include: {
                        videos: { orderBy: { createdAt: 'desc' }, take: 1 },
                        threeDAssets: { orderBy: { createdAt: 'desc' }, take: 1 },
                        imageBundles: { orderBy: { createdAt: 'desc' }, take: 1 }
                    }
                });

                let assetPath = '';
                let assetType = '3d';

                if (projectForDigest) {
                    if (projectForDigest.threeDAssets && projectForDigest.threeDAssets.length > 0) {
                        assetPath = projectForDigest.threeDAssets[0].filename;
                        assetType = '3d';
                    } else if (projectForDigest.videos && projectForDigest.videos.length > 0) {
                        assetPath = projectForDigest.videos[0].filename;
                        assetType = 'video';
                    } else if (projectForDigest.imageBundles && projectForDigest.imageBundles.length > 0) {
                        // For image bundles, get first image
                        const bundle = projectForDigest.imageBundles[0];
                        const images = await prisma.image.findMany({ where: { bundleId: bundle.id }, take: 1 });
                        if (images.length > 0) {
                            assetPath = images[0].filename;
                            assetType = 'image';
                        }
                    }
                }

                if (!assetPath) {
                    console.log('[Discord Digest] No asset found for video generation');
                } else {
                    const digestItems = [{
                        type: assetType,
                        assetPath: assetPath,
                        projectId: bestProjectId,
                        projectName: Object.keys(byProject).find(k => byProject[k].id === bestProjectId) || 'Project',
                        comments: potentialGifComments.slice(0, 10).map(c => ({
                            id: c.id,
                            content: c.content,
                            timestamp: c.timestamp,
                            cameraState: c.cameraState ? (typeof c.cameraState === 'string' ? JSON.parse(c.cameraState) : c.cameraState) : null,
                            annotation: c.annotation ? (typeof c.annotation === 'string' ? JSON.parse(c.annotation) : c.annotation) : null,
                            user: {
                                name: c.user?.name || c.guestName || 'Reviewer',
                                avatarPath: c.user?.avatarPath || null  // Just the path, digestVideoService will add baseUrl
                            }
                        }))
                    }];

                    const mediaDir = path.join(DATA_PATH, 'media', 'digests');
                    if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });

                    const videoPath = await generateDigestVideo(digestItems, mediaDir);
                    console.log(`[Discord Digest] Generated WebM at: ${videoPath}`);

                    if (videoPath) {
                        const fname = path.basename(videoPath);
                        finalFiles.push({ path: videoPath, name: fname });
                        videoGenerated = true;
                    }
                }
            } catch (e) {
                console.error('[Discord Digest] Failed to generate digest video', e);
            }
        } else {
            console.log('[Discord Digest] No timed comments found for video generation.');
        }

        // Logic Exclusive: If video generated, DO NOT send images.
        // Use images only as fallback or if no video.
        if (!videoGenerated) {
            finalFiles.push(...potentialImageFiles);
        }

        const embed = {
            title: `Activity Digest (${items.length} updates)`,
            description: description,
            color: 3447003, // Blue
            timestamp: new Date().toISOString()
        };

        await sendToDiscord(
            team.discordWebhookUrl,
            { embeds: [embed] },
            finalFiles, // Use finalFiles instead of files
            team.discordBotName,
            team.discordBotAvatar
        );

        // Delete processed items
        await prisma.discordQueue.deleteMany({
            where: { id: { in: items.map(i => i.id) } }
        });
    } finally {
        // Always release the lock
        processingTeams.delete(team.id);
        console.log(`[Discord Digest] Released lock for team ${team.id}`);
    }
}

module.exports = {
    notifyDiscord,
    processDebouncedQueue,
    processHourlyQueue,
    processDiscordQueue
};
