import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Play, Pause, Maximize, Settings, Keyboard, MessageSquare,
    Check, Volume2, VolumeX, MousePointer2, Pencil
} from 'lucide-react';
import DrawingToolbar from './DrawingToolbar';
import { formatSMPTE, calculateCurrentFrame, timeToFrame, frameToTime } from '../utils/timeUtils';

/**
 * Unified toolbar for Video/Image/3D review.
 * 3-capsule layout matching the 3D viewer exactly:
 * - Left: Play/Pause + Timeline + Time display
 * - Center: Volume + Settings + Fullscreen
 * - Right: Pointer + Pencil (+ DrawingToolbar when active) + Comments toggle
 */
const VideoImageToolbar = ({
    // Playback
    isPlaying,
    onTogglePlay,
    currentTime,
    duration,
    frameRate = 24,
    startFrame = 0,

    // Timeline
    onSeek,
    markers = [],
    selectionRange,
    highlightedCommentId,

    // Volume
    volume = 1,
    onVolumeChange,

    // Playback speed
    playbackRate = 1,
    onPlaybackRateChange,

    // Fullscreen
    onFullscreen,

    // Comments panel
    isCommentsPanelOpen = true,
    onToggleCommentsPanel,

    // Shortcuts modal
    onShowShortcuts,

    // Drawing mode - controlled from parent
    isDrawingMode = false,
    onToggleDrawingMode,
    drawingTool = 'pointer',
    onDrawingToolChange,
    drawingColor = '#ef4444',
    onDrawingColorChange,
    drawingStrokeWidth = 5,
    onDrawingStrokeWidthChange,
    onClearAnnotations,
    onUndo,
    canUndo = false,
    onSend,
    hasDrawingChanges = false,

    // Asset type (video or image)
    assetType = 'video',

    // Image navigation
    currentImageIndex,
    totalImages
}) => {

    const [showSettings, setShowSettings] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [prevVolume, setPrevVolume] = useState(1);
    const settingsRef = useRef(null);
    const timelineRef = useRef(null);
    const isDragging = useRef(false);

    // Close settings dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (settingsRef.current && !settingsRef.current.contains(e.target)) {
                setShowSettings(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Local formatSMPTE removed in favor of imported one
    // currentFrame calculation replaced with imported utility
    const currentFrame = calculateCurrentFrame(currentTime, frameRate, startFrame);

    // Toggle mute
    const toggleMute = () => {
        const newMuted = !isMuted;
        setIsMuted(newMuted);
        if (onVolumeChange) {
            if (newMuted) {
                setPrevVolume(volume);
                onVolumeChange(0);
            } else {
                onVolumeChange(prevVolume || 1);
            }
        }
    };

    // Calculate time from mouse/touch event with frame snapping
    const calculateTimeFromEvent = (e) => {
        if (!timelineRef.current || !duration) return 0;
        const rect = timelineRef.current.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const x = clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, x / rect.width));
        const rawTime = percentage * duration;

        // Snap to nearest frame using centralized logic
        const frame = timeToFrame(rawTime, frameRate);
        return frameToTime(frame, frameRate);
    };

    // Handle timeline mouse down
    const handleTimelineMouseDown = (e) => {
        if (assetType !== 'video') return;
        isDragging.current = true;
        const newTime = calculateTimeFromEvent(e);
        onSeek?.(newTime);

        const handleMouseMove = (moveEvent) => {
            if (isDragging.current) {
                const moveTime = calculateTimeFromEvent(moveEvent);
                onSeek?.(moveTime);
            }
        };

        const handleMouseUp = () => {
            isDragging.current = false;
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    // Handle timeline touch start
    const handleTimelineTouchStart = (e) => {
        if (assetType !== 'video') return;
        isDragging.current = true;
        const newTime = calculateTimeFromEvent(e);
        onSeek?.(newTime);

        const handleTouchMove = (moveEvent) => {
            if (isDragging.current) {
                // Prevent scrolling while scrubbing
                moveEvent.preventDefault();
                const moveTime = calculateTimeFromEvent(moveEvent);
                onSeek?.(moveTime);
            }
        };

        const handleTouchEnd = () => {
            isDragging.current = false;
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
        };

        window.addEventListener('touchmove', handleTouchMove, { passive: false });
        window.addEventListener('touchend', handleTouchEnd);
    };

    // Handle switching to pointer mode - clears canvas
    const handlePointerClick = () => {
        if (isDrawingMode) {
            onClearAnnotations?.();
            onToggleDrawingMode?.(false);
        }
        onDrawingToolChange?.('pointer');
    };

    // Playback speed options
    const speeds = [0.25, 0.5, 1, 1.5, 2];

    // Calculate progress percentage
    const progress = duration ? (currentTime / duration) * 100 : 0;

    return (
        <div className={`absolute bottom-6 left-0 w-full px-6 flex items-end gap-4 pointer-events-none z-40 ${assetType === 'video' ? '' : 'justify-end'}`}>

            {/* === CAPSULE 1: Timeline (Left) - Video Only === */}
            {assetType === 'video' && (
                <div className="flex-1 flex items-center gap-3 px-4 py-2 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full shadow-lg transition-all hover:bg-white/15 pointer-events-auto min-w-0">

                    {/* Play/Pause (Video only) */}
                    {assetType === 'video' && (
                        <>
                            <button
                                onClick={onTogglePlay}
                                className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/20 transition-colors text-white shrink-0"
                            >
                                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                            </button>
                            <div className="h-4 w-[1px] bg-white/20 mx-1 shrink-0" />
                        </>
                    )}

                    {/* Timeline with markers */}
                    {/* Timeline with markers - Video Only */}
                    {assetType === 'video' && (
                        <div
                            ref={timelineRef}
                            className="flex-1 min-w-[120px] relative h-8 flex items-center cursor-pointer group"
                            onMouseDown={handleTimelineMouseDown}
                            onTouchStart={handleTimelineTouchStart}
                        >
                            {/* Track background */}
                            <div className="absolute inset-x-0 h-1 bg-white/30 rounded-full">
                                {/* Progress fill */}
                                <div
                                    className="h-full bg-white rounded-full transition-all"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>

                            {/* Selection range */}
                            {selectionRange && selectionRange.start !== null && selectionRange.end !== null && (
                                <div
                                    className="absolute h-1 bg-blue-400/50 rounded-full"
                                    style={{
                                        left: `${(selectionRange.start / duration) * 100}%`,
                                        width: `${((selectionRange.end - selectionRange.start) / duration) * 100}%`
                                    }}
                                />
                            )}

                            {/* Markers (profile thumbnails) */}
                            {markers.map((marker, idx) => {
                                const position = duration ? (marker.timestamp / duration) * 100 : 0;
                                const isHighlighted = marker.id === highlightedCommentId;

                                return (
                                    <div
                                        key={marker.id || idx}
                                        className={`absolute -translate-x-1/2 transition-all cursor-pointer hover:scale-125 ${isHighlighted ? 'z-20 scale-125' : 'z-10'}`}
                                        style={{ left: `${position}%`, top: '-8px' }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSeek?.(marker.timestamp, marker);
                                        }}
                                        title={marker.content || 'Comment'}
                                    >
                                        {marker.user?.avatar ? (
                                            <img
                                                src={marker.user.avatar}
                                                alt=""
                                                className={`w-5 h-5 rounded-full border-2 ${isHighlighted ? 'border-blue-400' : 'border-white/50'}`}
                                            />
                                        ) : (
                                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold ${isHighlighted ? 'bg-blue-500 border-2 border-blue-400' : 'bg-white/20 border-2 border-white/50'} text-white`}>
                                                {marker.user?.name?.[0]?.toUpperCase() || marker.guestName?.[0]?.toUpperCase() || '?'}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Playhead */}
                            <div
                                className="absolute w-3 h-3 bg-white rounded-full -translate-x-1/2 shadow-lg transition-all group-hover:scale-110"
                                style={{ left: `${progress}%` }}
                            />
                        </div>
                    )}

                    {/* Time display */}
                    {assetType === 'video' && (
                        <span className="text-xs font-mono text-white/90 min-w-[120px] text-center tabular-nums shrink-0">
                            {formatSMPTE(currentTime, frameRate)} / {formatSMPTE(duration, frameRate)} • Frame {currentFrame} / {calculateCurrentFrame(duration, frameRate, startFrame)}
                        </span>
                    )}

                    {/* Image counter */}
                    {assetType === 'image' && totalImages > 1 && (
                        <span className="text-xs font-mono text-white/90 min-w-[80px] text-center tabular-nums shrink-0">
                            {currentImageIndex + 1} / {totalImages}
                        </span>
                    )}
                </div>
            )
            }

            {/* === CAPSULE 2: Controls (Center) === */}
            <div className="relative flex items-center gap-2 px-2 py-2 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full shadow-lg transition-all hover:bg-white/15 min-h-[50px] pointer-events-auto">

                {/* Volume (Video only) - LEFT of Settings */}
                {assetType === 'video' && (
                    <div className="relative group/vol flex items-center">
                        <button
                            onClick={toggleMute}
                            className="p-2 rounded-full text-white hover:bg-white/20 transition-colors"
                            title={isMuted ? "Unmute" : "Mute"}
                        >
                            {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                        </button>
                        <div className="w-0 overflow-hidden group-hover/vol:w-20 transition-all duration-300 ease-in-out">
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={isMuted ? 0 : volume}
                                onChange={(e) => {
                                    const newVol = parseFloat(e.target.value);
                                    onVolumeChange?.(newVol);
                                    setIsMuted(newVol === 0);
                                }}
                                className="w-16 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                            />
                        </div>
                    </div>
                )}

                {/* Settings Dropdown - Video Only (or if shortcuts needed for image?) User said "no gear". */}
                {assetType === 'video' && (
                    <div className="relative" ref={settingsRef}>
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className={`p-2 rounded-full transition-colors ${showSettings ? 'bg-white text-black' : 'text-white hover:bg-white/20'}`}
                            title="Settings"
                        >
                            <Settings size={18} />
                        </button>

                        <AnimatePresence>
                            {showSettings && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    className="absolute bottom-full right-0 mb-3 w-48 bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl shadow-xl overflow-hidden p-1"
                                >
                                    {/* Playback Speed */}
                                    {assetType === 'video' && (
                                        <>
                                            <div className="px-3 py-2 text-xs text-white/50 uppercase tracking-wide">Playback Speed</div>
                                            <div className="grid grid-cols-5 gap-1 p-1">
                                                {speeds.map(speed => (
                                                    <button
                                                        key={speed}
                                                        onClick={() => onPlaybackRateChange?.(speed)}
                                                        className={`px-2 py-1.5 text-xs rounded-lg transition-colors flex items-center justify-center ${playbackRate === speed ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
                                                    >
                                                        {speed}x
                                                        {playbackRate === speed && <Check size={10} className="ml-1" />}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="h-[1px] bg-white/10 my-1" />
                                        </>
                                    )}

                                    {/* Shortcuts */}
                                    <button
                                        onClick={() => {
                                            setShowSettings(false);
                                            onShowShortcuts?.();
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white rounded-lg transition-colors"
                                    >
                                        <Keyboard size={14} />
                                        Keyboard Shortcuts
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}

                {/* Fullscreen */}
                <button
                    onClick={onFullscreen}
                    className="p-2 rounded-full text-white hover:bg-white/20 transition-colors"
                    title="Fullscreen"
                >
                    <Maximize size={18} />
                </button>
            </div>

            {/* === CAPSULE 3: Tools (Right) === */}
            <div className="pointer-events-auto shrink-0">
                <div className="relative flex items-center gap-2 px-2 py-2 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full shadow-lg transition-all hover:bg-white/15 min-h-[50px]">

                    {/* Pointer button - clears canvas when clicked */}
                    <button
                        onClick={handlePointerClick}
                        className={`p-2 rounded-full transition-all ${!isDrawingMode ? 'bg-white text-black shadow-lg shadow-white/20' : 'text-white hover:bg-white/20'}`}
                        title="Pointer"
                    >
                        <MousePointer2 size={20} />
                    </button>

                    {/* Pencil button */}
                    <button
                        onClick={() => {
                            const newMode = !isDrawingMode;
                            onToggleDrawingMode?.(newMode);
                            if (newMode) onDrawingToolChange?.('pencil');
                        }}
                        className={`p-2 rounded-full transition-all ${isDrawingMode ? 'bg-white text-black shadow-lg shadow-white/20' : 'text-white hover:bg-white/20'}`}
                        title="Draw"
                    >
                        <Pencil size={20} />
                    </button>

                    {/* Drawing Toolbar (inline when active) */}
                    {isDrawingMode && (
                        <>
                            <div className="h-6 w-[1px] bg-white/20 mx-1" />
                            <DrawingToolbar
                                tool={drawingTool}
                                setTool={onDrawingToolChange}
                                color={drawingColor}
                                setColor={onDrawingColorChange}
                                strokeWidth={drawingStrokeWidth}
                                setStrokeWidth={onDrawingStrokeWidthChange}
                                onClose={() => {
                                    onClearAnnotations?.();
                                    onToggleDrawingMode?.(false);
                                }}
                                setIsDrawingMode={onToggleDrawingMode}
                                extraTools={[]}
                                onUndo={onUndo}
                                canUndo={canUndo}
                                onSend={onSend}
                                hasChanges={hasDrawingChanges}
                            />
                        </>
                    )}

                    <div className="h-6 w-[1px] bg-white/20 mx-1" />

                    {/* Comments Toggle */}
                    <button
                        onClick={onToggleCommentsPanel}
                        className={`p-2 rounded-full transition-colors ${isCommentsPanelOpen ? 'bg-white text-black' : 'text-white hover:bg-white/20'}`}
                        title={isCommentsPanelOpen ? "Hide Comments" : "Show Comments"}
                    >
                        <MessageSquare size={18} />
                    </button>
                </div>
            </div>
        </div >
    );
};

export default VideoImageToolbar;
