import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GripHorizontal, X, Maximize2, Minimize2, Move } from 'lucide-react';

const FloatingPanelContainer = ({
    children,
    onClose,
    className = '',
    layoutId = "floating-panel",
    isAnchored = false // New prop: if true, panel is fixed to right edge, only resizable width
}) => {
    // Default dimensions
    const DEFAULT_W = isAnchored ? 450 : 350;
    const DEFAULT_H = 600;

    // State for fully controlled window
    const [bounds, setBounds] = useState({ x: 0, y: 0, width: DEFAULT_W, height: DEFAULT_H });
    const [preferredHeight, setPreferredHeight] = useState(DEFAULT_H); // Remember desired height when squashed

    // Interaction refs
    const isDragging = useRef(false);
    const isResizing = useRef(null); // 'nw', 'ne', 'sw', 'se' or null
    const dragOffset = useRef({ x: 0, y: 0 });
    const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0, mouseX: 0, mouseY: 0 });
    const containerRef = useRef(null);
    const animationFrameRef = useRef(null);

    const storageKey = isAnchored ? 'commentsPanelWidth' : 'commentsPanelPosition';

    // Load persisted state or set default
    useLayoutEffect(() => {
        if (isAnchored) {
            // For anchored mode, only load width
            const savedWidth = localStorage.getItem(storageKey);
            const w = savedWidth ? parseInt(savedWidth, 10) : DEFAULT_W;
            setBounds({
                x: window.innerWidth - w,
                y: 0,
                width: w,
                height: window.innerHeight
            });
        } else {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    // Validate bounds with strict Number check
                    const validX = Number.isFinite(parsed.x) ? Math.min(Math.max(parsed.x, 0), window.innerWidth - 50) : window.innerWidth - DEFAULT_W - 20;
                    const validY = Number.isFinite(parsed.y) ? Math.min(Math.max(parsed.y, 0), window.innerHeight - 50) : 100;
                    const validW = Number.isFinite(parsed.width) ? parsed.width : DEFAULT_W;
                    const validH = Number.isFinite(parsed.height) ? parsed.height : DEFAULT_H;
                    const validPrefH = Number.isFinite(parsed.preferredHeight) ? parsed.preferredHeight : validH;

                    setBounds({
                        x: validX,
                        y: validY,
                        width: validW,
                        height: validH
                    });
                    setPreferredHeight(validPrefH);
                } catch (e) {
                    console.error("Failed to load panel state", e);
                }
            } else {
                // "Smart Default": Top-Right, mimicking flex
                setBounds({
                    x: window.innerWidth - DEFAULT_W - 20,
                    y: 100, // Top margin
                    width: DEFAULT_W,
                    height: Math.min(DEFAULT_H, window.innerHeight - 150)
                });
                setPreferredHeight(Math.min(DEFAULT_H, window.innerHeight - 150));
            }
        }
    }, [isAnchored, storageKey]);

    // Update anchored panel on window resize
    useEffect(() => {
        if (!isAnchored) return;

        const handleResize = () => {
            setBounds(prev => ({
                ...prev,
                x: window.innerWidth - prev.width,
                height: window.innerHeight
            }));
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isAnchored]);

    // Save state on change (debounced via effect + cleanup or just save on interaction end)
    const saveState = (currentBounds, prefH) => {
        if (isAnchored) {
            localStorage.setItem(storageKey, currentBounds.width.toString());
        } else {
            localStorage.setItem(storageKey, JSON.stringify({
                ...currentBounds,
                preferredHeight: prefH
            }));
        }
    };

    // ---- Interactions ----

    const handlePointerDown = (e, action, corner = null) => {
        // For anchored mode, only allow width resize from left edge
        if (isAnchored && action === 'drag') return;
        if (isAnchored && action === 'resize' && corner !== 'w') return;

        e.preventDefault();
        e.stopPropagation(); // critical for not triggering other drags

        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();

        if (action === 'drag') {
            isDragging.current = true;
            dragOffset.current = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
            // Sync state to visual coordinates immediately to prevent jump
            setBounds(prev => ({
                ...prev,
                x: rect.left,
                y: rect.top,
                width: rect.width,
                height: rect.height
            }));
        } else if (action === 'resize') {
            isResizing.current = corner;
            resizeStart.current = {
                x: rect.left,
                y: rect.top,
                width: rect.width,
                height: rect.height,
                mouseX: e.clientX,
                mouseY: e.clientY,
                preferredHeight: preferredHeight
            };
            // Sync state to visual
            setBounds(prev => ({
                ...prev,
                x: rect.left,
                y: rect.top,
                width: rect.width,
                height: rect.height
            }));
        }
    };

    // Clean up animation frame
    useEffect(() => {
        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, []);

    const handlePointerMove = (e) => {
        if (!isDragging.current && !isResizing.current) return;

        // Persist event synthetic properties if needed, but we use clientX/Y which are on the event object always
        // But for RAF we need to capture the coordinates
        const clientX = e.clientX;
        const clientY = e.clientY;

        if (animationFrameRef.current) return;

        animationFrameRef.current = requestAnimationFrame(() => {
            animationFrameRef.current = null;

            if (isDragging.current && !isAnchored) {
                const newX = clientX - dragOffset.current.x;
                const newY = clientY - dragOffset.current.y;

                const clampedX = Math.min(Math.max(newX, 0), window.innerWidth - bounds.width);
                const clampedY = Math.min(Math.max(newY, 0), window.innerHeight - 50);

                setBounds(prev => ({
                    ...prev,
                    x: clampedX,
                    y: clampedY
                }));
            } else if (isResizing.current) {
                const corner = isResizing.current;
                const dx = clientX - resizeStart.current.mouseX;
                const dy = clientY - resizeStart.current.mouseY;
                const MIN_W = 280;
                const MIN_H = 200;
                const MAX_W = isAnchored ? 700 : window.innerWidth - 50;
                const MAX_H = window.innerHeight - 50;

                let newX = resizeStart.current.x;
                let newY = resizeStart.current.y;
                let newW = resizeStart.current.width;
                let newH = resizeStart.current.height;

                if (corner.includes('e')) {
                    newW = Math.max(MIN_W, Math.min(MAX_W, resizeStart.current.width + dx));
                }
                if (corner.includes('w')) {
                    const potentialW = resizeStart.current.width - dx;
                    if (potentialW >= MIN_W && potentialW <= MAX_W) {
                        newW = potentialW;
                        if (!isAnchored) {
                            newX = resizeStart.current.x + dx;
                        }
                    }
                }
                if (corner.includes('s') && !isAnchored) {
                    newH = Math.max(MIN_H, Math.min(MAX_H, resizeStart.current.height + dy));
                }
                if (corner.includes('n') && !isAnchored) {
                    const potentialH = resizeStart.current.height - dy;
                    if (potentialH >= MIN_H && potentialH <= MAX_H) {
                        newH = potentialH;
                        newY = resizeStart.current.y + dy;
                    }
                }

                if (isAnchored) {
                    newX = window.innerWidth - newW;
                    newH = window.innerHeight;
                }

                setBounds({ x: newX, y: newY, width: newW, height: newH });
                if (!isAnchored) {
                    setPreferredHeight(newH);
                }
            }
        });
    };

    const handlePointerUp = () => {
        if (isDragging.current || isResizing.current) {
            saveState(bounds, preferredHeight);
        }
        isDragging.current = false;
        isResizing.current = null;
    };

    // Attach global listeners on mount
    useEffect(() => {
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [bounds, preferredHeight, isAnchored]);

    // Auto-save on change (debounced)
    const mounted = useRef(false);
    useEffect(() => {
        if (mounted.current) {
            const timer = setTimeout(() => saveState(bounds, preferredHeight), 500);
            return () => clearTimeout(timer);
        }
        mounted.current = true;
    }, [bounds, preferredHeight]);


    return (
        <motion.div
            ref={containerRef}
            layoutId={layoutId}
            initial={false}
            animate={{
                // x and y removed to avoid transform conflict. We track bounds in state and apply via style.
                // We only animate dimensions here.
                width: bounds.width,
                height: isAnchored ? '100%' : bounds.height,
                opacity: 1
            }}
            transition={{
                type: 'spring',
                damping: 30,
                stiffness: 300,
                mass: 0.8
            }}
            className={`${isAnchored ? 'z-30 h-full' : 'fixed z-50 rounded-xl border'} bg-card shadow-2xl flex flex-col overflow-hidden ${isAnchored ? 'rounded-none border-l' : ''} ${className}`}
            style={{
                position: isAnchored ? 'relative' : 'fixed',
                ...(isAnchored ? { width: bounds.width } : {
                    left: bounds.x,
                    top: bounds.y,
                    width: bounds.width,
                    height: bounds.height
                }),
                margin: 0
            }}
        >
            {/* Header / Drag Handle - simplified for anchored mode */}
            {!isAnchored && (
                <div
                    className={`flex items-center justify-between p-3 bg-muted/80 backdrop-blur cursor-move border-b border-border select-none`}
                    onPointerDown={(e) => handlePointerDown(e, 'drag')}
                >
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
                        <GripHorizontal size={16} className="text-muted-foreground/50" />
                        <span>Comments</span>
                    </div>
                    <div className="flex items-center gap-1.5" onPointerDown={(e) => e.stopPropagation()}>
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-md text-muted-foreground transition-colors"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>
            )}

            {/* Content */}
            <div
                className="flex-1 overflow-hidden flex flex-col min-h-0 relative bg-background/95 backdrop-blur-sm transition-all"
            >
                {children}
            </div>

            {/* Resize Handles */}
            {isAnchored ? (
                /* Only left edge resize for anchored */
                <div
                    className="absolute top-0 bottom-0 left-0 w-1 cursor-ew-resize z-50 hover:bg-primary/50 transition-colors"
                    onPointerDown={(e) => handlePointerDown(e, 'resize', 'w')}
                />
            ) : (
                <>
                    {/* N */}
                    <div className="absolute top-0 left-2 right-2 h-2 cursor-ns-resize z-50" onPointerDown={(e) => handlePointerDown(e, 'resize', 'n')} />
                    {/* S */}
                    <div className="absolute bottom-0 left-2 right-2 h-2 cursor-ns-resize z-50" onPointerDown={(e) => handlePointerDown(e, 'resize', 's')} />
                    {/* E */}
                    <div className="absolute top-2 bottom-2 right-0 w-2 cursor-ew-resize z-50" onPointerDown={(e) => handlePointerDown(e, 'resize', 'e')} />
                    {/* W */}
                    <div className="absolute top-2 bottom-2 left-0 w-2 cursor-ew-resize z-50" onPointerDown={(e) => handlePointerDown(e, 'resize', 'w')} />

                    {/* Corners */}
                    <div className="absolute top-0 left-0 w-4 h-4 cursor-nwse-resize z-50" onPointerDown={(e) => handlePointerDown(e, 'resize', 'nw')} />
                    <div className="absolute top-0 right-0 w-4 h-4 cursor-nesw-resize z-50" onPointerDown={(e) => handlePointerDown(e, 'resize', 'ne')} />
                    <div className="absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize z-50" onPointerDown={(e) => handlePointerDown(e, 'resize', 'sw')} />
                    <div className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-50" onPointerDown={(e) => handlePointerDown(e, 'resize', 'se')} />
                </>
            )}
        </motion.div>
    );
};

export default FloatingPanelContainer;
