import React from 'react';
import { Play, Pause, SkipBack, SkipForward, MessageSquare, PenTool, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MobileControls = ({
    isPlaying,
    onTogglePlay,
    currentTime,
    duration,
    onSeek,
    onOpenComments,
    onToggleDrawing,
    isDrawingMode,
    commentCount = 0
}) => {
    // Format time helper
    const formatTime = (seconds) => {
        if (!seconds) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="absolute inset-0 z-20 flex flex-col justify-between pointer-events-none">
            {/* Top Bar */}
            <div className="bg-gradient-to-b from-black/80 to-transparent p-4 flex justify-between items-start pointer-events-auto">
                <div className="flex gap-4">
                    {/* Back button is handled by MobileHeader or browser back, maybe add one here if fullscreen */}
                </div>

                {/* Tools */}
                <div className="flex gap-4">
                    <button
                        onClick={onToggleDrawing}
                        className={`p-2 rounded-full backdrop-blur-md ${isDrawingMode ? 'bg-primary text-white' : 'bg-black/40 text-white'}`}
                    >
                        {isDrawingMode ? <X size={20} /> : <PenTool size={20} />}
                    </button>
                </div>
            </div>

            {/* Center Play Button (only visible when paused/controls active) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-auto" onClick={onTogglePlay}>
                {!isPlaying && (
                    <div className="bg-black/40 backdrop-blur-sm p-4 rounded-full text-white border border-white/10">
                        <Play size={40} fill="currentColor" className="ml-1" />
                    </div>
                )}
            </div>

            {/* Bottom Controls */}
            <div className="bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 pb-8 pointer-events-auto">
                {/* Scrubber */}
                <div className="flex items-center gap-3 mb-4">
                    <span className="text-xs font-medium font-mono text-zinc-300">{formatTime(currentTime)}</span>
                    <input
                        type="range"
                        min={0}
                        max={duration || 100}
                        value={currentTime}
                        onChange={(e) => onSeek(parseFloat(e.target.value))}
                        className="flex-1 h-1 bg-white/30 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
                    />
                    <span className="text-xs font-medium font-mono text-zinc-500">{formatTime(duration)}</span>
                </div>

                {/* Action Bar */}
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-6">
                        <button onClick={onTogglePlay} className="text-white active:scale-90 transition-transform">
                            {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}
                        </button>
                        <button className="text-white active:scale-90 transition-transform" onClick={() => onSeek(currentTime - 5)}>
                            <SkipBack size={24} />
                        </button>
                        <button className="text-white active:scale-90 transition-transform" onClick={() => onSeek(currentTime + 5)}>
                            <SkipForward size={24} />
                        </button>
                    </div>

                    <button
                        onClick={onOpenComments}
                        className="relative p-2 text-white active:scale-90 transition-transform"
                    >
                        <MessageSquare size={24} />
                        {commentCount > 0 && (
                            <span className="absolute top-0 right-0 bg-primary text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                                {commentCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MobileControls;
