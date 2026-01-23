import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { useHeader } from '../context/HeaderContext';
import { useNotification } from '../context/NotificationContext';
import { useMobileDetection } from '../components/MobileGuard';
import axios from 'axios';
import { toast } from 'sonner';

export const useProjectController = () => {
    const { id, teamSlug, projectSlug, versionName } = useParams();
    const { setBreadcrumbPath } = useHeader();
    const navigate = useNavigate();
    const location = useLocation();

    // Context from Layout
    const outletContext = useOutletContext();
    const setMobileSidebarDocked = outletContext?.setMobileSidebarDocked;
    const mobileSidebarDocked = outletContext?.mobileSidebarDocked;

    // Mobile Detection
    const { isMobile, isLandscape } = useMobileDetection();

    // --- State ---

    // Project Data
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

    // Upload State
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadStatusMessage, setUploadStatusMessage] = useState('');
    const [uploadingVersion, setUploadingVersion] = useState(false);

    // Playback State
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const { socket } = useNotification();
    const [volume, setVolume] = useState(() => {
        const saved = localStorage.getItem('pref_volume');
        return saved !== null ? parseFloat(saved) : 1;
    });
    const [loop, setLoop] = useState(false);
    // Removed local state persistence for simplicty in hook or keep it? Keeping it.
    const [playbackRate, setPlaybackRate] = useState(() => {
        const saved = localStorage.getItem('pref_rate');
        return saved !== null ? parseFloat(saved) : 1;
    });

    // Annotations & Drawings
    const [pendingAnnotations, setPendingAnnotations] = useState([]);
    const [viewingAnnotation, setViewingAnnotation] = useState(null);
    const [isDrawingTrigger, setIsDrawingTrigger] = useState(false);
    const [isDrawingMode, setIsDrawingMode] = useState(false);
    const [drawingTool, setDrawingTool] = useState('pointer');
    const [drawingColor, setDrawingColor] = useState('#ef4444');
    const [drawingStrokeWidth, setDrawingStrokeWidth] = useState(5);

    // Comments & Logic
    const [highlightedCommentId, setHighlightedCommentId] = useState(null);
    const [pendingSubmission, setPendingSubmission] = useState(null);

    // Range Selection
    const [selectionRange, setSelectionRange] = useState({ start: null, end: null });

    // Version Control
    const [activeVersionIndex, setActiveVersionIndex] = useState(0);
    const [compareVersionIndex, setCompareVersionIndex] = useState(null);
    const [compareAudioEnabled, setCompareAudioEnabled] = useState(false);
    const [showUploadVersionModal, setShowUploadVersionModal] = useState(false); // Can be controlled by UI
    const [showCompareSelect, setShowCompareSelect] = useState(false); // UI

    // Image Gallery
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    // Renaming
    const [isRenamingVersion, setIsRenamingVersion] = useState(false);
    const [tempVersionName, setTempVersionName] = useState('');

    // UI/Layout State (Shared or Default)
    const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [showMobileComments, setShowMobileComments] = useState(true);
    const [mobileRightPanelDocked, setMobileRightPanelDocked] = useState(false);
    const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [mobileVideoHeight, setMobileVideoHeight] = useState('40%');

    // Validation
    const hasGeneratedRef = useRef(false);
    const isGeneratingRef = useRef(false);

    // Refs (Exposed to UI if needed, or keeping logic internal)
    // IMPORTANT: Since these are used in functions inside the hook, we must define them here.
    // The UI components will need to attach them or we pass refs to them.
    // Better pattern: The UI renders the element and passes the ref TO the hook?
    // OR: The hook creates the refs and returns them.
    const fileInputRef = useRef(null);
    const imageInputRef = useRef(null);
    const threeDInputRef = useRef(null);
    const videoPlayerRef = useRef(null);
    const activityPanelRef = useRef(null);
    const controlsTimeoutRef = useRef(null);

    const [syncChannel, setSyncChannel] = useState(null);

    // --- Helpers & Logic ---

    // Fetch Project
    const fetchProject = useCallback(() => {
        let url = `/api/projects/${id}`;
        if (teamSlug && projectSlug) {
            url = `/api/projects/slug/${teamSlug}/${projectSlug}`;
        } else if (id) {
            url = `/api/projects/${id}`;
        } else {
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
    }, [id, teamSlug, projectSlug, versionName, location.search]);

    // Initial Fetch
    useEffect(() => {
        fetchProject();
    }, [id, teamSlug, projectSlug, location.search, location.pathname, fetchProject]);

    // Socket Setup
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
    }, [socket, project?.id, fetchProject]);

    // Broadcast Channel
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
                fetchProject();
            }
        };

        return () => bc.close();
    }, [id, fetchProject]);

    // Sync Time to Popup
    useEffect(() => {
        if (syncChannel && isPlaying) {
            syncChannel.postMessage({ type: 'timeUpdate', payload: { time: currentTime } });
        }
    }, [currentTime, syncChannel, isPlaying]);

    // Keyboard Shortcuts
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

    // Loop Selection
    useEffect(() => {
        if (isPlaying && selectionRange.start !== null && selectionRange.end !== null) {
            if (Math.abs(selectionRange.end - selectionRange.start) > 0.1) {
                if (currentTime >= selectionRange.end || currentTime < selectionRange.start) {
                    videoPlayerRef.current?.seek(selectionRange.start);
                }
            }
        }
    }, [currentTime, isPlaying, selectionRange]);

    // Highlight Comment
    useEffect(() => {
        if (!loading && project && project.versions && project.versions.length > 0) {
            const params = new URLSearchParams(location.search);
            const commentId = params.get('commentId');
            const activeVersion = project.versions[activeVersionIndex];

            if (commentId && activeVersion) {
                setHighlightedCommentId(parseInt(commentId));

                if (activeVersion.type === 'video') {
                    // Recurse function to find comment
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

    // Breadcrumbs
    useEffect(() => {
        if (project && project.versions && project.versions.length > 0) {
            const version = project.versions[activeVersionIndex];
            if (!version) return;
            if (version.type === 'video') {
                setBreadcrumbPath(['Projects', project.name, version.originalName || version.filename]);
            } else {
                setBreadcrumbPath(['Projects', project.name, version.versionName || 'Image Set']);
            }
        }
    }, [project, activeVersionIndex, setBreadcrumbPath]);

    // Handlers
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

    const handleReviewSubmit = (content, image) => {
        if (!isMobile) {
            setIsPanelCollapsed(false);
        } else {
            if (isLandscape) setMobileRightPanelDocked(true);
            else setShowMobileComments(true);
        }
        setPendingSubmission({ content, attachment: image });
    };

    const handleAnnotationAdded = () => {
        if (!isMobile) {
            setIsPanelCollapsed(false);
        } else {
            if (isLandscape) setMobileRightPanelDocked(true);
            else setShowMobileComments(true);
        }
        setTimeout(() => {
            if (activityPanelRef.current?.focusInput) {
                activityPanelRef.current.focusInput();
            }
        }, 50);
    };

    const handleStepFrame = (frames) => {
        const activeVersion = project?.versions?.[activeVersionIndex];
        if (!videoPlayerRef.current || !activeVersion) return;
        const frameDuration = 1 / (activeVersion.frameRate || 24);
        const newTime = currentTime + (frames * frameDuration);
        videoPlayerRef.current.seek(Math.max(0, Math.min(newTime, duration)));
        videoPlayerRef.current.pause();
    };

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
            await axios.post(`/api/projects/${project.id}/versions`, formData, {
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

    // Reset guard when ID changes
    useEffect(() => {
        hasGeneratedRef.current = false;
    }, [id]);

    const handleModelLoaded = React.useCallback(() => {
        if (location.state?.needsThumbnailGeneration && videoPlayerRef.current && !isGeneratingRef.current && !hasGeneratedRef.current) {
            isGeneratingRef.current = true;
            hasGeneratedRef.current = true;

            setTimeout(() => {
                if (videoPlayerRef.current) {
                    videoPlayerRef.current.fitView();
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
            }, 1000);
        }
    }, [location.state, location.pathname, id, navigate]);

    return {
        // IDs & Routing
        id, teamSlug, projectSlug, versionName, navigate,

        // Data
        project, loading, isUpdatingStatus, setProject,
        fetchProject, updateProjectStatus,

        // Versioning
        activeVersionIndex, setActiveVersionIndex,
        compareVersionIndex, setCompareVersionIndex,
        compareAudioEnabled, setCompareAudioEnabled,
        showUploadVersionModal, setShowUploadVersionModal,
        showCompareSelect, setShowCompareSelect,
        handleVersionUpload,
        isRenamingVersion, setIsRenamingVersion,
        tempVersionName, setTempVersionName, handleRenameVersion,

        // Uploads
        uploadProgress, uploadStatusMessage, uploadingVersion,

        // Playback
        currentTime, setCurrentTime,
        duration, setDuration,
        isPlaying, setIsPlaying,
        volume, setVolume,
        loop, setLoop,
        playbackRate, setPlaybackRate,
        handleStepFrame,

        // Images
        currentImageIndex, setCurrentImageIndex,

        // Drawing & Annotations
        pendingAnnotations, setPendingAnnotations,
        viewingAnnotation, setViewingAnnotation,
        isDrawingTrigger, handleTriggerDrawing,
        isDrawingMode, setIsDrawingMode,
        drawingTool, setDrawingTool,
        drawingColor, setDrawingColor,
        drawingStrokeWidth, setDrawingStrokeWidth,
        handleAnnotationAdded,

        // Comments & Interactions
        highlightedCommentId, setHighlightedCommentId,
        pendingSubmission, setPendingSubmission,
        handleReviewSubmit,
        handleComment: fetchProject, // reuse,
        handleVersionAdded: fetchProject, // reuse,
        handleProjectUpdate: (data) => setProject(prev => ({ ...prev, ...data })), // exposed if needed

        // Range
        selectionRange, setSelectionRange,

        // Refs (Must be attached by Consumer)
        fileInputRef, imageInputRef, threeDInputRef,
        videoPlayerRef, activityPanelRef,

        // UI State
        isMobile, isLandscape,
        isStatusMenuOpen, setIsStatusMenuOpen,
        isMobileMenuOpen, setIsMobileMenuOpen,
        showControls, setShowControls, handleMouseMove,
        showMobileComments, setShowMobileComments,
        mobileRightPanelDocked, setMobileRightPanelDocked,
        isPanelCollapsed, setIsPanelCollapsed,
        showShortcuts, setShowShortcuts,
        mobileVideoHeight, setMobileVideoHeight,
        copyClientLink, handlePopout,
        handleInputFocus, handleModelLoaded
    };
};
