import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useRef } from 'react';
import VideoPlayer from '../components/VideoPlayer';
import ThreeDViewer from '../components/ThreeD/ThreeDViewer';
import VideoControls from '../components/VideoControls';
import ActivityPanel from '../components/ActivityPanel';
import Timeline from '../components/Timeline';
import ClientLogin from './ClientLogin';
import ShortcutsModal from '../components/ShortcutsModal';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMobileDetection } from '../components/MobileGuard';

const ClientReview = () => {
  const { token } = useParams();
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
  const [showShortcuts, setShowShortcuts] = useState(false);
  const videoPlayerRef = useRef(null);

  const { isMobile, isLandscape } = useMobileDetection();

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
         // Loop within selection range if playing
         // Tolerance of 0.1s to prevent glitching at exact boundary
         // Also handle case where start == end (single point selection, don't loop)
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

  // Determine active asset
  let activeAsset = null;
  let assetType = null;

  if (project.videos && project.videos.length > 0) {
      activeAsset = project.videos[0];
      assetType = 'video';
  } else if (project.threeDAssets && project.threeDAssets.length > 0) {
      activeAsset = project.threeDAssets[0];
      assetType = '3d';
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-background text-foreground">
      <ShortcutsModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
      {/* Simplified Header */}
      <div className={`${isMobile && !isLandscape ? 'hidden' : 'flex'} h-16 border-b border-border bg-card px-4 items-center justify-between shrink-0`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded flex items-center justify-center text-primary-foreground font-bold">
            R
          </div>
          <h1 className="font-semibold text-lg">{project.name}</h1>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status === 'ALL_REVIEWS_DONE' ? 'bg-green-500/10 text-green-500' : 'bg-secondary text-secondary-foreground'}`}>
             {status === 'ALL_REVIEWS_DONE' ? 'Reviews Done (Read-only)' : 'Client Review'}
          </span>
        </div>
        <div className="flex items-center gap-4">
             {/* Comparison Selector - Only for Video */}
             {assetType === 'video' && project.videos.length > 1 && (
                 <select
                    className="bg-muted text-xs p-1 rounded border-none focus:ring-1 focus:ring-primary"
                    value={compareVersion || ''}
                    onChange={(e) => setCompareVersion(e.target.value || null)}
                 >
                     <option value="">Single View</option>
                     {project.videos.filter(v => v.id !== activeAsset.id).map(v => (
                         <option key={v.id} value={v.filename}>Compare with {v.versionName}</option>
                     ))}
                 </select>
             )}

            <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Reviewing as <strong>{guestName}</strong></span>
                <button
                    onClick={() => { localStorage.removeItem('clientName'); setHasAccess(false); }}
                    className="text-xs text-primary hover:underline"
                >
                    Change Name
                </button>
            </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 overflow-hidden flex w-full relative ${isMobile && !isLandscape ? 'flex-col' : 'flex-row'}`}>
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

             <div className={`${isMobile && !isLandscape ? (showMobileComments ? 'h-[40%]' : 'flex-1') : 'flex-1'} flex flex-col min-w-0 bg-black relative min-h-0 transition-all duration-300`}>
                 <div className="flex-1 relative flex items-center justify-center min-h-0 p-4">
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
                        />
                    ) : (
                        <ThreeDViewer
                            ref={videoPlayerRef}
                            src={`/api/media/${activeAsset.filename}`}
                            onAnnotationSave={(data) => setPendingAnnotations(data)}
                            viewingAnnotation={viewingAnnotation}
                            isDrawingModeTrigger={isDrawingTrigger}
                            onCameraInteractionStart={() => setViewingAnnotation(null)}
                        />
                    )}
                 </div>
                 {assetType === 'video' && (
                     <>
                        <Timeline
                            currentTime={currentTime}
                            duration={duration || 100}
                            selectionRange={selectionRange}
                            onSeek={(t, comment) => {
                                videoPlayerRef.current?.seek(t);
                                if (comment) {
                                    setViewingAnnotation(comment.annotation ? JSON.parse(comment.annotation) : null);
                                    setHighlightedCommentId(comment.id);
                                    // Set range duration if comment has one
                                    if (comment.duration) setRangeDuration(comment.duration);
                                } else {
                                    setViewingAnnotation(null);
                                    setHighlightedCommentId(null);
                                }
                            }}
                            onRangeChange={(start, end) => {
                                if (start === null && end === null) {
                                    setSelectionRange(null);
                                    setRangeDuration(null);
                                } else {
                                    setSelectionRange({ start, end });
                                }
                            }}
                            onRangeCommit={(start, end) => {
                                setSelectionRange({ start, end });
                                setRangeDuration(end - start);
                                // Pause on range selection done (standard UX for precise comment)
                                videoPlayerRef.current?.pause();
                            }}
                            markers={activeAsset.comments.map(c => ({
                                id: c.id,
                                timestamp: c.timestamp,
                                duration: c.duration,
                                content: c.content,
                                annotation: c.annotation,
                                isResolved: c.isResolved
                            }))}
                        />
                        <VideoControls
                            isPlaying={isPlaying}
                            onTogglePlay={() => videoPlayerRef.current?.togglePlay()}
                            currentTime={currentTime}
                            duration={duration}
                            volume={volume}
                            onVolumeChange={(v) => {
                                setVolume(v);
                                localStorage.setItem('pref_volume', v);
                                videoPlayerRef.current?.setVolume(v);
                            }}
                            onFullscreen={() => videoPlayerRef.current?.toggleFullscreen()}
                            loop={loop}
                            onToggleLoop={() => setLoop(!loop)}
                            playbackRate={playbackRate}
                            onPlaybackRateChange={(rate) => {
                                setPlaybackRate(rate);
                                localStorage.setItem('pref_rate', rate);
                            }}
                            onToggleComments={() => {
                                if (isMobile && isLandscape) {
                                    setMobileRightPanelDocked(!mobileRightPanelDocked);
                                } else {
                                    setShowMobileComments(!showMobileComments);
                                }
                            }}
                            onStepFrame={handleStepFrame}
                        />
                     </>
                 )}
             </div>
             <div className={`
                 ${(!isMobile || (isMobile && isLandscape && mobileRightPanelDocked)) ? 'md:relative relative block md:w-80 w-80 h-full border-l border-border z-0' : 'relative block w-full bg-background flex flex-col transition-all duration-300'}
                 ${(isMobile && !isLandscape) ? (showMobileComments ? 'flex-1' : 'h-0 overflow-hidden') : ''}
                 ${(isMobile && isLandscape && !mobileRightPanelDocked) ? 'hidden' : ''}
             `}>
                <ActivityPanel
                    projectId={project.id}
                    videoId={assetType === 'video' ? activeAsset.id : null}
                    threeDAssetId={assetType === '3d' ? activeAsset.id : null}
                    comments={activeAsset.comments || []}
                    currentTime={currentTime}
                    rangeDuration={rangeDuration}
                    selectionStart={selectionRange ? selectionRange.start : null}
                    pendingAnnotations={pendingAnnotations}
                    getAnnotations={() => videoPlayerRef.current?.getAnnotations()}
                    getCameraState={() => videoPlayerRef.current?.getCameraState ? videoPlayerRef.current.getCameraState() : null}
                    onClearAnnotations={() => {
                        setPendingAnnotations([]);
                        videoPlayerRef.current?.clearAnnotations();
                        setRangeDuration(null);
                        setSelectionRange(null);
                    }}
                    onCommentClick={(time, annotation, id, comment) => {
                        videoPlayerRef.current?.seek(time);
                        setViewingAnnotation(annotation);
                        setHighlightedCommentId(id);
                        setShowMobileComments(false);

                        // If 3D, restore camera
                        if (assetType === '3d' && comment && comment.cameraState) {
                            videoPlayerRef.current?.setCameraState(comment.cameraState);
                        }

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
                         const target = findComment(activeAsset.comments);
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
                        if (assetType === 'video') {
                            const updatedVideos = [...project.videos];
                            updatedVideos[0].comments.push(newComment);
                            setProject({ ...project, videos: updatedVideos });
                        } else if (assetType === '3d') {
                            const updatedAssets = [...project.threeDAssets];
                            updatedAssets[0].comments.push(newComment);
                            setProject({ ...project, threeDAssets: updatedAssets });
                        }
                    }}
                    onCommentUpdated={(updatedComment) => {
                         let updatedList = assetType === 'video' ? [...project.videos] : [...project.threeDAssets];
                         const idx = updatedList[0].comments.findIndex(c => c.id === updatedComment.id);
                         if (idx !== -1) {
                             updatedList[0].comments[idx] = updatedComment;
                             if (assetType === 'video') {
                                 setProject({ ...project, videos: updatedList });
                             } else {
                                 setProject({ ...project, threeDAssets: updatedList });
                             }
                         }
                    }}
                    onToggleDrawing={handleTriggerDrawing}
                    isGuest={true}
                    guestName={guestName}
                    clientToken={token}
                    isReadOnly={status === 'ALL_REVIEWS_DONE'}
                    onClose={() => {
                        if (isMobile && isLandscape) {
                           setMobileRightPanelDocked(false);
                        } else {
                           setShowMobileComments(false);
                        }
                    }}
                    onInputFocus={handleInputFocus}
                />
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
