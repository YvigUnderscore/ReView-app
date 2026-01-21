import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation, useOutletContext, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Layout from './components/Layout';
import VideoPlayer from './components/VideoPlayer';
import ImageViewer from './components/ImageViewer';
import ModelViewer from './components/ThreeD/ModelViewer';
import Timeline from './components/Timeline';
import ActivityPanel from './components/ActivityPanel';
import Login from './pages/Login';
import Setup from './pages/Setup';
import Register from './pages/Register';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import LandingPage from './pages/LandingPage';
import AdminDashboard from './pages/Admin/AdminDashboard';
import TeamDashboard from './pages/Team/TeamDashboard';
import RecentActivity from './pages/RecentActivity';
import ProjectLibrary from './pages/ProjectLibrary';
import Trash from './pages/Trash';
import SettingsPage from './pages/SettingsPage';
import GuidePage from './pages/GuidePage';
import LatestUpdatePage from './pages/LatestUpdatePage';
import TeamSettings from './pages/Team/TeamSettings';
import { AuthProvider, useAuth } from './context/AuthContext';
import { HeaderProvider, useHeader } from './context/HeaderContext';
import { ThemeProvider } from './context/ThemeContext';
import { BrandingProvider } from './context/BrandingContext';
import { NotificationProvider, useNotification } from './context/NotificationContext';
import PrivateRoute from './components/PrivateRoute';
import { useParams } from 'react-router-dom';
import CreateProjectModal from './components/CreateProjectModal';
import EditProjectModal from './components/EditProjectModal';
import ClientReview from './pages/ClientReview';
import VideoControls from './components/VideoControls';
import CommentsPopup from './pages/CommentsPopup';
import ShortcutsModal from './components/ShortcutsModal';
import ViewerTopMenu from './components/ViewerTopMenu';
import MobileGuard, { useMobileDetection } from './components/MobileGuard';
import axios from 'axios';
import { Pencil, Upload, Edit3, Check, X as XIcon, Share2, ChevronDown, SplitSquareHorizontal, Image as ImageIcon, ChevronLeft, ChevronRight, MoreVertical, MessageSquare } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import FloatingPanelContainer from './components/FloatingPanelContainer';
import VideoImageToolbar from './components/VideoImageToolbar';
import FixedCommentsPanel from './components/FixedCommentsPanel';
// import AnnouncementPopup from './components/AnnouncementPopup';

const PageTransition = ({ children }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="w-full h-full"
        >
            {children}
        </motion.div>
    );
};

// Project View Component (Stateful Wrapper)
const ProjectView = () => {
    const { id, teamSlug, projectSlug, versionName } = useParams();
    const { setBreadcrumbPath } = useHeader();

    // Context from Layout for Sidebar Control
    const outletContext = useOutletContext();
    const setMobileSidebarDocked = outletContext?.setMobileSidebarDocked;
    const mobileSidebarDocked = outletContext?.mobileSidebarDocked;

    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadStatusMessage, setUploadStatusMessage] = useState('');

    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

    // Shared state
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const { socket } = useNotification();
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
    const [pendingSubmission, setPendingSubmission] = useState(null);
    const activityPanelRef = useRef(null);
    const [mobileVideoHeight, setMobileVideoHeight] = useState('40%'); // Default 40% height for video in mobile portrait

    // Drawing State (controlled from toolbar, passed to player)
    const [isDrawingMode, setIsDrawingMode] = useState(false);
    const [drawingTool, setDrawingTool] = useState('pointer');
    const [drawingColor, setDrawingColor] = useState('#ef4444');
    const [drawingStrokeWidth, setDrawingStrokeWidth] = useState(5);

    // Mobile check for maximization
    const { isMobile, isLandscape } = useMobileDetection();

    const isResizing = useRef(false);
    const currentResizeWidth = useRef(400); // Track width during resize
    const hasGeneratedRef = useRef(false);

    // Resize Handlers
    const startResize = (e) => {
        isResizing.current = true;
        currentResizeWidth.current = 400; // default?
        e.preventDefault();
        document.addEventListener('mousemove', handleResize);
        document.addEventListener('mouseup', stopResize);
        document.addEventListener('touchmove', handleResize);
        document.addEventListener('touchend', stopResize);
    };

    const handleResize = (e) => {
        if (!isResizing.current) return;

        const clientY = e.touches ? e.touches[0].clientY : e.clientX; // unused?

        if (isMobile && !isLandscape) {
            // Mobile Portrait: Vertical Resize logic if we want to keep it?
            // Actually user wanted updated logic. We removed desktop resize.
            // Maybe keep mobile portrait resize for video height?
        }
    };

    const stopResize = () => {
        isResizing.current = false;
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', stopResize);
        document.removeEventListener('touchmove', handleResize);
        document.removeEventListener('touchend', stopResize);
    };

    const controlsTimeoutRef = useRef(null);
    const fileInputRef = useRef(null);
    const imageInputRef = useRef(null);
    const threeDInputRef = useRef(null);
    const videoPlayerRef = useRef(null);
    const isGeneratingRef = useRef(false);
    const [uploadingVersion, setUploadingVersion] = useState(false);

    // Broadcast Channel for Popup Sync
    const [syncChannel, setSyncChannel] = useState(null);

    const location = useLocation();
    // navigate already declared below, removing duplicate if exists or finding existing one.
    // Actually, let's just keep the one at line ~503 and remove this if I added it, or vice versa.
    // The previous edit added it here. I should remove it from here if it exists below, OR remove the one below.
    // Best to check where it was. It was at line 503.
    // So I will remove it from here in my previous edit?
    // Wait, I just added it in the previous step. So I should remove it now.

    // logic: "const navigate = useNavigate();" was added at line ~169.
    // original was at 503.
    // I will remove this one.

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

    // 3D Review Submit Handler - mirrors ClientReview.jsx
    const handleReviewSubmit = (content, image) => {
        // Force open panel if closed
        if (!isMobile) {
            setIsPanelCollapsed(false);
        } else {
            if (isLandscape) setMobileRightPanelDocked(true);
            else setShowMobileComments(true);
        }

        // Queue submission
        setPendingSubmission({ content, attachment: image });
    };

    // 3D Annotation Added Handler - opens panel and focuses input
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

    const handleStepFrame = (frames) => {
        if (!videoPlayerRef.current || !activeVersion) return;
        const frameDuration = 1 / (activeVersion.frameRate || 24);
        const newTime = currentTime + (frames * frameDuration);
        videoPlayerRef.current.seek(Math.max(0, Math.min(newTime, duration)));
        videoPlayerRef.current.pause();
    };

    const fetchProject = () => {
        let url = `/api/projects/${id}`;
        if (teamSlug && projectSlug) {
            url = `/api/projects/slug/${teamSlug}/${projectSlug}`;
        } else if (id) {
            url = `/api/projects/${id}`;
        } else {
            // No ID or Slug?
            return;
        }

        fetch(url, {
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
                    if (versionName) {
                        const foundIdx = data.versions.findIndex(v => v.versionName === versionName);
                        if (foundIdx !== -1) idx = foundIdx;
                    } else if (videoId) {
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
    }, [id, teamSlug, projectSlug, location.search, location.pathname]); //Added pathname to dependency to trigger on URL change

    // Join Project Room & Listen
    useEffect(() => {
        if (!socket || !project) return;

        socket.emit('join_project', project.id);

        const handleComment = (data) => {
            if (data.projectId === project.id) {
                fetchProject();
            }
        };

        const handleVersionAdded = (data) => {
            if (data.projectId === project.id) {
                fetchProject();
            }
        };

        const handleProjectUpdate = (data) => {
            if (data.id === project.id) {
                setProject(prev => ({ ...prev, ...data }));
            }
        };

        socket.on('COMMENT_ADDED', handleComment);
        socket.on('VERSION_ADDED', handleVersionAdded);
        socket.on('PROJECT_UPDATE', handleProjectUpdate);

        socket.on('UPLOAD_STATUS', (data) => {
            console.log('SOCKET EVENT: UPLOAD_STATUS received', data);
            setUploadStatusMessage(data.message);
        });

        return () => {
            socket.off('COMMENT_ADDED', handleComment);
            socket.off('VERSION_ADDED', handleVersionAdded);
            socket.off('PROJECT_UPDATE', handleProjectUpdate);
            socket.off('UPLOAD_STATUS');
        };
    }, [socket, project?.id]);

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
                                for (let c of comments) {
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

    // Handle version upload
    const handleVersionUpload = async (e) => {
        const file = fileInputRef.current?.files[0];
        const threeDFile = threeDInputRef.current?.files[0];
        const images = imageInputRef.current?.files;

        if (!file && !threeDFile && (!images || images.length === 0)) return;

        setUploadingVersion(true);
        const formData = new FormData();

        if (file) {
            formData.append('file', file);
        } else if (threeDFile) {
            formData.append('file', threeDFile);
        } else if (images && images.length > 0) {
            Array.from(images).forEach(img => {
                formData.append('images', img);
            });
        }

        try {
            setUploadProgress(0);
            setUploadStatusMessage('Uploading...');
            const res = await axios.post(`/api/projects/${project.id}/versions`, formData, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'multipart/form-data'
                },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setUploadProgress(percentCompleted);
                }
            });
            fetchProject();
        } catch (err) {
            console.error(err);
            toast.error("Error uploading version");
        } finally {
            setUploadingVersion(false);
            setUploadProgress(0);
            setUploadStatusMessage('');
            if (fileInputRef.current) fileInputRef.current.value = '';
            if (threeDInputRef.current) threeDInputRef.current.value = '';
            if (imageInputRef.current) imageInputRef.current.value = '';
        }
    };

    const handleRenameVersion = async () => {
        if (!tempVersionName.trim()) return;
        const version = project.versions[activeVersionIndex];
        if (version.type !== 'video') {
            toast.error("Renaming image collections is not supported yet.");
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
        } catch (err) {
            console.error("Failed to rename version");
        }
    };

    const updateProjectStatus = async (newStatus) => {
        if (!project?.id) return;
        setIsUpdatingStatus(true);
        try {
            const res = await fetch(`/api/projects/${project.id}`, {
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
        toast.success("Client review link copied to clipboard!");
    };

    const handlePopout = () => {
        window.open(`/project/${id}/comments-popup`, 'comments-popup', 'width=450,height=700');
        setIsPanelCollapsed(true);
    };

    const navigate = useNavigate();

    // Reset guard when ID changes
    useEffect(() => {
        hasGeneratedRef.current = false;
    }, [id]);

    const handleModelLoaded = React.useCallback(() => {
        if (location.state?.needsThumbnailGeneration && videoPlayerRef.current && !isGeneratingRef.current && !hasGeneratedRef.current) {
            isGeneratingRef.current = true;
            hasGeneratedRef.current = true; // Block immediately

            // Delay to ensure rendering is complete and controls are ready
            setTimeout(() => {
                if (videoPlayerRef.current) {
                    videoPlayerRef.current.fitView();

                    // Capture and upload
                    requestAnimationFrame(async () => {
                        const screenshotData = videoPlayerRef.current.getScreenshot();
                        if (screenshotData) {
                            try {
                                const res = await fetch(screenshotData);
                                const blob = await res.blob();
                                const file = new File([blob], "thumbnail.jpg", { type: "image/jpeg" });

                                const formData = new FormData();
                                formData.append('thumbnail', file);

                                await fetch(`/api/projects/${id}/thumbnail-notify`, {
                                    method: 'POST',
                                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                                    body: formData
                                });

                                toast.success("Thumbnail generated and notification sent!");

                                // Clear flag to prevent re-run using React Router
                                navigate(location.pathname, { replace: true, state: {} });

                            } catch (e) {
                                console.error("Failed to generate/upload thumbnail", e);
                            } finally {
                                isGeneratingRef.current = false;
                            }
                        } else {
                            isGeneratingRef.current = false;
                        }
                    });
                } else {
                    isGeneratingRef.current = false;
                }
            }, 1000); // 1 second delay to be safe for loading/rendering
        }
    }, [location.state, location.pathname, id, navigate]);

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
        <div className={`flex h-full w-full overflow-hidden relative ${isMobile && !isLandscape ? 'flex-col' : ''}`}>
            <MobileGuard />
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

            {isMobile && isLandscape && (
                <button
                    onClick={() => setMobileRightPanelDocked(!mobileRightPanelDocked)}
                    className={`fixed right-0 top-1/2 -translate-y-1/2 z-50 p-2 bg-black/50 text-white rounded-l-lg border-y border-l border-white/20 hover:bg-black/70 transition-transform ${mobileRightPanelDocked ? '-translate-x-[320px]' : ''}`}
                    title="Toggle Comments"
                >
                    {mobileRightPanelDocked ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                </button>
            )}

            {/* Main Flex Row Wrapper for Content + Side Panel */}
            <div className={`flex flex-1 min-h-0 relative w-full ${isMobile && !isLandscape ? 'flex-col' : 'flex-row'}`}>
                <div
                    className={`${isMobile && !isLandscape ? (showMobileComments ? '' : 'flex-1') : 'flex-1'} flex flex-col min-w-0 bg-black relative min-h-0 transition-all duration-300`}
                    style={isMobile && !isLandscape && showMobileComments ? { height: mobileVideoHeight } : {}}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={() => isPlaying && setShowControls(false)}
                >
                    {/* Top Controls: Burger Menu */}
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
                        onUpload={() => { }} // Not used directly, specific refs used
                        uploadingVersion={uploadingVersion}
                        fileInputRef={fileInputRef}
                        imageInputRef={imageInputRef}
                        threeDInputRef={threeDInputRef}
                        status={project.status}
                        onStatusChange={updateProjectStatus}
                        onShare={copyClientLink}
                    />

                    {/* Inputs for upload */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleVersionUpload}
                        accept="video/*,.glb"
                        className="hidden"
                    />
                    <input
                        type="file"
                        ref={threeDInputRef}
                        onChange={handleVersionUpload}
                        accept=".glb,.fbx,.usd,.usdz,.usda,.usdc,.zip"
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
                                    // Seek to the animation timecode
                                    if (videoPlayerRef.current?.seek) {
                                        videoPlayerRef.current.seek(time);
                                    }

                                    // Restore camera state if available
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
                            onToggleCommentsPanel={() => {
                                if (isMobile && isLandscape) {
                                    setMobileRightPanelDocked(!mobileRightPanelDocked);
                                } else {
                                    setIsPanelCollapsed(!isPanelCollapsed);
                                }
                            }}
                            onShowShortcuts={() => setShowShortcuts(true)}
                            currentImageIndex={currentImageIndex}
                            totalImages={activeVersion.images?.length || 0}
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
                                setSelectionRange({ start: null, end: null });
                            }}
                            onUndo={() => videoPlayerRef.current?.undoAnnotation?.()}
                            canUndo={videoPlayerRef.current?.getDrawingState?.()?.canUndo || false}
                            onSend={() => videoPlayerRef.current?.sendAnnotations?.()}
                            hasDrawingChanges={videoPlayerRef.current?.getDrawingState?.()?.hasAnnotations || false}
                        />
                    )}
                </div>

                {/* Floating Activity Panel Container */}
                <div
                    className={`
            ${(!isMobile || (isMobile && isLandscape && mobileRightPanelDocked))
                            ? (isThreeD
                                ? 'fixed inset-0 pointer-events-none z-40'
                                : `h-full ${!isPanelCollapsed ? 'w-auto' : 'w-0'} flex flex-col overflow-hidden transition-all duration-300 shrink-0`)
                            : 'relative block w-full bg-background flex flex-col transition-all duration-300'}
            ${(isMobile && !isLandscape) ? (showMobileComments ? 'flex-1' : 'h-0 overflow-hidden') : ''}
            ${isPanelCollapsed && !isMobile && isThreeD ? 'opacity-0 pointer-events-none' : 'opacity-100'}
            ${(isMobile && isLandscape && !mobileRightPanelDocked) ? 'hidden' : ''}
          `}
                >
                    {(!isMobile || (isMobile && isLandscape && mobileRightPanelDocked)) ? (
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

                                                    if (isVideo) {
                                                        if (commentId) {
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

                                                    if (isVideo) {
                                                        currentCommentsList = updatedVersions[activeVersionIndex].comments;
                                                    } else if (isImageBundle) {
                                                        currentCommentsList = updatedVersions[activeVersionIndex].images[currentImageIndex].comments;
                                                    } else if (isThreeD) {
                                                        currentCommentsList = updatedVersions[activeVersionIndex].comments;
                                                    }

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

                                                    if (isVideo) {
                                                        if (commentId) {
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

                                                    if (isVideo) {
                                                        currentCommentsList = updatedVersions[activeVersionIndex].comments;
                                                    } else if (isImageBundle) {
                                                        currentCommentsList = updatedVersions[activeVersionIndex].images[currentImageIndex].comments;
                                                    } else if (isThreeD) {
                                                        currentCommentsList = updatedVersions[activeVersionIndex].comments;
                                                    }

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
                    ) : (
                        <ActivityPanel
                            ref={activityPanelRef}
                            // Mobile Portrait View (Standard)
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
                                } else if (isThreeD && comment?.cameraState) {
                                    videoPlayerRef.current?.setCameraState(comment.cameraState);
                                }

                                setViewingAnnotation(annotation);
                                setHighlightedCommentId(commentId);
                                setShowMobileComments(false);
                            }}
                            highlightedCommentId={highlightedCommentId}
                            onCommentAdded={(newComment) => {
                                // ... same logic implies we should refactor this big block later ...
                                // Duplicated logic for mobile view vs desktop floating view?
                                // No, I can wrap the whole logic in a render function or component but for now I'll just duplicate to ensure safety
                                const newProject = { ...project };
                                let targetCommentsList;
                                const videosCount = (project.videos || []).length;
                                const bundlesCount = (project.imageBundles || []).length;

                                if (activeVersionIndex < videosCount) {
                                    targetCommentsList = newProject.videos[activeVersionIndex].comments;
                                } else if (activeVersionIndex < videosCount + bundlesCount) {
                                    const bundleIndex = activeVersionIndex - videosCount;
                                    if (!newProject.imageBundles[bundleIndex].images[currentImageIndex].comments) {
                                        newProject.imageBundles[bundleIndex].images[currentImageIndex].comments = [];
                                    }
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
                                // ... duplicated ...
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
                            onCommentDeleted={(commentId) => {
                                // ... duplicated ...
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
                                if (isVideo) {
                                    currentCommentsList = updatedVersions[activeVersionIndex].comments;
                                } else if (isImageBundle) {
                                    currentCommentsList = updatedVersions[activeVersionIndex].images[currentImageIndex].comments;
                                } else if (isThreeD) {
                                    currentCommentsList = updatedVersions[activeVersionIndex].comments;
                                }
                                deleteFromTree(currentCommentsList);
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
                            pendingSubmission={pendingSubmission}
                            onSubmissionComplete={() => setPendingSubmission(null)}
                        />
                    )}
                </div>
            </div>
        </div >
    );
};

// ... export App ...
const AppRoutesAndProviders = () => {
    return (
        <AuthProvider>
            <BrandingProvider>
                <HeaderProvider>
                    <ThemeProvider>
                        <NotificationProvider>
                            <Router>
                                {/* AnnouncementPopup handled in Layout now */}
                                <AppRoutes />
                                <Toaster richColors position="top-right" closeButton theme="system" />
                            </Router>
                        </NotificationProvider>
                    </ThemeProvider>
                </HeaderProvider>
            </BrandingProvider>
        </AuthProvider>
    );
};

export default AppRoutesAndProviders;

const AppRoutes = () => {
    const { user, setupRequired, loading, error, securityIssue } = useAuth();
    const location = useLocation();

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
                    <Route path="/team/settings" element={<TeamSettings />} />
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
            <AnimatePresence>
                <Routes location={location} key={location.pathname}>
                    {/* Public Routes */}
                    <Route path="/" element={
                        <PageTransition>
                            {user ? <Navigate to="/dashboard" replace /> : <LandingPage />}
                        </PageTransition>
                    } />
                    <Route path="/login" element={
                        <PageTransition>
                            {user ? <Navigate to="/dashboard" replace /> : <Login />}
                        </PageTransition>
                    } />
                    <Route path="/register" element={
                        <PageTransition>
                            {user ? <Navigate to="/dashboard" replace /> : <Register />}
                        </PageTransition>
                    } />
                    <Route path="/forgot-password" element={
                        <PageTransition>
                            {user ? <Navigate to="/dashboard" replace /> : <ForgotPasswordPage />}
                        </PageTransition>
                    } />
                    <Route path="/reset-password" element={
                        <PageTransition>
                            {user ? <Navigate to="/dashboard" replace /> : <ResetPasswordPage />}
                        </PageTransition>
                    } />
                    <Route path="/review/:token" element={
                        <PageTransition>
                            <ClientReview />
                        </PageTransition>
                    } />
                    <Route path="/guide" element={
                        <PageTransition>
                            <GuidePage />
                        </PageTransition>
                    } />
                    <Route path="/latest-update" element={
                        <PageTransition>
                            <LatestUpdatePage />
                        </PageTransition>
                    } />

                    {/* Fallback for setup */}
                    <Route path="/setup" element={<Navigate to="/" replace />} />

                    {/* Protected Routes */}
                    <Route element={<PrivateRoute />}>
                        <Route element={<Layout />}>
                            <Route path="/dashboard" element={
                                <PageTransition>
                                    <RecentActivity />
                                </PageTransition>
                            } />
                            <Route path="/projects" element={
                                <PageTransition>
                                    <ProjectLibrary />
                                </PageTransition>
                            } />

                            {/* Legacy ID Route */}
                            <Route path="/project/:id" element={
                                <PageTransition>
                                    <ProjectView />
                                </PageTransition>
                            } />
                            {/* New Slug Route */}
                            {/* New Slug Route with Version */}
                            <Route path="/:teamSlug/:projectSlug/:versionName?" element={
                                <PageTransition>
                                    <ProjectView />
                                </PageTransition>
                            } />

                            <Route path="/project/:id/comments-popup" element={<CommentsPopup />} />
                            <Route path="/admin" element={
                                <PageTransition>
                                    <AdminDashboard />
                                </PageTransition>
                            } />

                            <Route path="/team/settings" element={
                                <PageTransition>
                                    <TeamSettings />
                                </PageTransition>
                            } />
                            <Route path="/team" element={
                                <PageTransition>
                                    <TeamDashboard />
                                </PageTransition>
                            } />
                            {/* New Team Route */}
                            <Route path="/:teamSlug" element={
                                <PageTransition>
                                    <TeamDashboard />
                                </PageTransition>
                            } />

                            <Route path="/trash" element={
                                <PageTransition>
                                    <Trash />
                                </PageTransition>
                            } />
                            <Route path="/settings" element={
                                <PageTransition>
                                    <SettingsPage />
                                </PageTransition>
                            } />
                        </Route>
                    </Route>

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </AnimatePresence>
        </>
    );
};
