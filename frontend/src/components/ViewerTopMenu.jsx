import React, { useState, useRef, useEffect } from 'react';
import { Menu, Upload, Check, ChevronRight, Share2, SplitSquareHorizontal, Layers, Pencil, Box, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ViewerTopMenu = ({
    project,
    activeVersionIndex,
    onVersionChange,
    onRenameVersion,
    isRenamingVersion,
    tempVersionName,
    setTempVersionName,
    onEnterRename,
    compareVersionIndex,
    onCompareChange,
    onUpload,
    uploadingVersion,
    fileInputRef,
    imageInputRef,
    threeDInputRef,
    status,
    onStatusChange,
    onShare,
    isClientReview = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeSubmenu, setActiveSubmenu] = useState(null); // 'compare', 'upload', 'status'
    const menuRef = useRef(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
                setActiveSubmenu(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleMenu = () => {
        setIsOpen(!isOpen);
        if (!isOpen) setActiveSubmenu(null);
    };

    const isVideo = project.versions && project.versions[activeVersionIndex]?.type === 'video';

    const handleSubmenuClick = (submenu) => {
        setActiveSubmenu(activeSubmenu === submenu ? null : submenu);
    };

    return (
        <div className="absolute top-4 right-4 z-50" ref={menuRef}>
            <button
                onClick={toggleMenu}
                className="bg-black/50 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur border border-white/10 transition-colors shadow-lg"
            >
                <Menu size={20} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="absolute top-full right-0 mt-2 w-64 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl max-h-[80vh] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent overflow-hidden"
                    >
                        <div className="py-1">

                            {/* Version Selection */}
                            <div className="px-4 py-2 border-b border-zinc-800">
                                <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-1 block">Version</label>
                                {isRenamingVersion ? (
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="text"
                                            value={tempVersionName}
                                            onChange={(e) => setTempVersionName(e.target.value)}
                                            className="bg-zinc-800 border-none text-white text-sm rounded px-2 py-1 w-full outline-none focus:ring-1 focus:ring-primary"
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') onRenameVersion();
                                            }}
                                        />
                                        <button onClick={onRenameVersion} className="text-green-500 hover:text-green-400 p-1"><Check size={14} /></button>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between group">
                                        <select
                                            value={activeVersionIndex}
                                            onChange={(e) => {
                                                onVersionChange(parseInt(e.target.value));
                                                // Keep open
                                            }}
                                            className="bg-transparent text-white text-sm w-full outline-none cursor-pointer py-1"
                                        >
                                            {project.versions.map((v, i) => (
                                                <option key={v.id} value={i} className="bg-zinc-900 text-white">
                                                    {v.versionName || `V${String(project.versions.length - i).padStart(2, '0')}`} {v.type === 'image_bundle' ? '(Images)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                        {!isClientReview && isVideo && (
                                            <button
                                                onClick={() => {
                                                    if (setTempVersionName) setTempVersionName(project.versions[activeVersionIndex].versionName || `V${String(project.versions.length - activeVersionIndex).padStart(2, '0')}`);
                                                    if (onEnterRename) onEnterRename();
                                                }}
                                                className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-white transition-opacity p-1"
                                                title="Rename Version"
                                            >
                                                <Pencil size={12} />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Compare Mode */}
                            {!isClientReview && isVideo && project.versions.filter(v => v.type === 'video').length >= 2 && (
                                <div className="border-b border-zinc-800/50">
                                    <div
                                        className="px-4 py-2 hover:bg-zinc-800 transition-colors cursor-pointer flex items-center justify-between text-white text-sm"
                                        onClick={() => handleSubmenuClick('compare')}
                                    >
                                        <div className="flex items-center gap-2">
                                            <SplitSquareHorizontal size={16} className="text-zinc-400" />
                                            <span>Compare</span>
                                        </div>
                                        <motion.div
                                            animate={{ rotate: activeSubmenu === 'compare' ? 90 : 0 }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            <ChevronRight size={14} className="text-zinc-500" />
                                        </motion.div>
                                    </div>
                                    <AnimatePresence>
                                        {activeSubmenu === 'compare' && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="overflow-hidden bg-black/20"
                                            >
                                                <div className="pl-6 pr-4 py-2 space-y-1">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onCompareChange(null); }}
                                                        className={`w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-800 text-white rounded-md ${compareVersionIndex === null ? 'bg-primary/20 text-primary' : ''}`}
                                                    >
                                                        Single View
                                                    </button>
                                                    {project.versions.map((v, i) => {
                                                        if (i === activeVersionIndex || v.type !== 'video') return null;
                                                        return (
                                                            <button
                                                                key={v.id}
                                                                onClick={(e) => { e.stopPropagation(); onCompareChange(i); }}
                                                                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-800 text-white rounded-md ${compareVersionIndex === i ? 'bg-primary/20 text-primary' : ''}`}
                                                            >
                                                                With {v.versionName || `V${String(project.versions.length - i).padStart(2, '0')}`}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}

                            {/* Upload Submenu */}
                            {!isClientReview && (
                                <div className="border-b border-zinc-800/50">
                                    <div
                                        className="px-4 py-2 hover:bg-zinc-800 transition-colors cursor-pointer flex items-center justify-between text-white text-sm"
                                        onClick={() => handleSubmenuClick('upload')}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Upload size={16} className="text-zinc-400" />
                                            <span>Upload New Version</span>
                                        </div>
                                        <motion.div
                                            animate={{ rotate: activeSubmenu === 'upload' ? 90 : 0 }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            <ChevronRight size={14} className="text-zinc-500" />
                                        </motion.div>
                                    </div>
                                    <AnimatePresence>
                                        {activeSubmenu === 'upload' && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="overflow-hidden bg-black/20"
                                            >
                                                <div className="pl-6 pr-4 py-2 space-y-1">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-800 text-white rounded-md flex items-center gap-2"
                                                    >
                                                        <Video size={14} className="text-zinc-500" />
                                                        <span>Video</span>
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); threeDInputRef.current?.click(); }}
                                                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-800 text-white rounded-md flex items-center gap-2"
                                                    >
                                                        <Box size={14} className="text-zinc-500" />
                                                        <span>3D Model</span>
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); imageInputRef.current?.click(); }}
                                                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-800 text-white rounded-md flex items-center gap-2"
                                                    >
                                                        <Layers size={14} className="text-zinc-500" />
                                                        <span>Image</span>
                                                    </button>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}

                            {/* Status Submenu */}
                            {!isClientReview && (
                                <div className="border-b border-zinc-800/50">
                                    <div
                                        className="px-4 py-2 hover:bg-zinc-800 transition-colors cursor-pointer flex items-center justify-between text-white text-sm"
                                        onClick={() => handleSubmenuClick('status')}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Layers size={16} className="text-zinc-400" />
                                            <span>Status</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${status === 'CLIENT_REVIEW' ? 'bg-green-500/20 text-green-400' :
                                                status === 'ALL_REVIEWS_DONE' ? 'bg-blue-500/20 text-blue-400' :
                                                    'bg-zinc-700 text-zinc-300'
                                                }`}>
                                                {status === 'CLIENT_REVIEW' ? 'Client' : status === 'ALL_REVIEWS_DONE' ? 'Done' : 'Internal'}
                                            </span>
                                            <motion.div
                                                animate={{ rotate: activeSubmenu === 'status' ? 90 : 0 }}
                                                transition={{ duration: 0.2 }}
                                            >
                                                <ChevronRight size={14} className="text-zinc-500" />
                                            </motion.div>
                                        </div>
                                    </div>
                                    <AnimatePresence>
                                        {activeSubmenu === 'status' && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="overflow-hidden bg-black/20"
                                            >
                                                <div className="pl-6 pr-4 py-2 space-y-1">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onStatusChange('INTERNAL_REVIEW'); }}
                                                        className={`w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-800 text-white rounded-md ${status === 'INTERNAL_REVIEW' ? 'text-primary font-medium' : ''}`}
                                                    >
                                                        Internal Review
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onStatusChange('CLIENT_REVIEW'); }}
                                                        className={`w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-800 text-white rounded-md ${status === 'CLIENT_REVIEW' ? 'text-green-400 font-medium' : ''}`}
                                                    >
                                                        Client Review
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onStatusChange('ALL_REVIEWS_DONE'); }}
                                                        className={`w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-800 text-white rounded-md ${status === 'ALL_REVIEWS_DONE' ? 'text-blue-400 font-medium' : ''}`}
                                                    >
                                                        Reviews Done
                                                    </button>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}

                            {/* Share */}
                            <button
                                onClick={() => { onShare(); }}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-zinc-800 text-white flex items-center gap-2"
                                disabled={!project.clientToken && status === 'INTERNAL_REVIEW'}
                            >
                                <Share2 size={16} className="text-zinc-400" />
                                <span>Share Review Link</span>
                            </button>

                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ViewerTopMenu;
