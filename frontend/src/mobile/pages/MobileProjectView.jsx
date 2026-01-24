import React, { useRef, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjectController } from '../../hooks/useProjectController'; // Reuse shared logic!
import VideoPlayer from '../../components/VideoPlayer';
import MobileControls from '../components/player/MobileControls';
import MobileCommentsSheet from '../components/player/MobileCommentsSheet';
import MobileModelViewer from '../components/ThreeD/MobileModelViewer';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { AnimatePresence, motion } from 'framer-motion';

const MobileProjectView = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    // Using the shared hook for all state management
    const {
        project, loading,
        activeVersionIndex, setActiveVersionIndex,
        currentTime, setCurrentTime,
        duration, setDuration,
        isPlaying, setIsPlaying,
        viewingAnnotation, setViewingAnnotation,
        highlightedCommentId, setHighlightedCommentId,
        videoPlayerRef,
        isDrawingMode, setIsDrawingMode,
        handleReviewSubmit
    } = useProjectController();

    // Local UI State
    const [showComments, setShowComments] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const controlsTimeoutRef = useRef(null);

    // Auto-hide controls
    useEffect(() => {
        if (isPlaying && !showComments && !isDrawingMode) {
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
            controlsTimeoutRef.current = setTimeout(() => {
                setShowControls(false);
            }, 3000);
        } else {
            setShowControls(true);
        }
        return () => clearTimeout(controlsTimeoutRef.current);
    }, [isPlaying, showComments, isDrawingMode]);

    const interact = () => {
        setShowControls(true);
        if (isPlaying && !showComments && !isDrawingMode) {
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
            controlsTimeoutRef.current = setTimeout(() => {
                setShowControls(false);
            }, 3000);
        }
    };

    if (loading) return <div className="h-screen bg-black flex items-center justify-center text-white">Loading...</div>;
    if (!project) return <div className="h-screen bg-black flex items-center justify-center text-red-500">Project not found</div>;

    const activeVersion = project.versions[activeVersionIndex];
    const isVideo = activeVersion?.type === 'video';
    const isModel = activeVersion?.type === 'model' || activeVersion?.type === '3d' || activeVersion?.type === 'three_d_asset';

    // Submit comment handler (mobile implementation)
    const handleMobileCommentSubmit = async (text) => {
        if (!text.trim()) return;

        // Construct payload similar to ActivityPanel
        const payload = {
            content: text,
            timestamp: currentTime,
            // Grab annotations from player ref if drawing
            annotation: isDrawingMode && videoPlayerRef.current
                ? JSON.stringify(videoPlayerRef.current.getAnnotations())
                : null
        };

        try {
            await axios.post(`/api/projects/${project.id}/comments`, {
                ...payload,
                versionId: activeVersion.id,
                // parentId for replies? Ignoring for now in MVP
            }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });

            // Clear drawing after submit
            if (videoPlayerRef.current && videoPlayerRef.current.clearAnnotations) {
                videoPlayerRef.current.clearAnnotations();
            }
            setIsDrawingMode(false);

            // Optimistic update or socket will handle it.
            // But we should probably close sheet if it was a drawing comment? 
            // Or keep it open.
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="h-[100dvh] w-full bg-background relative flex flex-col overflow-hidden transition-colors duration-300" onClick={interact}>
            {/* Header (Absolute) */}
            <div className={`absolute top-0 left-0 right-0 p-4 z-40 transition-opacity duration-300 pointer-events-none ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                <button onClick={() => navigate(-1)} className="bg-black/40 backdrop-blur-md p-2 rounded-full text-white pointer-events-auto active:scale-95">
                    <ChevronLeft size={24} />
                </button>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 relative flex items-center justify-center bg-black">
                {isVideo && (
                    <VideoPlayer
                        ref={videoPlayerRef}
                        src={`/api/media/${activeVersion.filename}`}
                        onTimeUpdate={setCurrentTime}
                        onDurationChange={setDuration}
                        onPlayStateChange={setIsPlaying}
                        viewingAnnotation={viewingAnnotation}
                        isGuest={false} // Assuming auth
                        // Pass specific drawing props
                        isDrawingModeTrigger={isDrawingMode}
                        onDrawingModeChange={setIsDrawingMode}
                    // Disable native controls, we build our own
                    />
                )}

                {isModel && (
                    <div className="w-full h-full relative">
                        {/* Dynamic Import for ModelViewer to avoid circular deps if any */}
                        {/* We import ModelViewer at top level, but render conditionally */}
                        <MobileModelViewer
                            ref={videoPlayerRef} // Reuse ref for uniformity
                            src={`/api/media/${activeVersion.filename}`}
                            assetId={activeVersion.id}
                            onTimeUpdate={setCurrentTime}
                            onDurationChange={setDuration}
                            poster={project.thumbnailPath ? `/api/media/${project.thumbnailPath}` : null}
                        />
                    </div>
                )}

                {!isVideo && !isModel && (
                    <div className="text-white">ImageViewer not ported yet</div>
                )}

                {/* Controls Overlay (Video Only) */}
                <AnimatePresence>
                    {showControls && isVideo && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-30 pointer-events-none"
                        >
                            <MobileControls
                                isPlaying={isPlaying}
                                onTogglePlay={() => videoPlayerRef.current?.togglePlay?.() || videoPlayerRef.current?.play?.()}
                                currentTime={currentTime}
                                duration={duration}
                                onSeek={(t) => videoPlayerRef.current?.seek?.(t)}
                                onOpenComments={() => {
                                    setShowComments(true);
                                    if (isPlaying) videoPlayerRef.current?.pause?.();
                                }}
                                onToggleDrawing={() => setIsDrawingMode(!isDrawingMode)}
                                isDrawingMode={isDrawingMode}
                                commentCount={activeVersion?.comments?.length || 0}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Specific controls for Model (All Models) - Floating Buttons for Comments/Drawing */}
                {/* MobileModelViewer handles its own timeline/animations internally now */}
                {isModel && showControls && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute bottom-28 right-4 z-30 pointer-events-auto flex flex-col gap-4"
                    >
                        <button
                            onClick={() => setIsDrawingMode(!isDrawingMode)}
                            className={`p-3 rounded-full ${isDrawingMode ? 'bg-primary text-white' : 'bg-black/60 text-white backdrop-blur-md'}`}
                        >
                            <span className="sr-only">Draw</span>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>
                        </button>

                        <button
                            onClick={() => setShowComments(true)}
                            className="p-3 rounded-full bg-black/60 text-white backdrop-blur-md relative"
                        >
                            <span className="sr-only">Comments</span>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                            {activeVersion?.comments?.length > 0 && (
                                <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center bg-red-500 rounded-full text-[10px] font-bold">
                                    {activeVersion.comments.length}
                                </span>
                            )}
                        </button>
                    </motion.div>
                )}
            </div>

            {/* Comments Sheet */}
            <MobileCommentsSheet
                isOpen={showComments}
                onClose={() => setShowComments(false)}
                comments={activeVersion?.comments || []}
                onCommentSubmit={handleMobileCommentSubmit}
                onCommentClick={(time, annotation) => {
                    setShowComments(false);
                    // Handle seek/restore depending on type
                    if (time !== null && videoPlayerRef.current?.seek) {
                        videoPlayerRef.current.seek(time);
                    }
                    if (annotation) setViewingAnnotation(JSON.parse(annotation));
                }}
                currentTime={currentTime}
            />
        </div>
    );
};

export default MobileProjectView;
