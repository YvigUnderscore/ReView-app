/**
 * Digest Render Script
 * Controls the minimal page for rendering digest videos
 * Receives commands via postMessage from Puppeteer
 */

(function () {
    // Initial safe definition to satisfy backend wait check immediately
    // Real methods will be attached later, or we catch the error.
    window.DigestRenderer = window.DigestRenderer || {};

    try {
        // Elements
        const viewer3D = document.getElementById('viewer-3d');
        const viewerVideo = document.getElementById('viewer-video');
        const viewerImage = document.getElementById('viewer-image');
        const annotationCanvas = document.getElementById('annotation-canvas');
        const loadingEl = document.getElementById('loading');
        const commentOverlay = document.getElementById('comment-overlay');

        const ctx = annotationCanvas.getContext('2d');

        // State
        let currentType = null;
        let isReady = false;

        // Resize canvas to match container (1280x720)
        function resizeCanvas() {
            annotationCanvas.width = 1280;
            annotationCanvas.height = 720;
        }
        resizeCanvas();

        // Hide all viewers
        function hideAllViewers() {
            viewer3D.style.display = 'none';
            viewerVideo.style.display = 'none';
            viewerImage.style.display = 'none';
        }

        // Show loading
        function showLoading(show) {
            loadingEl.style.display = show ? 'block' : 'none';
        }

        // Show comment overlay with user info (liquid glass style)
        // opacity: if provided (0-1), sets manual opacity and disables transition for frame-by-frame rendering
        function showComment(userData, commentText, opacity = null) {
            if (userData && commentText) {
                const avatarEl = commentOverlay.querySelector('.avatar');
                const initialsEl = commentOverlay.querySelector('.initials');
                const avatarImg = commentOverlay.querySelector('.avatar-img');
                const userNameEl = commentOverlay.querySelector('.user-name');
                const commentTextEl = commentOverlay.querySelector('.comment-text');

                // Set user name
                userNameEl.textContent = userData.name || 'Reviewer';

                // Set avatar
                if (userData.avatarPath) {
                    avatarImg.src = userData.avatarPath;
                    avatarImg.style.display = 'block';
                    initialsEl.style.display = 'none';
                } else {
                    // Show initials
                    const initials = (userData.name || 'R').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                    initialsEl.textContent = initials;
                    initialsEl.style.display = 'block';
                    avatarImg.style.display = 'none';
                }

                // Set comment text
                commentTextEl.textContent = commentText;

                // Show with animation or manual opacity
                commentOverlay.style.display = 'flex';

                if (opacity !== null) {
                    // Manual control
                    commentOverlay.style.transition = 'none';
                    commentOverlay.style.opacity = opacity;
                    commentOverlay.classList.remove('visible'); // Remove class to avoid conflict, rely on inline opacity
                } else {
                    // Automatic CSS transition
                    commentOverlay.style.transition = '';
                    commentOverlay.style.opacity = '';
                    // Force reflow for animation
                    commentOverlay.offsetHeight;
                    commentOverlay.classList.add('visible');
                }
            } else {
                if (opacity !== null) {
                    // Manual hide
                    commentOverlay.style.transition = 'none';
                    commentOverlay.style.opacity = opacity; // likely 0
                    if (opacity <= 0.01) commentOverlay.style.display = 'none';
                } else {
                    // Hide with animation
                    commentOverlay.classList.remove('visible');
                    setTimeout(() => {
                        commentOverlay.style.display = 'none';
                    }, 300);
                }
            }
        }

        // Legacy function for compatibility
        function showProjectInfo(name, comment) {
            showComment({ name: name }, comment);
        }

        // Get current camera state (for manual interpolation on backend)
        function getCameraState() {
            if (currentType !== '3d' || !viewer3D) {
                return null;
            }
            // ModelViewer methods return values
            // cameraOrbit: { theta: number(rad), phi: number(rad), radius: number(m) }
            // cameraTarget: { x: number, y: number, z: number }
            // fieldOfView: number (deg)
            return {
                orbit: viewer3D.getCameraOrbit(),
                target: viewer3D.getCameraTarget(),
                fov: viewer3D.getFieldOfView()
            };
        }

        // Wait for model-viewer custom element to be defined (async loading)
        async function waitForModelViewer(timeoutMs = 15000) {
            if (customElements.get('model-viewer')) return;

            const start = Date.now();
            while (!customElements.get('model-viewer')) {
                if (Date.now() - start > timeoutMs) {
                    throw new Error('model-viewer component did not load within timeout');
                }
                await new Promise(r => setTimeout(r, 100));
            }
            console.log('[DigestRenderer] model-viewer ready');
        }

        // Load 3D asset
        async function load3D(src) {
            // Ensure model-viewer is loaded before trying to use it
            await waitForModelViewer();

            return new Promise((resolve, reject) => {
                hideAllViewers();
                currentType = '3d';

                viewer3D.src = src;
                viewer3D.style.display = 'block';

                const onLoad = () => {
                    viewer3D.removeEventListener('load', onLoad);
                    viewer3D.removeEventListener('error', onError);
                    showLoading(false);

                    // Play first available animation if any
                    const animations = viewer3D.availableAnimations;
                    if (animations && animations.length > 0) {
                        console.log('[DigestRenderer] Playing animation:', animations[0]);
                        viewer3D.animationName = animations[0];
                        viewer3D.play();
                    }

                    resolve();
                };

                const onError = (e) => {
                    viewer3D.removeEventListener('load', onLoad);
                    viewer3D.removeEventListener('error', onError);
                    reject(e);
                };

                viewer3D.addEventListener('load', onLoad);
                viewer3D.addEventListener('error', onError);
            });
        }

        // Seek 3D animation to specific time
        async function seek3DAnimation(timestamp) {
            if (currentType !== '3d') return;

            // Pause animation and seek to timestamp
            viewer3D.pause();
            viewer3D.currentTime = timestamp;
            console.log('[DigestRenderer] Seeking animation to:', timestamp);
        }

        // Load video
        async function loadVideo(src) {
            return new Promise((resolve, reject) => {
                hideAllViewers();
                currentType = 'video';

                viewerVideo.src = src;
                viewerVideo.style.display = 'block';

                const onLoaded = () => {
                    viewerVideo.removeEventListener('loadeddata', onLoaded);
                    viewerVideo.removeEventListener('error', onError);
                    showLoading(false);
                    resolve();
                };

                const onError = (e) => {
                    viewerVideo.removeEventListener('loadeddata', onLoaded);
                    viewerVideo.removeEventListener('error', onError);
                    reject(e);
                };

                viewerVideo.addEventListener('loadeddata', onLoaded);
                viewerVideo.addEventListener('error', onError);
            });
        }

        // Load image
        async function loadImage(src) {
            return new Promise((resolve, reject) => {
                hideAllViewers();
                currentType = 'image';

                viewerImage.src = src;
                viewerImage.style.display = 'block';

                viewerImage.onload = () => {
                    showLoading(false);
                    resolve();
                };

                viewerImage.onerror = reject;
            });
        }

        // Set 3D camera state - matches ModelViewer.jsx logic exactly
        async function setCameraState(state, animate = true) {
            if (currentType !== '3d' || !state) {
                console.log('[DigestRenderer] setCameraState: skipped (type=' + currentType + ')');
                return;
            }

            console.log('[DigestRenderer] setCameraState:', JSON.stringify(state));

            // Parse state if it's a string
            let parsedState = state;
            if (typeof state === 'string') {
                try {
                    parsedState = JSON.parse(state);
                } catch (e) {
                    console.error('[DigestRenderer] Failed to parse camera state:', e);
                    return;
                }
            }

            // Enable smooth camera transition (higher = slower)
            // Default is 600ms. 300ms gives a nice ~1s transition.
            const originalDecay = viewer3D.interpolationDecay;
            viewer3D.interpolationDecay = animate ? 300 : 0;

            // Apply orbit
            if (parsedState.orbit) {
                if (typeof parsedState.orbit === 'object' && parsedState.orbit.theta !== undefined) {
                    viewer3D.cameraOrbit = `${parsedState.orbit.theta}rad ${parsedState.orbit.phi}rad ${parsedState.orbit.radius}m`;
                } else {
                    viewer3D.cameraOrbit = parsedState.orbit;
                }
            }

            // Apply target
            if (parsedState.target) {
                if (typeof parsedState.target === 'object' && parsedState.target.x !== undefined) {
                    viewer3D.cameraTarget = `${parsedState.target.x}m ${parsedState.target.y}m ${parsedState.target.z}m`;
                } else {
                    viewer3D.cameraTarget = parsedState.target;
                }
            }

            // Apply FOV
            if (parsedState.fov) {
                if (typeof parsedState.fov === 'number') {
                    viewer3D.fieldOfView = `${parsedState.fov}deg`;
                } else {
                    viewer3D.fieldOfView = parsedState.fov;
                }
            }

            console.log('[DigestRenderer] Camera set to:', viewer3D.cameraOrbit, viewer3D.cameraTarget, viewer3D.fieldOfView);

            // Note: We don't wait here - the caller (Puppeteer) will capture frames
            // during the transition period. The interpolation happens automatically
            // over ~1 second with interpolationDecay=50.
        }

        // Fit to view for 3D
        async function fitToView() {
            if (currentType !== '3d') return;

            // Reset to default camera
            viewer3D.cameraOrbit = 'auto auto auto';
            viewer3D.cameraTarget = 'auto auto auto';
            viewer3D.fieldOfView = 'auto';

            await sleep(500);
        }

        // Seek video to timestamp
        async function seekTo(timestamp) {
            if (currentType !== 'video') return;

            viewerVideo.currentTime = timestamp;

            // Wait for seek to complete
            await new Promise(resolve => {
                const onSeeked = () => {
                    viewerVideo.removeEventListener('seeked', onSeeked);
                    resolve();
                };
                viewerVideo.addEventListener('seeked', onSeeked);
            });
        }

        // Stored annotation for animation
        let currentAnnotationData = null;

        // Manual animation progress update (0 to 1)
        function updateAnnotationProgress(progress) {
            if (currentAnnotationData) {
                drawShape(ctx, currentAnnotationData, progress);
            }
        }

        // Exact port of ModelViewer.jsx drawShape logic
        function drawShape(ctx, shape, progress = 1) {
            ctx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);

            // Handle shapes array or single shape
            const shapes = shape.shapes || (Array.isArray(shape) ? shape : [shape]);

            shapes.forEach(startShape => {
                // Apply logic for each sub-shape
                _drawSingleShape(ctx, startShape, progress, shape.aspectRatio);
            });
        }

        // Helper for single shape drawing with exact logic
        function _drawSingleShape(ctx, shape, progress, containerAspectRatio) {
            ctx.beginPath();
            ctx.strokeStyle = shape.color || '#ef4444';

            const canvas = ctx.canvas;
            const w = canvas.width;
            const h = canvas.height;
            const currentAspect = w / h;

            // Calculate scale correction based on Aspect Ratio regimes
            let scaleX = 1;
            let scaleY = 1;

            // Use container aspect ratio if provided (from the parent annotation object) or shape's own
            const savedAspect = containerAspectRatio || shape.aspectRatio;

            if (savedAspect) {
                const isSavedLandscape = savedAspect > 1;
                const isCurrentLandscape = currentAspect > 1;

                if (isSavedLandscape && isCurrentLandscape) {
                    // Both Landscape: Fixed VFOV. Scale X only.
                    scaleX = savedAspect / currentAspect;
                    scaleY = 1;
                } else if (!isSavedLandscape && !isCurrentLandscape) {
                    // Both Portrait: Fixed HFOV. Scale Y only.
                    scaleX = 1;
                    scaleY = currentAspect / savedAspect;
                } else if (isSavedLandscape && !isCurrentLandscape) {
                    // Landscape -> Portrait.
                    scaleX = savedAspect;
                    scaleY = currentAspect;
                } else if (!isSavedLandscape && isCurrentLandscape) {
                    // Portrait -> Landscape.
                    scaleX = 1 / currentAspect;
                    scaleY = 1 / savedAspect;
                }
            }

            const scaleFactor = Math.max((currentAspect > 1 ? h : w) / 1080, 0.5);
            const width = shape.strokeWidth || 5;
            const baseWidth = shape.tool === 'highlighter' ? width * 3 : width;
            ctx.lineWidth = baseWidth * scaleFactor;

            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalAlpha = shape.tool === 'highlighter' ? 0.4 : 1.0;
            ctx.fillStyle = shape.color || '#ef4444';

            const isNormalized = (val) => val <= 1.5;

            const getCoord = (sx, sy) => {
                let x = sx;
                let y = sy;

                // Apply Aspect Ratio Correction
                if (scaleX !== 1) x = (x - 0.5) * scaleX + 0.5;
                if (scaleY !== 1) y = (y - 0.5) * scaleY + 0.5;

                // Check if normalized (checking first point usually works)
                if (shape.isNormalized || (shape.points && shape.points.length > 0 && isNormalized(shape.points[0].x))) {
                    return { x: x * w, y: y * h };
                }
                return { x: sx, y: sy };
            };

            const shapeType = shape.tool || shape.type;

            if (shapeType === 'pencil' || shapeType === 'freehand' || shapeType === 'highlighter' || shapeType === 'eraser') {
                if (!shape.points || shape.points.length < 2) return;

                // Progressive drawing based on points count
                const totalPoints = shape.points.length;

                // HIDE if progress is 0 (Fix "dots" visible before animation)
                if (progress <= 0) return;

                const drawCount = Math.max(2, Math.floor(totalPoints * progress));

                const p0 = getCoord(shape.points[0].x, shape.points[0].y);
                ctx.moveTo(p0.x, p0.y);
                for (let i = 1; i < drawCount; i++) {
                    const pi = getCoord(shape.points[i].x, shape.points[i].y);
                    ctx.lineTo(pi.x, pi.y);
                }
                ctx.stroke();
            } else {
                // Primitive shapes
                const p = getCoord(shape.x || shape.start?.x || 0, shape.y || shape.start?.y || 0);

                // Calculate dimensions
                let dimW = shape.w;
                let dimH = shape.h;

                // Handle start/end based shapes
                if (shape.start && shape.end) {
                    const start = getCoord(shape.start.x, shape.start.y);
                    const end = getCoord(shape.end.x, shape.end.y);
                    // For primitives we need width/height relative to start
                    // But simplified logic uses getCoord on x/y
                    // Let's stick to start/end logic converted to x/y/w/h for consistency with ModelViewer logic structure
                    // ModelViewer uses shape.x/y/w/h. We need to adapt if we receive start/end.
                    // However, ModelViewer's drawShape assumes x/y/w/h are pre-calculated or normalized.
                    // Our data has start/end.

                    // Re-calculating properly for start/end based inputs
                    // The getCoord handles scaling on POINTs.
                    // Distance between points also needs scaling if we use w/h.
                    // Better to use start/end points directly if possible.
                    // But the ModelViewer code used in reference: `const dims = { w: shape.w * w * scaleX, h: shape.h * h * scaleY };`

                    // Let's adapt start/end to p/dims logic:
                    // We shouldn't use shape.start/end directly if we want to follow ModelViewer structure,
                    // BUT ModelViewer code I saw used separate logic for start/end wasn't fully visible for primitives?
                    // Ah, line 1245: `ctx.strokeRect(p.x, p.y, dims.w, dims.h);`
                    // So it expects x,y,w,h.

                    // If we have start/end, we convert:
                    // But start/end are normalized.
                    // So p1 = getCoord(start), p2 = getCoord(end).
                    // w = p2.x - p1.x, h = p2.y - p1.y.
                    // This automatically includes scaleX/scaleY application!

                    const p1 = getCoord(shape.start.x, shape.start.y);
                    const p2 = getCoord(shape.end.x, shape.end.y);
                    p.x = p1.x; // Override p
                    p.y = p1.y;
                    dimW = (p2.x - p1.x) / (w * scaleX); // Reverse scaleX to match "dims.w * w * scaleX" logic?
                    // No, simpler: just use p1, p2 directly.
                    // But I must follow the animation logic which uses dims.

                    // HACK: calculate raw pixel dimensions
                    const pixelW = p2.x - p1.x;
                    const pixelH = p2.y - p1.y;

                    // Mock dims object that results in pixelW/pixelH when multiplied
                    // dims.w * w * scaleX = pixelW => dims.w = pixelW / (w * scaleX)
                    // This seems complicated.
                    // Let's just USE pixelW/pixelH directly and remove the multiplier in drawing code below.
                    var directDims = { w: pixelW, h: pixelH };
                } else {
                    var directDims = { w: shape.w * w * scaleX, h: shape.h * h * scaleY };
                }

                const dims = directDims; // Use calculated pixel dimensions

                if (shapeType === 'rectangle' || shapeType === 'rect') {
                    if (progress < 1) {
                        const perimeter = 2 * (Math.abs(dims.w) + Math.abs(dims.h));
                        ctx.setLineDash([perimeter * progress, perimeter]);
                    }
                    ctx.strokeRect(p.x, p.y, dims.w, dims.h);
                    ctx.setLineDash([]);
                } else if (shapeType === 'circle' || shapeType === 'ellipse') {
                    if (progress < 1) {
                        ctx.beginPath();
                        ctx.ellipse(p.x + dims.w / 2, p.y + dims.h / 2, Math.abs(dims.w / 2), Math.abs(dims.h / 2), 0, 0, 2 * Math.PI * progress);
                        ctx.stroke();
                    } else {
                        ctx.beginPath();
                        ctx.ellipse(p.x + dims.w / 2, p.y + dims.h / 2, Math.abs(dims.w / 2), Math.abs(dims.h / 2), 0, 0, 2 * Math.PI);
                        ctx.stroke();
                    }
                } else if (shapeType === 'arrow') {

                    const lineProgress = Math.min(progress * 1.2, 1);
                    const headProgress = Math.max((progress - 0.8) * 5, 0);

                    const tox = p.x + dims.w * lineProgress;
                    const toy = p.y + dims.h * lineProgress;

                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(tox, toy);
                    ctx.stroke();

                    if (headProgress > 0) {
                        const fullTox = p.x + dims.w;
                        const fullToy = p.y + dims.h;
                        const headlen = width * 3 * scaleFactor * headProgress;
                        const angle = Math.atan2(dims.h, dims.w);

                        ctx.beginPath();
                        ctx.moveTo(fullTox, fullToy);
                        ctx.lineTo(fullTox - headlen * Math.cos(angle - Math.PI / 6), fullToy - headlen * Math.sin(angle - Math.PI / 6));
                        ctx.moveTo(fullTox, fullToy);
                        ctx.lineTo(fullTox - headlen * Math.cos(angle + Math.PI / 6), fullToy - headlen * Math.sin(angle + Math.PI / 6));
                        ctx.stroke();
                    }
                } else if (shapeType === 'text') {
                    ctx.globalAlpha = progress;
                    ctx.font = `${(width * 3) * scaleFactor}px sans-serif`;
                    ctx.fillText(shape.text || 'Text', p.x, p.y);
                }
            }

            ctx.globalAlpha = 1.0;
            ctx.globalCompositeOperation = 'source-over';
        }

        // Set annotation (don't draw immediately, wait for progress update or draw with 0)
        function drawAnnotation(annotation) {
            currentAnnotationData = annotation;
            // Draw initial state (hidden / progress 0)
            drawShape(ctx, annotation, 0);
        }

        // Clear annotation canvas
        function clearAnnotation() {
            currentAnnotationData = null;
            ctx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
        }

        // Sleep helper
        function sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        // Message handler for Puppeteer communication
        window.addEventListener('message', async (event) => {
            const { action, data } = event.data;

            try {
                switch (action) {
                    case 'load3D':
                        await load3D(data.src);
                        window.postMessage({ action: 'loaded', type: '3d' }, '*');
                        break;

                    case 'loadVideo':
                        await loadVideo(data.src);
                        window.postMessage({ action: 'loaded', type: 'video' }, '*');
                        break;

                    case 'loadImage':
                        await loadImage(data.src);
                        window.postMessage({ action: 'loaded', type: 'image' }, '*');
                        break;

                    case 'setCameraState':
                        await setCameraState(data.state, data.animate !== false);
                        window.postMessage({ action: 'cameraSet' }, '*');
                        break;

                    case 'fitToView':
                        await fitToView();
                        window.postMessage({ action: 'fitDone' }, '*');
                        break;

                    case 'seekTo':
                        await seekTo(data.timestamp);
                        window.postMessage({ action: 'seekDone' }, '*');
                        break;

                    case 'drawAnnotation':
                        drawAnnotation(data.annotation);
                        window.postMessage({ action: 'annotationDrawn' }, '*');
                        break;

                    case 'clearAnnotation':
                        clearAnnotation();
                        window.postMessage({ action: 'annotationCleared' }, '*');
                        break;

                    case 'showProjectInfo':
                        showProjectInfo(data.name, data.comment);
                        break;

                    case 'hideProjectInfo':
                        showProjectInfo(null);
                        break;

                    case 'setAnnotationOpacity':
                        setAnnotationOpacity(data.opacity);
                        break;

                    case 'ready':
                        isReady = true;
                        showLoading(false);
                        window.postMessage({ action: 'ready' }, '*');
                        break;
                }
            } catch (error) {
                console.error('Digest render error:', error);
                window.postMessage({ action: 'error', error: error.message }, '*');
            }
        });

        // Expose functions globally for direct Puppeteer evaluate calls
        window.DigestRenderer = {
            load3D,
            loadVideo,
            loadImage,
            setCameraState,
            getCameraState,
            fitToView,
            seekTo,
            seek3DAnimation,
            showComment,
            sleep,
            drawAnnotation,
            clearAnnotation,
            updateAnnotationProgress,
            setAnnotationOpacity // Expose new function
        };

        // Signal ready
        showLoading(false);
        console.log('[DigestRenderer] Ready');
    } catch (e) {
        console.error('[DigestRenderer] CRITICAL INIT ERROR:', e);
        window.postMessage({ action: 'error', error: e.message || e.toString() }, '*');
    }
})();

function setAnnotationOpacity(opacity) {
    const canvas = document.getElementById('annotation-canvas');
    if (canvas) {
        canvas.style.opacity = opacity;
    }
}
