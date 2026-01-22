const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

// Concurrency Limit: 1 concurrent generation
const limit = require('p-limit')(1);

const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_ME_IN_PROD_PLEASE';
const DATA_PATH = process.env.DATA_PATH || path.join(__dirname, '..', 'storage');

// Default timing constants (will be overridden by DB settings)
const DEFAULT_FPS = 18;
const DEFAULT_TRANSITION = 1; // seconds
const DEFAULT_PAUSE = 2; // seconds

/**
 * Gets digest settings from SystemSettings and optionally Team
 * @param {number} teamId - Optional team ID for team-specific overrides
 */
async function getDigestSettings(teamId = null) {
    // Fetch all digest-related system settings
    const keys = [
        'digest_fps_max', 'digest_fps_default',
        'digest_transition_max', 'digest_transition_default',
        'digest_pause_max', 'digest_pause_default',
        'digest_width', 'digest_height'
    ];

    const systemSettings = await prisma.systemSetting.findMany({
        where: { key: { in: keys } }
    });

    const settings = {};
    systemSettings.forEach(s => settings[s.key] = parseFloat(s.value));

    // Apply defaults if not set
    const fpsMax = settings['digest_fps_max'] || 24;
    const fpsDefault = settings['digest_fps_default'] || DEFAULT_FPS;
    const transitionMax = settings['digest_transition_max'] || 3;
    const transitionDefault = settings['digest_transition_default'] || DEFAULT_TRANSITION;
    const pauseMax = settings['digest_pause_max'] || 10;
    const pauseDefault = settings['digest_pause_default'] || DEFAULT_PAUSE;

    let fps = fpsDefault;
    let transition = transitionDefault;
    let pause = pauseDefault;

    // Apply team-specific overrides if available
    if (teamId) {
        const team = await prisma.team.findUnique({
            where: { id: teamId },
            select: { digestFps: true, digestTransition: true, digestPause: true }
        });

        if (team) {
            if (team.digestFps != null) fps = Math.min(team.digestFps, fpsMax);
            if (team.digestTransition != null) transition = Math.min(team.digestTransition, transitionMax);
            if (team.digestPause != null) pause = Math.min(team.digestPause, pauseMax);
        }
    }

    // Resolution (default 1280x720)
    const width = parseInt(settings['digest_width']) || 1280;
    const height = parseInt(settings['digest_height']) || 720;

    return {
        fps: Math.round(fps),
        transition: transition * 1000, // Convert to ms
        pause: pause * 1000, // Convert to ms
        width,
        height,
        fpsMax, transitionMax, pauseMax
    };
}

/**
 * Gets the public URL from system settings
 */
async function getPublicUrl() {
    const setting = await prisma.systemSetting.findUnique({ where: { key: 'public_url' } });
    return setting ? setting.value.replace(/\/$/, '') : 'http://localhost:3000';
}

/**
 * Check if digest video generation is enabled
 */
async function isDigestVideoEnabled() {
    const setting = await prisma.systemSetting.findUnique({ where: { key: 'digest_video_enabled' } });
    // Default to true if not set
    return setting ? setting.value === 'true' : true;
}

/**
 * Build digest items from projects with comments
 * @param {Array} projectsWithComments - Projects containing comments to digest
 * @returns {Array} Formatted digest items
 */
function buildDigestItems(projectsWithComments) {
    return projectsWithComments.map(p => {
        // Get the first version with comments
        const version = p.versions?.find(v =>
            (v.comments && v.comments.length > 0) ||
            (v.images && v.images.some(img => img.comments?.length > 0))
        ) || p.versions?.[0];

        if (!version) return null;

        // Get comments based on type
        let comments = [];

        if (version.type === 'three_d_asset' || version.type === 'video') {
            comments = version.comments || [];
        } else if (version.type === 'image_bundle' && version.images) {
            // Flatten comments from all images
            version.images.forEach(img => {
                if (img.comments) {
                    comments.push(...img.comments.map(c => ({ ...c, imageId: img.id })));
                }
            });
        }

        // Filter: only root comments (exclude replies), sort by timestamp or date
        const rootComments = comments
            .filter(c => !c.parentId)
            .sort((a, b) => {
                if (a.timestamp != null && b.timestamp != null) {
                    return a.timestamp - b.timestamp;
                }
                return new Date(a.createdAt) - new Date(b.createdAt);
            });

        return {
            type: version.type === 'three_d_asset' ? '3d' :
                version.type === 'image_bundle' ? 'image' : 'video',
            assetPath: version.filename,
            projectId: p.id,
            projectName: p.name,
            comments: rootComments.map(c => ({
                id: c.id,
                content: c.content,
                timestamp: c.timestamp,
                cameraState: c.cameraState ? (typeof c.cameraState === 'string' ? JSON.parse(c.cameraState) : c.cameraState) : null,
                annotation: c.annotation ? (typeof c.annotation === 'string' ? JSON.parse(c.annotation) : c.annotation) : null,
                imageId: c.imageId,
                user: c.user
            }))
        };
    }).filter(Boolean);
}

/**
 * Generate a digest video from multiple assets and comments
 * @param {Array} digestItems - List of items to include in digest
 * @param {string} outputDir - Directory to save the video
 * @returns {Promise<string|null>} Path to generated WebM or null
 */
const generateDigestVideo = (digestItems, outputDir) => {
    return limit(async () => {
        // Check if feature is enabled globally
        const enabled = await isDigestVideoEnabled();
        if (!enabled) {
            console.log('[Digest Video] Feature disabled globally, skipping');
            return null;
        }

        // Check if feature is enabled for the team (if applicable)
        if (digestItems && digestItems.length > 0) {
            const firstProject = await prisma.project.findUnique({
                where: { id: digestItems[0].projectId },
                select: { team: { select: { digestVideoEnabled: true } } }
            });

            if (firstProject && firstProject.team && firstProject.team.digestVideoEnabled === false) {
                console.log('[Digest Video] Feature disabled for this team, skipping');
                return null;
            }
        }

        if (!digestItems || digestItems.length === 0) {
            console.log('[Digest Video] No items to digest');
            return null;
        }

        // Count total comments
        const totalComments = digestItems.reduce((sum, item) => sum + item.comments.length, 0);
        if (totalComments === 0) {
            console.log('[Digest Video] No comments to show');
            return null;
        }

        console.log(`[Digest Video] Generating video for ${digestItems.length} assets, ${totalComments} comments`);

        const publicUrl = await getPublicUrl();

        // Get any project's team for settings and auth
        const firstProject = await prisma.project.findUnique({
            where: { id: digestItems[0].projectId },
            include: { team: { include: { owner: true } } }
        });

        if (!firstProject) {
            console.error('[Digest Video] Project not found');
            return null;
        }

        // Fetch dynamic settings based on team
        const teamId = firstProject.team?.id || null;
        const digestSettings = await getDigestSettings(teamId);
        const FPS = digestSettings.fps;
        const TRANSITION_DURATION = digestSettings.transition;
        const PAUSE_DURATION = digestSettings.pause;
        const VIDEO_WIDTH = digestSettings.width;
        const VIDEO_HEIGHT = digestSettings.height;

        // console.log(`[Digest Video] Using settings: FPS=${FPS}, Transition=${TRANSITION_DURATION}ms, Pause=${PAUSE_DURATION}ms, Resolution=${VIDEO_WIDTH}x${VIDEO_HEIGHT}`);

        // Generate auth token
        const token = jwt.sign(
            { id: firstProject.team.owner.id, email: firstProject.team.owner.email, role: firstProject.team.owner.role || 'user' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Docker network fix
        let baseUrl = publicUrl;
        if (baseUrl.includes('localhost:3429')) {
            // console.log('[Digest Video] Detected Docker, rewriting URL');
            baseUrl = baseUrl.replace('localhost:3429', 'frontend');
        }

        const digestRenderUrl = `${baseUrl}/digest-render.html`;
        // console.log(`[Digest Video] Loading digest renderer: ${digestRenderUrl}`);

        const browser = await puppeteer.launch({
            executablePath: '/usr/bin/chromium',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--allow-file-access-from-files',
                '--enable-unsafe-swiftshader',
                '--disable-web-security'
            ],
            headless: 'new'
        });

        try {
            const page = await browser.newPage();
            // page.on('console', msg => console.log('[Puppeteer]:', msg.text()));

            // Dynamic viewport based on admin settings
            await page.setViewport({ width: VIDEO_WIDTH, height: VIDEO_HEIGHT });

            // Navigate to digest renderer (2 minute timeout for slow servers)
            await page.goto(digestRenderUrl, { waitUntil: 'networkidle2', timeout: 120000 });

            // Wait for script to load (2 minute timeout for slow CDN/servers)
            await page.waitForFunction(() => window.DigestRenderer !== undefined, { timeout: 120000 });

            // Create temp directory for frames
            const tempDir = path.join(outputDir, `temp_digest_${Date.now()}`);
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

            let frameIndex = 0;

            // Helper to wait for next frame render
            const waitForFrame = async () => {
                await page.evaluate(() => {
                    return new Promise(resolve => requestAnimationFrame(resolve));
                });
            };

            // Helper to capture frame
            const captureFrame = async () => {
                const framePath = path.join(tempDir, `frame_${frameIndex.toString().padStart(5, '0')}.png`);
                await page.screenshot({ path: framePath, type: 'png' });
                frameIndex++;
            };

            // Helper to capture multiple frames for duration with proper timing
            // allowAnimationControl: if true, controls DigestRenderer.updateAnnotationProgress
            const captureForDuration = async (durationMs, allowAnimationControl = false) => {
                const numFrames = Math.round((durationMs / 1000) * FPS);
                const frameInterval = durationMs / numFrames; // ms per frame

                // console.log(`[Digest Video] Capturing ${numFrames} frames over ${durationMs}ms`);

                for (let i = 0; i < numFrames; i++) {
                    // Update animation progress if requested (0 to 1 over first 1000ms of duration)
                    if (allowAnimationControl) {
                        const elapsed = i * frameInterval;
                        const progress = Math.min(elapsed / 1000, 1);
                        await page.evaluate((p) => {
                            if (window.DigestRenderer.updateAnnotationProgress) {
                                window.DigestRenderer.updateAnnotationProgress(p);
                            }
                        }, progress);
                    }

                    // Wait for next animation frame to sync with renderer
                    await waitForFrame();
                    // Capture the frame
                    await captureFrame();
                    // Wait the remaining time for this frame interval
                    await new Promise(r => setTimeout(r, Math.max(0, frameInterval - 16)));
                }
            };

            // Process each digest item
            for (const item of digestItems) {
                // console.log(`[Digest Video] Processing ${item.type} asset: ${item.projectName}`);

                const assetUrl = `${baseUrl}/api/media/${item.assetPath}`;

                // Load asset
                if (item.type === '3d') {
                    try {
                        await page.evaluate(async (src) => {
                            await window.DigestRenderer.load3D(src);
                        }, assetUrl);
                    } catch (err) {
                        console.error(`[Digest Video] Failed to load 3D model: ${assetUrl}`, err);
                        continue;
                    }

                    // Wait for model to load
                    await page.waitForFunction(() => {
                        const mv = document.getElementById('viewer-3d');
                        return mv && mv.loaded;
                    }, { timeout: 30000 });

                    // Fit to view intro
                    await page.evaluate(async () => {
                        await window.DigestRenderer.fitToView();
                    });
                    // WARMUP RENDERER (Wait for quality, but DO NOT capture static frames)
                    // Solves "bad quality" start and "static" start.
                    await new Promise(r => setTimeout(r, 1000));

                } else if (item.type === 'video') {
                    try {
                        await page.evaluate(async (src) => {
                            await window.DigestRenderer.loadVideo(src);
                        }, assetUrl);
                    } catch (err) {
                        console.error(`[Digest Video] Failed to load video: ${assetUrl}`, err);
                        continue;
                    }

                    // Intro at 0s
                    await page.evaluate(async () => {
                        await window.DigestRenderer.seekTo(0);
                    });
                    await new Promise(r => setTimeout(r, 1000)); // Warmup

                } else if (item.type === 'image') {
                    // For images, use first image
                    try {
                        await page.evaluate(async (src) => {
                            await window.DigestRenderer.loadImage(src);
                        }, assetUrl);
                    } catch (err) {
                        console.error(`[Digest Video] Failed to load image: ${assetUrl}`, err);
                        // Skip this asset, as we can't render it
                        continue;
                    }
                    await new Promise(r => setTimeout(r, 1000)); // Warmup
                }

                // Process each comment
                for (let i = 0; i < item.comments.length; i++) {
                    const comment = item.comments[i];
                    // console.log(`[Digest Video] Comment ${i + 1}/${item.comments.length}: "${comment.content?.substring(0, 30)}..."`);

                    // MANUAL TRANSITION LOOP: Manual Camera Interpolation & Opacity Control

                    const TRANSITION_MS = TRANSITION_DURATION;
                    const HIDE_DURATION = 300;
                    const SHOW_DELAY = 400;
                    const SHOW_DURATION = 500;
                    const ANNO_START_TIME = 800;

                    const numFrames = Math.round((TRANSITION_MS / 1000) * FPS);
                    const frameInterval = TRANSITION_MS / numFrames;

                    // Get Start Camera State
                    let startCameraState = null;
                    if (item.type === '3d') {
                        startCameraState = await page.evaluate(() => window.DigestRenderer.getCameraState());
                    }

                    // Parse End Camera State
                    let endCameraState = null;
                    if (item.type === '3d' && comment.cameraState) {
                        try {
                            endCameraState = typeof comment.cameraState === 'string' ? JSON.parse(comment.cameraState) : comment.cameraState;
                        } catch (e) { /* ignore */ }
                    }

                    // Interpolation Helpers
                    const parseOrbit = (str) => {
                        if (!str) return null;
                        const parts = str.split(' ');
                        return {
                            theta: parseFloat(parts[0].replace('rad', '')),
                            phi: parseFloat(parts[1].replace('rad', '')),
                            radius: parseFloat(parts[2].replace('m', ''))
                        };
                    };
                    const parseTarget = (str) => {
                        if (!str) return null;
                        const parts = str.split(' ');
                        return {
                            x: parseFloat(parts[0].replace('m', '')),
                            y: parseFloat(parts[1].replace('m', '')),
                            z: parseFloat(parts[2].replace('m', ''))
                        };
                    };
                    const lerp = (a, b, t) => a + (b - a) * t;
                    const easeInOutCubic = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

                    // console.log(`[Digest Video] Transitioning... (${numFrames} frames)`);

                    if (startCameraState && endCameraState) {
                        try {
                            // console.log(`[Digest Video] Camera Transition: Start=${JSON.stringify(startCameraState.orbit)} End=${JSON.stringify(endCameraState.orbit || endCameraState)}`);
                        } catch (e) { }
                    }

                    // Loop Frames
                    for (let f = 0; f < numFrames; f++) {
                        const elapsed = f * frameInterval;
                        const linearT = f / numFrames;
                        const t = easeInOutCubic(linearT);

                        // 1. Animation Timestamp Interpolation (Continuous Scrub)
                        let currentTimestamp = null;
                        if (comment.timestamp != null) {
                            // Determine start time (previous comment's timestamp or 0)
                            const prevTimestamp = (i > 0 && item.comments[i - 1] && item.comments[i - 1].timestamp != null)
                                ? item.comments[i - 1].timestamp
                                : 0;

                            // Interpolate Time
                            currentTimestamp = lerp(prevTimestamp, comment.timestamp, t);
                        }

                        // Apply Timestamp
                        if (currentTimestamp !== null) {
                            if (item.type === '3d') {
                                await page.evaluate((ts) => window.DigestRenderer.seek3DAnimation(ts), currentTimestamp);
                            } else if (item.type === 'video') {
                                await page.evaluate((ts) => window.DigestRenderer.seekTo(ts), currentTimestamp);
                            }
                        }

                        // 2. Camera Interpolation (Manual with Cubic Easing + FOV)
                        if (item.type === '3d' && startCameraState && endCameraState) {
                            // Interpolate Orbit
                            let startOrbit = startCameraState.orbit;
                            let endOrbit = endCameraState.orbit;
                            if (typeof endOrbit === 'string') endOrbit = parseOrbit(endOrbit);

                            let currentOrbit = null;
                            if (startOrbit && endOrbit) {
                                currentOrbit = {
                                    theta: lerp(startOrbit.theta, endOrbit.theta, t),
                                    phi: lerp(startOrbit.phi, endOrbit.phi, t),
                                    radius: lerp(startOrbit.radius, endOrbit.radius, t)
                                };
                            }

                            // Interpolate Target
                            let startTarget = startCameraState.target;
                            let endTarget = endCameraState.target;
                            if (typeof endTarget === 'string') endTarget = parseTarget(endTarget);

                            let currentTarget = null;
                            if (startTarget && endTarget) {
                                currentTarget = {
                                    x: lerp(startTarget.x, endTarget.x, t),
                                    y: lerp(startTarget.y, endTarget.y, t),
                                    z: lerp(startTarget.z, endTarget.z, t)
                                };
                            }

                            // Interolate FOV (Crucial for framing/zoom)
                            let startFov = startCameraState.fov;
                            let endFov = endCameraState.fov;

                            const parseFov = (val) => {
                                if (val === 'auto' || val == null) return 45; // Default fallback
                                return parseFloat(val);
                            };

                            let currentFov = null;
                            if (startFov != null || endFov != null) {
                                const sF = parseFov(startFov);
                                const eF = parseFov(endFov);
                                currentFov = lerp(sF, eF, t);
                            }

                            // Apply
                            if (currentOrbit || currentTarget || currentFov) {
                                const stateToSet = {};
                                if (currentOrbit) stateToSet.orbit = currentOrbit;
                                if (currentTarget) stateToSet.target = currentTarget;
                                if (currentFov) stateToSet.fov = currentFov;

                                await page.evaluate((s) => window.DigestRenderer.setCameraState(s, false), stateToSet);
                            }
                        }

                        // 3. Opacity Control (Old / New)
                        const prevComment = i > 0 ? item.comments[i - 1] : null;

                        // Fade Out Previous
                        // Fade Out Previous
                        if (prevComment && elapsed < HIDE_DURATION) {
                            const opacity = Math.max(0, 1 - (elapsed / HIDE_DURATION));
                            const u = { name: prevComment.user?.name || 'Reviewer', avatarPath: prevComment.user?.avatarPath ? `${baseUrl}/api/media/avatars/${prevComment.user.avatarPath}` : null };
                            await page.evaluate((u, c, o) => {
                                window.DigestRenderer.showComment(u, c, o);
                                if (window.DigestRenderer.setAnnotationOpacity) {
                                    window.DigestRenderer.setAnnotationOpacity(o);
                                }
                            }, u, prevComment.content?.substring(0, 150), opacity);
                        } else if (elapsed >= HIDE_DURATION && elapsed < SHOW_DELAY) {
                            await page.evaluate(() => {
                                window.DigestRenderer.showComment(null, null, 0);
                                if (window.DigestRenderer.setAnnotationOpacity) window.DigestRenderer.setAnnotationOpacity(0);
                            });
                        }

                        // Show New
                        if (elapsed >= SHOW_DELAY) {
                            const opacity = Math.min((elapsed - SHOW_DELAY) / SHOW_DURATION, 1);
                            const u = { name: comment.user?.name || 'Reviewer', avatarPath: comment.user?.avatarPath ? `${baseUrl}/api/media/avatars/${comment.user.avatarPath}` : null };
                            await page.evaluate((u, c, o) => {
                                window.DigestRenderer.showComment(u, c, o);
                                if (window.DigestRenderer.setAnnotationOpacity) {
                                    window.DigestRenderer.setAnnotationOpacity(1);
                                }
                            }, u, comment.content?.substring(0, 150), opacity);
                        }

                        // 4. Annotation
                        if (comment.annotation) {
                            if (f === 0 || (elapsed >= ANNO_START_TIME && (elapsed - frameInterval) < ANNO_START_TIME)) {
                                await page.evaluate((annotation) => {
                                    if (window.DigestRenderer.setAnnotationOpacity) window.DigestRenderer.setAnnotationOpacity(1);
                                    window.DigestRenderer.drawAnnotation(annotation);
                                    if (window.DigestRenderer.updateAnnotationProgress) {
                                        window.DigestRenderer.updateAnnotationProgress(0);
                                    }
                                }, comment.annotation);
                            }
                        }

                        if (comment.annotation && elapsed >= ANNO_START_TIME) {
                            const annoProgress = Math.min((elapsed - ANNO_START_TIME) / 1000, 1);
                            await page.evaluate((p) => {
                                if (window.DigestRenderer.updateAnnotationProgress) {
                                    window.DigestRenderer.updateAnnotationProgress(p);
                                }
                            }, annoProgress);
                        }

                        // Wait & Capture
                        await waitForFrame();
                        await captureFrame();
                        await new Promise(r => setTimeout(r, Math.max(0, frameInterval - 16)));
                    }

                    // Continue animation during Pause Phase (Manual Loop)
                    const PAUSE_MS = PAUSE_DURATION;
                    const pauseFrames = Math.round((PAUSE_MS / 1000) * FPS);
                    const pauseInterval = PAUSE_MS / pauseFrames;
                    const TRANSITION_MS_TOTAL = 1500;
                    const ANNO_START_TIME_TOTAL = 800;
                    const ANNO_DURATION = 1000;
                    const ANNO_END_TIME = ANNO_START_TIME_TOTAL + ANNO_DURATION; // 1800ms

                    for (let p = 0; p < pauseFrames; p++) {
                        const totalElapsed = TRANSITION_MS_TOTAL + (p * pauseInterval);

                        // Check if animation is totally finished (Static Phase: > 1800ms)
                        // If finished, duplicate last frame
                        const isStatic = totalElapsed > ANNO_END_TIME;

                        if (isStatic && p > 0) {
                            // OPTIMIZATION: Duplicate last frame
                            const lastFramePath = path.join(tempDir, `frame_${(frameIndex - 1).toString().padStart(5, '0')}.png`);
                            const newFramePath = path.join(tempDir, `frame_${frameIndex.toString().padStart(5, '0')}.png`);
                            try {
                                fs.copyFileSync(lastFramePath, newFramePath);
                                frameIndex++;
                                await new Promise(r => setTimeout(r, 1));
                            } catch (e) {
                                console.error('[Digest Video] Optimization copy failed, fallback to capture', e);
                                await captureFrame();
                            }
                        } else {
                            if (comment.annotation) {
                                const prog = Math.min((totalElapsed - ANNO_START_TIME_TOTAL) / 1000, 1);
                                await page.evaluate((prog) => {
                                    if (window.DigestRenderer.updateAnnotationProgress) window.DigestRenderer.updateAnnotationProgress(prog);
                                }, prog);
                            }
                            await waitForFrame();
                            await captureFrame();
                            await new Promise(r => setTimeout(r, Math.max(0, pauseInterval - 16)));
                        }
                    }

                    // Clear annotation
                    if (comment.annotation) await page.evaluate(() => window.DigestRenderer.clearAnnotation());
                }

                // Hide comment overlay between assets
                await page.evaluate(() => {
                    window.DigestRenderer.showComment(null, null);
                });
            }

            // console.log(`[Digest Video] Captured ${frameIndex} frames total`);

            // Generate WebM with ffmpeg
            const videoFilename = `digest-${Date.now()}.webm`;
            const videoPath = path.join(outputDir, videoFilename);

            // Calculate optimal bitrate/resolution dynamically
            const totalDurationSec = frameIndex / FPS;
            const targetSizeBytes = 7 * 1024 * 1024; // 7MB
            const maxBitrateBits = (targetSizeBytes * 8) / totalDurationSec;

            // Cap at 8Mbps, minimum 500kbps
            let targetBitrate = Math.min(Math.max(maxBitrateBits, 500000), 8000000);

            // Format for ffmpeg (e.g. "2M", "500k")
            const bitrateString = `${Math.floor(targetBitrate / 1000)}k`;

            // console.log(`[Digest Video] Estimated duration: ${totalDurationSec.toFixed(2)}s, Target Max Bitrate: ${bitrateString}`);

            await new Promise((resolve, reject) => {
                ffmpeg()
                    .input(path.join(tempDir, 'frame_%05d.png'))
                    .inputFPS(FPS)
                    .outputOptions([
                        '-c:v', 'libvpx-vp9',
                        '-crf', '20',         // Quality factor
                        '-b:v', bitrateString,// Dynamic bitrate
                        '-pix_fmt', 'yuv420p',
                        '-an'                 // No audio
                    ])
                    .output(videoPath)
                    .on('end', resolve)
                    .on('error', reject)
                    .run();
            });

            // Check file size
            const stats = fs.statSync(videoPath);
            const sizeInMb = stats.size / (1024 * 1024);
            console.log(`[Digest Video] Generated: ${videoPath} (${sizeInMb.toFixed(2)} MB)`);

            // If too large, regenerate with lower quality
            if (sizeInMb > 8) {
                console.log('[Digest Video] File too large, regenerating with lower quality');
                const smallVideoPath = path.join(outputDir, `digest-${Date.now()}-small.webm`);

                await new Promise((resolve, reject) => {
                    ffmpeg()
                        .input(path.join(tempDir, 'frame_%05d.png'))
                        .inputFPS(15) // Lower framerate
                        .outputOptions([
                            '-c:v', 'libvpx-vp9',
                            '-crf', '50',
                            '-b:v', '500k',
                            '-vf', 'scale=480:-1',
                            '-an'
                        ])
                        .output(smallVideoPath)
                        .on('end', resolve)
                        .on('error', reject)
                        .run();
                });

                fs.unlinkSync(videoPath);
                fs.renameSync(smallVideoPath, videoPath);
            }

            // Cleanup temp frames (Safe Mode)
            try {
                // Wait for file locks to release (Windows/Docker fix)
                await new Promise(r => setTimeout(r, 500));
                fs.rmSync(tempDir, { recursive: true, force: true });
            } catch (cleanupErr) {
                console.warn('[Digest Video] Warning: Failed to clean up temp dir (non-critical):', cleanupErr.message);
            }

            return videoPath;

        } catch (error) {
            console.error('[Digest Video] Error:', error);
            return null;
        } finally {
            if (browser) await browser.close();
        }
    });
};

module.exports = {
    generateDigestVideo,
    buildDigestItems
};
