const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const { PrismaClient } = require('@prisma/client');
const os = require('os');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

// Concurrency Limit: 1 concurrent generation
const limit = require('p-limit')(1);

const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_ME_IN_PROD_PLEASE';

/**
 * Gets the public URL from system settings
 */
async function getPublicUrl() {
    const setting = await prisma.systemSetting.findUnique({ where: { key: 'public_url' } });
    return setting ? setting.value.replace(/\/$/, '') : 'http://localhost:3000';
}

/**
 * Generates a digest GIF from a list of comments
 * @param {Array} comments - List of comments with timestamps
 * @param {number} projectId - The project ID
 * @param {string} outputDir - Directory to save the GIF
 * @returns {Promise<string|null>} - The path to the generated GIF or null
 */
const generateDigestGif = (comments, projectId, outputDir) => {
    return limit(async () => {
        console.log(`[Digest GIF] Generating GIF for ${comments.length} comments`);
        // Filter comments to only those with timestamps (for animation-based projects)
        // Filter comments to only those with timestamps (for animation-based projects)
        const timedComments = comments.filter(c => c.timestamp != null && c.timestamp >= 0);

        if (timedComments.length === 0) {
            console.log('[Digest GIF] No timed comments, skipping GIF generation');
            return null;
        }

        // Sort by timestamp
        timedComments.sort((a, b) => a.timestamp - b.timestamp);

        console.log(`[Digest GIF] Generating GIF for ${timedComments.length} comments`);

        const publicUrl = await getPublicUrl();

        // Get project to determine URL structure and Owner for Auth
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                team: {
                    include: { owner: true }
                }
            }
        });

        if (!project) {
            console.error('[Digest GIF] Project not found');
            return null;
        }

        const projectUrl = `${publicUrl}/${project.team.slug}/${project.slug}`;

        // Docker Network Fix: If running in Docker and checking user's localhost, switch to service name
        // Puppeteer running in backend container needs to access frontend container
        let targetUrl = projectUrl;
        if (targetUrl.includes('localhost:3429')) {
            console.log('[Digest GIF] Detected Docker environment, rewriting URL to http://frontend');
            targetUrl = targetUrl.replace('localhost:3429', 'frontend');
        }

        console.log(`[Digest GIF] Loading project: ${targetUrl}`);

        // Generate Token for Auth
        const token = jwt.sign(
            { id: project.team.owner.id, email: project.team.owner.email, role: project.team.owner.role || 'user' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        const browser = await puppeteer.launch({
            executablePath: '/usr/bin/chromium',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--allow-file-access-from-files',
                '--enable-unsafe-swiftshader'
            ],
            headless: 'new'
        });

        try {
            const page = await browser.newPage();
            page.on('console', msg => console.log('[Puppeteer]:', msg.text()));

            // 16:9 viewport
            await page.setViewport({ width: 640, height: 360 });

            // Auth Injection: Go to origin first, set token, then navigate
            try {
                const targetUrlObj = new URL(targetUrl);
                const origin = targetUrlObj.origin;
                console.log(`[Digest GIF] Injecting auth token at ${origin}`);
                await page.goto(`${origin}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });

                await page.evaluate((t) => {
                    localStorage.setItem('token', t);
                }, token);
            } catch (authErr) {
                console.warn('[Digest GIF] Auth injection warning:', authErr.message);
            }

            // Navigate to project
            await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

            // Wait for model-viewer or video player to load
            await page.waitForSelector('model-viewer, video', { timeout: 30000 });

            // Hide UI elements to clean up the capture
            await page.addStyleTag({
                content: `
                    header, nav, .timeline-container, .activity-panel, .controls-overlay, .shortcuts-panel, .floating-panel, .annotation-list, button {
                        display: none !important;
                    }
                    /* Ensure model-viewer takes full space if needed, though we screenshot the element directly */
                    body { background: transparent !important; }
                `
            });

            // Get handle to the model-viewer or video element
            const elementHandle = await page.$('model-viewer, video');

            const tempDir = path.join(outputDir, 'temp_digest_frames_' + Date.now());
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

            let frameIndex = 0;
            const FPS = 30;
            const TRANSITION_FRAMES = Math.round(0.5 * FPS); // 0.5s transition = 15 frames
            const PAUSE_FRAMES = Math.round(1.0 * FPS);      // 1s pause = 30 frames

            for (let i = 0; i < timedComments.length; i++) {
                const comment = timedComments[i];
                const targetTime = comment.timestamp;
                const cameraState = comment.cameraState ? JSON.parse(comment.cameraState) : null;

                console.log(`[Digest GIF] Capturing comment ${i + 1}/${timedComments.length} at ${targetTime}s`);

                // For transition, we need to smoothly move from current to target
                // For the first comment, just jump to it
                if (i === 0) {
                    await applyState(page, targetTime, cameraState);
                } else {
                    // Animate transition (Time + Camera)
                    const prevComment = timedComments[i - 1];
                    const prevTime = prevComment.timestamp;
                    // Simple linear interpolation for time. Camera interpolation is harder, so we stick to time for now
                    // or we could do a hard cut. Let's do smooth time, cut camera at start?
                    // Better: Apply target camera *after* transition to avoid dizzy motion? 
                    // Or keep camera static during transition?
                    // User complained "Camera doesn't move". So let's snap camera at the target frame.

                    for (let f = 0; f < TRANSITION_FRAMES; f++) {
                        const progress = f / TRANSITION_FRAMES;
                        const currentTime = prevTime + (targetTime - prevTime) * progress;

                        // We only interpolate time here. Camera stays at previous state until the cut or we interpolate?
                        // Let's just interpolate time.
                        await applyState(page, currentTime, null);

                        const framePath = path.join(tempDir, `frame_${frameIndex.toString().padStart(5, '0')}.png`);
                        if (elementHandle) {
                            await elementHandle.screenshot({ path: framePath, type: 'png' });
                        } else {
                            await page.screenshot({ path: framePath, type: 'png' });
                        }
                        frameIndex++;
                    }
                }

                // Set exact target time and Camera State
                await applyState(page, targetTime, cameraState);

                // Capture pause frames with overlay
                for (let f = 0; f < PAUSE_FRAMES; f++) {
                    const framePath = path.join(tempDir, `frame_${frameIndex.toString().padStart(5, '0')}.png`);
                    if (elementHandle) {
                        await elementHandle.screenshot({ path: framePath, type: 'png' });
                    } else {
                        await page.screenshot({ path: framePath, type: 'png' });
                    }
                    frameIndex++;
                }
            }

            console.log(`[Digest GIF] Captured ${frameIndex} frames total`);

            // Generate GIF with ffmpeg
            const gifFilename = `digest-${projectId}-${Date.now()}.gif`;
            const gifPath = path.join(outputDir, gifFilename);

            await new Promise((resolve, reject) => {
                ffmpeg()
                    .input(path.join(tempDir, 'frame_%05d.png'))
                    .inputFPS(FPS)
                    .outputOptions([
                        '-vf', 'scale=500:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer',
                        '-loop', '0'
                    ])
                    .output(gifPath)
                    .on('end', resolve)
                    .on('error', reject)
                    .run();
            });

            // Check file size and compress if needed
            const stats = fs.statSync(gifPath);
            const sizeInMo = stats.size / (1024 * 1024);
            console.log(`[Digest GIF] Generated GIF: ${gifPath} (${sizeInMo.toFixed(2)} Mo)`);

            if (sizeInMo > 8) {
                console.log('[Digest GIF] GIF too large, regenerating with lower quality');
                // Regenerate with smaller resolution
                const smallGifPath = path.join(outputDir, `digest-${projectId}-${Date.now()}-small.gif`);
                await new Promise((resolve, reject) => {
                    ffmpeg()
                        .input(path.join(tempDir, 'frame_%05d.png'))
                        .inputFPS(15) // Lower framerate
                        .outputOptions([
                            '-vf', 'scale=320:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=64[p];[s1][p]paletteuse=dither=bayer',
                            '-loop', '0'
                        ])
                        .output(smallGifPath)
                        .on('end', resolve)
                        .on('error', reject)
                        .run();
                });

                // Remove large GIF and use small one
                fs.unlinkSync(gifPath);
                fs.renameSync(smallGifPath, gifPath);
            }

            // Cleanup temp frames
            fs.rmSync(tempDir, { recursive: true, force: true });

            return gifPath;

        } catch (error) {
            console.error('[Digest GIF] Error:', error);
            return null;
        } finally {
            if (browser) await browser.close();
        }
    });
};

/**
 * Helper to apply state (Time and Camera)
 */
async function applyState(page, time, cameraState) {
    await page.evaluate((t, cam) => {
        // Try model-viewer first
        const mv = document.querySelector('model-viewer');
        if (mv) {
            if (mv.currentTime !== undefined) {
                mv.pause();
                mv.currentTime = t;
            }

            // Apply Camera State if provided
            if (cam) {
                if (cam.orbit) mv.cameraOrbit = cam.orbit;
                if (cam.target) mv.cameraTarget = cam.target;
                if (cam.fov) mv.fieldOfView = cam.fov;
                mv.jumpCameraToGoal(); // Instant jump
            }
            return;
        }

        // Try video element (just time)
        const video = document.querySelector('video');
        if (video) {
            video.pause();
            video.currentTime = t;
            return;
        }
    }, time, cameraState);

    // Wait for the frame to render/stabilize
    await new Promise(r => setTimeout(r, 100));
}

module.exports = { generateDigestGif };
