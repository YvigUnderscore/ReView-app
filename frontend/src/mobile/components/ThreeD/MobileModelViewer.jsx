import React, { useRef, useState, useEffect, forwardRef, useCallback } from 'react';
import '@google/model-viewer';
import {
    Maximize2, RotateCcw, Box, Layers, Settings, X, Loader2
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';

// Simplified Mobile Model Viewer
const MobileModelViewer = forwardRef(({
    src: rawSrc,
    onTimeUpdate,
    onDurationChange,
    onModelLoaded,
    poster,
}, ref) => {
    const { getMediaUrl } = useAuth();
    const src = getMediaUrl(rawSrc);

    const modelViewerRef = useRef(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [showControls, setShowControls] = useState(false); // This state is no longer used in the new code

    const [showSettings, setShowSettings] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [animations, setAnimations] = useState([]);
    const [selectedAnim, setSelectedAnim] = useState('');

    // Viewer Settings
    const [exposure, setExposure] = useState(1);
    const [toneMapping, setToneMapping] = useState('neutral'); // neutral or aces

    // Expose ref
    React.useImperativeHandle(ref, () => ({
        play: () => {
            if (modelViewerRef.current) {
                modelViewerRef.current.play();
                setIsPlaying(true);
            }
        },
        pause: () => {
            if (modelViewerRef.current) {
                modelViewerRef.current.pause();
                setIsPlaying(false);
            }
        },
        togglePlay: () => {
            const mv = modelViewerRef.current;
            if (mv) {
                if (mv.paused) {
                    mv.play();
                    setIsPlaying(true);
                } else {
                    mv.pause();
                    setIsPlaying(false);
                }
            }
        },
        seek: (time) => {
            if (modelViewerRef.current) {
                modelViewerRef.current.currentTime = time;
                setCurrentTime(time);
            }
        },
        currentTime: modelViewerRef.current?.currentTime || 0,
        duration: modelViewerRef.current?.duration || 0,
    }));

    useEffect(() => {
        const mv = modelViewerRef.current;
        if (!mv) return;

        const handleLoad = () => {
            setIsLoading(false);
            if (onModelLoaded) onModelLoaded();

            // Short timeout to ensure internal state is ready
            // Some model-viewer versions don't populate availableAnimations immediately on load
            setTimeout(() => {
                if (mv.availableAnimations && mv.availableAnimations.length > 0) {
                    console.log('MobileViewer: Animations found', mv.availableAnimations);
                    setAnimations(mv.availableAnimations);
                    setSelectedAnim(mv.availableAnimations[0]);

                    // Auto-play first animation
                    mv.animationName = mv.availableAnimations[0];
                    mv.play();
                    setIsPlaying(true);

                    setDuration(mv.duration);
                    if (onDurationChange) onDurationChange(mv.duration);
                } else {
                    console.log('MobileViewer: No animations found');
                    setAnimations([]);
                }
            }, 100);
        };

        const handleError = (e) => {
            console.error('Mobile ModelViewer Error:', e);
            setError('Failed to load 3D model');
            setIsLoading(false);
        };

        mv.addEventListener('load', handleLoad);
        mv.addEventListener('error', handleError);

        return () => {
            mv.removeEventListener('load', handleLoad);
            mv.removeEventListener('error', handleError);
        };
    }, []);

    // Time Update Loop - Aggressively update duration to ensure UI appears
    useEffect(() => {
        let frame;
        const update = () => {
            const mv = modelViewerRef.current;
            if (mv) {
                const current = mv.currentTime;
                const dur = mv.duration;

                setCurrentTime(current);

                // Ensure duration is captured if it wasn't valid immediately on load
                if (dur > 0 && duration !== dur) {
                    setDuration(dur);
                    if (onDurationChange) onDurationChange(dur);
                }

                if (!mv.paused) setIsPlaying(true);
                else setIsPlaying(false);

                if (onTimeUpdate && !mv.paused) onTimeUpdate(current);
            }
            frame = requestAnimationFrame(update);
        };
        frame = requestAnimationFrame(update);
        return () => cancelAnimationFrame(frame);
    }, [onTimeUpdate, duration]);

    const handleSeek = (e) => {
        const time = parseFloat(e.target.value);
        if (modelViewerRef.current) {
            modelViewerRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };

    const handleAnimChange = (e) => {
        const animName = e.target.value;
        setSelectedAnim(animName);
        if (modelViewerRef.current) {
            modelViewerRef.current.animationName = animName;
            // Force play on change
            modelViewerRef.current.play();
            setIsPlaying(true);
        }
    };

    return (
        <div className="w-full h-full relative bg-black/90 text-white overflow-hidden">
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center z-10 text-white">
                    <Loader2 className="animate-spin mb-2" size={32} />
                    <span className="sr-only">Loading 3D Model...</span>
                </div>
            )}

            {error && (
                <div className="absolute inset-0 flex items-center justify-center z-10 text-red-500 bg-black/80 p-4 text-center">
                    <p>{error}</p>
                </div>
            )}

            <model-viewer
                ref={modelViewerRef}
                src={src}
                poster={getMediaUrl(poster)}
                camera-controls
                touch-action="none" // disable browser scrolling for full control
                auto-rotate={false} // Disable auto-rotate by default for better UX
                shadow-intensity="1"
                environment-image="neutral"
                exposure={exposure}
                tone-mapping={toneMapping}
                style={{ width: '100%', height: '100%' }}
                interaction-prompt="none" // Remove the hand animation
                ar
                autoplay // Enable animations in AR and auto-start
                loop // Crucial for AR loop support
                ar-modes="webxr scene-viewer quick-look"
            >
                {/* Remove default AR button slot to clear bottom-right */}
                <div slot="ar-button" style={{ display: 'none' }}></div>
            </model-viewer>

            {/* Top Controls (Settings) */}
            <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 pointer-events-auto">
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white border border-white/10 active:bg-white/20 transition-all"
                >
                    {showSettings ? <X size={20} /> : <Settings size={20} />}
                </button>

                {/* AR Toggle (Custom) - Top right below settings */}
                <button
                    onClick={() => modelViewerRef.current?.activateAR()}
                    className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white border border-white/10 active:bg-white/20 transition-all"
                >
                    <Box size={20} />
                </button>
            </div>

            {/* Settings Menu Overlay */}
            {showSettings && (
                <div className="absolute top-20 right-4 w-64 bg-black/80 backdrop-blur-xl rounded-2xl border border-white/10 p-4 z-20 pointer-events-auto shadow-2xl animate-in fade-in slide-in-from-top-5 duration-200">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">Display Settings</h3>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs text-zinc-300 block mb-1">Exposure ({exposure})</label>
                            <input
                                type="range"
                                min="0" max="2" step="0.1"
                                value={exposure}
                                onChange={(e) => setExposure(parseFloat(e.target.value))}
                                className="w-full accent-primary h-1 bg-white/20 rounded-full appearance-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-zinc-300 block mb-1">Tone Mapping</label>
                            <div className="flex bg-white/10 p-1 rounded-lg">
                                <button
                                    onClick={() => setToneMapping('neutral')}
                                    className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${toneMapping === 'neutral' ? 'bg-white/20 text-white' : 'text-zinc-400'}`}
                                >
                                    Neutral
                                </button>
                                <button
                                    onClick={() => setToneMapping('aces')}
                                    className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${toneMapping === 'aces' ? 'bg-white/20 text-white' : 'text-zinc-400'}`}
                                >
                                    ACES
                                </button>
                            </div>
                        </div>
                        <div className="pt-2 border-t border-white/10">
                            <button
                                onClick={() => {
                                    setExposure(1);
                                    setToneMapping('neutral');
                                }}
                                className="w-full py-2 flex items-center justify-center gap-2 text-xs text-zinc-400 hover:text-white"
                            >
                                <RotateCcw size={12} /> Reset View
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Controls (Timeline & Animations) */}
            <div className="absolute bottom-0 left-0 right-0 p-4 z-20 pointer-events-auto bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-12 pb-8">

                {/* Animation Selector */}
                {animations.length > 1 && (
                    <div className="mb-4 flex justify-center">
                        <div className="bg-black/60 backdrop-blur-md rounded-full p-1 border border-white/10 flex items-center gap-2 max-w-full overflow-x-auto no-scrollbar">
                            <Layers size={14} className="ml-2 text-zinc-400 shrink-0" />
                            <select
                                value={selectedAnim}
                                onChange={handleAnimChange}
                                className="bg-transparent text-xs text-white p-1 pr-2 outline-none border-none max-w-[200px]"
                            >
                                {animations.map(anim => (
                                    <option key={anim} value={anim} className="bg-zinc-900 text-white">{anim}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}

                {/* Timeline Controls */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => {
                            const mv = modelViewerRef.current;
                            if (mv) {
                                if (isPlaying) mv.pause();
                                else mv.play();
                                setIsPlaying(!isPlaying);
                            }
                        }}
                        disabled={duration === 0}
                        className={`w-10 h-10 flex items-center justify-center rounded-full shrink-0 shadow-lg active:scale-95 transition-transform ${duration > 0 ? 'bg-white text-black' : 'bg-white/20 text-white/50'}`}
                    >
                        {isPlaying ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                        ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5"><path d="M5 3l14 9-14 9V3z" /></svg>
                        )}
                    </button>

                    <div className="flex-1 relative">
                        <input
                            type="range"
                            min="0"
                            max={duration > 0 ? duration : 100}
                            step="0.01"
                            value={currentTime}
                            onChange={handleSeek}
                            disabled={duration === 0}
                            className={`w-full h-1.5 rounded-full appearance-none shadow-sm ${duration > 0 ? 'accent-primary bg-white/20' : 'accent-zinc-600 bg-white/10'}`}
                        />
                        <div className="flex justify-between text-[10px] text-zinc-400 mt-1 font-mono">
                            <span>{currentTime.toFixed(1)}s</span>
                            {/* Show duration or placeholder */}
                            <span>{duration > 0 ? duration.toFixed(1) + 's' : '--:--'}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

export default MobileModelViewer;
