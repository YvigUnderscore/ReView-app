import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useRef } from 'react';
import VideoPlayer from '../components/VideoPlayer';
import ModelViewer from '../components/ThreeD/ModelViewer';
import ImageViewer from '../components/ImageViewer';
import VideoControls from '../components/VideoControls';
import ActivityPanel from '../components/ActivityPanel';
import Timeline from '../components/Timeline';
import ClientLogin from './ClientLogin';
import ShortcutsModal from '../components/ShortcutsModal';
import ViewerTopMenu from '../components/ViewerTopMenu';
import { Loader2, ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';
import { useMobileDetection } from '../components/MobileGuard';
import io from 'socket.io-client';
import FloatingPanelContainer from '../components/FloatingPanelContainer';
import FixedCommentsPanel from '../components/FixedCommentsPanel';
import VideoImageToolbar from '../components/VideoImageToolbar';
import { AnimatePresence, motion } from 'framer-motion';

const ClientReview = () => {
    const { token } = useParams();
    const [socket, setSocket] = useState(null);
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [status, setStatus] = useState(null);
    const [guestName, setGuestName] = useState(localStorage.getItem('clientName') || '');
    const [hasAccess, setHasAccess] = useState(!!localStorage.getItem('clientName'));

    // Player State
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [seekTime, setSeekTime] = useState(null);
    const [pendingAnnotations, setPendingAnnotations] = useState([]);
    const [viewingAnnotation, setViewingAnnotation] = useState(null);
    const [isDrawingTrigger, setIsDrawingTrigger] = useState(false);
    const [highlightedCommentId, setHighlightedCommentId] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(() => {
        const saved = localStorage.getItem('pref_volume');
        return saved !== null ? parseFloat(saved) : 1;
    });
    const [loop, setLoop] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(() => {
        const saved = localStorage.getItem('pref_rate');
        return saved !== null ? parseFloat(saved) : 1;
    });
    const [showMobileComments, setShowMobileComments] = useState(false);
    const [mobileRightPanelDocked, setMobileRightPanelDocked] = useState(false);
    const [rangeDuration, setRangeDuration] = useState(null);
    // Add Selection Range State for persistence
    const [selectionRange, setSelectionRange] = useState(null); // { start, end }

    const [compareVersion, setCompareVersion] = useState(null);
    const [activeVersionIndex, setActiveVersionIndex] = useState(0);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const videoPlayerRef = useRef(null);

    // Image State
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    const [mobileVideoHeight, setMobileVideoHeight] = useState('40%');
    const [isPanelCollapsed, setIsPanelCollapsed] = useState(false); // Used for overlay visibility now

    // Drawing State (controlled from toolbar, passed to player)
    const [isDrawingMode, setIsDrawingMode] = useState(false);
    const [drawingTool, setDrawingTool] = useState('pointer');
    const [drawingColor, setDrawingColor] = useState('#ef4444');
    const [drawingStrokeWidth, setDrawingStrokeWidth] = useState(5);

    const { isMobile, isLandscape } = useMobileDetection();

    // Determine active asset based on activeVersionIndex
    const clientVersions = React.useMemo(() => {
        if (!project) return [];
        const videos = (project.videos || []).map(v => ({ ...v, type: 'video' }));
        const threeD = (project.threeDAssets || []).map(a => ({ ...a, type: '3d' }));
        const imageBundles = (project.imageBundles || []).map(b => ({ ...b, type: 'image_bundle' }));
        return [...videos, ...imageBundles, ...threeD];
    }, [project]);

    const activeAsset = clientVersions[activeVersionIndex] || null;
    const assetType = activeAsset?.type || null;

    const activeComments = React.useMemo(() => {
        if (!activeAsset) return [];
        if (assetType === 'image_bundle') {
            if (activeAsset.images && activeAsset.images[currentImageIndex]) {
                return activeAsset.images[currentImageIndex].comments || [];
            }
            return [];
        }
        return activeAsset.comments || [];
    }, [activeAsset, assetType, currentImageIndex]);

    const isResizing = useRef(false);

    // Removed resize logic for legacy panel

    const handleResize = (e) => {
        if (!isResizing.current) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        if (isMobile && !isLandscape) {
            const percentage = (clientY / window.innerHeight) * 100;
            if (percentage > 20 && percentage < 80) setMobileVideoHeight(`${percentage}%`);
        }
    };

    const stopResize = () => {
        isResizing.current = false;
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', stopResize);
        document.removeEventListener('touchmove', handleResize);
        document.removeEventListener('touchend', stopResize);
    };

    const fetchProject = async () => {
        try {
            const response = await fetch(`/api/client/projects/${token}`);
            if (!response.ok) {
                if (response.status === 403) {
                    const data = await response.json();
                    setStatus(data.status); // INTERNAL_REVIEW
                    throw new Error(data.error);
                }
                throw new Error('Project not found');
            }
            const data = await response.json();
            setProject(data);
            setStatus(data.status);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProject();
    }, [token]);

    // Set default version to latest when project loads
    useEffect(() => {
        if (project) {
            // Assuming versions are ordered chronologically, last one is latest.
            // But we need to check if 'clientVersions' is available yet?
            // clientVersions is memoized on project.
            const totalVersions = (project.videos || []).length + (project.imageBundles || []).length + (project.threeDAssets || []).length;
            if (totalVersions > 0) {
                setActiveVersionIndex(totalVersions - 1);
            }
        }
    }, [project]);

    // Socket Connection for Guest
    useEffect(() => {
        if (!project) return;

        const newSocket = io(window.location.origin, {
            path: '/socket.io/',
            transports: ['websocket'],
            query: { token }
        });

        newSocket.on('connect', () => {
            newSocket.emit('join_project', project.id);
        });

        newSocket.on('COMMENT_ADDED', (data) => {
            if (data.projectId === project.id) {
                fetchProject();
            }
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [project?.id]);

    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            if (e.key === '?' && e.shiftKey) {
                const activeTag = document.activeElement?.tagName?.toLowerCase();
                if (activeTag === 'input' || activeTag === 'textarea') return;
                e.preventDefault();
                setShowShortcuts(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, []);

    // Loop Selection Logic
    useEffect(() => {
        if (isPlaying && selectionRange && selectionRange.start !== null && selectionRange.end !== null) {
            if (Math.abs(selectionRange.end - selectionRange.start) > 0.1) {
                if (currentTime >= selectionRange.end || currentTime < selectionRange.start) {
                    videoPlayerRef.current?.seek(selectionRange.start);
                }
            }
        }
    }, [currentTime, isPlaying, selectionRange]);

    const handleLogin = (name) => {
        localStorage.setItem('clientName', name);
        setGuestName(name);
        setHasAccess(true);
    };

    const handleTriggerDrawing = () => {
        setIsDrawingTrigger(true);
        setTimeout(() => setIsDrawingTrigger(false), 100);
    };

    const [pendingSubmission, setPendingSubmission] = useState(null);

    const activityPanelRef = useRef(null);



    const handleReviewSubmit = (content, image) => {
        // Force open panel if closed
        if (!isMobile) {
            setIsPanelCollapsed(false);
        } else {
            if (isLandscape) setMobileRightPanelDocked(true);
            else setShowMobileComments(true);
        }

        // Queue submission
        setPendingSubmission({ content, image });
    };

    const handleAnnotationAdded = () => {
        // Open panel
        if (!isMobile) {
            setIsPanelCollapsed(false);
        } else {
            if (isLandscape) setMobileRightPanelDocked(true);
            else setShowMobileComments(true);
        }

        // Focus input
        setTimeout(() => {
            if (activityPanelRef.current?.focusInput) {
                activityPanelRef.current.focusInput();
            }
        }, 50);
    };

    const handleInputFocus = () => {
        if (videoPlayerRef.current && isPlaying) {
            videoPlayerRef.current.pause();
        }
    };

    const handleStepFrame = (frames) => {
        if (!videoPlayerRef.current || !activeAsset) return;
        const frameDuration = 1 / (activeAsset.frameRate || 24);
        const newTime = currentTime + (frames * frameDuration);
        videoPlayerRef.current.seek(Math.max(0, Math.min(newTime, duration)));
        videoPlayerRef.current.pause();
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    // Handle specific status errors
    if (status === 'INTERNAL_REVIEW') {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="bg-card border border-border rounded-lg shadow-lg p-8 max-w-md w-full text-center">
                    <h1 className="text-xl font-bold text-foreground mb-4">Access Denied</h1>
                    <p className="text-muted-foreground">
                        Reviews have not started for this project yet. Please check back later.
                    </p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="bg-destructive/10 border border-destructive rounded-lg p-6 text-destructive text-center">
                    <p className="font-medium">{error}</p>
                </div>
            </div>
        );
    }

    if (!hasAccess) {
        return <ClientLogin onLogin={handleLogin} />;
    }

    return (
        <div className="h-[100dvh] flex flex-col bg-background text-foreground">
            <ShortcutsModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />

            {/* Main Content */}
            <div className={`flex-1 overflow-hidden flex w-full relative ${isMobile && !isLandscape ? 'flex-col' : ''}`}>
                {activeAsset ? (
                    <>
                        {/* Mobile Landscape Comments Toggle (Right) */}
                        {isMobile && isLandscape && (
                            <button
                                onClick={() => setMobileRightPanelDocked(!mobileRightPanelDocked)}
                                className={`fixed right-0 top-1/2 -translate-y-1/2 z-50 p-2 bg-black/50 text-white rounded-l-lg border-y border-l border-white/20 hover:bg-black/70 transition-transform ${mobileRightPanelDocked ? '-translate-x-[320px]' : ''}`}
                                title="Toggle Comments"
                            >
                                {mobileRightPanelDocked ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                            </button>
                        )}

                        <div
                            className={`${isMobile && !isLandscape ? (showMobileComments ? '' : 'flex-1') : (assetType === '3d' ? 'w-full h-full absolute inset-0' : 'flex-1 h-full')} flex flex-col min-w-0 bg-black relative min-h-0 transition-all duration-300`}
                            style={isMobile && !isLandscape && showMobileComments ? { height: mobileVideoHeight } : {}}
                        >
                            {/* Top Controls: Burger Menu */}
                            <ViewerTopMenu
                                project={{ ...project, versions: clientVersions }}
                                activeVersionIndex={activeVersionIndex}
                                onVersionChange={(idx) => {
                                    setActiveVersionIndex(idx);
                                    setCompareVersion(null);
                                    setSelectionRange(null);
                                    setRangeDuration(null);
                                    setCurrentImageIndex(0);
                                }}
                                onRenameVersion={() => { }}
                                isRenamingVersion={false}
                                compareVersionIndex={compareVersion ? clientVersions.findIndex(v => v.filename === compareVersion) : null}
                                onCompareChange={(idx) => {
                                    if (idx === null || !clientVersions[idx]) setCompareVersion(null);
                                    else setCompareVersion(clientVersions[idx].filename);
                                }}
                                onUpload={() => { }}
                                uploadingVersion={false}
                                status={status}
                                onStatusChange={() => { }}
                                onShare={() => { }}
                                isClientReview={true}
                            />

                            {/* Project Name Overlay */}
                            <div className="absolute top-4 left-4 z-20 pointer-events-none">
                                <div className="bg-black/50 backdrop-blur rounded px-3 py-1.5 border border-white/20 text-white shadow-sm">
                                    <h1 className="font-semibold text-sm">{project.name}</h1>
                                    <div className="text-[10px] text-white/70">Reviewing as {guestName}</div>
                                </div>
                            </div>

                            <div className="flex-1 relative flex items-center justify-center min-h-0 p-0">
                                {assetType === 'video' ? (
                                    <VideoPlayer
                                        ref={videoPlayerRef}
                                        src={`/api/media/${activeAsset.filename}`}
                                        compareSrc={compareVersion ? `/api/media/${compareVersion}` : null}
                                        onTimeUpdate={setCurrentTime}
                                        onDurationChange={setDuration}
                                        seekTo={seekTime}
                                        onAnnotationSave={(data) => setPendingAnnotations(data)}
                                        viewingAnnotation={viewingAnnotation}
                                        isDrawingModeTrigger={isDrawingTrigger}
                                        onUserPlay={() => {
                                            setViewingAnnotation(null);
                                            setHighlightedCommentId(null);
                                        }}
                                        isGuest={true}
                                        guestName={guestName}
                                        isReadOnly={status === 'ALL_REVIEWS_DONE'}
                                        onReviewSubmit={handleReviewSubmit}
                                        onDrawingModeChange={setIsDrawingMode}
                                    />
                                ) : assetType === 'image_bundle' ? (
                                    <ImageViewer
                                        ref={videoPlayerRef}
                                        src={activeAsset.images && activeAsset.images.length > 0 ? `/api/media/${activeAsset.images[currentImageIndex].filename}` : ''}
                                        onNext={() => {
                                            if (currentImageIndex < (activeAsset.images?.length || 0) - 1) {
                                                setCurrentImageIndex(currentImageIndex + 1);
                                                setViewingAnnotation(null);
                                            }
                                        }}
                                        onPrev={() => {
                                            if (currentImageIndex > 0) {
                                                setCurrentImageIndex(currentImageIndex - 1);
                                                setViewingAnnotation(null);
                                            }
                                        }}
                                        hasPrev={currentImageIndex > 0}
                                        hasNext={currentImageIndex < (activeAsset.images?.length || 0) - 1}
                                        onAnnotationSave={(data) => setPendingAnnotations(data)}
                                        viewingAnnotation={viewingAnnotation}
                                        isDrawingModeTrigger={isDrawingTrigger}
                                        activeImageIndex={currentImageIndex}
                                        totalImages={activeAsset.images?.length || 0}
                                        onReviewSubmit={handleReviewSubmit}
                                        onDrawingModeChange={setIsDrawingMode}
                                    />
                                ) : (
                                    <ModelViewer
                                        ref={videoPlayerRef}
                                        src={`/api/media/${activeAsset.filename}`}
                                        entryFile={activeAsset.originalName ? activeAsset.originalName.split('::')[1] : null}
                                        onAnnotationSave={(data) => setPendingAnnotations(data)}
                                        viewingAnnotation={viewingAnnotation}
                                        isDrawingModeTrigger={isDrawingTrigger}
                                        onCameraInteractionStart={() => setViewingAnnotation(null)}
                                        onTimeUpdate={setCurrentTime}
                                        onDurationChange={setDuration}
                                        onReviewSubmit={handleReviewSubmit}
                                        onAnnotationAdded={handleAnnotationAdded}
                                        existingComments={activeComments}
                                        onCommentClick={(time, annotation, id, comment) => {
                                            // Seek to the animation timecode
                                            if (videoPlayerRef.current?.seek) {
                                                videoPlayerRef.current.seek(time);
                                            }

                                            // Restore camera state if available
                                            if (comment && comment.cameraState) {
                                                const state = typeof comment.cameraState === 'string'
                                                    ? JSON.parse(comment.cameraState)
                                                    : comment.cameraState;
                                                videoPlayerRef.current?.setCameraState(state);
                                            }
                                            setViewingAnnotation(annotation);
                                            setHighlightedCommentId(id);
                                        }}
                                    />
                                )}
                            </div>
                            {(assetType === 'video' || assetType === 'image_bundle') && (
                                <VideoImageToolbar
                                    assetType={assetType === 'image_bundle' ? 'image' : 'video'}
                                    isPlaying={isPlaying}
                                    onTogglePlay={() => videoPlayerRef.current?.togglePlay()}
                                    currentTime={currentTime}
                                    duration={duration || 1}
                                    frameRate={activeAsset.frameRate || 24}
                                    startFrame={0}
                                    onSeek={(t, comment) => {
                                        videoPlayerRef.current?.seek(t);
                                        if (comment) {
                                            setViewingAnnotation(comment.annotation ? JSON.parse(comment.annotation) : null);
                                            setHighlightedCommentId(comment.id);
                                            if (comment.duration) setRangeDuration(comment.duration);
                                        } else {
                                            setViewingAnnotation(null);
                                            setHighlightedCommentId(null);
                                        }
                                    }}
                                    markers={(activeAsset.comments || []).map(c => ({
                                        id: c.id,
                                        timestamp: c.timestamp,
                                        duration: c.duration,
                                        content: c.content,
                                        annotation: c.annotation,
                                        isResolved: c.isResolved,
                                        user: c.user || c.guestInfo
                                    }))}
                                    selectionRange={selectionRange}
                                    highlightedCommentId={highlightedCommentId}
                                    volume={volume}
                                    onVolumeChange={(v) => {
                                        setVolume(v);
                                        localStorage.setItem('pref_volume', v);
                                        videoPlayerRef.current?.setVolume(v);
                                    }}
                                    playbackRate={playbackRate}
                                    onPlaybackRateChange={(rate) => {
                                        setPlaybackRate(rate);
                                        localStorage.setItem('pref_rate', rate);
                                        videoPlayerRef.current?.setPlaybackRate(rate);
                                    }}
                                    onFullscreen={() => videoPlayerRef.current?.toggleFullscreen()}
                                    isCommentsPanelOpen={!isPanelCollapsed}
                                    onToggleCommentsPanel={() => {
                                        if (isMobile && isLandscape) {
                                            setMobileRightPanelDocked(!mobileRightPanelDocked);
                                        } else if (!isMobile) {
                                            setIsPanelCollapsed(!isPanelCollapsed);
                                        } else {
                                            setShowMobileComments(!showMobileComments);
                                        }
                                    }}
                                    onShowShortcuts={() => setShowShortcuts(true)}
                                    currentImageIndex={currentImageIndex}
                                    totalImages={activeAsset.images?.length || 0}
                                    // Drawing mode props
                                    isDrawingMode={isDrawingMode}
                                    onToggleDrawingMode={(mode) => {
                                        setIsDrawingMode(mode);
                                        videoPlayerRef.current?.setDrawingMode?.(mode);
                                    }}
                                    drawingTool={drawingTool}
                                    onDrawingToolChange={(tool) => {
                                        setDrawingTool(tool);
                                        videoPlayerRef.current?.setDrawingTool?.(tool);
                                    }}
                                    drawingColor={drawingColor}
                                    onDrawingColorChange={(color) => {
                                        setDrawingColor(color);
                                        videoPlayerRef.current?.setDrawingColor?.(color);
                                    }}
                                    drawingStrokeWidth={drawingStrokeWidth}
                                    onDrawingStrokeWidthChange={(width) => {
                                        setDrawingStrokeWidth(width);
                                        videoPlayerRef.current?.setDrawingStrokeWidth?.(width);
                                    }}
                                    onClearAnnotations={() => {
                                        videoPlayerRef.current?.clearAnnotations?.();
                                        setPendingAnnotations([]);
                                    }}
                                    onUndo={() => videoPlayerRef.current?.undoAnnotation?.()}
                                    canUndo={videoPlayerRef.current?.getDrawingState?.()?.canUndo || false}
                                    onSend={() => videoPlayerRef.current?.sendAnnotations?.()}
                                    hasDrawingChanges={videoPlayerRef.current?.getDrawingState?.()?.hasAnnotations || false}
                                />
                            )}
                        </div>

                        {/* Comments Panel - Fixed for video/image, Floating for 3D */}
                        <div
                            className={`
                    ${(!isMobile || (isMobile && isLandscape && mobileRightPanelDocked))
                                    ? (assetType === '3d'
                                        ? 'fixed inset-0 pointer-events-none z-40'
                                        : `h-full ${!isPanelCollapsed ? 'w-auto' : 'w-0'} flex flex-col overflow-hidden transition-all duration-300 shrink-0`)
                                    : 'relative block w-full bg-background flex flex-col transition-all duration-300'}
                    ${(isMobile && !isLandscape) ? (showMobileComments ? 'flex-1' : 'h-0 overflow-hidden') : ''}
                    ${(isMobile && isLandscape && !mobileRightPanelDocked) ? 'hidden' : ''}
                 `}
                        >
                            {(!isMobile || (isMobile && isLandscape && mobileRightPanelDocked)) ? (
                                <div className={`${assetType === '3d' ? 'pointer-events-auto' : 'h-full'}`}>
                                    <AnimatePresence mode="wait">
                                        {/* 3D: FloatingPanelContainer */}
                                        {!isPanelCollapsed && assetType === '3d' && (
                                            <FloatingPanelContainer
                                                key="panel-3d"
                                                layoutId="comments-panel"
                                                onClose={() => setIsPanelCollapsed(true)}
                                            >
                                                <ActivityPanel
                                                    ref={activityPanelRef}
                                                    projectId={project.id}
                                                    videoId={null}
                                                    imageId={null}
                                                    threeDAssetId={activeAsset.id}
                                                    comments={activeComments}
                                                    currentTime={currentTime}
                                                    rangeDuration={rangeDuration}
                                                    selectionStart={selectionRange ? selectionRange.start : null}
                                                    pendingAnnotations={pendingAnnotations}
                                                    getAnnotations={() => videoPlayerRef.current?.getAnnotations()}
                                                    getScreenshot={(options) => videoPlayerRef.current?.getScreenshot(options)}
                                                    getCameraState={() => videoPlayerRef.current?.getCameraState ? videoPlayerRef.current.getCameraState() : null}
                                                    getHotspots={() => videoPlayerRef.current?.getHotspots ? videoPlayerRef.current.getHotspots() : null}
                                                    onClearAnnotations={() => {
                                                        setPendingAnnotations([]);
                                                        videoPlayerRef.current?.clearAnnotations();
                                                        setRangeDuration(null);
                                                        setSelectionRange(null);
                                                    }}
                                                    onCommentClick={(time, annotation, id, comment) => {
                                                        if (videoPlayerRef.current?.seek) {
                                                            videoPlayerRef.current.seek(time);
                                                        }
                                                        if (comment && comment.cameraState) {
                                                            const state = typeof comment.cameraState === 'string'
                                                                ? JSON.parse(comment.cameraState)
                                                                : comment.cameraState;
                                                            videoPlayerRef.current?.setCameraState(state);
                                                        }
                                                        setViewingAnnotation(annotation);
                                                        setHighlightedCommentId(id);
                                                    }}
                                                    highlightedCommentId={highlightedCommentId}
                                                    onCommentAdded={(newComment) => {
                                                        const newProject = { ...project };
                                                        const videosCount = (project.videos || []).length;
                                                        const bundlesCount = (project.imageBundles || []).length;
                                                        const threeDIndex = activeVersionIndex - videosCount - bundlesCount;
                                                        const targetCommentsList = newProject.threeDAssets[threeDIndex].comments;
                                                        if (newComment.parentId) {
                                                            const addReply = (comments) => {
                                                                for (let c of comments) {
                                                                    if (c.id === newComment.parentId) {
                                                                        if (!c.replies) c.replies = [];
                                                                        c.replies.push(newComment);
                                                                        return true;
                                                                    }
                                                                    if (c.replies && c.replies.length > 0) {
                                                                        if (addReply(c.replies)) return true;
                                                                    }
                                                                }
                                                                return false;
                                                            };
                                                            addReply(targetCommentsList);
                                                        } else {
                                                            targetCommentsList.push(newComment);
                                                        }
                                                        setProject(newProject);
                                                    }}
                                                    onCommentUpdated={(updatedComment) => {
                                                        const newProject = { ...project };
                                                        const videosCount = (project.videos || []).length;
                                                        const bundlesCount = (project.imageBundles || []).length;
                                                        const threeDIndex = activeVersionIndex - videosCount - bundlesCount;
                                                        const targetCommentsList = newProject.threeDAssets[threeDIndex].comments;
                                                        const updateInTree = (comments) => {
                                                            for (let i = 0; i < comments.length; i++) {
                                                                if (comments[i].id === updatedComment.id) {
                                                                    comments[i] = { ...updatedComment, replies: comments[i].replies };
                                                                    return true;
                                                                }
                                                                if (comments[i].replies) {
                                                                    if (updateInTree(comments[i].replies)) return true;
                                                                }
                                                            }
                                                            return false;
                                                        };
                                                        updateInTree(targetCommentsList || []);
                                                        setProject(newProject);
                                                    }}
                                                    onCommentDeleted={(commentId) => {
                                                        const newProject = { ...project };
                                                        const videosCount = (project.videos || []).length;
                                                        const bundlesCount = (project.imageBundles || []).length;
                                                        const threeDIndex = activeVersionIndex - videosCount - bundlesCount;
                                                        const targetCommentsList = newProject.threeDAssets[threeDIndex].comments;
                                                        const deleteFromTree = (comments) => {
                                                            const index = comments.findIndex(c => c.id === commentId);
                                                            if (index !== -1) {
                                                                comments.splice(index, 1);
                                                                return true;
                                                            }
                                                            for (let c of comments) {
                                                                if (c.replies && deleteFromTree(c.replies)) return true;
                                                            }
                                                            return false;
                                                        };
                                                        deleteFromTree(targetCommentsList || []);
                                                        setProject(newProject);
                                                    }}
                                                    onToggleDrawing={handleTriggerDrawing}
                                                    isGuest={true}
                                                    guestName={guestName}
                                                    clientToken={token}
                                                    isReadOnly={status === 'ALL_REVIEWS_DONE'}
                                                    onClose={() => setIsPanelCollapsed(true)}
                                                    onCollapse={() => setIsPanelCollapsed(true)}
                                                    onInputFocus={handleInputFocus}
                                                    pendingSubmission={pendingSubmission}
                                                    onSubmissionComplete={() => setPendingSubmission(null)}
                                                />
                                            </FloatingPanelContainer>
                                        )}

                                        {/* Video/Image: FixedCommentsPanel */}
                                        {!isPanelCollapsed && assetType !== '3d' && (
                                            <FixedCommentsPanel
                                                key="panel-2d"
                                                isOpen={!isPanelCollapsed}
                                                onClose={() => setIsPanelCollapsed(true)}
                                                width={350}
                                            >
                                                <ActivityPanel
                                                    ref={activityPanelRef}
                                                    projectId={project.id}
                                                    videoId={assetType === 'video' ? activeAsset.id : null}
                                                    imageId={assetType === 'image_bundle' && activeAsset.images && activeAsset.images[currentImageIndex] ? activeAsset.images[currentImageIndex].id : null}
                                                    threeDAssetId={null}
                                                    comments={activeComments}
                                                    currentTime={currentTime}
                                                    rangeDuration={rangeDuration}
                                                    selectionStart={selectionRange ? selectionRange.start : null}
                                                    pendingAnnotations={pendingAnnotations}
                                                    getAnnotations={() => videoPlayerRef.current?.getAnnotations()}
                                                    getScreenshot={(options) => videoPlayerRef.current?.getScreenshot(options)}
                                                    getCameraState={() => null}
                                                    getHotspots={() => null}
                                                    onClearAnnotations={() => {
                                                        setPendingAnnotations([]);
                                                        videoPlayerRef.current?.clearAnnotations();
                                                        setRangeDuration(null);
                                                        setSelectionRange(null);
                                                    }}
                                                    onCommentClick={(time, annotation, id, comment) => {
                                                        if (assetType === 'video' && time !== undefined && time !== null) {
                                                            videoPlayerRef.current?.seek(time);
                                                        }
                                                        setViewingAnnotation(annotation);
                                                        setHighlightedCommentId(id);
                                                        if (id) {
                                                            const findComment = (comments) => {
                                                                for (let c of comments) {
                                                                    if (c.id === id) return c;
                                                                    if (c.replies) {
                                                                        const found = findComment(c.replies);
                                                                        if (found) return found;
                                                                    }
                                                                }
                                                                return null;
                                                            };
                                                            // activeComments is memoized in ClientReview
                                                            const target = findComment(activeComments);
                                                            if (target && target.duration) {
                                                                setSelectionRange({ start: target.timestamp, end: target.timestamp + target.duration });
                                                                setRangeDuration(target.duration);
                                                            } else {
                                                                setSelectionRange(null);
                                                                setRangeDuration(null);
                                                            }
                                                        } else {
                                                            setSelectionRange(null);
                                                            setRangeDuration(null);
                                                        }
                                                    }}
                                                    highlightedCommentId={highlightedCommentId}
                                                    onCommentAdded={(newComment) => {
                                                        const newProject = { ...project };
                                                        const videosCount = (project.videos || []).length;
                                                        const bundlesCount = (project.imageBundles || []).length;
                                                        let targetCommentsList;
                                                        if (activeVersionIndex < videosCount) {
                                                            targetCommentsList = newProject.videos[activeVersionIndex].comments;
                                                        } else {
                                                            const bundleIndex = activeVersionIndex - videosCount;
                                                            if (!newProject.imageBundles[bundleIndex].images[currentImageIndex].comments) {
                                                                newProject.imageBundles[bundleIndex].images[currentImageIndex].comments = [];
                                                            }
                                                            targetCommentsList = newProject.imageBundles[bundleIndex].images[currentImageIndex].comments;
                                                        }
                                                        if (newComment.parentId) {
                                                            const addReply = (comments) => {
                                                                for (let c of comments) {
                                                                    if (c.id === newComment.parentId) {
                                                                        if (!c.replies) c.replies = [];
                                                                        c.replies.push(newComment);
                                                                        return true;
                                                                    }
                                                                    if (c.replies && c.replies.length > 0) {
                                                                        if (addReply(c.replies)) return true;
                                                                    }
                                                                }
                                                                return false;
                                                            };
                                                            addReply(targetCommentsList);
                                                        } else {
                                                            targetCommentsList.push(newComment);
                                                        }
                                                        setProject(newProject);
                                                    }}
                                                    onCommentUpdated={(updatedComment) => {
                                                        const newProject = { ...project };
                                                        const videosCount = (project.videos || []).length;
                                                        const bundlesCount = (project.imageBundles || []).length;
                                                        let targetCommentsList;
                                                        if (activeVersionIndex < videosCount) {
                                                            targetCommentsList = newProject.videos[activeVersionIndex].comments;
                                                        } else {
                                                            const bundleIndex = activeVersionIndex - videosCount;
                                                            targetCommentsList = newProject.imageBundles[bundleIndex].images[currentImageIndex].comments;
                                                        }
                                                        const updateInTree = (comments) => {
                                                            for (let i = 0; i < comments.length; i++) {
                                                                if (comments[i].id === updatedComment.id) {
                                                                    comments[i] = { ...updatedComment, replies: comments[i].replies };
                                                                    return true;
                                                                }
                                                                if (comments[i].replies) {
                                                                    if (updateInTree(comments[i].replies)) return true;
                                                                }
                                                            }
                                                            return false;
                                                        };
                                                        updateInTree(targetCommentsList || []);
                                                        setProject(newProject);
                                                    }}
                                                    onCommentDeleted={(commentId) => {
                                                        const newProject = { ...project };
                                                        const videosCount = (project.videos || []).length;
                                                        const bundlesCount = (project.imageBundles || []).length;
                                                        let targetCommentsList;
                                                        if (activeVersionIndex < videosCount) {
                                                            targetCommentsList = newProject.videos[activeVersionIndex].comments;
                                                        } else {
                                                            const bundleIndex = activeVersionIndex - videosCount;
                                                            targetCommentsList = newProject.imageBundles[bundleIndex].images[currentImageIndex].comments;
                                                        }
                                                        const deleteFromTree = (comments) => {
                                                            const index = comments.findIndex(c => c.id === commentId);
                                                            if (index !== -1) {
                                                                comments.splice(index, 1);
                                                                return true;
                                                            }
                                                            for (let c of comments) {
                                                                if (c.replies && deleteFromTree(c.replies)) return true;
                                                            }
                                                            return false;
                                                        };
                                                        deleteFromTree(targetCommentsList || []);
                                                        setProject(newProject);
                                                    }}
                                                    onToggleDrawing={handleTriggerDrawing}
                                                    isGuest={true}
                                                    guestName={guestName}
                                                    clientToken={token}
                                                    isReadOnly={status === 'ALL_REVIEWS_DONE'}
                                                    onClose={() => setIsPanelCollapsed(true)}
                                                    onCollapse={() => setIsPanelCollapsed(true)}
                                                    onInputFocus={handleInputFocus}
                                                    pendingSubmission={pendingSubmission}
                                                    onSubmissionComplete={() => setPendingSubmission(null)}
                                                />
                                            </FixedCommentsPanel>
                                        )}

                                        {/* Collapsed button (3D only - video/image uses toolbar toggle) */}
                                        {isPanelCollapsed && assetType === '3d' && (
                                            <motion.button
                                                key="button"
                                                layoutId="comments-panel"
                                                onClick={() => setIsPanelCollapsed(false)}
                                                className="fixed top-24 right-4 z-50 p-3 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 flex items-center justify-center pointer-events-auto"
                                                whileHover={{ scale: 1.1 }}
                                                whileTap={{ scale: 0.9 }}
                                                initial={{ opacity: 0, scale: 0.5 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.5 }}
                                                title="Open Comments"
                                            >
                                                <MessageSquare size={24} />
                                            </motion.button>
                                        )}
                                    </AnimatePresence>
                                </div>
                            ) : (
                                <ActivityPanel
                                    ref={activityPanelRef}
                                    projectId={project.id}
                                    videoId={assetType === 'video' ? activeAsset.id : null}
                                    imageId={assetType === 'image_bundle' && activeAsset.images && activeAsset.images[currentImageIndex] ? activeAsset.images[currentImageIndex].id : null}
                                    threeDAssetId={assetType === '3d' ? activeAsset.id : null}
                                    comments={activeComments}
                                    currentTime={currentTime}
                                    rangeDuration={rangeDuration}
                                    selectionStart={selectionRange ? selectionRange.start : null}
                                    pendingAnnotations={pendingAnnotations}
                                    getAnnotations={() => videoPlayerRef.current?.getAnnotations()}
                                    getScreenshot={(options) => videoPlayerRef.current?.getScreenshot(options)}
                                    getCameraState={() => videoPlayerRef.current?.getCameraState ? videoPlayerRef.current.getCameraState() : null}
                                    getHotspots={() => videoPlayerRef.current?.getHotspots ? videoPlayerRef.current.getHotspots() : null}
                                    onClearAnnotations={() => {
                                        setPendingAnnotations([]);
                                        videoPlayerRef.current?.clearAnnotations();
                                        setRangeDuration(null);
                                        setSelectionRange(null);
                                    }}
                                    pendingSubmission={pendingSubmission}
                                    onSubmissionComplete={() => setPendingSubmission(null)}
                                    onCommentClick={(time, annotation, id, comment) => {
                                        if (assetType === 'video') {
                                            videoPlayerRef.current?.seek(time);
                                        } else if (assetType === '3d' && comment && comment.cameraState) {
                                            const state = typeof comment.cameraState === 'string'
                                                ? JSON.parse(comment.cameraState)
                                                : comment.cameraState;
                                            videoPlayerRef.current?.setCameraState(state);
                                        }

                                        setViewingAnnotation(annotation);
                                        setHighlightedCommentId(id);
                                        setShowMobileComments(false);

                                        // Find comment to see if it has a duration
                                        const findComment = (comments) => {
                                            for (let c of comments) {
                                                if (c.id === id) return c;
                                                if (c.replies) {
                                                    const found = findComment(c.replies);
                                                    if (found) return found;
                                                }
                                            }
                                            return null;
                                        };
                                        const target = findComment(activeComments);
                                        if (target && target.duration) {
                                            setSelectionRange({ start: target.timestamp, end: target.timestamp + target.duration });
                                            setRangeDuration(target.duration);
                                        } else {
                                            setSelectionRange(null);
                                            setRangeDuration(null);
                                        }
                                    }}
                                    highlightedCommentId={highlightedCommentId}
                                    onCommentAdded={(newComment) => {
                                        const newProject = { ...project };
                                        let targetCommentsList;

                                        const videosCount = (project.videos || []).length;
                                        const bundlesCount = (project.imageBundles || []).length;

                                        if (activeVersionIndex < videosCount) {
                                            targetCommentsList = newProject.videos[activeVersionIndex].comments;
                                        } else if (activeVersionIndex < videosCount + bundlesCount) {
                                            const bundleIndex = activeVersionIndex - videosCount;
                                            targetCommentsList = newProject.imageBundles[bundleIndex].images[currentImageIndex].comments;
                                        } else {
                                            const threeDIndex = activeVersionIndex - videosCount - bundlesCount;
                                            targetCommentsList = newProject.threeDAssets[threeDIndex].comments;
                                        }

                                        if (newComment.parentId) {
                                            const addReply = (comments) => {
                                                for (let c of comments) {
                                                    if (c.id === newComment.parentId) {
                                                        if (!c.replies) c.replies = [];
                                                        c.replies.push(newComment);
                                                        return true;
                                                    }
                                                    if (c.replies && c.replies.length > 0) {
                                                        if (addReply(c.replies)) return true;
                                                    }
                                                }
                                                return false;
                                            };
                                            addReply(targetCommentsList);
                                        } else {
                                            targetCommentsList.push(newComment);
                                        }

                                        setProject(newProject);
                                    }}
                                    onCommentUpdated={(updatedComment) => {
                                        const newProject = { ...project };
                                        const videosCount = (project.videos || []).length;
                                        const bundlesCount = (project.imageBundles || []).length;

                                        let targetCommentsList;
                                        if (activeVersionIndex < videosCount) {
                                            targetCommentsList = newProject.videos[activeVersionIndex].comments;
                                        } else if (activeVersionIndex < videosCount + bundlesCount) {
                                            const bundleIndex = activeVersionIndex - videosCount;
                                            targetCommentsList = newProject.imageBundles[bundleIndex].images[currentImageIndex].comments;
                                        } else {
                                            const threeDIndex = activeVersionIndex - videosCount - bundlesCount;
                                            targetCommentsList = newProject.threeDAssets[threeDIndex].comments;
                                        }

                                        const updateInTree = (comments) => {
                                            for (let i = 0; i < comments.length; i++) {
                                                if (comments[i].id === updatedComment.id) {
                                                    comments[i] = { ...updatedComment, replies: comments[i].replies };
                                                    return true;
                                                }
                                                if (comments[i].replies) {
                                                    if (updateInTree(comments[i].replies)) return true;
                                                }
                                            }
                                            return false;
                                        };
                                        updateInTree(targetCommentsList || []);
                                        setProject(newProject);
                                    }}
                                    onCommentDeleted={(commentId) => {
                                        const newProject = { ...project };
                                        const videosCount = (project.videos || []).length;
                                        const bundlesCount = (project.imageBundles || []).length;

                                        let targetCommentsList;
                                        if (activeVersionIndex < videosCount) {
                                            targetCommentsList = newProject.videos[activeVersionIndex].comments;
                                        } else if (activeVersionIndex < videosCount + bundlesCount) {
                                            const bundleIndex = activeVersionIndex - videosCount;
                                            targetCommentsList = newProject.imageBundles[bundleIndex].images[currentImageIndex].comments;
                                        } else {
                                            const threeDIndex = activeVersionIndex - videosCount - bundlesCount;
                                            targetCommentsList = newProject.threeDAssets[threeDIndex].comments;
                                        }

                                        const deleteFromTree = (comments) => {
                                            const index = comments.findIndex(c => c.id === commentId);
                                            if (index !== -1) {
                                                comments.splice(index, 1);
                                                return true;
                                            }
                                            for (let c of comments) {
                                                if (c.replies && deleteFromTree(c.replies)) return true;
                                            }
                                            return false;
                                        };
                                        deleteFromTree(targetCommentsList || []);
                                        setProject(newProject);
                                    }}
                                    onToggleDrawing={handleTriggerDrawing}
                                    isGuest={true}
                                    guestName={guestName}
                                    clientToken={token}
                                    isReadOnly={status === 'ALL_REVIEWS_DONE'}
                                    onClose={() => {
                                        if (isMobile && isLandscape) {
                                            setMobileRightPanelDocked(false);
                                        } else if (!isMobile) {
                                            setIsPanelCollapsed(true);
                                        } else {
                                            setShowMobileComments(false);
                                        }
                                    }}
                                    onCollapse={() => setIsPanelCollapsed(true)}
                                    onInputFocus={handleInputFocus}
                                />
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        No reviewable assets available.
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClientReview;
