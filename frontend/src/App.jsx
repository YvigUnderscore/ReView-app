import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation, useOutletContext } from 'react-router-dom';
import Layout from './components/Layout';
import VideoPlayer from './components/VideoPlayer';
import ImageViewer from './components/ImageViewer';
import ThreeDViewer from './components/ThreeD/ThreeDViewer';
import Timeline from './components/Timeline';
import ActivityPanel from './components/ActivityPanel';
import Login from './pages/Login';
import Setup from './pages/Setup';
import Register from './pages/Register';
import LandingPage from './pages/LandingPage';
import AdminDashboard from './pages/Admin/AdminDashboard';
import TeamDashboard from './pages/Team/TeamDashboard';
import RecentActivity from './pages/RecentActivity';
import ProjectLibrary from './pages/ProjectLibrary';
import SettingsPage from './pages/SettingsPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { HeaderProvider, useHeader } from './context/HeaderContext';
import { ThemeProvider } from './context/ThemeContext';
import { BrandingProvider } from './context/BrandingContext';
import { NotificationProvider } from './context/NotificationContext';
import PrivateRoute from './components/PrivateRoute';
import { useParams } from 'react-router-dom';
import CreateProjectModal from './components/CreateProjectModal';
import EditProjectModal from './components/EditProjectModal';
import ClientReview from './pages/ClientReview';
import VideoControls from './components/VideoControls';
import CommentsPopup from './pages/CommentsPopup';
import ShortcutsModal from './components/ShortcutsModal';
import MobileGuard, { useMobileDetection } from './components/MobileGuard';
import { Pencil, Upload, Edit3, Check, X as XIcon, Share2, ChevronDown, SplitSquareHorizontal, Image as ImageIcon, ChevronLeft, ChevronRight, MoreVertical } from 'lucide-react';
import { Toaster } from 'sonner';

// Project View Component (Stateful Wrapper)
const ProjectView = () => {
  const { id } = useParams();
  const { setBreadcrumbPath } = useHeader();

  // Context from Layout for Sidebar Control
  const outletContext = useOutletContext();
  const setMobileSidebarDocked = outletContext?.setMobileSidebarDocked;
  const mobileSidebarDocked = outletContext?.mobileSidebarDocked;

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Shared state
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
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
  const [pendingAnnotations, setPendingAnnotations] = useState([]);
  const [viewingAnnotation, setViewingAnnotation] = useState(null);
  const [isDrawingTrigger, setIsDrawingTrigger] = useState(false);
  const [highlightedCommentId, setHighlightedCommentId] = useState(null);

  // Range Selection State
  const [selectionRange, setSelectionRange] = useState({ start: null, end: null });

  // Version Control
  const [activeVersionIndex, setActiveVersionIndex] = useState(0);
  const [compareVersionIndex, setCompareVersionIndex] = useState(null);
  const [compareAudioEnabled, setCompareAudioEnabled] = useState(false);
  const [showUploadVersionModal, setShowUploadVersionModal] = useState(false);
  const [showCompareSelect, setShowCompareSelect] = useState(false);

  // Image Gallery State
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Renaming state
  const [isRenamingVersion, setIsRenamingVersion] = useState(false);
  const [tempVersionName, setTempVersionName] = useState('');
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  // Replaced simple toggle with docked logic for mobile landscape
  const [showMobileComments, setShowMobileComments] = useState(true);
  // Separate state for Docked Right Panel in Mobile Landscape
  const [mobileRightPanelDocked, setMobileRightPanelDocked] = useState(false);

  // Panel State
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Mobile check for maximization
  const { isMobile, isLandscape } = useMobileDetection();

  const controlsTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const videoPlayerRef = useRef(null);
  const [uploadingVersion, setUploadingVersion] = useState(false);

  // Broadcast Channel for Popup Sync
  const [syncChannel, setSyncChannel] = useState(null);

  const location = useLocation();

  useEffect(() => {
     const bc = new BroadcastChannel(`review_sync_${id}`);
     setSyncChannel(bc);

     bc.onmessage = (event) => {
         const { type, payload } = event.data;
         if (type === 'seek') {
             if (videoPlayerRef.current) {
                 videoPlayerRef.current.seek(payload.time);
                 videoPlayerRef.current.pause();
             }
             if (payload.annotation) setViewingAnnotation(payload.annotation);
             setHighlightedCommentId(payload.commentId);
         } else if (type === 'commentAdded') {
             fetchProject(); // Reload to see new comment
         }
     };

     return () => bc.close();
  }, [id]);

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

  // Sync time to popup
  useEffect(() => {
      if (syncChannel && isPlaying) {
          // Throttle updates?
          syncChannel.postMessage({ type: 'timeUpdate', payload: { time: currentTime } });
      }
  }, [currentTime, syncChannel, isPlaying]);

  const handleMouseMove = () => {
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = setTimeout(() => {
          if (isPlaying) {
              setShowControls(false);
          }
      }, 3000);
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
      if (!videoPlayerRef.current || !activeVersion) return;
      const frameDuration = 1 / (activeVersion.frameRate || 24);
      const newTime = currentTime + (frames * frameDuration);
      videoPlayerRef.current.seek(Math.max(0, Math.min(newTime, duration)));
      videoPlayerRef.current.pause();
  };

  const fetchProject = () => {
      fetch(`/api/projects/${id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      .then(res => {
          if (!res.ok) throw new Error(res.statusText || 'Failed to fetch project');
          return res.json();
      })
      .then(data => {
          setProject(data);
          setLoading(false);
          const params = new URLSearchParams(location.search);
          const videoId = params.get('video');

          if (data.versions && data.versions.length > 0) {
              let idx = 0;
              if (videoId) {
                  const foundIdx = data.versions.findIndex(v => v.id === parseInt(videoId));
                  if (foundIdx !== -1) idx = foundIdx;
              }
              setActiveVersionIndex(idx);
          }
      })
      .catch(err => {
          console.error(err);
          setLoading(false);
          setProject(null);
      });
  };

  useEffect(() => {
    fetchProject();
  }, [id, location.search]);

  // Loop Selection Logic
  useEffect(() => {
     if (isPlaying && selectionRange.start !== null && selectionRange.end !== null) {
         if (Math.abs(selectionRange.end - selectionRange.start) > 0.1) {
             if (currentTime >= selectionRange.end || currentTime < selectionRange.start) {
                  videoPlayerRef.current?.seek(selectionRange.start);
             }
         }
     }
  }, [currentTime, isPlaying, selectionRange]);

  // Handle highlighted comment from query param
  useEffect(() => {
     if (!loading && project && project.versions && project.versions.length > 0) {
         const params = new URLSearchParams(location.search);
         const commentId = params.get('commentId');
         const activeVersion = project.versions[activeVersionIndex];

         if (commentId && activeVersion) {
             setHighlightedCommentId(parseInt(commentId));

             if (activeVersion.type === 'video') {
                 // Video Logic
                 const findComment = (comments) => {
                     for (let c of comments) {
                         if (c.id === parseInt(commentId)) return c;
                         if (c.replies) {
                             const found = findComment(c.replies);
                             if (found) return found;
                         }
                     }
                     return null;
                 };
                 const target = findComment(activeVersion.comments || []);
                 if (target) {
                     if (videoPlayerRef.current) {
                         videoPlayerRef.current.seek(target.timestamp);
                         videoPlayerRef.current.pause();
                         if (target.annotation) {
                             setViewingAnnotation(JSON.parse(target.annotation));
                         }
                     }
                 }
             } else if (activeVersion.type === 'image_bundle') {
                 // Image Logic
                 if (activeVersion.images) {
                    activeVersion.images.forEach((img, idx) => {
                        const findComment = (comments) => {
                            for(let c of comments) {
                                if (c.id === parseInt(commentId)) return c;
                                if (c.replies) {
                                    if (findComment(c.replies)) return c;
                                }
                            }
                            return null;
                        };
                        const target = findComment(img.comments || []);
                        if (target) {
                            setCurrentImageIndex(idx);
                            if (target.annotation) {
                                setViewingAnnotation(JSON.parse(target.annotation));
                            }
                        }
                    });
                 }
             }
         }
     }
  }, [loading, project, activeVersionIndex, location.search]);

  useEffect(() => {
    if (project && project.versions && project.versions.length > 0) {
       const version = project.versions[activeVersionIndex];
       if (version.type === 'video') {
           setBreadcrumbPath(['Projects', project.name, version.originalName || version.filename]);
       } else {
           setBreadcrumbPath(['Projects', project.name, version.versionName || 'Image Set']);
       }
    }
  }, [project, activeVersionIndex, setBreadcrumbPath]);

  // Handle version upload (same as before)
  const handleVersionUpload = async (e) => {
      const file = fileInputRef.current?.files[0];
      const images = imageInputRef.current?.files;

      if (!file && (!images || images.length === 0)) return;

      setUploadingVersion(true);
      const formData = new FormData();

      if (file) {
          formData.append('file', file);
      } else if (images && images.length > 0) {
          Array.from(images).forEach(img => {
              formData.append('images', img);
          });
      }

      try {
         const res = await fetch(`/api/projects/${id}/versions`, {
             method: 'POST',
             headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
             body: formData
         });
         if (res.ok) {
             fetchProject();
         } else {
             alert("Failed to upload version");
         }
      } catch(err) {
          console.error(err);
          alert("Error uploading version");
      } finally {
          setUploadingVersion(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
          if (imageInputRef.current) imageInputRef.current.value = '';
      }
  };

  const handleRenameVersion = async () => {
      if (!tempVersionName.trim()) return;
      const version = project.versions[activeVersionIndex];
      if (version.type !== 'video') {
          alert("Renaming image collections is not supported yet.");
          setIsRenamingVersion(false);
          return;
      }

      try {
          const res = await fetch(`/api/projects/videos/${version.id}`, {
              method: 'PATCH',
              headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify({ versionName: tempVersionName })
          });
          if (res.ok) {
              const updatedVideo = await res.json();
              const updatedVersions = [...project.versions];
              updatedVersions[activeVersionIndex] = { ...updatedVersions[activeVersionIndex], versionName: updatedVideo.versionName };
              setProject({ ...project, versions: updatedVersions });
              setIsRenamingVersion(false);
          }
      } catch(err) {
          console.error("Failed to rename version");
      }
  };

  const updateProjectStatus = async (newStatus) => {
      setIsUpdatingStatus(true);
      try {
          const res = await fetch(`/api/projects/${id}`, {
              method: 'PATCH',
              headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify({ status: newStatus })
          });
          if (res.ok) {
              const updated = await res.json();
              setProject(prev => ({ ...prev, status: updated.status, clientToken: updated.clientToken }));
          }
      } catch (err) {
          console.error("Failed to update status");
      } finally {
          setIsUpdatingStatus(false);
      }
  };

  const copyClientLink = () => {
      if (!project.clientToken) return;
      const link = `${window.location.origin}/review/${project.clientToken}`;
      navigator.clipboard.writeText(link);
      alert("Client review link copied to clipboard!");
  };

  const handlePopout = () => {
      window.open(`/project/${id}/comments-popup`, 'comments-popup', 'width=450,height=700');
      // We can also collapse the local panel automatically if desired, but user might want both?
      // User said "masquer OU mettre sur fenêtre externe".
      // Let's collapse it to save space.
      setIsPanelCollapsed(true);
  };

  if (loading) return <div>Loading...</div>;
  if (!project) return <div>Project not found</div>;

  const activeVersion = project.versions[activeVersionIndex];
  if (!activeVersion) return <div>No version in this project</div>;

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
    <div className={`flex h-full w-full overflow-hidden relative ${isMobile && !isLandscape ? 'flex-col' : ''}`}>
      <MobileGuard />
      <ShortcutsModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />

      {/* Mobile Landscape Sidebar Toggle (Left) - Disabled per requirements */}
      {/* {isMobile && isLandscape && (
          <button
            onClick={() => setMobileSidebarDocked && setMobileSidebarDocked(!mobileSidebarDocked)}
            className={`fixed left-0 top-1/2 -translate-y-1/2 z-50 p-2 bg-black/50 text-white rounded-r-lg border-y border-r border-white/20 hover:bg-black/70 transition-transform ${mobileSidebarDocked ? 'translate-x-[64px]' : ''}`}
            title="Toggle Sidebar"
          >
             {mobileSidebarDocked ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
      )} */}

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
        className={`${isMobile && !isLandscape ? (showMobileComments ? 'h-[40%]' : 'flex-1') : 'flex-1'} flex flex-col min-w-0 bg-black relative min-h-0 transition-all duration-300`}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && setShowControls(false)}
      >
         {/* Top Controls: Version Select, Upload, Status */}
         <div className={`absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
             {/* Left: Versions */}
             <div className="flex items-center gap-2 pointer-events-auto">
                 {/* Version Dropdown */}
             {project.versions.length > 0 && (
                 <div className="flex items-center gap-2 bg-black/50 backdrop-blur rounded px-2 py-1 border border-white/20">
                     {isRenamingVersion ? (
                         <div className="flex items-center gap-1">
                             <input
                                type="text"
                                value={tempVersionName}
                                onChange={(e) => setTempVersionName(e.target.value)}
                                className="bg-transparent border-b border-white/50 text-white text-xs outline-none w-20"
                                autoFocus
                             />
                             <button onClick={handleRenameVersion} className="text-green-400 hover:text-green-300"><Check size={12}/></button>
                             <button onClick={() => setIsRenamingVersion(false)} className="text-red-400 hover:text-red-300"><XIcon size={12}/></button>
                         </div>
                     ) : (
                        <>
                             <select
                                className="bg-transparent text-white text-xs outline-none cursor-pointer"
                                value={activeVersionIndex}
                                onChange={(e) => {
                                    setActiveVersionIndex(parseInt(e.target.value));
                                    setCompareVersionIndex(null);
                                    setCurrentImageIndex(0);
                                }}
                            >
                                {project.versions.map((v, i) => (
                                    <option key={v.id + v.type} value={i} className="text-black">
                                        {v.versionName || `V${String(project.versions.length - i).padStart(2,'0')}`} {v.type === 'image_bundle' ? '(Images)' : ''}
                                    </option>
                                ))}
                            </select>
                            {isVideo && (
                            <button
                                onClick={() => {
                                    setTempVersionName(activeVersion.versionName || `V0${project.versions.length - activeVersionIndex}`);
                                    setIsRenamingVersion(true);
                                }}
                                className="text-white/50 hover:text-white"
                                title="Rename Version"
                            >
                                <Edit3 size={10} />
                            </button>
                            )}
                        </>
                     )}
                 </div>
             )}

             {isVideo && project.versions.filter(v => v.type === 'video').length >= 2 && (
                 <div className="relative">
                     <button
                        onClick={() => setShowCompareSelect(!showCompareSelect)}
                        className={`text-xs px-2 py-1 rounded shadow-sm flex items-center gap-1 transition-all ${compareVersionIndex !== null ? 'bg-primary text-primary-foreground' : 'bg-black/50 text-white hover:bg-black/70'}`}
                        title="Split Screen Comparison"
                     >
                         <SplitSquareHorizontal size={12} />
                         <span>{compareVersionIndex !== null ? 'Compare' : 'Compare'}</span>
                     </button>
                     {showCompareSelect && (
                         <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded shadow-md flex flex-col z-50 min-w-[120px] py-1">
                             <button
                                 onClick={() => {
                                     setCompareVersionIndex(null);
                                     setShowCompareSelect(false);
                                 }}
                                 className={`px-3 py-1.5 text-xs text-left hover:bg-muted ${compareVersionIndex === null ? 'font-bold bg-muted/50' : ''}`}
                             >
                                 None (Single View)
                             </button>
                             {project.versions.map((v, i) => {
                                 if (i === activeVersionIndex || v.type !== 'video') return null;
                                 return (
                                     <button
                                        key={v.id}
                                        onClick={() => {
                                            setCompareVersionIndex(i);
                                            setShowCompareSelect(false);
                                        }}
                                        className={`px-3 py-1.5 text-xs text-left hover:bg-muted ${compareVersionIndex === i ? 'font-bold bg-muted/50' : ''}`}
                                     >
                                         {v.versionName || `V${String(project.versions.length - i).padStart(2,'0')}`}
                                     </button>
                                 );
                             })}
                         </div>
                     )}
                 </div>
             )}

             <div className="flex gap-1">
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingVersion}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs px-2 py-1 rounded shadow-sm flex items-center gap-1 transition-all"
                    title="Upload Video or 3D Version"
                >
                    {uploadingVersion ? (
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <Upload size={12} />
                    )}
                </button>
                 <button
                    onClick={() => imageInputRef.current?.click()}
                    disabled={uploadingVersion}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs px-2 py-1 rounded shadow-sm flex items-center gap-1 transition-all"
                    title="Upload Image Set Version"
                >
                    <ImageIcon size={12} />
                </button>
             </div>
             <input
                type="file"
                ref={fileInputRef}
                onChange={handleVersionUpload}
                accept="video/*,.glb"
                className="hidden"
             />
             <input
                type="file"
                ref={imageInputRef}
                onChange={handleVersionUpload}
                accept="image/png, image/jpeg, image/jpg, image/webp"
                multiple
                className="hidden"
             />
             </div>

             {/* Right: Status & Share */}
             <div className="flex items-center gap-2 pointer-events-auto">
                 {/* Desktop/Tablet Mode: Show Buttons directly */}
                 {!isMobile ? (
                 <>
                    <div className="relative pb-2 -mb-2">
                        {isStatusMenuOpen && (
                            <div className="fixed inset-0 z-10" onClick={() => setIsStatusMenuOpen(false)}></div>
                        )}
                        <button
                            onClick={() => setIsStatusMenuOpen(!isStatusMenuOpen)}
                            className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded border backdrop-blur transition-colors relative z-20 ${
                            project.status === 'CLIENT_REVIEW' ? 'bg-green-500/20 border-green-500/50 text-green-400' :
                            project.status === 'ALL_REVIEWS_DONE' ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' :
                            'bg-black/50 border-white/20 text-white/70 hover:text-white'
                        }`}>
                            {project.status === 'CLIENT_REVIEW' ? 'Client Review' :
                            project.status === 'ALL_REVIEWS_DONE' ? 'Reviews Done' : 'Internal Review'}
                            <ChevronDown size={12} />
                        </button>
                        {isStatusMenuOpen && (
                            <div className="absolute top-full right-0 mt-1 w-40 bg-card border border-border rounded shadow-lg overflow-hidden z-20">
                                <button
                                    onClick={() => { updateProjectStatus('INTERNAL_REVIEW'); setIsStatusMenuOpen(false); }}
                                    className="w-full text-left px-4 py-2 text-xs hover:bg-accent hover:text-accent-foreground"
                                >
                                    Internal Review
                                </button>
                                <button
                                    onClick={() => { updateProjectStatus('CLIENT_REVIEW'); setIsStatusMenuOpen(false); }}
                                    className="w-full text-left px-4 py-2 text-xs hover:bg-accent hover:text-accent-foreground"
                                >
                                    Client Review
                                </button>
                                <button
                                    onClick={() => { updateProjectStatus('ALL_REVIEWS_DONE'); setIsStatusMenuOpen(false); }}
                                    className="w-full text-left px-4 py-2 text-xs hover:bg-accent hover:text-accent-foreground"
                                >
                                    All Reviews Done
                                </button>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={copyClientLink}
                        disabled={!project.clientToken && project.status === 'INTERNAL_REVIEW'}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs px-3 py-1.5 rounded shadow-sm flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        title={!project.clientToken ? "Enable Client Review to generate link" : "Copy Client Review Link"}
                    >
                        <Share2 size={12} />
                        <span>Share</span>
                    </button>
                 </>
                 ) : (
                 /* Mobile Mode: Group into Dropdown */
                 <div className="relative">
                    {isMobileMenuOpen && <div className="fixed inset-0 z-10" onClick={() => setIsMobileMenuOpen(false)}></div>}
                    <button
                         onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                         className="bg-black/50 text-white hover:bg-black/70 p-1.5 rounded border border-white/20 backdrop-blur"
                    >
                        <MoreVertical size={16} />
                    </button>

                    {isMobileMenuOpen && (
                        <div className="absolute top-full right-0 mt-2 w-48 bg-card border border-border rounded shadow-lg overflow-hidden z-20 py-1">
                             {/* Status in Menu */}
                             <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-b border-border mb-1">Status</div>
                             <button onClick={() => { updateProjectStatus('INTERNAL_REVIEW'); setIsMobileMenuOpen(false); }} className={`w-full text-left px-4 py-2 text-xs hover:bg-accent ${project.status === 'INTERNAL_REVIEW' ? 'text-primary' : ''}`}>Internal Review</button>
                             <button onClick={() => { updateProjectStatus('CLIENT_REVIEW'); setIsMobileMenuOpen(false); }} className={`w-full text-left px-4 py-2 text-xs hover:bg-accent ${project.status === 'CLIENT_REVIEW' ? 'text-primary' : ''}`}>Client Review</button>
                             <button onClick={() => { updateProjectStatus('ALL_REVIEWS_DONE'); setIsMobileMenuOpen(false); }} className={`w-full text-left px-4 py-2 text-xs hover:bg-accent ${project.status === 'ALL_REVIEWS_DONE' ? 'text-primary' : ''}`}>Reviews Done</button>

                             <div className="border-t border-border my-1"></div>

                             {/* Actions */}
                             <button
                                onClick={() => { copyClientLink(); setIsMobileMenuOpen(false); }}
                                disabled={!project.clientToken && project.status === 'INTERNAL_REVIEW'}
                                className="w-full text-left px-4 py-2 text-xs hover:bg-accent flex items-center gap-2"
                             >
                                 <Share2 size={12} />
                                 Share Review Link
                             </button>

                             <button
                                onClick={() => { setShowUploadVersionModal(true); setIsMobileMenuOpen(false); fileInputRef.current?.click(); }}
                                className="w-full text-left px-4 py-2 text-xs hover:bg-accent flex items-center gap-2"
                             >
                                 <Upload size={12} />
                                 Upload Version
                             </button>
                        </div>
                    )}
                 </div>
                 )}

                 {/* Expand Comments Panel Button (If Collapsed) */}
                 {isPanelCollapsed && (
                     <button
                        onClick={() => setIsPanelCollapsed(false)}
                        className="bg-black/50 text-white hover:bg-black/70 p-1.5 rounded border border-white/20"
                        title="Show Comments"
                     >
                         <ChevronLeft size={16} />
                     </button>
                 )}
             </div>
         </div>

         <div className="flex-1 relative flex items-center justify-center min-h-0 p-0 md:p-0">
             {isVideo ? (
                <VideoPlayer
                    ref={videoPlayerRef}
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
                />
             ) : isThreeD ? (
                 <ThreeDViewer
                    ref={videoPlayerRef}
                    src={`/api/media/${activeVersion.filename}`}
                    onAnnotationSave={(data) => setPendingAnnotations(data)}
                    viewingAnnotation={viewingAnnotation}
                    isDrawingModeTrigger={isDrawingTrigger}
                    onCameraInteractionStart={() => setViewingAnnotation(null)}
                    onCameraChange={(state) => {}}
                 />
             ) : (
                 <ImageViewer
                    ref={videoPlayerRef}
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
         {isVideo && (
             <>
                <Timeline
                    currentTime={currentTime}
                    duration={duration || 100}
                    visible={showControls}
                    selectionRange={selectionRange}
                    highlightedCommentId={highlightedCommentId}
                    onRangeChange={(start, end) => setSelectionRange({ start, end })}
                    onRangeCommit={(start, end) => setSelectionRange({ start, end })}
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
                />
                <VideoControls
                    isPlaying={isPlaying}
                    onTogglePlay={() => videoPlayerRef.current?.togglePlay()}
                    currentTime={currentTime}
                    duration={duration}
                    volume={volume}
                    onFullscreen={() => videoPlayerRef.current?.toggleFullscreen()}
                    onVolumeChange={(v) => {
                        setVolume(v);
                        localStorage.setItem('pref_volume', v);
                        videoPlayerRef.current?.setVolume(v);
                    }}
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
                    isCompareMode={compareVersionIndex !== null}
                    compareAudioEnabled={compareAudioEnabled}
                    onToggleCompareAudio={() => setCompareAudioEnabled(!compareAudioEnabled)}
                    onStepFrame={handleStepFrame}
                />
             </>
         )}
      </div>

      {/* Activity Panel Container */}
      <div className={`
          ${(!isMobile || (isMobile && isLandscape && mobileRightPanelDocked)) ? 'md:relative relative block h-full border-l border-border z-0' : 'relative block w-full bg-background flex flex-col transition-all duration-300'}
          ${(isMobile && !isLandscape) ? (showMobileComments ? 'flex-1' : 'h-0 overflow-hidden') : ''}
          ${isPanelCollapsed ? 'w-0 overflow-hidden' : 'w-80'}
          ${(isMobile && isLandscape && !mobileRightPanelDocked) ? 'hidden' : ''}
      `}>
          {!isPanelCollapsed && (
              <ActivityPanel
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
                 getCameraState={() => videoPlayerRef.current?.getCameraState ? videoPlayerRef.current.getCameraState() : null}
                 onClearAnnotations={() => {
                     setPendingAnnotations([]);
                     videoPlayerRef.current?.clearAnnotations();
                     setSelectionRange({ start: null, end: null });
                 }}
                 onCommentClick={(time, annotation, commentId, comment) => {
                     if (isVideo) {
                        videoPlayerRef.current?.seek(time);
                        videoPlayerRef.current?.pause();
                     } else if (isThreeD && comment?.cameraState) {
                        videoPlayerRef.current?.setCameraState(comment.cameraState);
                     } else if (isThreeD) {
                         videoPlayerRef.current?.resetView();
                     }

                     setViewingAnnotation(annotation);
                     setHighlightedCommentId(commentId);

                     if (isVideo) {
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
                     }
                     setShowMobileComments(false);
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
                         if (!updatedVersions[activeVersionIndex].comments) {
                             updatedVersions[activeVersionIndex].comments = [];
                         }
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
                 onCommentUpdated={(updatedComment) => {
                     const updatedVersions = project.versions.map((version, vIdx) => {
                         if (vIdx !== activeVersionIndex) return version;

                         if (version.type === 'video' || version.type === 'three_d_asset') {
                             const updateInTree = (comments) => {
                                return comments.map(c => {
                                    if (c.id === updatedComment.id) return { ...updatedComment, replies: c.replies };
                                    if (c.replies) {
                                        return { ...c, replies: updateInTree(c.replies) };
                                    }
                                    return c;
                                });
                             };
                             return { ...version, comments: updateInTree(version.comments) };
                         } else if (version.type === 'image_bundle') {
                              const updatedImages = version.images.map(img => {
                                  const updateInTree = (comments) => {
                                    return comments.map(c => {
                                        if (c.id === updatedComment.id) return { ...updatedComment, replies: c.replies };
                                        if (c.replies) {
                                            return { ...c, replies: updateInTree(c.replies) };
                                        }
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
                 onClose={() => {
                     if (isMobile && isLandscape) {
                        setMobileRightPanelDocked(false);
                     } else {
                        setShowMobileComments(false);
                     }
                 }}
                 onCollapse={() => setIsPanelCollapsed(true)}
                 onPopout={handlePopout}
                 onInputFocus={handleInputFocus}
              />
          )}
      </div>
    </div>
  );
};

// ... AppRoutes and App component ...
const AppRoutes = () => {
  const { user, setupRequired, loading, error, securityIssue } = useAuth();

  if (loading) {
     return <div className="h-screen w-full flex items-center justify-center bg-black text-white">Loading...</div>;
  }

  if (error) {
     return (
        <div className="h-screen w-full flex items-center justify-center flex-col bg-black text-white">
            <div className="text-red-500 font-bold mb-2">Error connecting to server</div>
            <div className="text-zinc-400">{error}</div>
            <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded">Retry</button>
        </div>
     );
  }

  if (setupRequired) {
     return (
       <>
         {securityIssue && (
             <div className="bg-red-600 text-white text-center py-2 font-bold px-4 z-50 relative">
                 {securityIssue}
             </div>
         )}
         <Routes>
           <Route path="/setup" element={<Setup />} />
           <Route path="*" element={<Navigate to="/setup" replace />} />
         </Routes>
       </>
     );
  }

  return (
    <>
      {securityIssue && (
          <div className="bg-red-600 text-white text-center py-2 font-bold px-4 z-50 relative">
              {securityIssue}
          </div>
      )}
      <Routes>
      {/* Public Routes */}
      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <Register />} />
      <Route path="/review/:token" element={<ClientReview />} />

      {/* Fallback for setup */}
      <Route path="/setup" element={<Navigate to="/" replace />} />

      {/* Protected Routes */}
      <Route element={<PrivateRoute />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<RecentActivity />} />
          <Route path="/projects" element={<ProjectLibrary />} />
          <Route path="/project/:id" element={<ProjectView />} />
          <Route path="/project/:id/comments-popup" element={<CommentsPopup />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/team" element={<TeamDashboard />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
};

function App() {
  return (
    <AuthProvider>
      <BrandingProvider>
        <HeaderProvider>
          <ThemeProvider>
            <NotificationProvider>
              <Router>
                <AppRoutes />
                <Toaster richColors position="top-right" closeButton theme="system" />
              </Router>
            </NotificationProvider>
          </ThemeProvider>
        </HeaderProvider>
      </BrandingProvider>
    </AuthProvider>
  );
}

export default App;
