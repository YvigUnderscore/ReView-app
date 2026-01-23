import React, { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Play, Pause, Volume2, Maximize, Check, X, MessageSquare, Spline } from 'lucide-react';
import { isPointInShape, moveShape } from '../utils/annotationUtils';
import { timeToFrame, frameToTime } from '../utils/timeUtils';
import DrawingToolbar from './DrawingToolbar';
import { useAuth } from '../context/AuthContext';

// Helper to format time as MM:SS
const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const VideoPlayer = forwardRef(({ src: rawSrc, compareSrc: rawCompareSrc, compareAudioEnabled, onTimeUpdate, onDurationChange, onAnnotationSave, viewingAnnotation, viewingCommentId, isDrawingModeTrigger, onUserPlay, isGuest, guestName, isReadOnly, onPlayStateChange, loop, playbackRate, frameRate = 24, onReviewSubmit, onDrawingModeChange }, ref) => {
    const { getMediaUrl } = useAuth();
    const src = getMediaUrl(rawSrc);
    const compareSrc = getMediaUrl(rawCompareSrc);

    const videoRef = useRef(null);
    const compareVideoRef = useRef(null);
    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const wrapperRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [videoError, setVideoError] = useState(null);
    const [showFullscreenMessage, setShowFullscreenMessage] = useState(false);
    const [videoDimensions, setVideoDimensions] = useState(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showFullscreenControls, setShowFullscreenControls] = useState(true);
    const [volume, setVolume] = useState(1);
    const fullscreenControlsTimeoutRef = useRef(null);

    // Drawing State
    const [isDrawingMode, setIsDrawingMode] = useState(false);
    const [tool, setTool] = useState('pointer');
    const [color, setColor] = useState('#ef4444');
    const [strokeWidth, setStrokeWidth] = useState(7);
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
    const [currentAnnotation, setCurrentAnnotation] = useState(null);
    const [annotations, setAnnotations] = useState([]);
    const [currentViewingCommentId, setCurrentViewingCommentId] = useState(null);
    const [draggingAnnotation, setDraggingAnnotation] = useState(null);
    const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
    const [hoveredShapeIndex, setHoveredShapeIndex] = useState(-1);

    // History for Undo/Redo
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const isUndoing = useRef(false);

    // Refs for callbacks
    const annotationsRef = useRef(annotations);
    const currentAnnotationRef = useRef(currentAnnotation);
    const draggingAnnotationRef = useRef(draggingAnnotation);

    useEffect(() => {
        annotationsRef.current = annotations;
    }, [annotations]);

    useEffect(() => {
        currentAnnotationRef.current = currentAnnotation;
    }, [currentAnnotation]);

    useEffect(() => {
        draggingAnnotationRef.current = draggingAnnotation;
    }, [draggingAnnotation]);

    // Load Draft
    useEffect(() => {
        if (src) {
            try {
                const draftKey = `draft_video_${btoa(src).slice(0, 32)}`;
                const saved = localStorage.getItem(draftKey);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    setAnnotations(parsed);
                }
            } catch (e) { }
        }
    }, [src]);

    // Save Draft & History
    useEffect(() => {
        if (src) {
            try {
                const draftKey = `draft_video_${btoa(src).slice(0, 32)}`;
                localStorage.setItem(draftKey, JSON.stringify(annotations));
            } catch (e) { }
        }

        if (isUndoing.current) {
            isUndoing.current = false;
            return;
        }

        setHistory(prev => {
            const newHist = prev.slice(0, historyIndex + 1);
            newHist.push([...annotations]);
            return newHist;
        });
        setHistoryIndex(prev => prev + 1);
    }, [annotations, src]);

    const handleUndo = () => {
        if (historyIndex > 0) {
            isUndoing.current = true;
            const prev = history[historyIndex - 1];
            setAnnotations(prev);
            setHistoryIndex(historyIndex - 1);
        }
    };
    const handleSendReview = () => {
        if (onAnnotationSave) onAnnotationSave(annotations);
        if (onReviewSubmit) onReviewSubmit();
        // Auto-exit drawing mode after sending
        setIsDrawingMode(false);
        if (onDrawingModeChange) onDrawingModeChange(false);
        setTool('pointer');
        setAnnotations([]);
    };

    // Expose methods
    useImperativeHandle(ref, () => ({
        getAnnotations: () => {
            if (isDrawing && currentAnnotation) {
                return [...annotations, currentAnnotation];
            }
            return annotations;
        },
        getScreenshot: (options = { includeAnnotations: false }) => {
            if (!videoRef.current || !canvasRef.current) return null;
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const offscreen = document.createElement('canvas');
            offscreen.width = video.videoWidth;
            offscreen.height = video.videoHeight;
            const ctx = offscreen.getContext('2d');
            ctx.drawImage(video, 0, 0, offscreen.width, offscreen.height);
            if (options.includeAnnotations) {
                ctx.drawImage(canvas, 0, 0);
            }
            return offscreen.toDataURL('image/jpeg', 0.85);
        },
        clearAnnotations: () => {
            setAnnotations([]);
            setIsDrawingMode(false);
            setTool('pointer');
            setCurrentAnnotation(null);
            setIsDrawing(false);
        },
        seek: (time) => {
            if (videoRef.current) videoRef.current.currentTime = time;
            if (compareVideoRef.current) compareVideoRef.current.currentTime = time;
        },
        togglePlay: () => {
            togglePlay();
        },
        pause: () => {
            if (videoRef.current) {
                videoRef.current.pause();
                setIsPlaying(false);
                if (onPlayStateChange) onPlayStateChange(false);
            }
            if (compareVideoRef.current) compareVideoRef.current.pause();
        },
        toggleFullscreen: () => {
            if (!document.fullscreenElement) {
                containerRef.current?.requestFullscreen();
            } else {
                document.exitFullscreen();
            }
        },
        setVolume: (vol) => {
            if (videoRef.current) videoRef.current.volume = vol;
            if (compareVideoRef.current && compareAudioEnabled) compareVideoRef.current.volume = vol;
        },
        setPlaybackRate: (rate) => {
            if (videoRef.current) videoRef.current.playbackRate = rate;
            if (compareVideoRef.current) compareVideoRef.current.playbackRate = rate;
        },
        // Drawing mode control methods (for external toolbar)
        setDrawingMode: (mode) => {
            setIsDrawingMode(mode);
            if (mode) {
                videoRef.current?.pause();
                setIsPlaying(false);
                updateCanvasLayout();
            }
        },
        setDrawingTool: (newTool) => {
            setTool(newTool);
        },
        setDrawingColor: (newColor) => {
            setColor(newColor);
        },
        setDrawingStrokeWidth: (width) => {
            setStrokeWidth(width);
        },
        getDrawingState: () => ({
            isDrawingMode,
            tool,
            color,
            strokeWidth,
            hasAnnotations: annotations.length > 0,
            canUndo: historyIndex > 0
        }),
        undoAnnotation: handleUndo,
        sendAnnotations: handleSendReview,
        loadAnnotations: (annotationsArray) => {
            if (Array.isArray(annotationsArray)) {
                setAnnotations(annotationsArray);
                setIsDrawingMode(true);
                if (onDrawingModeChange) onDrawingModeChange(true);
                videoRef.current?.pause();
                setIsPlaying(false);
                updateCanvasLayout();
            }
        }
    }));

    const handleVideoPlay = () => {
        setIsPlaying(true);
        if (onPlayStateChange) onPlayStateChange(true);
    };

    const handleVideoPause = () => {
        setIsPlaying(false);
        if (onPlayStateChange) onPlayStateChange(false);
    };

    useEffect(() => {
        if (videoRef.current) videoRef.current.loop = loop;
        if (compareVideoRef.current) compareVideoRef.current.loop = loop;
    }, [loop]);

    useEffect(() => {
        if (videoRef.current) videoRef.current.playbackRate = playbackRate || 1;
        if (compareVideoRef.current) compareVideoRef.current.playbackRate = playbackRate || 1;
    }, [playbackRate]);

    useEffect(() => {
        if (compareVideoRef.current) {
            compareVideoRef.current.muted = !compareAudioEnabled;
        }
    }, [compareAudioEnabled]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            const isFs = !!document.fullscreenElement;
            setIsFullscreen(isFs);
            if (isFs) {
                setShowFullscreenMessage(true);
                setShowFullscreenControls(true);
                setTimeout(() => setShowFullscreenMessage(false), 2000);
            } else {
                setShowFullscreenMessage(false);
                setShowFullscreenControls(true);
            }
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    // Fullscreen mouse move handler for auto-hide controls
    const handleFullscreenMouseMove = useCallback(() => {
        if (!isFullscreen) return;
        setShowFullscreenControls(true);
        if (fullscreenControlsTimeoutRef.current) {
            clearTimeout(fullscreenControlsTimeoutRef.current);
        }
        fullscreenControlsTimeoutRef.current = setTimeout(() => {
            if (isPlaying) {
                setShowFullscreenControls(false);
            }
        }, 3000);
    }, [isFullscreen, isPlaying]);

    // Handle volume change
    const handleVolumeChange = (newVolume) => {
        setVolume(newVolume);
        if (videoRef.current) videoRef.current.volume = newVolume;
    };

    const normalize = (x, y) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        return {
            x: x / canvas.width,
            y: y / canvas.height
        };
    };

    const drawShape = useCallback((ctx, shape) => {
        ctx.beginPath();
        ctx.strokeStyle = shape.color;

        const canvas = ctx.canvas;
        const scaleFactor = Math.max(canvas.width / 1920, 0.5);
        const width = shape.strokeWidth || 10;
        const baseWidth = shape.tool === 'highlighter' ? width * 3 : width;
        ctx.lineWidth = baseWidth * scaleFactor;

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = shape.tool === 'highlighter' ? 0.4 : 1.0;
        ctx.fillStyle = shape.color;

        const w = canvas.width;
        const h = canvas.height;
        const isNormalized = (val) => val <= 1.5;

        const getCoord = (sx, sy) => {
            if (shape.isNormalized || (shape.points && shape.points.length > 0 && isNormalized(shape.points[0].x))) {
                return { x: sx * w, y: sy * h };
            }
            if (shape.isNormalized || (shape.x !== undefined && isNormalized(shape.x))) {
                return { x: sx * w, y: sy * h };
            }
            return { x: sx, y: sy };
        };

        if (hoveredShapeIndex !== -1 && annotationsRef.current[hoveredShapeIndex] === shape) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = 'rgba(239, 68, 68, 0.8)';
            ctx.lineWidth += 2;
        }

        if (shape.tool === 'pencil' || shape.tool === 'highlighter' || shape.tool === 'eraser') {
            if (shape.points.length < 2) {
                ctx.shadowBlur = 0;
                return;
            }
            const p0 = getCoord(shape.points[0].x, shape.points[0].y);
            ctx.moveTo(p0.x, p0.y);
            for (let i = 1; i < shape.points.length; i++) {
                const pi = getCoord(shape.points[i].x, shape.points[i].y);
                ctx.lineTo(pi.x, pi.y);
            }
            if (shape.tool === 'eraser') {
                ctx.globalCompositeOperation = 'destination-out';
                ctx.lineWidth = (width * 3) * scaleFactor;
            } else {
                ctx.globalCompositeOperation = 'source-over';
            }
            ctx.stroke();
        } else {
            const p = getCoord(shape.x, shape.y);
            const dims = shape.isNormalized
                ? { w: shape.w * w, h: shape.h * h }
                : { w: shape.w, h: shape.h };

            if (!shape.isNormalized && isNormalized(shape.w) && shape.w > 0) {
                dims.w = shape.w * w;
                dims.h = shape.h * h;
            }

            if (shape.tool === 'rect') {
                ctx.strokeRect(p.x, p.y, dims.w, dims.h);
            } else if (shape.tool === 'circle') {
                ctx.ellipse(p.x + dims.w / 2, p.y + dims.h / 2, Math.abs(dims.w / 2), Math.abs(dims.h / 2), 0, 0, 2 * Math.PI);
                ctx.stroke();
            } else if (shape.tool === 'line') {
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x + dims.w, p.y + dims.h);
                ctx.stroke();
            } else if (shape.tool === 'arrow') {
                const headlen = width * 3 * scaleFactor;
                const tox = p.x + dims.w;
                const toy = p.y + dims.h;
                const angle = Math.atan2(toy - p.y, tox - p.x);
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(tox, toy);
                ctx.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
                ctx.moveTo(tox, toy);
                ctx.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
                ctx.stroke();
            } else if (shape.tool === 'text') {
                ctx.font = `${(width * 3) * scaleFactor}px sans-serif`;
                ctx.fillText(shape.text || 'Text', p.x, p.y);
            } else if (shape.tool === 'bubble') {
                const r = 10 * scaleFactor;
                const x = p.x;
                const y = p.y;
                const w_ = dims.w;
                const h_ = dims.h;

                ctx.beginPath();
                ctx.moveTo(x + r, y);
                ctx.lineTo(x + w_ - r, y);
                ctx.quadraticCurveTo(x + w_, y, x + w_, y + r);
                ctx.lineTo(x + w_, y + h_ - r);
                ctx.quadraticCurveTo(x + w_, y + h_, x + w_ - r, y + h_);

                const tailX = x + w_ * 0.2;
                const tailY = y + h_;

                ctx.lineTo(tailX + 10 * scaleFactor, y + h_);
                ctx.lineTo(tailX, y + h_ + 20 * scaleFactor);
                ctx.lineTo(tailX - 10 * scaleFactor, y + h_);

                ctx.lineTo(x + r, y + h_);
                ctx.quadraticCurveTo(x, y + h_, x, y + h_ - r);
                ctx.lineTo(x, y + r);
                ctx.quadraticCurveTo(x, y, x + r, y);
                ctx.stroke();

            } else if (shape.tool === 'curve') {
                const startX = p.x;
                const startY = p.y;
                const endX = p.x + dims.w;
                const endY = p.y + dims.h;
                const cpX = (startX + endX) / 2;
                const cpY = (startY + endY) / 2 - Math.abs(dims.w) * 0.5;
                ctx.moveTo(startX, startY);
                ctx.quadraticCurveTo(cpX, cpY, endX, endY);
                ctx.stroke();
                const angle = Math.atan2(endY - cpY, endX - cpX);
                const headlen = width * 3 * scaleFactor;
                ctx.lineTo(endX - headlen * Math.cos(angle - Math.PI / 6), endY - headlen * Math.sin(angle - Math.PI / 6));
                ctx.moveTo(endX, endY);
                ctx.lineTo(endX - headlen * Math.cos(angle + Math.PI / 6), endY - headlen * Math.sin(angle + Math.PI / 6));
                ctx.stroke();
            }
        }
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = 'source-over';
    }, [hoveredShapeIndex]);

    const performRedraw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const currentAnnos = annotationsRef.current || [];
        const activeAnno = currentAnnotationRef.current;
        [...currentAnnos, activeAnno].filter(Boolean).forEach(shape => drawShape(ctx, shape));
    }, [drawShape]);

    const updateCanvasLayout = useCallback(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const container = containerRef.current;
        const wrapper = wrapperRef.current;

        if (!video || !canvas || !container) return;

        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (!vw || !vh) return;

        // Update canvas resolution to match video resolution
        if (canvas.width !== vw || canvas.height !== vh) {
            canvas.width = vw;
            canvas.height = vh;
            performRedraw();
        }

        if (wrapper) {
            const cw = container.clientWidth;
            const ch = container.clientHeight;
            const scale = Math.min(cw / vw, ch / vh);
            const displayedWidth = vw * scale;
            const displayedHeight = vh * scale;

            wrapper.style.width = `${displayedWidth}px`;
            wrapper.style.height = `${displayedHeight}px`;
            // wrapper.style.aspectRatio = 'auto'; // Remove aspect ratio constraint if present
        }

    }, [performRedraw]);

    useEffect(() => {
        if (isDrawingModeTrigger && !isReadOnly) {
            enterDrawingMode();
            setTool('pointer');
        }
    }, [isDrawingModeTrigger, isReadOnly]);

    useEffect(() => {
        // If viewingCommentId is provided, use strict ID-based comparison
        // Otherwise, always sync based on viewingAnnotation changes
        const shouldUpdate = viewingCommentId !== undefined
            ? viewingCommentId !== currentViewingCommentId
            : true;

        if (shouldUpdate) {
            if (viewingCommentId !== undefined) {
                setCurrentViewingCommentId(viewingCommentId);
            }
            // ALWAYS sync annotations with viewingAnnotation prop
            setAnnotations(viewingAnnotation || []);
        }
    }, [viewingAnnotation, viewingCommentId, currentViewingCommentId]);

    useEffect(() => {
        if (isPlaying && !isDrawingMode && !viewingAnnotation) {
            setAnnotations([]);
        }
    }, [isPlaying, isDrawingMode, viewingAnnotation]);

    useEffect(() => {
        performRedraw();
    }, [annotations, currentAnnotation, performRedraw]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const resizeObserver = new ResizeObserver(() => {
            requestAnimationFrame(() => {
                updateCanvasLayout();
            });
        });
        resizeObserver.observe(container);
        return () => resizeObserver.disconnect();
    }, [updateCanvasLayout]);

    const togglePlay = useCallback(() => {
        if (isDrawingMode) return;
        if (!videoRef.current) return;
        if (videoRef.current.paused) {
            videoRef.current.play();
            if (compareVideoRef.current) compareVideoRef.current.play().catch(e => console.log(e));
            setIsPlaying(true);
            if (onUserPlay) onUserPlay();
            if (onPlayStateChange) onPlayStateChange(true);
        } else {
            videoRef.current.pause();
            if (compareVideoRef.current) compareVideoRef.current.pause();
            setIsPlaying(false);
            if (onPlayStateChange) onPlayStateChange(false);
        }
    }, [isDrawingMode, onUserPlay, onPlayStateChange]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            const activeTag = document.activeElement?.tagName?.toLowerCase();
            if (activeTag === 'input' || activeTag === 'textarea') return;

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                handleUndo();
            } else if (e.code === 'Space') {
                e.preventDefault();
                togglePlay();
            } else if (e.code === 'ArrowRight') {
                e.preventDefault();
                if (videoRef.current) {
                    const currentFrame = timeToFrame(videoRef.current.currentTime, frameRate);
                    const safeDuration = videoRef.current.duration;
                    const nextTime = frameToTime(currentFrame + 1, frameRate);
                    videoRef.current.currentTime = Math.min(safeDuration, nextTime);
                }
            } else if (e.code === 'ArrowLeft') {
                e.preventDefault();
                if (videoRef.current) {
                    const currentFrame = timeToFrame(videoRef.current.currentTime, frameRate);
                    const prevTime = frameToTime(currentFrame - 1, frameRate);
                    videoRef.current.currentTime = Math.max(0, prevTime);
                }
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [togglePlay, frameRate, history, historyIndex]);

    const handleTimeUpdate = () => {
        const time = videoRef.current.currentTime;
        setCurrentTime(time);
        if (onTimeUpdate) onTimeUpdate(time);
        if (compareVideoRef.current) {
            if (Math.abs(compareVideoRef.current.currentTime - time) > 0.05) {
                compareVideoRef.current.currentTime = time;
            }
        }
    };

    const onLoadedMetadata = () => {
        const d = videoRef.current.duration;
        const v = videoRef.current;
        if (Number.isFinite(d)) {
            setDuration(d);
            if (onDurationChange) onDurationChange(d);
        }
        if (v) {
            setVideoDimensions({ width: v.videoWidth, height: v.videoHeight });
        }
        updateCanvasLayout();
    };

    const onVideoError = (e) => {
        console.error("Video Error Event:", e);
        if (videoRef.current && videoRef.current.error) {
            setVideoError(videoRef.current.error.message);
        }
    };

    const getPos = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const containerRect = containerRef.current.getBoundingClientRect();
        const containerX = clientX - containerRect.left;
        const containerY = clientY - containerRect.top;
        return {
            pixel: { x: Math.max(0, Math.min(x, rect.width)), y: Math.max(0, Math.min(y, rect.height)) },
            containerPixel: { x: containerX, y: containerY },
            norm: { x: Math.max(0, Math.min(x, rect.width)) / rect.width, y: Math.max(0, Math.min(y, rect.height)) / rect.height }
        };
    };

    const startDrawing = (e) => {
        if (!isDrawingMode) return;
        if (e.touches) e.preventDefault();
        const pos = getPos(e);
        setStartPos(pos.norm);
        setLastPos(pos.norm);

        if (tool === 'object-eraser') {
            const clickedIndex = [...annotations].reverse().findIndex(shape => isPointInShape(pos.norm, shape, canvasRef.current.getBoundingClientRect()));
            if (clickedIndex !== -1) {
                const actualIndex = annotations.length - 1 - clickedIndex;
                const newAnnotations = [...annotations];
                newAnnotations.splice(actualIndex, 1);
                setAnnotations(newAnnotations);
            }
            return;
        }
        if (tool === 'pointer') {
            const clickedIndex = [...annotations].reverse().findIndex(shape => isPointInShape(pos.norm, shape, canvasRef.current.getBoundingClientRect()));
            if (clickedIndex !== -1) {
                const actualIndex = annotations.length - 1 - clickedIndex;
                setDraggingAnnotation({ ...annotations[actualIndex], index: actualIndex });
                setIsDrawing(true);
            }
            return;
        }
        setIsDrawing(true);
        if (tool === 'pencil' || tool === 'highlighter' || tool === 'eraser') {
            setCurrentAnnotation({ tool, color, strokeWidth, points: [pos.norm], isNormalized: true });
        } else if (tool === 'text') {
            const text = prompt("Enter text:");
            if (text) {
                setAnnotations([...annotations, { tool, color, strokeWidth, x: pos.norm.x, y: pos.norm.y, text, isNormalized: true }]);
            }
            setIsDrawing(false);
        } else {
            setCurrentAnnotation({ tool, color, strokeWidth, x: pos.norm.x, y: pos.norm.y, w: 0, h: 0, isNormalized: true });
        }
    };

    const draw = (e) => {
        const pos = getPos(e);
        setCursorPos(pos.containerPixel);
        if (tool === 'object-eraser') {
            const hitIndex = [...annotations].reverse().findIndex(shape => isPointInShape(pos.norm, shape, canvasRef.current.getBoundingClientRect()));
            const actualIndex = hitIndex !== -1 ? annotations.length - 1 - hitIndex : -1;
            if (hoveredShapeIndex !== actualIndex) {
                setHoveredShapeIndex(actualIndex);
                performRedraw();
            }
        } else if (hoveredShapeIndex !== -1) {
            setHoveredShapeIndex(-1);
            performRedraw();
        }
        if (tool === 'pointer' && !isDrawing) {
            const hit = annotations.some(shape => isPointInShape(pos.norm, shape, canvasRef.current.getBoundingClientRect()));
            canvasRef.current.style.cursor = hit ? 'move' : 'default';
        }
        if (!isDrawing) return;
        if (!isDrawingMode) return;
        if (tool === 'pointer' && draggingAnnotation) {
            const deltaX = pos.norm.x - lastPos.x;
            const deltaY = pos.norm.y - lastPos.y;
            const updatedShape = moveShape(draggingAnnotation, { x: deltaX, y: deltaY });
            setDraggingAnnotation(updatedShape);
            setLastPos(pos.norm);
            const newAnnotations = [...annotations];
            newAnnotations[draggingAnnotation.index] = updatedShape;
            setAnnotations(newAnnotations);
            return;
        }
        if (tool === 'pencil' || tool === 'highlighter' || tool === 'eraser') {
            setCurrentAnnotation(prev => ({ ...prev, points: [...prev.points, pos.norm] }));
        } else {
            setCurrentAnnotation(prev => ({ ...prev, w: pos.norm.x - startPos.x, h: pos.norm.y - startPos.y }));
        }
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        setDraggingAnnotation(null);
        if (currentAnnotation) {
            setAnnotations([...annotations, currentAnnotation]);
            setCurrentAnnotation(null);
        }
    };

    const enterDrawingMode = () => {
        // Only clear if we don't already have annotations to edit
        if (!isDrawingMode && annotations.length === 0) {
            setAnnotations([]);
        }
        setIsDrawingMode(true);
        videoRef.current.pause();
        setIsPlaying(false);
        updateCanvasLayout();
    };

    const clearAnnotations = () => {
        setAnnotations([]);
    };

    return (
        <div className="flex-1 flex flex-col relative overflow-hidden group bg-black w-full h-full">
            <div
                ref={containerRef}
                className="relative flex-1 flex justify-center items-center w-full min-h-0"
                onMouseMove={isFullscreen ? handleFullscreenMouseMove : undefined}
            >
                {compareSrc ? (
                    <div className="grid grid-cols-2 w-full h-full gap-1">
                        <div className="relative w-full h-full flex items-center justify-center bg-black">
                            <video
                                ref={videoRef}
                                src={src}
                                className="max-h-full max-w-full object-contain cursor-pointer"
                                onTimeUpdate={handleTimeUpdate}
                                onLoadedMetadata={onLoadedMetadata}
                                onError={onVideoError}
                                onPlay={handleVideoPlay}
                                onPause={handleVideoPause}
                                onEnded={handleVideoPause}
                                playsInline
                                webkit-playsinline="true"
                                onClick={togglePlay}
                            />
                            <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded pointer-events-none">V1 (Current)</div>
                        </div>
                        <div className="relative w-full h-full flex items-center justify-center bg-black">
                            <video
                                ref={compareVideoRef}
                                src={compareSrc}
                                className="max-h-full max-w-full object-contain"
                                playsInline
                                webkit-playsinline="true"
                                muted={!compareAudioEnabled}
                                onClick={togglePlay}
                            />
                            <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded pointer-events-none">V2 (Compare)</div>
                        </div>
                    </div>
                ) : (
                    <div
                        className="relative w-full h-full flex items-center justify-center"
                        style={{
                            maxHeight: '100%',
                            maxWidth: '100%'
                        }}
                    >
                        <div
                            ref={wrapperRef}
                            className="relative"
                            style={{
                                width: '100%', // Initial value, overriden by JS
                                height: '100%',
                            }}
                        >
                            <video
                                ref={videoRef}
                                src={src}
                                className={`w-full h-full object-contain cursor-pointer ${videoError ? 'opacity-20' : ''}`}
                                onTimeUpdate={handleTimeUpdate}
                                onLoadedMetadata={onLoadedMetadata}
                                onError={onVideoError}
                                onPlay={handleVideoPlay}
                                onPause={handleVideoPause}
                                onEnded={handleVideoPause}
                                playsInline
                                webkit-playsinline="true"
                                onClick={togglePlay}
                                style={{
                                    display: 'block',
                                    maxHeight: '100%',
                                    maxWidth: '100%',
                                }}
                            />

                            <canvas
                                ref={canvasRef}
                                className={`absolute inset-0 w-full h-full z-10 touch-none ${isDrawingMode ? (tool === 'pointer' ? 'cursor-default' : 'cursor-none') : 'pointer-events-none'}`}
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={stopDrawing}
                            />
                        </div>
                    </div>
                )}

                {videoError && (
                    <div className="absolute inset-0 flex items-center justify-center text-red-500 bg-black/50 p-4 rounded z-20 pointer-events-none">
                        <div>Error loading video: {videoError}<br />Source: {src}</div>
                    </div>
                )}

                {isDrawingMode && !isReadOnly && !compareSrc && tool !== 'pointer' && tool !== 'text' && tool !== 'object-eraser' && (
                    <div
                        className="absolute pointer-events-none rounded-full border border-white z-20"
                        style={{
                            left: cursorPos.x,
                            top: cursorPos.y,
                            width: Math.max(strokeWidth * (canvasRef.current ? canvasRef.current.clientWidth / canvasRef.current.width : 1) * (tool === 'highlighter' ? 3 : 1), 4) + 'px',
                            height: Math.max(strokeWidth * (canvasRef.current ? canvasRef.current.clientWidth / canvasRef.current.width : 1) * (tool === 'highlighter' ? 3 : 1), 4) + 'px',
                            transform: 'translate(-50%, -50%)',
                            backgroundColor: tool === 'eraser' ? 'rgba(255,255,255,0.5)' : color,
                            opacity: 0.8
                        }}
                    />
                )}
                {showFullscreenMessage && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded pointer-events-none transition-opacity duration-500 z-30">
                        Press Esc to exit full screen
                    </div>
                )}

                {/* Fullscreen Overlay Controls */}
                {isFullscreen && (
                    <div
                        className={`absolute inset-x-0 bottom-0 z-40 transition-opacity duration-300 ${showFullscreenControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                        style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.8))' }}
                    >
                        <div className="p-6 pt-16">
                            {/* Timeline */}
                            <div
                                className="w-full h-2 bg-white/30 rounded-full mb-4 cursor-pointer relative group/timeline"
                                onClick={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const x = e.clientX - rect.left;
                                    const percent = x / rect.width;
                                    const newTime = percent * duration;
                                    if (videoRef.current) videoRef.current.currentTime = newTime;
                                }}
                            >
                                <div
                                    className="h-full bg-white rounded-full transition-all"
                                    style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                                />
                                <div
                                    className="absolute w-4 h-4 bg-white rounded-full -translate-x-1/2 -translate-y-1/2 top-1/2 shadow-lg opacity-0 group-hover/timeline:opacity-100 transition-opacity"
                                    style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                                />
                            </div>

                            {/* Controls Row */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    {/* Play/Pause */}
                                    <button
                                        onClick={togglePlay}
                                        className="w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                                    >
                                        {isPlaying ? (
                                            <Pause size={24} fill="currentColor" />
                                        ) : (
                                            <Play size={24} fill="currentColor" />
                                        )}
                                    </button>

                                    {/* Volume */}
                                    <div className="flex items-center gap-2 group/vol">
                                        <button
                                            onClick={() => handleVolumeChange(volume === 0 ? 1 : 0)}
                                            className="p-2 rounded-full hover:bg-white/10 text-white transition-colors"
                                        >
                                            <Volume2 size={20} />
                                        </button>
                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.05"
                                            value={volume}
                                            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                                            className="w-20 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                                        />
                                    </div>

                                    {/* Time Display */}
                                    <span className="text-white text-sm font-mono">
                                        {formatTime(currentTime)} / {formatTime(duration)}
                                    </span>
                                </div>

                                {/* Exit Fullscreen */}
                                <button
                                    onClick={() => document.exitFullscreen()}
                                    className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                                >
                                    <Maximize size={20} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* DrawingToolbar removed - now handled by external VideoImageToolbar */}
            </div>
        </div>
    );
});

export default VideoPlayer;
