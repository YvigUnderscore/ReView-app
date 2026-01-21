
import React, { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { X, ArrowLeft, ArrowRight } from 'lucide-react';
import { isPointInShape, moveShape } from '../utils/annotationUtils';
import DrawingToolbar from './DrawingToolbar';

const ImageViewer = forwardRef(({ src, onNext, onPrev, hasPrev, hasNext, annotations, onAnnotationSave, viewingAnnotation, isDrawingModeTrigger, isReadOnly, activeImageIndex, totalImages, onImageChange, onReviewSubmit, onDrawingModeChange }, ref) => {
    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const imageRef = useRef(null);
    const wrapperRef = useRef(null);

    // Drawing State
    const [isDrawingMode, setIsDrawingMode] = useState(false);
    const [tool, setTool] = useState('pointer');
    const [color, setColor] = useState('#ef4444');
    const [strokeWidth, setStrokeWidth] = useState(7);
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 }); // Normalized start pos
    const [lastPos, setLastPos] = useState({ x: 0, y: 0 }); // Normalized last pos for dragging
    const [currentAnnotation, setCurrentAnnotation] = useState(null);
    const [localAnnotations, setLocalAnnotations] = useState([]); // Annotations for current session/image
    const [draggingAnnotation, setDraggingAnnotation] = useState(null); // The annotation being moved
    const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
    const [hoveredShapeIndex, setHoveredShapeIndex] = useState(-1);
    const [imageDimensions, setImageDimensions] = useState(null);

    // History for Undo/Redo
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const isUndoing = useRef(false);

    // Refs for callbacks
    const annotationsRef = useRef(localAnnotations);
    const currentAnnotationRef = useRef(currentAnnotation);
    const draggingAnnotationRef = useRef(draggingAnnotation);

    useEffect(() => {
        annotationsRef.current = localAnnotations;
    }, [localAnnotations]);

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
                const draftKey = `draft_image_${btoa(src).slice(0, 32)} `; // Simple truncated key
                const saved = localStorage.getItem(draftKey);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    setLocalAnnotations(parsed);
                } else {
                    setLocalAnnotations([]); // Clear if no draft
                }
            } catch (e) { console.error(e); }
        }
    }, [src]);

    // Save Draft & History
    useEffect(() => {
        if (src) {
            try {
                const draftKey = `draft_image_${btoa(src).slice(0, 32)} `;
                localStorage.setItem(draftKey, JSON.stringify(localAnnotations));
            } catch (e) { }
        }

        if (isUndoing.current) {
            isUndoing.current = false;
            return;
        }

        setHistory(prev => {
            const newHist = prev.slice(0, historyIndex + 1);
            newHist.push([...localAnnotations]);
            return newHist;
        });
        setHistoryIndex(prev => prev + 1);
    }, [localAnnotations, src]);

    const handleUndo = () => {
        if (historyIndex > 0) {
            isUndoing.current = true;
            const prev = history[historyIndex - 1];
            setLocalAnnotations(prev);
            setHistoryIndex(historyIndex - 1);
        }
    };

    const handleSendReview = () => {
        if (onAnnotationSave) onAnnotationSave(localAnnotations);
        if (onReviewSubmit) onReviewSubmit();
        // Auto-exit drawing mode after sending
        setIsDrawingMode(false);
        if (onDrawingModeChange) onDrawingModeChange(false);
        setTool('pointer');
        setLocalAnnotations([]);
    };

    // Expose methods
    useImperativeHandle(ref, () => ({
        getAnnotations: () => {
            if (isDrawing && currentAnnotation) {
                return [...localAnnotations, currentAnnotation];
            }
            return localAnnotations;
        },
        clearAnnotations: () => {
            setLocalAnnotations([]);
            setIsDrawingMode(false);
            setTool('pointer');
            setCurrentAnnotation(null);
            setIsDrawing(false);
        },
        // Methods to match VideoPlayer interface for compatibility
        seek: () => { },
        pause: () => { },
        togglePlay: () => { },
        toggleFullscreen: () => {
            if (!document.fullscreenElement) {
                containerRef.current?.requestFullscreen();
            } else {
                document.exitFullscreen();
            }
        },
        getScreenshot: ({ includeAnnotations = true } = {}) => {
            if (!imageRef.current) return null;

            const canvas = document.createElement('canvas');
            canvas.width = imageRef.current.naturalWidth;
            canvas.height = imageRef.current.naturalHeight;
            const ctx = canvas.getContext('2d');

            // Draw Image
            ctx.drawImage(imageRef.current, 0, 0);

            // Draw Annotations if requested
            if (includeAnnotations && canvasRef.current) {
                ctx.drawImage(canvasRef.current, 0, 0);
            }

            return canvas.toDataURL('image/jpeg', 0.8);
        },
        // Drawing mode control methods (for external toolbar)
        setDrawingMode: (mode) => {
            setIsDrawingMode(mode);
            if (mode) {
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
            hasAnnotations: localAnnotations.length > 0,
            canUndo: historyIndex > 0
        }),
        undoAnnotation: handleUndo,
        sendAnnotations: handleSendReview,
        loadAnnotations: (annotationsArray) => {
            if (Array.isArray(annotationsArray)) {
                setLocalAnnotations(annotationsArray);
                setIsDrawingMode(true);
                if (onDrawingModeChange) onDrawingModeChange(true);
                updateCanvasLayout();
            }
        }
    }));

    // Coordinate Normalization Helpers
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

        // Trash Hover Effect
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
            // Other shapes (rect, circle, etc - simplified reuse)
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
                ctx.font = `${(width * 3) * scaleFactor}px sans - serif`;
                ctx.fillText(shape.text || 'Text', p.x, p.y);
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

    // Handle Layout
    const updateCanvasLayout = useCallback(() => {
        const img = imageRef.current;
        const canvas = canvasRef.current;
        const container = containerRef.current;
        const wrapper = wrapperRef.current;

        if (!img || !canvas || !container) return;

        const naturalWidth = img.naturalWidth;
        const naturalHeight = img.naturalHeight;

        if (!naturalWidth || !naturalHeight) return;

        // Update Canvas Resolution (internal pixels)
        if (canvas.width !== naturalWidth || canvas.height !== naturalHeight) {
            canvas.width = naturalWidth;
            canvas.height = naturalHeight;
            performRedraw();
        }

        if (wrapper) {
            const cw = container.clientWidth;
            const ch = container.clientHeight;
            const scale = Math.min(cw / naturalWidth, ch / naturalHeight);
            const displayedWidth = naturalWidth * scale;
            const displayedHeight = naturalHeight * scale;

            wrapper.style.width = `${displayedWidth}px`;
            wrapper.style.height = `${displayedHeight}px`;
        }

    }, [performRedraw]);

    // Resize Observer
    useEffect(() => {
        const img = imageRef.current;
        const container = containerRef.current;
        if (!img || !container) return;

        const handleResize = () => {
            requestAnimationFrame(updateCanvasLayout);
        };

        const resizeObserver = new ResizeObserver(handleResize);
        resizeObserver.observe(img);
        resizeObserver.observe(container); // Also observe container for centering changes

        // Initial call
        updateCanvasLayout();

        return () => resizeObserver.disconnect();
    }, [updateCanvasLayout, src]);

    // Handle Image Load
    const onImageLoad = () => {
        const img = imageRef.current;
        if (img) {
            setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
        }
        updateCanvasLayout();
    };

    // Sync annotations from props (Viewing saved annotations)
    useEffect(() => {
        if (viewingAnnotation) {
            setLocalAnnotations(viewingAnnotation);
        } else if (!isDrawingMode) {
            // Clear annotations when navigating to a comment without annotations
            setLocalAnnotations([]);
        }
    }, [viewingAnnotation, isDrawingMode, src]);

    // Redraw on changes
    useEffect(() => {
        performRedraw();
    }, [localAnnotations, currentAnnotation, performRedraw]);

    // Trigger Drawing Mode
    useEffect(() => {
        if (isDrawingModeTrigger && !isReadOnly) {
            setIsDrawingMode(true);
            setLocalAnnotations([]); // Clear previous for new drawing
            setTool('pointer');
        }
    }, [isDrawingModeTrigger, isReadOnly]);

    // Keydown for Undo
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                handleUndo();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [history, historyIndex]);


    // Drawing Handlers
    const getPos = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        // Clamp coordinates to stay within the canvas
        const clampedX = Math.max(0, Math.min(x, rect.width));
        const clampedY = Math.max(0, Math.min(y, rect.height));

        // Calculate cursor position relative to container for visual cursor alignment
        const containerRect = containerRef.current.getBoundingClientRect();
        const containerX = clientX - containerRect.left;
        const containerY = clientY - containerRect.top;

        return {
            pixel: { x: clampedX, y: clampedY },
            containerPixel: { x: containerX, y: containerY },
            norm: { x: clampedX / rect.width, y: clampedY / rect.height }
        };
    };

    const startDrawing = (e) => {
        if (!isDrawingMode) return;
        if (e.touches) e.preventDefault();

        const pos = getPos(e);
        setStartPos(pos.norm);
        setLastPos(pos.norm);

        if (tool === 'object-eraser') {
            const clickedIndex = [...localAnnotations].reverse().findIndex(shape => isPointInShape(pos.norm, shape, canvasRef.current.getBoundingClientRect()));
            if (clickedIndex !== -1) {
                const actualIndex = localAnnotations.length - 1 - clickedIndex;
                const newAnnotations = [...localAnnotations];
                newAnnotations.splice(actualIndex, 1);
                setLocalAnnotations(newAnnotations);
            }
            return;
        }

        if (tool === 'pointer') {
            const clickedIndex = [...localAnnotations].reverse().findIndex(shape => isPointInShape(pos.norm, shape, canvasRef.current.getBoundingClientRect()));

            if (clickedIndex !== -1) {
                const actualIndex = localAnnotations.length - 1 - clickedIndex;
                setDraggingAnnotation({ ...localAnnotations[actualIndex], index: actualIndex });
                setIsDrawing(true);
            }
            return;
        }

        setIsDrawing(true);

        if (tool === 'pencil' || tool === 'highlighter' || tool === 'eraser') {
            setCurrentAnnotation({
                tool, color, strokeWidth, points: [pos.norm], isNormalized: true
            });
        } else if (tool === 'text') {
            const text = prompt("Enter text:");
            if (text) {
                setLocalAnnotations([...localAnnotations, {
                    tool,
                    color,
                    strokeWidth,
                    x: pos.norm.x,
                    y: pos.norm.y,
                    text,
                    isNormalized: true
                }]);
            }
            setIsDrawing(false);
        } else {
            setCurrentAnnotation({
                tool, color, strokeWidth, x: pos.norm.x, y: pos.norm.y, w: 0, h: 0, isNormalized: true
            });
        }
    };

    const draw = (e) => {
        const pos = getPos(e);
        setCursorPos(pos.containerPixel);

        if (tool === 'object-eraser') {
            const hitIndex = [...localAnnotations].reverse().findIndex(shape => isPointInShape(pos.norm, shape, canvasRef.current.getBoundingClientRect()));
            const actualIndex = hitIndex !== -1 ? localAnnotations.length - 1 - hitIndex : -1;
            if (hoveredShapeIndex !== actualIndex) {
                setHoveredShapeIndex(actualIndex);
                performRedraw();
            }
        } else if (hoveredShapeIndex !== -1) {
            setHoveredShapeIndex(-1);
            performRedraw();
        }

        // Handle Cursor Style
        if (tool === 'pointer' && !isDrawing) {
            const hit = localAnnotations.some(shape => isPointInShape(pos.norm, shape, canvasRef.current.getBoundingClientRect()));
            canvasRef.current.style.cursor = hit ? 'move' : 'default';
        }

        if (!isDrawing) return;

        if (tool === 'pointer' && draggingAnnotation) {
            const deltaX = pos.norm.x - lastPos.x;
            const deltaY = pos.norm.y - lastPos.y;

            const updatedShape = moveShape(draggingAnnotation, { x: deltaX, y: deltaY });
            setDraggingAnnotation(updatedShape);
            setLastPos(pos.norm);

            const newAnnotations = [...localAnnotations];
            newAnnotations[draggingAnnotation.index] = updatedShape;
            setLocalAnnotations(newAnnotations);
            return;
        }

        if (tool === 'pencil' || tool === 'highlighter' || tool === 'eraser') {
            setCurrentAnnotation(prev => ({
                ...prev, points: [...prev.points, pos.norm]
            }));
        } else if (currentAnnotation) {
            setCurrentAnnotation(prev => ({
                ...prev, w: pos.norm.x - startPos.x, h: pos.norm.y - startPos.y
            }));
        }
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        setDraggingAnnotation(null);
        if (currentAnnotation) {
            setLocalAnnotations([...localAnnotations, currentAnnotation]);
            setCurrentAnnotation(null);
        }
    };

    return (
        <div className="flex-1 flex flex-col relative overflow-hidden group bg-black w-full h-full">
            <div ref={containerRef} className="relative flex-1 flex justify-center items-center w-full min-h-0">
                <div
                    ref={wrapperRef}
                    className="relative"
                    style={{
                        width: '100%',
                        height: '100%',
                    }}
                >
                    <img
                        ref={imageRef}
                        src={src}
                        className="w-full h-full object-contain select-none"
                        style={{ display: 'block' }}
                        onLoad={onImageLoad}
                        alt="Review Asset"
                    />

                    <canvas
                        ref={canvasRef}
                        className={`absolute inset-0 w-full h-full z-10 touch-none ${isDrawingMode ? (tool === 'pointer' ? 'cursor-default' : 'cursor-crosshair') : 'pointer-events-none'}`}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                    />
                </div>

                {/* Navigation Overlays */}
                {hasPrev && !isDrawingMode && (
                    <button
                        onClick={onPrev}
                        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-black/50 hover:bg-black/80 text-white p-3 rounded-full transition-colors"
                    >
                        <ArrowLeft size={24} />
                    </button>
                )}
                {hasNext && !isDrawingMode && (
                    <button
                        onClick={onNext}
                        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-black/50 hover:bg-black/80 text-white p-3 rounded-full transition-colors"
                    >
                        <ArrowRight size={24} />
                    </button>
                )}

                {/* Image Counter */}
                <div className="absolute top-4 right-4 bg-black/60 text-white px-3 py-1 rounded-full text-sm pointer-events-none">
                    {activeImageIndex + 1} / {totalImages}
                </div>

                {/* Cursor Preview */}
                {isDrawingMode && !isReadOnly && tool !== 'pointer' && tool !== 'text' && tool !== 'object-eraser' && (
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

                {/* DrawingToolbar removed - now handled by external VideoImageToolbar */}
            </div>
        </div>
    );
});

export default ImageViewer;
