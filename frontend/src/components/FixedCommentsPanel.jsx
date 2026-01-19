import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare } from 'lucide-react';

const STORAGE_KEY = 'commentsPanelWidth';
const DEFAULT_WIDTH = 450;
const MIN_WIDTH = 300;
const MAX_WIDTH = 700;

/**
 * Fixed Comments Panel for Video/Image review.
 * Fixed to the right side, resizable width, no minimize button.
 */
const FixedCommentsPanel = ({
    children,
    isOpen,
    onClose,
    className = ''
}) => {
    // Load saved width from localStorage
    const [width, setWidth] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
    });

    const isResizing = useRef(false);
    const panelRef = useRef(null);

    // Save width to localStorage when it changes
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, width.toString());
    }, [width]);

    const handleResizeStart = (e) => {
        e.preventDefault();
        isResizing.current = true;
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';

        const handleMouseMove = (moveEvent) => {
            if (!isResizing.current) return;
            const containerWidth = window.innerWidth;
            const newWidth = containerWidth - moveEvent.clientX;
            setWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth)));
        };

        const handleMouseUp = () => {
            isResizing.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    if (!isOpen) return null;

    return (
        <motion.div
            ref={panelRef}
            initial={{ x: width, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: width, opacity: 0 }}
            transition={{
                type: 'spring',
                damping: 25,
                stiffness: 300
            }}
            className={`h-full bg-card border-l border-border flex flex-col overflow-hidden relative ${className}`}
            style={{ width }}
        >
            {/* Resize Handle (Left Edge) */}
            <div
                className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary/50 transition-colors z-10"
                onMouseDown={handleResizeStart}
            />



            {/* Content */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-0 relative bg-background/95 backdrop-blur-sm">
                {children}
            </div>
        </motion.div>
    );
};

export default FixedCommentsPanel;
