import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { useBranding } from '../context/BrandingContext';

const AnnouncementPopup = () => {
    const { config } = useBranding();
    const [isVisible, setIsVisible] = useState(false);
    const [announcement, setAnnouncement] = useState(null);

    useEffect(() => {
        if (config?.announcement && config.announcement.isActive) {
            setAnnouncement(config.announcement);
        }
    }, [config]);

    useEffect(() => {
        if (!announcement) return;

        const checkVisibility = () => {
            const now = new Date();
            const start = announcement.startAt ? new Date(announcement.startAt) : null;
            const end = announcement.endAt ? new Date(announcement.endAt) : null;

            // Check if within date range
            if (start && now < start) return;
            if (end && now > end) return;

            // Check session storage for last seen (forces show on new connection/tab)
            const lastSeen = sessionStorage.getItem('last_seen_announcement_session');
            const today = new Date().toISOString().split('T')[0];

            if (lastSeen !== today) {
                setIsVisible(true);
            }
        };

        checkVisibility();

    }, [announcement]);

    const handleClose = () => {
        setIsVisible(false);
        const today = new Date().toISOString().split('T')[0];
        sessionStorage.setItem('last_seen_announcement_session', today);
    };

    if (!isVisible || !announcement) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300">
                <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Announcement</h3>
                    <button
                        onClick={handleClose}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6">
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                        {announcement.message}
                    </p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 flex justify-end">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors font-medium text-sm"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AnnouncementPopup;
