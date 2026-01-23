/**
 * Digest Image Service
 * Generates composite images for Discord IMAGE mode notifications
 * Layout: Screenshot on left, comment panel on right
 */

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Concurrency Limit: 1 concurrent generation
const limit = require('p-limit')(1);

const DATA_PATH = process.env.DATA_PATH || path.join(__dirname, '../storage');

/**
 * Gets the public URL from system settings
 */
async function getPublicUrl() {
    const setting = await prisma.systemSetting.findUnique({ where: { key: 'public_url' } });
    return setting ? setting.value.replace(/\/$/, '') : 'http://localhost:3000';
}

/**
 * Generate HTML for the composite image
 * @param {Object} options - Options for rendering
 * @returns {string} HTML string
 */
function generateCompositeHTML(options) {
    const {
        screenshotDataUrl,
        screenshotWidth,
        screenshotHeight,
        userName,
        avatarDataUrl,
        userInitials,
        commentText,
        attachmentDataUrls,
        panelWidth
    } = options;

    // Calculate responsive font size based on height - MAX 20px
    const baseFontSize = Math.max(12, Math.min(20, Math.floor(screenshotHeight / 35)));
    const titleFontSize = Math.min(22, Math.floor(baseFontSize * 1.1));
    const smallFontSize = Math.floor(baseFontSize * 0.75);

    // Calculate attachment zone height (max 10% of total height)
    const maxAttachmentHeight = Math.floor(screenshotHeight * 0.10);
    const attachmentSize = attachmentDataUrls.length > 0
        ? Math.min(maxAttachmentHeight, Math.floor((panelWidth - 40) / Math.min(attachmentDataUrls.length, 4)) - 8)
        : 0;

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', 'Inter', system-ui, -apple-system, sans-serif;
            background: #1a1a2e;
            width: ${screenshotWidth + panelWidth}px;
            height: ${screenshotHeight}px;
            display: flex;
            overflow: hidden;
        }
        
        .screenshot-container {
            width: ${screenshotWidth}px;
            height: ${screenshotHeight}px;
            flex-shrink: 0;
            background: #000;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .screenshot-container img {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }
        
        .comment-panel {
            width: ${panelWidth}px;
            height: ${screenshotHeight}px;
            background: linear-gradient(180deg, #1e1e32 0%, #16162a 100%);
            padding: ${Math.floor(baseFontSize * 1.2)}px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        
        .user-header {
            display: flex;
            align-items: center;
            gap: ${Math.floor(baseFontSize * 0.8)}px;
            margin-bottom: ${Math.floor(baseFontSize)}px;
            flex-shrink: 0;
        }
        
        .avatar {
            width: ${Math.floor(baseFontSize * 2.5)}px;
            height: ${Math.floor(baseFontSize * 2.5)}px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            font-size: ${titleFontSize}px;
            color: #fff;
            flex-shrink: 0;
            overflow: hidden;
        }
        
        .avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        .user-name {
            font-weight: 600;
            font-size: ${titleFontSize}px;
            color: #fff;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .comment-content {
            flex: 1;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            min-height: 0;
        }
        
        .comment-text {
            font-size: ${baseFontSize}px;
            color: rgba(255, 255, 255, 0.9);
            line-height: 1.5;
            overflow: hidden;
            word-wrap: break-word;
            word-break: break-word;
            overflow-wrap: break-word;
            white-space: pre-wrap;
            hyphens: auto;
        }
        
        .attachments-container {
            margin-top: auto;
            padding-top: ${Math.floor(baseFontSize * 0.8)}px;
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            flex-shrink: 0;
            max-height: ${maxAttachmentHeight + 20}px;
            overflow: hidden;
        }
        
        .attachment-thumb {
            width: ${attachmentSize}px;
            height: ${attachmentSize}px;
            border-radius: 8px;
            object-fit: cover;
            border: 2px solid rgba(255, 255, 255, 0.1);
        }
        
        .brand-footer {
            margin-top: ${Math.floor(baseFontSize * 0.5)}px;
            padding-top: ${Math.floor(baseFontSize * 0.5)}px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            align-items: center;
            gap: 8px;
            flex-shrink: 0;
        }
        
        .brand-text {
            font-size: ${smallFontSize}px;
            color: rgba(255, 255, 255, 0.4);
        }
    </style>
</head>
<body>
    <div class="screenshot-container">
        <img src="${screenshotDataUrl}" alt="Screenshot" />
    </div>
    <div class="comment-panel">
        <div class="user-header">
            <div class="avatar">
                ${avatarDataUrl
            ? `<img src="${avatarDataUrl}" alt="Avatar" />`
            : userInitials
        }
            </div>
            <div class="user-name">${escapeHtml(userName)}</div>
        </div>
        <div class="comment-content">
            <div class="comment-text">${escapeHtml(commentText)}</div>
        </div>
        ${attachmentDataUrls.length > 0 ? `
        <div class="attachments-container">
            ${attachmentDataUrls.map(url => `
                <img class="attachment-thumb" src="${url}" alt="Attachment" />
            `).join('')}
        </div>
        ` : ''}
        <div class="brand-footer">
            <span class="brand-text">ReView</span>
        </div>
    </div>
</body>
</html>
    `;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Read file and convert to base64 data URL
 */
function fileToDataUrl(filePath) {
    if (!filePath || !fs.existsSync(filePath)) return null;

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp'
    };

    const mimeType = mimeTypes[ext] || 'image/png';
    const data = fs.readFileSync(filePath);
    return `data:${mimeType};base64,${data.toString('base64')}`;
}

/**
 * Get image dimensions using a simple approach
 */
function getImageDimensions(filePath) {
    // Read first bytes to determine dimensions (PNG/JPEG)
    const buffer = fs.readFileSync(filePath);

    // PNG: width at bytes 16-19, height at bytes 20-23
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        return { width, height };
    }

    // JPEG: Need to parse markers
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
        let offset = 2;
        while (offset < buffer.length) {
            if (buffer[offset] !== 0xFF) break;
            const marker = buffer[offset + 1];

            // SOF markers (Start of Frame)
            if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
                const height = buffer.readUInt16BE(offset + 5);
                const width = buffer.readUInt16BE(offset + 7);
                return { width, height };
            }

            const length = buffer.readUInt16BE(offset + 2);
            offset += 2 + length;
        }
    }

    // WebP
    if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
        // VP8 format
        if (buffer.toString('ascii', 12, 16) === 'VP8 ') {
            const width = buffer.readUInt16LE(26) & 0x3FFF;
            const height = buffer.readUInt16LE(28) & 0x3FFF;
            return { width, height };
        }
        // VP8L format
        if (buffer.toString('ascii', 12, 16) === 'VP8L') {
            const bits = buffer.readUInt32LE(21);
            const width = (bits & 0x3FFF) + 1;
            const height = ((bits >> 14) & 0x3FFF) + 1;
            return { width, height };
        }
    }

    // Default fallback
    return { width: 1280, height: 720 };
}

/**
 * Generate a composite image for Discord
 * @param {Object} commentData - Comment data including screenshot, user, content, attachments
 * @param {string} outputDir - Directory to save the composite image
 * @returns {Promise<string|null>} Path to generated image or null
 */
const generateCompositeImage = (commentData, outputDir) => {
    return limit(async () => {
        const {
            screenshotPath,
            annotationScreenshotPath,
            userName,
            avatarPath,
            content,
            attachmentPaths,
            burnAnnotations
        } = commentData;

        // Determine which screenshot to use
        let imagePath = null;
        if (burnAnnotations && annotationScreenshotPath && fs.existsSync(annotationScreenshotPath)) {
            imagePath = annotationScreenshotPath;
        } else if (screenshotPath && fs.existsSync(screenshotPath)) {
            imagePath = screenshotPath;
        }

        if (!imagePath) {
            console.log('[Digest Image] No screenshot available, skipping composite generation');
            return null;
        }

        console.log(`[Digest Image] Generating composite for: ${userName}`);

        try {
            // Get screenshot dimensions
            const { width: screenshotWidth, height: screenshotHeight } = getImageDimensions(imagePath);

            // Fixed panel width of 700px
            const panelWidth = 700;
            const totalWidth = screenshotWidth + panelWidth;

            // Convert screenshot to data URL
            const screenshotDataUrl = fileToDataUrl(imagePath);
            if (!screenshotDataUrl) {
                console.error('[Digest Image] Failed to read screenshot');
                return null;
            }

            // Get user avatar
            let avatarDataUrl = null;
            if (avatarPath) {
                const fullAvatarPath = path.join(DATA_PATH, 'avatars', avatarPath);
                if (fs.existsSync(fullAvatarPath)) {
                    avatarDataUrl = fileToDataUrl(fullAvatarPath);
                }
            }

            // Get user initials
            const userInitials = (userName || 'U')
                .split(' ')
                .map(n => n[0])
                .join('')
                .substring(0, 2)
                .toUpperCase();

            // Load attachment thumbnails
            // Note: Comment attachments are stored in DATA_PATH/media (via multer)
            const attachmentDataUrls = [];
            if (attachmentPaths && Array.isArray(attachmentPaths)) {
                for (const attPath of attachmentPaths.slice(0, 4)) { // Max 4 attachments shown
                    // Try media folder first (where multer stores them)
                    let fullPath = path.join(DATA_PATH, 'media', attPath);
                    if (!fs.existsSync(fullPath)) {
                        // Fallback to comments folder
                        fullPath = path.join(DATA_PATH, 'comments', attPath);
                    }
                    if (fs.existsSync(fullPath)) {
                        const dataUrl = fileToDataUrl(fullPath);
                        if (dataUrl) attachmentDataUrls.push(dataUrl);
                    }
                }
            }

            // Generate HTML
            const html = generateCompositeHTML({
                screenshotDataUrl,
                screenshotWidth,
                screenshotHeight,
                userName: userName || 'Reviewer',
                avatarDataUrl,
                userInitials,
                commentText: content || '',
                attachmentDataUrls,
                panelWidth
            });

            // Launch Puppeteer
            const browser = await puppeteer.launch({
                executablePath: '/usr/bin/chromium',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-gpu'
                ],
                headless: 'new'
            });

            try {
                const page = await browser.newPage();

                // Set viewport to exact dimensions
                await page.setViewport({ width: totalWidth, height: screenshotHeight });

                // Load HTML
                await page.setContent(html, { waitUntil: 'networkidle0' });

                // Wait a bit for fonts/images to render
                await new Promise(r => setTimeout(r, 200));

                // Generate output filename
                const outputFilename = `composite-${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
                const outputPath = path.join(outputDir, outputFilename);

                // Take screenshot
                await page.screenshot({
                    path: outputPath,
                    type: 'png'
                });

                console.log(`[Digest Image] Generated: ${outputPath}`);
                return outputPath;

            } finally {
                await browser.close();
            }

        } catch (error) {
            console.error('[Digest Image] Error generating composite:', error);
            return null;
        }
    });
};

module.exports = {
    generateCompositeImage,
    getPublicUrl
};
