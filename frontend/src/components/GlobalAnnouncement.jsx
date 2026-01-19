import React, { useState, useEffect } from 'react';
import { useBranding } from '../context/BrandingContext';
import { useNotification } from '../context/NotificationContext';
import AnnouncementPopup from './AnnouncementPopup';
import * as Icons from 'lucide-react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const GlobalAnnouncement = () => {
    const { config } = useBranding();
    const { socket } = useNotification();
    const [isVisible, setIsVisible] = useState(false);
    const [announcement, setAnnouncement] = useState(null);

    // Get icon component dynamically, safe fallback
    const getIconComponent = (iconName) => {
        if (!iconName) return Icons.Sparkles; // Default
        const Icon = Icons[iconName];
        return Icon || Icons.Sparkles;
    };

    // Initial load from config
    useEffect(() => {
        if (config?.announcement && config.announcement.isActive) {
            setAnnouncement(config.announcement);
        } else {
            setAnnouncement(null);
        }
    }, [config]);

    // Listen for WebSocket updates
    useEffect(() => {
        if (!socket) return;

        const handleUpdate = (newAnnouncement) => {
            if (newAnnouncement && newAnnouncement.isActive) {
                setAnnouncement(newAnnouncement);
            } else {
                setAnnouncement(null);
            }
        };

        socket.on('ANNOUNCEMENT_UPDATE', handleUpdate);

        return () => {
            socket.off('ANNOUNCEMENT_UPDATE', handleUpdate);
        };
    }, [socket]);

    // Handle Visibility & Dismissal
    useEffect(() => {
        if (!announcement) {
            setIsVisible(false);
            return;
        }

        // If type is popup, let the popup component handle its own visibility logic
        if (announcement.type === 'popup' || !announcement.type) {
            return;
        }

        if (!announcement.isActive) {
            setIsVisible(false);
            return;
        }

        const now = new Date();
        const start = announcement.startAt ? new Date(announcement.startAt) : null;
        const end = announcement.endAt ? new Date(announcement.endAt) : null;

        if (start && now < start) return;
        if (end && now > end) return;

        // Check local storage for dismissal
        const dismissed = localStorage.getItem('global_announcement_dismissed');
        if (dismissed) {
            try {
                const dismissedObj = JSON.parse(dismissed);
                // If title or message changed, show again
                // Using exact title/message matching ensures edits trigger re-appearance
                if (dismissedObj.message === announcement.message && dismissedObj.title === announcement.title) {
                    return;
                }
            } catch (e) { }
        }

        setIsVisible(true);
    }, [announcement]);

    const handleClose = () => {
        setIsVisible(false);
        localStorage.setItem('global_announcement_dismissed', JSON.stringify({
            message: announcement.message,
            title: announcement.title,
            timestamp: new Date().toISOString()
        }));
    };

    if (!announcement) return null;

    // Backward compatibility: if no type, default to popup checks inside AnnouncementPopup
    if (announcement.type === 'popup' || !announcement.type) {
        return <AnnouncementPopup />;
    }

    const IconComponent = getIconComponent(announcement.icon);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="w-full bg-gradient-to-r from-blue-900/20 to-purple-900/20 border-b border-white/10 relative overflow-hidden shrink-0 z-50"
                >
                    <div className="max-w-7xl mx-auto p-6 relative flex flex-col items-center justify-center text-center">
                        {/* Background Effect */}
                        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                            <IconComponent size={100} />
                        </div>

                        <button
                            onClick={handleClose}
                            className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors z-10 text-zinc-400 hover:text-white"
                        >
                            <X size={20} />
                        </button>

                        <div className="relative z-0 w-full max-w-4xl mx-auto">
                            {announcement.title && (
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold tracking-widest uppercase mb-3">
                                    {announcement.title}
                                </div>
                            )}
                            <div className="text-zinc-300 leading-relaxed font-medium prose prose-invert max-w-none prose-p:leading-relaxed prose-a:text-primary prose-a:no-underline hover:prose-a:underline">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {announcement.message}
                                </ReactMarkdown>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default GlobalAnnouncement;
