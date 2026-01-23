import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare } from 'lucide-react';
import { useProjectController } from '../../hooks/useProjectController';

// Components
import VideoPlayer from '../../components/VideoPlayer';
import ImageViewer from '../../components/ImageViewer';
import ModelViewer from '../../components/ThreeD/ModelViewer';
import ShortcutsModal from '../../components/ShortcutsModal';
import ViewerTopMenu from '../../components/ViewerTopMenu';
import VideoImageToolbar from '../../components/VideoImageToolbar';
import FixedCommentsPanel from '../../components/FixedCommentsPanel';
import FloatingPanelContainer from '../../components/FloatingPanelContainer';
import ActivityPanel from '../../components/ActivityPanel';

const ProjectViewDesktop = () => {
    const {
        // Data & State
        project, loading, setProject,
        uploadingVersion, uploadStatusMessage, uploadProgress,
        activeVersionIndex, setActiveVersionIndex,
        compareVersionIndex, setCompareVersionIndex,
        compareAudioEnabled,
        isRenamingVersion, setIsRenamingVersion,
        tempVersionName, setTempVersionName, handleRenameVersion,

        // Playback
        currentTime, setCurrentTime,
        duration, setDuration,
        isPlaying, setIsPlaying,
        volume, setVolume,
        loop,
        playbackRate, setPlaybackRate,
        handleStepFrame,

        // Images
        currentImageIndex, setCurrentImageIndex,

        // Drawing
        pendingAnnotations, setPendingAnnotations,
        viewingAnnotation, setViewingAnnotation,
        isDrawingTrigger, handleTriggerDrawing,
        isDrawingMode, setIsDrawingMode,
        drawingTool, setDrawingTool,
        drawingColor, setDrawingColor,
        drawingStrokeWidth, setDrawingStrokeWidth,
        handleAnnotationAdded,

        // Comments
        highlightedCommentId, setHighlightedCommentId,
        pendingSubmission, setPendingSubmission,
        handleReviewSubmit,

        // Range
        selectionRange, setSelectionRange,

        // Refs
        fileInputRef, imageInputRef, threeDInputRef,
        videoPlayerRef, activityPanelRef,

        // UI
        showControls, setShowControls, handleMouseMove,
        isPanelCollapsed, setIsPanelCollapsed,
        showShortcuts, setShowShortcuts,
        copyClientLink, handlePopout,
        handleInputFocus, handleModelLoaded,
        handleVersionUpload, updateProjectStatus,
        navigate, teamSlug, projectSlug
    } = useProjectController();

    if (loading) return <div>Loading...</div>;
    if (!project) return <div>Project not found</div>;

    const activeVersion = project.versions[activeVersionIndex];
    if (!activeVersion) return <div>No version in this project</div>;

    const startFrame = project.team?.startFrame || 0;

    const isVideo = activeVersion.type === 'video';
    const isImageBundle = activeVersion.type === 'image_bundle';
    const isThreeD = activeVersion.type === 'three_d_asset';

    let activeComments = [];
    if (isVideo) {
        activeComments = activeVersion.comments || [];
    } else if (isImageBundle) {
        if (activeVersion.images && activeVersion.images[currentImageIndex]) {
            activeComments = activeVersion.images[currentImageIndex].comments || [];
        }
    } else if (isThreeD) {
        activeComments = activeVersion.comments || [];
    }

    return (
        <div className="flex h-full w-full overflow-hidden relative">
            <ShortcutsModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />

            {uploadingVersion && (
                <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center backdrop-blur-sm">
                    <div className="bg-zinc-900/90 p-8 rounded-xl border border-zinc-700/50 w-96 text-center shadow-2xl">
                        <h3 className="text-white text-lg font-medium mb-1">Uploading Version</h3>
                        <p className="text-zinc-400 text-xs mb-6 uppercase tracking-wider font-semibold">
                            {uploadStatusMessage || 'Please wait...'}
                        </p>
                        <div className="w-full bg-zinc-800 rounded-full h-2 mb-3 overflow-hidden">
                            <div
                                className="bg-blue-600 h-full rounded-full transition-all duration-200 ease-out"
                                style={{ width: `${uploadProgress}%` }}
                            ></div>
                        </div>
                        <span className="text-zinc-300 font-mono text-sm">{uploadProgress}%</span>
                    </div>
                </div>
            )}

            {/* Main Flex Row Wrapper for Content + Side Panel */}
            <div className="flex flex-1 min-h-0 relative w-full flex-row">
                <div
                    className="flex-1 flex flex-col min-w-0 bg-black relative min-h-0 transition-all duration-300"
                    onMouseMove={handleMouseMove}
                    onMouseLeave={() => isPlaying && setShowControls(false)}
                >
                    {/* Top Controls */}
                    <ViewerTopMenu
                        project={project}
                        activeVersionIndex={activeVersionIndex}
                        onVersionChange={(idx) => {
                            const newVersion = project.versions[idx];
                            if (teamSlug && projectSlug && newVersion.versionName) {
                                navigate(`/${teamSlug}/${projectSlug}/${newVersion.versionName}`);
                            } else {
                                setActiveVersionIndex(idx);
                            }
                            setCompareVersionIndex(null);
                            setCurrentImageIndex(0);
                        }}
                        onRenameVersion={handleRenameVersion}
                        isRenamingVersion={isRenamingVersion}
                        tempVersionName={tempVersionName}
                        setTempVersionName={setTempVersionName}
                        onEnterRename={() => setIsRenamingVersion(true)}
                        compareVersionIndex={compareVersionIndex}
                        onCompareChange={setCompareVersionIndex}
                        onUpload={() => { }}
                        uploadingVersion={uploadingVersion}
                        fileInputRef={fileInputRef}
                        imageInputRef={imageInputRef}
                        threeDInputRef={threeDInputRef}
                        status={project.status}
                        onStatusChange={updateProjectStatus}
                        onShare={copyClientLink}
                    />

                    {/* Inputs for upload */}
                    <input type="file" ref={fileInputRef} onChange={handleVersionUpload} accept="video/*,.glb" className="hidden" />
                    <input type="file" ref={threeDInputRef} onChange={handleVersionUpload} accept=".glb,.fbx,.usd,.usdz,.usda,.usdc,.zip" className="hidden" />
                    <input type="file" ref={imageInputRef} onChange={handleVersionUpload} accept="image/png, image/jpeg, image/jpg, image/webp" multiple className="hidden" />

                    {/* Expand Comments Panel Button (If Collapsed) */}
                    <div className={`absolute top-4 right-16 z-20 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                        {isPanelCollapsed && (
                            <button
                                onClick={() => setIsPanelCollapsed(false)}
                                className="bg-black/50 text-white hover:bg-black/70 p-2 rounded-full border border-white/20 backdrop-blur"
                                title="Show Comments"
                            >
                                <MessageSquare size={16} />
                            </button>
                        )}
                    </div>

                    <div className="flex-1 relative flex items-center justify-center min-h-0 p-0 md:p-0">
                        {isVideo ? (
                            <VideoPlayer
                                ref={videoPlayerRef}
                                onDrawingModeChange={setIsDrawingMode}
                                src={`/api/media/${activeVersion.filename}`}
                                compareSrc={compareVersionIndex !== null ? `/api/media/${project.versions[compareVersionIndex].filename}` : null}
                                compareAudioEnabled={compareAudioEnabled}
                                onTimeUpdate={setCurrentTime}
                                onDurationChange={setDuration}
                                onAnnotationSave={(data) => setPendingAnnotations(data)}
                                viewingAnnotation={viewingAnnotation}
                                isDrawingModeTrigger={isDrawingTrigger}
                                onUserPlay={() => {
                                    setViewingAnnotation(null);
                                    setHighlightedCommentId(null);
                                }}
                                onPlayStateChange={setIsPlaying}
                                loop={loop}
                                playbackRate={playbackRate}
                                frameRate={activeVersion.frameRate || 24}
                                startFrame={startFrame}
                            />
                        ) : isThreeD ? (
                            <ModelViewer
                                ref={videoPlayerRef}
                                src={`/api/media/${activeVersion.filename}`}
                                assetId={activeVersion.id}
                                onAnnotationSave={(data) => setPendingAnnotations(data)}
                                viewingAnnotation={viewingAnnotation}
                                isDrawingModeTrigger={isDrawingTrigger}
                                onCameraInteractionStart={() => setViewingAnnotation(null)}
                                onCameraChange={(state) => { }}
                                onTimeUpdate={setCurrentTime}
                                onDurationChange={setDuration}
                                onReviewSubmit={handleReviewSubmit}
                                onAnnotationAdded={handleAnnotationAdded}
                                existingComments={activeComments}
                                onCommentClick={(time, annotation, id, comment) => {
                                    if (videoPlayerRef.current?.seek) {
                                        videoPlayerRef.current.seek(time);
                                    }
                                    if (comment && comment.cameraState) {
                                        videoPlayerRef.current?.setCameraState(comment.cameraState);
                                    }
                                    setViewingAnnotation(annotation);
                                    setHighlightedCommentId(id);
                                }}
                            />
                        ) : (
                            <ImageViewer
                                ref={videoPlayerRef}
                                onDrawingModeChange={setIsDrawingMode}
                                src={activeVersion.images && activeVersion.images.length > 0 ? `/api/media/${activeVersion.images[currentImageIndex].filename}` : ''}
                                onNext={() => {
                                    if (currentImageIndex < (activeVersion.images?.length || 0) - 1) {
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
                                hasNext={currentImageIndex < (activeVersion.images?.length || 0) - 1}
                                onAnnotationSave={(data) => setPendingAnnotations(data)}
                                viewingAnnotation={viewingAnnotation}
                                isDrawingModeTrigger={isDrawingTrigger}
                                activeImageIndex={currentImageIndex}
                                totalImages={activeVersion.images?.length || 0}
                            />
                        )}
                    </div>

                    {(isVideo || isImageBundle) && (
                        <VideoImageToolbar
                            assetType={isVideo ? 'video' : 'image'}
                            isPlaying={isPlaying}
                            onTogglePlay={() => videoPlayerRef.current?.togglePlay()}
                            currentTime={currentTime}
                            duration={duration || 1}
                            frameRate={activeVersion.frameRate || 24}
                            startFrame={startFrame}
                            onSeek={(t, comment) => {
                                videoPlayerRef.current?.seek(t);
                                if (comment) {
                                    videoPlayerRef.current?.pause();
                                    setViewingAnnotation(comment.annotation ? JSON.parse(comment.annotation) : null);
                                    setHighlightedCommentId(comment.id);
                                    if (comment.duration) {
                                        setSelectionRange({ start: comment.timestamp, end: comment.timestamp + comment.duration });
                                    }
                                } else {
                                    setViewingAnnotation(null);
                                    setHighlightedCommentId(null);
                                }
                            }}
                            markers={activeComments.map(c => ({
                                id: c.id,
                                timestamp: c.timestamp,
                                duration: c.duration,
                                content: c.content,
                                user: c.user,
                                guestName: c.guestName,
                                annotation: c.annotation,
                                isResolved: c.isResolved
                            })).filter(c => !c.isResolved)}
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
                            }}
                            onFullscreen={() => videoPlayerRef.current?.toggleFullscreen()}
                            isCommentsPanelOpen={!isPanelCollapsed}
                            onToggleCommentsPanel={() => setIsPanelCollapsed(!isPanelCollapsed)}
                            onShowShortcuts={() => setShowShortcuts(true)}
                            currentImageIndex={currentImageIndex}
                            totalImages={activeVersion.images?.length || 0}
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
                                setSelectionRange({ start: null, end: null });
                            }}
                            onUndo={() => videoPlayerRef.current?.undoAnnotation?.()}
                            canUndo={videoPlayerRef.current?.getDrawingState?.()?.canUndo || false}
                            onSend={() => videoPlayerRef.current?.sendAnnotations?.()}
                            hasDrawingChanges={videoPlayerRef.current?.getDrawingState?.()?.hasAnnotations || false}
                        />
                    )}
                </div>

                {/* Desktop Panel Logic: Floating for 3D, Fixed for others */}
                <div className={`
                    ${isThreeD ? 'fixed inset-0 pointer-events-none z-40' : `h-full ${!isPanelCollapsed ? 'w-auto' : 'w-0'} flex flex-col overflow-hidden transition-all duration-300 shrink-0`}
                    ${isPanelCollapsed && isThreeD ? 'opacity-0 pointer-events-none' : 'opacity-100'}
                `}>
                    <div className={`${isThreeD ? 'pointer-events-auto' : 'h-full'}`}>
                        <AnimatePresence mode="wait">
                            {!isPanelCollapsed ? (
                                isThreeD ? (
                                    <FloatingPanelContainer
                                        onClose={() => setIsPanelCollapsed(true)}
                                        layoutId="comments-panel"
                                    >
                                        <ActivityPanel
                                            ref={activityPanelRef}
                                            projectId={project.id}
                                            videoId={isVideo ? activeVersion.id : null}
                                            imageId={isImageBundle && activeVersion.images && activeVersion.images[currentImageIndex] ? activeVersion.images[currentImageIndex].id : null}
                                            threeDAssetId={isThreeD ? activeVersion.id : null}
                                            comments={activeComments}
                                            currentTime={currentTime}
                                            rangeDuration={selectionRange.end && selectionRange.start !== null ? Math.abs(selectionRange.end - selectionRange.start) : null}
                                            selectionStart={selectionRange.start}
                                            pendingAnnotations={pendingAnnotations}
                                            getAnnotations={() => videoPlayerRef.current?.getAnnotations()}
                                            getScreenshot={(options) => videoPlayerRef.current?.getScreenshot(options)}
                                            getCameraState={() => videoPlayerRef.current?.getCameraState ? videoPlayerRef.current.getCameraState() : null}
                                            getHotspots={() => videoPlayerRef.current?.getHotspots ? videoPlayerRef.current.getHotspots() : null}
                                            onClearAnnotations={() => {
                                                setPendingAnnotations([]);
                                                videoPlayerRef.current?.clearAnnotations();
                                                setSelectionRange({ start: null, end: null });
                                            }}
                                            onCommentClick={(time, annotation, commentId, comment) => {
                                                if (isVideo && time !== undefined && time !== null) {
                                                    videoPlayerRef.current?.seek(time);
                                                    videoPlayerRef.current?.pause();
                                                } else if (isThreeD) {
                                                    if (videoPlayerRef.current?.seek && time !== undefined && time !== null) {
                                                        videoPlayerRef.current.seek(time);
                                                    }
                                                    if (comment?.cameraState) {
                                                        videoPlayerRef.current?.setCameraState(comment.cameraState);
                                                    } else {
                                                        videoPlayerRef.current?.resetView();
                                                    }
                                                }
                                                setViewingAnnotation(annotation);
                                                setHighlightedCommentId(commentId);

                                                if (isVideo && commentId) {
                                                    // Logic to set range (simplified)
                                                    const findComment = (comments) => {
                                                        for (let c of comments) {
                                                            if (c.id === commentId) return c;
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
                                                    } else {
                                                        setSelectionRange({ start: null, end: null });
                                                    }
                                                } else {
                                                    setSelectionRange({ start: null, end: null });
                                                }
                                            }}
                                            highlightedCommentId={highlightedCommentId}
                                            onCommentAdded={(newComment) => {
                                                const updatedVersions = [...project.versions];
                                                let currentCommentsList;

                                                if (isVideo) {
                                                    currentCommentsList = updatedVersions[activeVersionIndex].comments;
                                                } else if (isImageBundle) {
                                                    currentCommentsList = updatedVersions[activeVersionIndex].images[currentImageIndex].comments;
                                                    if (!currentCommentsList) {
                                                        updatedVersions[activeVersionIndex].images[currentImageIndex].comments = [];
                                                        currentCommentsList = updatedVersions[activeVersionIndex].images[currentImageIndex].comments;
                                                    }
                                                } else if (isThreeD) {
                                                    if (!updatedVersions[activeVersionIndex].comments) updatedVersions[activeVersionIndex].comments = [];
                                                    currentCommentsList = updatedVersions[activeVersionIndex].comments;
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
                                                    addReply(currentCommentsList);
                                                } else {
                                                    currentCommentsList.push(newComment);
                                                }
                                                setProject({ ...project, versions: updatedVersions });
                                            }}
                                            onCommentDeleted={(commentId) => {
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
                                                const updatedVersions = [...project.versions];
                                                let currentCommentsList;
                                                if (isVideo) currentCommentsList = updatedVersions[activeVersionIndex].comments;
                                                else if (isImageBundle) currentCommentsList = updatedVersions[activeVersionIndex].images[currentImageIndex].comments;
                                                else if (isThreeD) currentCommentsList = updatedVersions[activeVersionIndex].comments;

                                                deleteFromTree(currentCommentsList);
                                                setProject({ ...project, versions: updatedVersions });
                                            }}
                                            onCommentUpdated={(updatedComment) => {
                                                const updatedVersions = project.versions.map((version, vIdx) => {
                                                    if (vIdx !== activeVersionIndex) return version;
                                                    if (version.type === 'video' || version.type === 'three_d_asset') {
                                                        const updateInTree = (comments) => {
                                                            return comments.map(c => {
                                                                if (c.id === updatedComment.id) return { ...updatedComment, replies: c.replies };
                                                                if (c.replies) return { ...c, replies: updateInTree(c.replies) };
                                                                return c;
                                                            });
                                                        };
                                                        return { ...version, comments: updateInTree(version.comments) };
                                                    } else if (version.type === 'image_bundle') {
                                                        const updatedImages = version.images.map(img => {
                                                            const updateInTree = (comments) => {
                                                                return comments.map(c => {
                                                                    if (c.id === updatedComment.id) return { ...updatedComment, replies: c.replies };
                                                                    if (c.replies) return { ...c, replies: updateInTree(c.replies) };
                                                                    return c;
                                                                });
                                                            };
                                                            return { ...img, comments: updateInTree(img.comments || []) };
                                                        });
                                                        return { ...version, images: updatedImages };
                                                    }
                                                    return version;
                                                });
                                                setProject({ ...project, versions: updatedVersions });
                                            }}
                                            onToggleDrawing={handleTriggerDrawing}
                                            onClose={() => setIsPanelCollapsed(true)}
                                            onCollapse={() => setIsPanelCollapsed(true)}
                                            onPopout={handlePopout}
                                            onInputFocus={handleInputFocus}
                                            pendingSubmission={pendingSubmission}
                                            onSubmissionComplete={() => setPendingSubmission(null)}
                                        />
                                    </FloatingPanelContainer>
                                ) : (
                                    <FixedCommentsPanel
                                        isOpen={!isPanelCollapsed}
                                        onClose={() => setIsPanelCollapsed(true)}
                                    >
                                        <ActivityPanel
                                            ref={activityPanelRef}
                                            projectId={project.id}
                                            videoId={isVideo ? activeVersion.id : null}
                                            imageId={isImageBundle && activeVersion.images && activeVersion.images[currentImageIndex] ? activeVersion.images[currentImageIndex].id : null}
                                            threeDAssetId={isThreeD ? activeVersion.id : null}
                                            comments={activeComments}
                                            currentTime={currentTime}
                                            rangeDuration={selectionRange.end && selectionRange.start !== null ? Math.abs(selectionRange.end - selectionRange.start) : null}
                                            selectionStart={selectionRange.start}
                                            pendingAnnotations={pendingAnnotations}
                                            getAnnotations={() => videoPlayerRef.current?.getAnnotations()}
                                            getScreenshot={(options) => videoPlayerRef.current?.getScreenshot(options)}
                                            getCameraState={() => videoPlayerRef.current?.getCameraState ? videoPlayerRef.current.getCameraState() : null}
                                            getHotspots={() => videoPlayerRef.current?.getHotspots ? videoPlayerRef.current.getHotspots() : null}
                                            onClearAnnotations={() => {
                                                setPendingAnnotations([]);
                                                videoPlayerRef.current?.clearAnnotations();
                                                setSelectionRange({ start: null, end: null });
                                            }}
                                            onCommentClick={(time, annotation, commentId, comment) => {
                                                if (isVideo && time !== undefined && time !== null) {
                                                    videoPlayerRef.current?.seek(time);
                                                    videoPlayerRef.current?.pause();
                                                }
                                                setViewingAnnotation(annotation);
                                                setHighlightedCommentId(commentId);

                                                if (isVideo && commentId) {
                                                    const findComment = (comments) => {
                                                        for (let c of comments) {
                                                            if (c.id === commentId) return c;
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
                                                    } else {
                                                        setSelectionRange({ start: null, end: null });
                                                    }
                                                } else {
                                                    setSelectionRange({ start: null, end: null });
                                                }
                                            }}
                                            highlightedCommentId={highlightedCommentId}
                                            onCommentAdded={(newComment) => {
                                                const updatedVersions = [...project.versions];
                                                let currentCommentsList;
                                                if (isVideo) currentCommentsList = updatedVersions[activeVersionIndex].comments;
                                                else if (isImageBundle) currentCommentsList = updatedVersions[activeVersionIndex].images[currentImageIndex].comments;
                                                else if (isThreeD) currentCommentsList = updatedVersions[activeVersionIndex].comments;

                                                if (newComment.parentId) {
                                                    const addReply = (comments) => {
                                                        for (let c of comments) {
                                                            if (c.id === newComment.parentId) {
                                                                if (!c.replies) c.replies = [];
                                                                c.replies.push(newComment);
                                                                return true;
                                                            }
                                                            if (c.replies) {
                                                                if (addReply(c.replies)) return true;
                                                            }
                                                        }
                                                        return false;
                                                    };
                                                    addReply(currentCommentsList);
                                                } else {
                                                    currentCommentsList.push(newComment);
                                                }
                                                setProject({ ...project, versions: updatedVersions });
                                            }}
                                            onCommentDeleted={(commentId) => {
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
                                                const updatedVersions = [...project.versions];
                                                let currentCommentsList;
                                                if (isVideo) currentCommentsList = updatedVersions[activeVersionIndex].comments;
                                                else if (isImageBundle) currentCommentsList = updatedVersions[activeVersionIndex].images[currentImageIndex].comments;
                                                else if (isThreeD) currentCommentsList = updatedVersions[activeVersionIndex].comments;

                                                deleteFromTree(currentCommentsList);
                                                setProject({ ...project, versions: updatedVersions });
                                            }}
                                            onCommentUpdated={(updatedComment) => {
                                                const updatedVersions = project.versions.map((version, vIdx) => {
                                                    if (vIdx !== activeVersionIndex) return version;

                                                    const updateInTree = (comments) => {
                                                        return comments.map(c => {
                                                            if (c.id === updatedComment.id) return { ...updatedComment, replies: c.replies };
                                                            if (c.replies) return { ...c, replies: updateInTree(c.replies) };
                                                            return c;
                                                        });
                                                    };

                                                    if (version.type === 'video' || version.type === 'three_d_asset') {
                                                        return { ...version, comments: updateInTree(version.comments) };
                                                    } else if (version.type === 'image_bundle') {
                                                        const updatedImages = version.images.map(img => {
                                                            return { ...img, comments: updateInTree(img.comments || []) };
                                                        });
                                                        return { ...version, images: updatedImages };
                                                    }
                                                    return version;
                                                });
                                                setProject({ ...project, versions: updatedVersions });
                                            }}
                                            onToggleDrawing={handleTriggerDrawing}
                                            onClose={() => setIsPanelCollapsed(true)}
                                            onCollapse={() => setIsPanelCollapsed(true)}
                                            onPopout={handlePopout}
                                            onInputFocus={handleInputFocus}
                                            pendingSubmission={pendingSubmission}
                                            onSubmissionComplete={() => setPendingSubmission(null)}
                                        />
                                    </FixedCommentsPanel>
                                )
                            ) : (
                                isThreeD ? (
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
                                ) : null
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProjectViewDesktop;
