import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Send, Image as ImageIcon, X, Trash2, Reply, Smile, Check, Eye, EyeOff, UserPlus, Download, Bell, BellOff, Minimize2, Video, FileText, Table, Pencil, Save, Circle, CheckCircle, PenLine } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MentionsInput from './MentionsInput';
import { formatDate } from '../lib/dateUtils';
import { useBranding } from '../context/BrandingContext';
import { toast } from 'sonner';
import ConfirmDialog from './ConfirmDialog';
import { useAuth } from '../context/AuthContext';

const renderContent = (content) => {
    if (!content) return null;
    const parts = content.split(/(@[\w_\-]+)/g);
    return parts.map((part, i) => {
        if (part.match(/^@[\w_\-]+$/)) {
            return <span key={i} className="text-blue-500 font-medium">{part}</span>;
        }
        return part;
    });
};

const CommentItem = ({ comment, onCommentClick, onToggleResolved, onToggleVisibility, onReply, onReact, isGuest, currentUserId, highlightedCommentId, onAssignTask, teamMembers, onDelete, canDelete, guestName, onEdit, isEditing, editContent, setEditContent, onSaveEdit, onCancelEdit }) => {
    const itemRef = useRef(null);
    const [showAssignSelect, setShowAssignSelect] = useState(false);
    const [showReactionPicker, setShowReactionPicker] = useState(false);
    const [showImageModal, setShowImageModal] = useState(false);
    const { dateFormat } = useBranding();
    const { getMediaUrl } = useAuth();

    useEffect(() => {
        if (highlightedCommentId === comment.id && itemRef.current) {
            itemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [highlightedCommentId, comment.id]);

    const formatTime = (time) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    // Group reactions
    const reactions = (comment.reactions || []).reduce((acc, r) => {
        acc[r.emoji] = (acc[r.emoji] || 0) + 1;
        return acc;
    }, {});

    const hasReacted = (emoji) => {
        return (comment.reactions || []).some(r => r.emoji === emoji && r.userId === currentUserId);
    };

    return (
        <div
            ref={itemRef}
            className={`flex gap-3 group p-2 rounded-lg transition-colors ${comment.isResolved ? 'opacity-50' : ''} ${highlightedCommentId === comment.id ? 'bg-primary/20 border-l-4 border-l-primary shadow-sm' : ''}`}
        >
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0 uppercase overflow-hidden">
                {comment.user?.avatarPath ? (
                    <img src={`/api/media/avatars/${comment.user.avatarPath}`} alt={comment.user.name} className="w-full h-full object-cover" />
                ) : (
                    comment.guestName ? (comment.guestName.substring(0, 2)) : (comment.user?.name ? comment.user.name.substring(0, 2) : 'U')
                )}
            </div>
            <div className="space-y-1 w-full min-w-0">
                <div className="flex items-center gap-2 justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold truncate">
                            {comment.guestName ? `${comment.guestName} (Client)` : (comment.user?.name || 'User')}
                        </span>
                        {comment.user?.teamRoles?.map(role => (
                            <span
                                key={role.id}
                                className="text-[10px] px-1.5 py-0.5 rounded text-white"
                                style={{ backgroundColor: role.color || '#3b82f6' }}
                            >
                                {role.name}
                            </span>
                        ))}
                        {comment.assignee && (
                            <div className="flex items-center gap-1 bg-purple-500/10 text-purple-400 px-1.5 rounded text-[10px] group/assign">
                                <span>{comment.assignee.name}</span>
                                {!isGuest && (
                                    <button
                                        onClick={() => onAssignTask(comment.id, null)}
                                        className="ml-1 hover:text-red-400 opacity-0 group-hover/assign:opacity-100 transition-opacity"
                                        title="Unassign"
                                    >
                                        <X size={10} />
                                    </button>
                                )}
                            </div>
                        )}
                        {!comment.assignee && !isGuest && (
                            <div className="relative">
                                {!showAssignSelect ? (
                                    <button onClick={() => setShowAssignSelect(true)} className="text-xs text-muted-foreground hover:text-foreground border border-dashed border-muted-foreground/30 px-1.5 py-0.5 rounded transition-colors">
                                        Assign
                                    </button>
                                ) : (
                                    <select
                                        className="text-xs p-0 bg-background border rounded w-24 h-6"
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            onAssignTask(comment.id, val === "unassigned" ? null : val);
                                            setShowAssignSelect(false);
                                        }}
                                        onBlur={() => setShowAssignSelect(false)}
                                        autoFocus
                                    >
                                        <option value="">Select...</option>
                                        <option value="unassigned" className="text-red-500">Unassign</option>
                                        {teamMembers.map(m => (
                                            <option key={m.id} value={m.id}>{m.name}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        )}
                        {!isGuest && !comment.guestName && (
                            <button
                                onClick={() => onToggleVisibility(comment.id, comment.isVisibleToClient)}
                                className={`text-xs p-0.5 rounded ${comment.isVisibleToClient ? 'text-green-500 bg-green-500/10' : 'text-muted-foreground hover:text-foreground'}`}
                                title={comment.isVisibleToClient ? "Visible to Client" : "Hidden from Client"}
                            >
                                {comment.isVisibleToClient ? <Eye size={12} /> : <EyeOff size={12} />}
                            </button>
                        )}
                        {isGuest && !comment.guestName && comment.isVisibleToClient && (
                            <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded">Team</span>
                        )}
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!isGuest && (comment.assigneeId ? (
                            <button
                                onClick={() => onToggleResolved(comment.id, comment.isResolved)}
                                className={`flex items-center gap-1 text-[10px] border px-1 rounded hover:bg-muted ${comment.isResolved ? 'border-green-500 text-green-500' : 'border-muted-foreground text-muted-foreground'}`}
                                title="Toggle Task Status"
                            >
                                {comment.isResolved ? <CheckCircle size={10} /> : <Circle size={10} />}
                                Task
                            </button>
                        ) : (
                            <button
                                onClick={() => onToggleResolved(comment.id, comment.isResolved)}
                                className={`hover:text-primary ${comment.isResolved ? 'text-green-500' : 'text-muted-foreground'}`}
                                title={comment.isResolved ? "Mark as Active" : "Mark as Done"}
                            >
                                {comment.isResolved ? <CheckCircle size={14} /> : <Circle size={14} />}
                            </button>
                        ))}
                        <div className="relative">
                            <button
                                onClick={() => setShowReactionPicker(!showReactionPicker)}
                                className="text-muted-foreground hover:text-primary p-1"
                                title="Add Reaction"
                            >
                                <Smile size={14} />
                            </button>
                            {showReactionPicker && (
                                <div className="absolute top-full right-0 bg-popover border border-border shadow-md rounded p-1 flex gap-1 z-10" onMouseLeave={() => setShowReactionPicker(false)}>
                                    {['👍', '👀', '✅'].map(emoji => (
                                        <button
                                            key={emoji}
                                            onClick={() => { onReact(comment.id, emoji); setShowReactionPicker(false); }}
                                            className="hover:bg-muted p-1 rounded text-sm"
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => onReply(comment)}
                            className="text-muted-foreground hover:text-primary p-1"
                            title="Reply"
                        >
                            <Reply size={14} />
                        </button>
                        {(canDelete || (isGuest && comment.guestName === guestName)) && (
                            <>
                                <button
                                    onClick={() => onEdit(comment)}
                                    className="text-muted-foreground hover:text-primary p-1"
                                    title="Edit"
                                >
                                    <Pencil size={14} />
                                </button>
                                <button
                                    onClick={() => {
                                        onDelete(comment.id);
                                    }}
                                    className="text-muted-foreground hover:text-red-500 p-1"
                                    title="Delete"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </>
                        )}
                    </div>
                </div>
                <div
                    className="p-3 bg-muted/50 rounded-lg text-sm border border-border cursor-pointer hover:bg-muted/80 transition-colors relative break-words overflow-hidden whitespace-pre-wrap"
                    onClick={() => !isEditing && onCommentClick(comment.timestamp, comment.annotation ? JSON.parse(comment.annotation) : null, comment.id, comment)}
                >
                    {isEditing ? (
                        <div className="flex flex-col gap-2" onClick={e => e.stopPropagation()}>
                            <textarea
                                value={editContent}
                                onChange={e => setEditContent(e.target.value)}
                                className="w-full bg-background border border-input rounded p-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary min-h-[60px]"
                                autoFocus
                            />
                            <div className="flex justify-end gap-2">
                                <button onClick={onCancelEdit} className="text-xs px-2 py-1 hover:bg-muted rounded">Cancel</button>
                                <button onClick={() => onSaveEdit(comment.id)} className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded flex items-center gap-1">
                                    <Save size={12} /> Save
                                </button>
                            </div>
                        </div>
                    ) : (
                        renderContent(comment.content)
                    )}
                    {comment.annotation && (
                        <div className="absolute top-2 right-2 text-xs text-primary bg-primary/10 px-1 rounded">
                            🎨
                        </div>
                    )}
                    {comment.attachmentPaths && (() => {
                        try {
                            const paths = JSON.parse(comment.attachmentPaths);
                            if (paths && paths.length > 0) {
                                return (
                                    <div className={`mt-2 ${paths.length > 1 ? 'grid grid-cols-2 gap-1' : ''}`}>
                                        {paths.map((path, idx) => (
                                            <div
                                                key={idx}
                                                className="relative rounded overflow-hidden cursor-zoom-in"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowImageModal(path);
                                                }}
                                            >
                                                <img
                                                    src={getMediaUrl(`/api/media/${path}`)}
                                                    alt={`Attachment ${idx + 1}`}
                                                    className="max-h-48 w-auto rounded border border-border object-cover"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                );
                            }
                        } catch (e) { }
                        return null;
                    })()}

                    {showImageModal && (
                        <div
                            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowImageModal(false);
                            }}
                        >
                            <img
                                src={getMediaUrl(`/api/media/${showImageModal}`)}
                                alt="Full Attachment"
                                className="max-w-full max-h-full rounded shadow-lg"
                            />
                            <button
                                onClick={() => setShowImageModal(false)}
                                className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white rounded-full p-2"
                            >
                                <X size={24} />
                            </button>
                        </div>
                    )}

                    {/* Reactions Display */}
                    {Object.keys(reactions).length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                            {Object.entries(reactions).map(([emoji, count]) => (
                                <button
                                    key={emoji}
                                    onClick={() => onReact(comment.id, emoji)}
                                    className={`text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-1 ${hasReacted(emoji) ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted border-transparent text-muted-foreground'}`}
                                >
                                    <span>{emoji}</span>
                                    <span>{count}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center gap-2 mt-1 justify-between">
                        <div className="flex items-center gap-2">
                            <span
                                className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded cursor-pointer hover:bg-primary/20"
                                onClick={() => onCommentClick(comment.timestamp, comment.annotation ? JSON.parse(comment.annotation) : null, comment.id, comment)}
                            >
                                {formatTime(comment.timestamp)}
                                {comment.duration && ` - ${formatTime(comment.timestamp + comment.duration)}`}
                            </span>
                            {comment.isEdited && (
                                <span
                                    className="text-[10px] text-muted-foreground flex items-center gap-0.5"
                                    title="Edited comment"
                                >
                                    <PenLine size={10} />
                                </span>
                            )}
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                            {formatDate(comment.createdAt, dateFormat)}
                        </span>
                    </div>

                    {comment.replies && comment.replies.length > 0 && (
                        <div className="mt-2 pl-4 border-l-2 border-border space-y-3">
                            {comment.replies.map(reply => (
                                <CommentItem
                                    key={reply.id}
                                    comment={reply}
                                    onCommentClick={onCommentClick}
                                    onToggleResolved={onToggleResolved}
                                    onToggleVisibility={onToggleVisibility}
                                    onReply={onReply}
                                    onReact={onReact}
                                    isGuest={isGuest}
                                    currentUserId={currentUserId}
                                    highlightedCommentId={highlightedCommentId}
                                    onAssignTask={onAssignTask}
                                    teamMembers={teamMembers}
                                    onDelete={onDelete}
                                    canDelete={canDelete}
                                    guestName={guestName}
                                    onEdit={onEdit}
                                    isEditing={isEditing}
                                    editContent={editContent}
                                    setEditContent={setEditContent}
                                    onSaveEdit={onSaveEdit}
                                    onCancelEdit={onCancelEdit}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const ActivityPanel = ({
    projectId,
    videoId,
    imageId,
    threeDAssetId,
    comments,
    currentTime,
    onCommentClick,
    onCommentAdded,
    onCommentUpdated,
    onCommentDeleted,
    pendingAnnotations,
    getAnnotations,
    getCameraState,
    getScreenshot,
    getHotspots,
    onClearAnnotations,
    onToggleDrawing,
    isGuest,
    guestName,
    clientToken,
    isReadOnly,
    highlightedCommentId,
    onClose,
    rangeDuration,
    selectionStart,
    onInputFocus,
    pendingSubmission,
    onSubmissionComplete,
    // New props for collapsible and popout
    onCollapse,
    onPopout,
    isWindowMode
}, ref) => {
    const [newComment, setNewComment] = useState('');
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { }, isDestructive: false });
    const [assigneeId, setAssigneeId] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [filter, setFilter] = useState('all');
    const [replyingTo, setReplyingTo] = useState(null);
    const [teamMembers, setTeamMembers] = useState([]);
    const [teamRoles, setTeamRoles] = useState([]);
    const [teamOwnerId, setTeamOwnerId] = useState(null);
    const [currentUserId, setCurrentUserId] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [pastedImage, setPastedImage] = useState(null);
    const [attachments, setAttachments] = useState([]); // Array of { file, preview }
    const [isMuted, setIsMuted] = useState(false);
    const fileInputRef = useRef(null);
    const mentionsInputRef = useRef(null);

    // State for editing comments
    const [editingCommentId, setEditingCommentId] = useState(null);
    const [editContent, setEditContent] = useState('');

    useEffect(() => {
        if (!isGuest && projectId) {
            // Fetch current user details to know ID and Role
            fetch('/api/auth/me', {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            })
                .then(res => res.json())
                .then(user => {
                    setCurrentUserId(user.id);
                    setUserRole(user.role);
                })
                .catch(err => console.error("Failed to fetch user", err));

            fetch(`/api/projects/${projectId}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            })
                .then(res => res.json())
                .then(data => {
                    if (data.team) {
                        setTeamMembers(data.team.members || []);
                        setTeamRoles(data.team.roles || []);
                        setTeamOwnerId(data.team.ownerId);
                    }
                    setIsMuted(!!data.isMuted);
                })
                .catch(err => console.error("Failed to fetch team data", err));
        }
    }, [isGuest, projectId]);

    const handleDeleteComment = async (commentId) => {
        try {
            let url;
            if (isGuest) {
                url = `/api/client/projects/${clientToken}/comments/${commentId}`;
            } else {
                url = `/api/projects/comments/${commentId}`;
            }

            const res = await fetch(url, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    ...(!isGuest && { 'Authorization': `Bearer ${localStorage.getItem('token')}` }),
                },
                body: isGuest ? JSON.stringify({ guestName }) : undefined
            });

            if (res.ok) {
                if (onCommentDeleted) onCommentDeleted(commentId);
            } else {
                toast.error("Failed to delete comment");
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleToggleMute = async () => {
        if (!projectId || isGuest) return;

        try {
            const method = isMuted ? 'DELETE' : 'POST';
            const res = await fetch(`/api/projects/${projectId}/mute`, {
                method,
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (res.ok) {
                setIsMuted(!isMuted);
            }
        } catch (err) {
            console.error("Failed to toggle mute", err);
        }
    };

    const handlePaste = (e) => {
        if (e.clipboardData && e.clipboardData.items) {
            const items = e.clipboardData.items;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf("image") !== -1) {
                    e.preventDefault();
                    const blob = items[i].getAsFile();
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        setPastedImage(event.target.result);
                    };
                    reader.readAsDataURL(blob);
                    return; // Only take the first image
                }
            }
        }
    };

    const handleExport = async (format) => {
        if (!projectId) return;
        if (!videoId && !imageId && !threeDAssetId) return;

        setShowExportMenu(false);

        try {
            let endpoint = '';
            let downloadName = '';

            if (videoId) {
                endpoint = `/api/projects/${projectId}/videos/${videoId}/export/${format}`;
                downloadName = `export-${projectId}-${videoId}.${format}`;
            } else if (threeDAssetId) {
                if (format === 'csv') {
                    toast.error("CSV export is not available for 3D assets.");
                    return;
                }
                endpoint = `/api/projects/${projectId}/3d/${threeDAssetId}/export/${format}`;
                downloadName = `export-${projectId}-3d-${threeDAssetId}.${format}`;
            } else if (imageId) {
                if (format === 'csv') {
                    toast.error("CSV export is not available for images.");
                    return;
                }
                endpoint = `/api/projects/${projectId}/images/${imageId}/export/${format}`;
                downloadName = `export-${projectId}-img-${imageId}.${format}`;
            }

            const res = await fetch(endpoint, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!res.ok) throw new Error('Export failed');

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = downloadName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            console.error("Export error:", err);
            toast.error("Failed to export comments");
        }
    };

    // Video logic ref
    const videoRef = useRef(null);

    useEffect(() => {
        if (pendingSubmission) {
            handleSend(pendingSubmission);
            if (onSubmissionComplete) onSubmissionComplete();
        }
    }, [pendingSubmission]);

    const formatTime = (time) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const handleSend = async (overrides = {}) => {
        let annotations = pendingAnnotations;
        let cameraState = null;
        let screenshot = null;

        // Use overrides if provided, otherwise fall back to state
        const contentToSubmit = overrides.content !== undefined ? overrides.content : newComment;
        const attachmentToSubmit = overrides.attachment !== undefined ? overrides.attachment : attachments;

        if (getAnnotations) {
            const currentAnnotations = getAnnotations();
            // Handle both legacy array format and new 3D annotation object format
            if (currentAnnotations) {
                if (Array.isArray(currentAnnotations) && currentAnnotations.length > 0) {
                    // Legacy format: array of shapes
                    annotations = currentAnnotations;
                } else if (currentAnnotations.is3DAnchoredAnnotation) {
                    // New 3D format: object with surfaceAnchor3D, captureCamera, shapes
                    annotations = currentAnnotations;
                }
            }
        }

        if (getCameraState) {
            cameraState = getCameraState();
        }

        // Get 3D hotspots
        let hotspots = null;
        if (getHotspots && threeDAssetId) {
            hotspots = getHotspots();
        }

        if (threeDAssetId && getScreenshot) {
            screenshot = await getScreenshot();
        }

        // Video/Image Screenshot Logic (Clean vs Burned)
        let annotationScreenshot = null;
        if (!threeDAssetId && getScreenshot) {
            // Get clean screenshot
            screenshot = await getScreenshot({ includeAnnotations: false });

            // If there are annotations, get the burned version too
            const hasAnnotations = Array.isArray(annotations) ? annotations.length > 0 : !!annotations?.shapes?.length;
            if (hasAnnotations) {
                annotationScreenshot = await getScreenshot({ includeAnnotations: true });
            }
        }

        // Pasted image overrides viewer screenshot if present, or acts as the screenshot
        if (pastedImage && !attachmentToSubmit) {
            screenshot = pastedImage;
            annotationScreenshot = null; // Pasted image is what it is
        }

        // Check if we have valid content to submit
        const hasAnnotationContent = Array.isArray(annotations) ? annotations.length > 0 : !!annotations?.is3DAnchoredAnnotation;
        const hasAttachments = Array.isArray(attachmentToSubmit) ? attachmentToSubmit.length > 0 : !!attachmentToSubmit;
        if (!contentToSubmit.trim() && !hasAnnotationContent && !pastedImage && !hasAttachments) return;
        setSubmitting(true);

        try {
            let url;
            const effectiveParentId = replyingTo ? (replyingTo.parentId || replyingTo.id) : null;

            const formData = new FormData();
            formData.append('content', contentToSubmit || 'Visual Annotation');
            formData.append('timestamp', (selectionStart !== null && selectionStart !== undefined) ? selectionStart : (currentTime || 0));
            if (rangeDuration) formData.append('duration', rangeDuration);
            if (hasAnnotationContent) formData.append('annotation', JSON.stringify(annotations));
            if (cameraState) formData.append('cameraState', JSON.stringify(cameraState));
            if (hotspots && hotspots.length > 0) formData.append('hotspots', JSON.stringify(hotspots));
            if (effectiveParentId) formData.append('parentId', effectiveParentId);
            if (assigneeId) formData.append('assigneeId', assigneeId);
            if (screenshot) formData.append('screenshot', screenshot);
            if (annotationScreenshot) formData.append('annotationScreenshot', annotationScreenshot);

            if (videoId) formData.append('videoId', videoId);
            if (imageId) formData.append('imageId', imageId);
            if (threeDAssetId) formData.append('threeDAssetId', threeDAssetId);

            // Attachment Logic: Array of files uses 'attachments', single file uses 'attachment'
            if (attachmentToSubmit && Array.isArray(attachmentToSubmit) && attachmentToSubmit.length > 0) {
                attachmentToSubmit.forEach(att => {
                    formData.append('attachments', att.file || att);
                });
            } else if (attachmentToSubmit && !Array.isArray(attachmentToSubmit)) {
                // Single file (legacy/override)
                formData.append('attachment', attachmentToSubmit);
            } else if (pastedImage) {
                // Convert DataURL to Blob and append as file
                const res = await fetch(pastedImage);
                const blob = await res.blob();
                formData.append('attachment', blob, 'pasted-image.png');
            }

            if (isGuest) {
                url = `/api/client/projects/${clientToken}/comments`;
                formData.append('guestName', guestName);
            } else {
                url = `/api/projects/${projectId}/comments`;
            }

            const headers = isGuest ? {} : { 'Authorization': `Bearer ${localStorage.getItem('token')}` };

            const res = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: formData
            });

            if (res.ok) {
                const comment = await res.json();
                onCommentAdded(comment);
                setNewComment('');
                setAssigneeId('');
                setReplyingTo(null);
                setPastedImage(null);
                setAttachments([]);
                if (fileInputRef.current) fileInputRef.current.value = '';
                if (onClearAnnotations) onClearAnnotations();
            }
        } catch (err) {
            console.error(err);
        } finally {
            setSubmitting(false);
        }
    };

    useImperativeHandle(ref, () => ({
        submit: () => {
            handleSend();
        },
        submitWithContent: (content, attachment) => {
            handleSend({ content, attachment });
        },
        focusInput: () => {
            // We need a ref to MentionsInput or just basic focus logic?
            // MentionsInput is a custom component, so we need a ref to IT.
            // Let's create a ref for it first.
            mentionsInputRef.current?.focus();
        }
    }));

    const toggleResolved = async (commentId, currentStatus) => {
        try {
            const res = await fetch(`/api/projects/comments/${commentId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ isResolved: !currentStatus })
            });
            if (res.ok) {
                const updatedComment = await res.json();
                if (onCommentUpdated) {
                    onCommentUpdated(updatedComment);
                }
            }
        } catch (err) {
            console.error(err);
        }
    };

    const toggleVisibility = async (commentId, currentStatus) => {
        try {
            const res = await fetch(`/api/projects/comments/${commentId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ isVisibleToClient: !currentStatus })
            });
            if (res.ok) {
                const updatedComment = await res.json();
                if (onCommentUpdated) {
                    onCommentUpdated(updatedComment);
                }
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleAssignTask = async (commentId, userId) => {
        try {
            const res = await fetch(`/api/projects/comments/${commentId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ assigneeId: parseInt(userId) })
            });
            if (res.ok) {
                const updatedComment = await res.json();
                if (onCommentUpdated) {
                    onCommentUpdated(updatedComment);
                }
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleReact = async (commentId, emoji) => {
        try {
            const res = await fetch(`/api/projects/comments/${commentId}/reactions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ emoji, guestName })
            });
            if (res.ok) {
                const updatedComment = await res.json();
                if (onCommentUpdated) {
                    onCommentUpdated(updatedComment);
                }
            }
        } catch (err) {
            console.error(err);
        }
    };

    const filteredComments = comments.filter(c => {
        if (filter === 'all') return true;
        if (filter === 'active') return !c.isResolved;
        if (filter === 'done') return c.isResolved;
        return true;
    });

    return (
        <div className="w-full h-full md:w-full bg-black/20 backdrop-blur-xl border-l border-white/10 flex flex-col">
            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                title={confirmDialog.title}
                message={confirmDialog.message}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                isDestructive={confirmDialog.isDestructive}
            />
            <div className="min-h-14 border-b border-border flex flex-col sm:flex-row items-center justify-between bg-muted/20 shrink-0 p-2 sm:px-4 sm:py-0 gap-2">
                <div className="flex items-center justify-between w-full sm:w-auto gap-2">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">Comments</span>
                        {/* Drawing toggle removed */}
                        {!isGuest && (
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={handleToggleMute}
                                    className={`p-1 rounded hover:bg-muted ${isMuted ? 'text-red-500' : 'text-muted-foreground hover:text-foreground'}`}
                                    title={isMuted ? "Unmute Project" : "Mute Project Notifications"}
                                >
                                    {isMuted ? <BellOff size={14} /> : <Bell size={14} />}
                                </button>
                                <div className="relative">
                                    <button
                                        onClick={() => setShowExportMenu(!showExportMenu)}
                                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                                        title="Export Comments"
                                    >
                                        <Download size={14} />
                                    </button>
                                    {showExportMenu && (
                                        <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded shadow-md flex flex-col z-50 min-w-[100px] py-1">
                                            <button onClick={() => handleExport('pdf')} className="px-3 py-1.5 text-xs text-left hover:bg-muted flex items-center gap-2">
                                                <FileText size={12} /> PDF
                                            </button>
                                            {!imageId && !threeDAssetId && (
                                                <button onClick={() => handleExport('csv')} className="px-3 py-1.5 text-xs text-left hover:bg-muted flex items-center gap-2">
                                                    <Table size={12} /> CSV
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {/* Collapsible and Popout Controls */}
                                {!isWindowMode && onCollapse && (
                                    <button
                                        onClick={onCollapse}
                                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                                        title="Minimize panel"
                                    >
                                        <Minimize2 size={14} />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <button onClick={onClose} className="sm:hidden bg-secondary hover:bg-secondary/80 text-secondary-foreground p-1.5 rounded-md transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="flex bg-muted rounded p-0.5">
                        <button onClick={() => setFilter('all')} className={`text-xs px-2 py-1 rounded ${filter === 'all' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}>All</button>
                        <button onClick={() => setFilter('active')} className={`text-xs px-2 py-1 rounded ${filter === 'active' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}>Active</button>
                        <button onClick={() => setFilter('done')} className={`text-xs px-2 py-1 rounded ${filter === 'done' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}>Done</button>
                    </div>
                </div>
            </div>

            <div
                className="flex-1 overflow-auto p-4 space-y-4 custom-scrollbar min-h-0"
                onClick={(e) => {
                    // Deselect on background click
                    if (e.target === e.currentTarget && highlightedCommentId) {
                        if (onCommentClick) onCommentClick(null, null, null, null);
                        if (onClearAnnotations) onClearAnnotations();
                    }
                }}
            >
                <AnimatePresence mode="popLayout" initial={false}>
                    {filteredComments
                        .sort((a, b) => a.timestamp - b.timestamp)
                        .map((comment) => (
                            <motion.div
                                key={comment.id}
                                layout
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                                transition={{ duration: 0.3, type: "spring", stiffness: 500, damping: 30 }}
                            >
                                <CommentItem
                                    comment={comment}
                                    onCommentClick={onCommentClick}
                                    onToggleResolved={toggleResolved}
                                    onToggleVisibility={toggleVisibility}
                                    onReply={(c) => setReplyingTo(c)}
                                    isGuest={isGuest}
                                    currentUserId={currentUserId}
                                    highlightedCommentId={highlightedCommentId}
                                    onAssignTask={handleAssignTask}
                                    onReact={handleReact}
                                    teamMembers={teamMembers}
                                    onDelete={(commentId) => {
                                        setConfirmDialog({
                                            isOpen: true,
                                            title: "Delete Comment",
                                            message: "Are you sure you want to delete this comment?",
                                            onConfirm: () => {
                                                handleDeleteComment(commentId);
                                                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                                            },
                                            isDestructive: true
                                        });
                                    }}
                                    guestName={guestName}
                                    canDelete={!isGuest && (currentUserId === comment.userId || userRole === 'admin' || currentUserId === teamOwnerId)}
                                    // Edit Props
                                    onEdit={(c) => {
                                        setEditingCommentId(c.id);
                                        setEditContent(c.content);
                                        // Load existing annotations using the same mechanism as viewing comments
                                        if (c.annotation && onCommentClick) {
                                            try {
                                                const existingAnnotations = JSON.parse(c.annotation);
                                                // Use onCommentClick to load annotations into viewer and enable drawing mode
                                                onCommentClick(c.timestamp, existingAnnotations, c.id, c);
                                                // Enable drawing mode after annotations are loaded
                                                setTimeout(() => {
                                                    if (onToggleDrawing) onToggleDrawing(true);
                                                }, 100);
                                            } catch (e) {
                                                console.error('Failed to load annotations for editing:', e);
                                            }
                                        } else if (onToggleDrawing) {
                                            // No annotations, just enable drawing mode
                                            onToggleDrawing(true);
                                        }
                                    }}
                                    isEditing={editingCommentId === comment.id}
                                    editContent={editContent}
                                    setEditContent={setEditContent}
                                    onCancelEdit={() => {
                                        const originalComment = comments.find(c => c.id === editingCommentId);
                                        setEditingCommentId(null);
                                        setEditContent('');
                                        // Restore original comment display (including annotations)
                                        if (originalComment && onCommentClick) {
                                            const annos = originalComment.annotation ? JSON.parse(originalComment.annotation) : null;
                                            onCommentClick(originalComment.timestamp, annos, originalComment.id, originalComment);
                                        }
                                        // Exit drawing mode
                                        if (onToggleDrawing) onToggleDrawing(false);
                                    }}
                                    onSaveEdit={async (id) => {
                                        try {
                                            const url = isGuest
                                                ? `/api/client/projects/${clientToken}/comments/${id}`
                                                : `/api/projects/comments/${id}`;

                                            // Get current annotations from viewer
                                            let currentAnnotations = null;
                                            if (getAnnotations) {
                                                const annos = getAnnotations();
                                                if (annos && annos.length > 0) {
                                                    currentAnnotations = JSON.stringify(annos);
                                                }
                                            }

                                            // Handle update
                                            const res = await fetch(url, {
                                                method: 'PATCH',
                                                headers: {
                                                    'Content-Type': 'application/json',
                                                    ...(!isGuest && { 'Authorization': `Bearer ${localStorage.getItem('token')}` })
                                                },
                                                body: JSON.stringify({
                                                    content: editContent,
                                                    annotation: currentAnnotations,
                                                    guestName: isGuest ? guestName : undefined
                                                })
                                            });

                                            if (res.ok) {
                                                const updated = await res.json();
                                                if (onCommentUpdated) onCommentUpdated(updated);
                                                setEditingCommentId(null);
                                                setEditContent('');
                                                // Clean up: exit drawing mode and clear annotations
                                                if (onToggleDrawing) onToggleDrawing(false);
                                                if (onClearAnnotations) onClearAnnotations();
                                                // Show updated comment with its annotations
                                                if (onCommentClick && updated) {
                                                    const annos = updated.annotation ? JSON.parse(updated.annotation) : null;
                                                    onCommentClick(updated.timestamp, annos, updated.id, updated);
                                                }
                                                toast.success('Comment updated');
                                            } else {
                                                toast.error('Failed to update comment');
                                            }
                                        } catch (e) {
                                            console.error(e);
                                            toast.error('Error updating comment');
                                        }
                                    }}
                                />
                            </motion.div>
                        ))}
                </AnimatePresence>

                {filteredComments.length === 0 && (
                    <div className="text-center text-muted-foreground text-sm py-10">
                        No comments found.
                    </div>
                )}
            </div>

            {!isReadOnly && (!threeDAssetId || replyingTo) && (
                <div className="p-4 border-t border-border bg-card shrink-0">
                    {replyingTo && (
                        <div className="mb-2 bg-muted/50 p-2 rounded flex justify-between items-center text-xs">
                            <span className="truncate max-w-[200px] text-muted-foreground">
                                Replying to <strong>{replyingTo.guestName || replyingTo.user?.name || 'User'}</strong>: "{replyingTo.content.substring(0, 20)}..."
                            </span>
                            <button onClick={() => setReplyingTo(null)} className="hover:text-foreground text-muted-foreground"><X size={14} /></button>
                        </div>
                    )}
                    {pendingAnnotations && pendingAnnotations.length > 0 && (
                        <div className="mb-2 bg-blue-500/10 text-blue-400 text-xs px-2 py-1 rounded flex justify-between items-center">
                            <span>Drawing attached</span>
                            <button onClick={onClearAnnotations} className="hover:text-white">x</button>
                        </div>
                    )}
                    {rangeDuration && (
                        <div className="mb-2 bg-yellow-500/10 text-yellow-400 text-xs px-2 py-1 rounded flex justify-between items-center">
                            <span>Range: {rangeDuration.toFixed(1)}s</span>
                        </div>
                    )}
                    {pastedImage && (
                        <div className="mb-2 relative w-20 h-20 border border-border rounded overflow-hidden group">
                            <img src={pastedImage} alt="Pasted" className="w-full h-full object-cover" />
                            <button
                                onClick={() => {
                                    setPastedImage(null);
                                    setAttachments([]);
                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                }}
                                className="absolute top-0 right-0 bg-black/50 text-white p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    )}
                    {/* Multiple attachments preview */}
                    {attachments.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-1">
                            {attachments.map((att, idx) => (
                                <div key={idx} className="relative w-16 h-16 border border-border rounded overflow-hidden group">
                                    <img src={att.preview} alt={`Attachment ${idx + 1}`} className="w-full h-full object-cover" />
                                    <button
                                        onClick={() => {
                                            setAttachments(prev => prev.filter((_, i) => i !== idx));
                                        }}
                                        className="absolute top-0 right-0 bg-black/50 text-white p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X size={10} />
                                    </button>
                                </div>
                            ))}
                            {attachments.length < 10 && (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-16 h-16 border border-dashed border-border rounded flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                                >
                                    <ImageIcon size={16} />
                                </button>
                            )}
                        </div>
                    )}
                    <div className="flex flex-col gap-2">
                        <MentionsInput
                            value={newComment}
                            onChange={e => setNewComment(e.target.value)}
                            onFocus={onInputFocus}
                            onPaste={handlePaste}
                            placeholder={replyingTo ? "Write a reply..." : (isGuest ? `Posting as ${guestName}...` : "Leave a comment...")}
                            className="w-full bg-background border border-input rounded-md p-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary min-h-[80px]"
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            teamMembers={teamMembers}
                            teamRoles={teamRoles}
                            ref={mentionsInputRef}
                        />

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    accept="image/png, image/jpeg, image/webp"
                                    multiple
                                    style={{ display: 'none' }}
                                    onClick={(e) => e.target.value = null}
                                    onChange={(e) => {
                                        const files = Array.from(e.target.files || []);
                                        if (files.length === 0) return;

                                        // Check total count (existing + new <= 10)
                                        if (attachments.length + files.length > 10) {
                                            toast.error(`Max 10 images. You can add ${10 - attachments.length} more.`);
                                            return;
                                        }

                                        // Validate each file
                                        const validFiles = [];
                                        for (const file of files) {
                                            if (file.size > 5 * 1024 * 1024) {
                                                toast.error(`${file.name} is too large (Max 5MB per file)`);
                                                continue;
                                            }
                                            validFiles.push(file);
                                        }

                                        // Create previews for all valid files
                                        validFiles.forEach(file => {
                                            const reader = new FileReader();
                                            reader.onload = (event) => {
                                                setAttachments(prev => [...prev, { file, preview: event.target.result }]);
                                            };
                                            reader.readAsDataURL(file);
                                        });
                                    }}
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                {!replyingTo && (
                                    <span className="text-xs font-mono text-muted-foreground bg-muted px-1 rounded">
                                        {formatTime(currentTime)}
                                    </span>
                                )}
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="bg-secondary text-secondary-foreground hover:bg-secondary/80 p-1.5 rounded transition-colors flex items-center gap-1"
                                    title="Upload Image (Max 10MB)"
                                >
                                    <ImageIcon size={16} />
                                </button>
                                <button
                                    onClick={handleSend}
                                    className="bg-primary text-primary-foreground text-xs px-3 py-1 rounded hover:opacity-90 disabled:opacity-50"
                                >
                                    Send
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default forwardRef(ActivityPanel);
