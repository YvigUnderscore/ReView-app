import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Clock, CheckCircle, Circle, Filter, Pencil, Eye, EyeOff, Reply, X, Download, FileText, Table, ExternalLink, Minimize2, Smile } from 'lucide-react';
import MentionsInput from './MentionsInput';
import { formatDate } from '../lib/dateUtils';
import { useBranding } from '../context/BrandingContext';

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

const CommentItem = ({ comment, onCommentClick, onToggleResolved, onToggleVisibility, onReply, onReact, isGuest, currentUserId, highlightedCommentId, onAssignTask, teamMembers }) => {
    const itemRef = useRef(null);
    const [showAssignSelect, setShowAssignSelect] = useState(false);
    const [showReactionPicker, setShowReactionPicker] = useState(false);
    const { dateFormat } = useBranding();

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
            className={`flex gap-3 group p-2 rounded-lg transition-colors ${comment.isResolved ? 'opacity-50' : ''} ${highlightedCommentId === comment.id ? 'bg-primary/10 border border-primary/20' : ''}`}
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
                                     <button onClick={() => setShowAssignSelect(true)} className="text-[10px] text-muted-foreground hover:text-foreground border border-dashed border-muted-foreground/30 px-1 rounded">
                                         Assign
                                     </button>
                                 ) : (
                                     <select
                                        className="text-[10px] p-0 bg-background border rounded w-20"
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
                    </div>
                </div>
                <div
                    className="p-3 bg-muted/50 rounded-lg text-sm border border-border cursor-pointer hover:bg-muted/80 transition-colors relative"
                    onClick={() => onCommentClick(comment.timestamp, comment.annotation ? JSON.parse(comment.annotation) : null, comment.id, comment)}
                >
                    {renderContent(comment.content)}
                    {comment.annotation && (
                        <div className="absolute top-2 right-2 text-xs text-primary bg-primary/10 px-1 rounded">
                            Has Drawing
                        </div>
                    )}
                </div>

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
                            />
                        ))}
                    </div>
                )}
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
    pendingAnnotations,
    getAnnotations,
    getCameraState,
    getScreenshot,
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
    // New props for collapsible and popout
    onCollapse,
    onPopout,
    isWindowMode
}) => {
  const [newComment, setNewComment] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState('all');
  const [replyingTo, setReplyingTo] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamRoles, setTeamRoles] = useState([]);
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
      if (!isGuest && projectId) {
          fetch(`/api/projects/${projectId}`, {
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          })
          .then(res => res.json())
          .then(data => {
              if (data.team) {
                  setTeamMembers(data.team.members || []);
                  setTeamRoles(data.team.roles || []);
              }
          })
          .catch(err => console.error("Failed to fetch team data", err));
      }
  }, [isGuest, projectId]);

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
                 alert("CSV export is not available for 3D assets.");
                 return;
             }
             endpoint = `/api/projects/${projectId}/3d/${threeDAssetId}/export/${format}`;
             downloadName = `export-${projectId}-3d-${threeDAssetId}.${format}`;
          } else if (imageId) {
              if (format === 'csv') {
                  alert("CSV export is not available for images.");
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
          alert("Failed to export comments");
      }
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSend = async () => {
     let annotations = pendingAnnotations;
     let cameraState = null;
     let screenshot = null;

     if (getAnnotations) {
         const currentAnnotations = getAnnotations();
         if (currentAnnotations && currentAnnotations.length > 0) {
             annotations = currentAnnotations;
         }
     }

     if (getCameraState) {
         cameraState = getCameraState();
     }

     if (threeDAssetId && getScreenshot) {
         screenshot = getScreenshot();
     }

     if (!newComment.trim() && (!annotations || annotations.length === 0)) return;
     setSubmitting(true);

     try {
        let url, body, headers;
        const effectiveParentId = replyingTo ? (replyingTo.parentId || replyingTo.id) : null;

        const commonBody = {
            content: newComment || 'Visual Annotation',
            timestamp: (selectionStart !== null && selectionStart !== undefined) ? selectionStart : (currentTime || 0),
            duration: rangeDuration || null,
            annotation: annotations && annotations.length > 0 ? annotations : null,
            cameraState: cameraState,
            parentId: effectiveParentId,
            assigneeId: assigneeId || null,
            screenshot: screenshot
        };

        if (videoId) commonBody.videoId = videoId;
        if (imageId) commonBody.imageId = imageId;
        if (threeDAssetId) commonBody.threeDAssetId = threeDAssetId;

        if (isGuest) {
            url = `/api/client/projects/${clientToken}/comments`;
            body = { ...commonBody, guestName: guestName };
            headers = { 'Content-Type': 'application/json' };
        } else {
            url = `/api/projects/${projectId}/comments`;
            body = commonBody;
            headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            };
        }

        const res = await fetch(url, {
           method: 'POST',
           headers: headers,
           body: JSON.stringify(body)
        });

        if (res.ok) {
           const comment = await res.json();
           onCommentAdded(comment);
           setNewComment('');
           setAssigneeId('');
           setReplyingTo(null);
           if (onClearAnnotations) onClearAnnotations();
        }
     } catch (err) {
        console.error(err);
     } finally {
        setSubmitting(false);
     }
  };

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
    <div className="w-full h-full md:w-full bg-card flex flex-col">
      <div className="h-14 border-b border-border flex items-center px-4 justify-between bg-muted/20 shrink-0">
         <div className="flex items-center gap-2">
             <span className="font-semibold text-sm">Comments</span>
             {!isGuest && (
                 <div className="flex items-center gap-1">
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
                    {!isWindowMode && onPopout && (
                        <button
                            onClick={onPopout}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                            title="Open in new window"
                        >
                            <ExternalLink size={14} />
                        </button>
                    )}
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

         <div className="flex items-center justify-between px-4 py-2 border-b border-border">
            <div className="flex bg-muted rounded p-0.5">
                <button onClick={() => setFilter('all')} className={`text-xs px-2 py-1 rounded ${filter === 'all' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}>All</button>
                <button onClick={() => setFilter('active')} className={`text-xs px-2 py-1 rounded ${filter === 'active' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}>Active</button>
                <button onClick={() => setFilter('done')} className={`text-xs px-2 py-1 rounded ${filter === 'done' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}>Done</button>
            </div>
            <button onClick={onClose} className="md:hidden bg-secondary hover:bg-secondary/80 text-secondary-foreground p-2 rounded-md transition-colors ml-2">
                <X size={20} />
            </button>
         </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {filteredComments
        .sort((a, b) => a.timestamp - b.timestamp)
        .map((comment) => (
           <CommentItem
               key={comment.id}
               comment={comment}
               onCommentClick={onCommentClick}
               onToggleResolved={toggleResolved}
               onToggleVisibility={toggleVisibility}
               onReply={(c) => setReplyingTo(c)}
               isGuest={isGuest}
               currentUserId={null}
               highlightedCommentId={highlightedCommentId}
               onAssignTask={handleAssignTask}
               onReact={handleReact}
               teamMembers={teamMembers}
           />
        ))}

        {filteredComments.length === 0 && (
           <div className="text-center text-muted-foreground text-sm py-10">
              No comments found.
           </div>
        )}
      </div>

      {!isReadOnly && (
      <div className="p-4 border-t border-border bg-card">
         {replyingTo && (
             <div className="mb-2 bg-muted/50 p-2 rounded flex justify-between items-center text-xs">
                 <span className="truncate max-w-[200px] text-muted-foreground">
                     Replying to <strong>{replyingTo.guestName || replyingTo.user?.name || 'User'}</strong>: "{replyingTo.content.substring(0, 20)}..."
                 </span>
                 <button onClick={() => setReplyingTo(null)} className="hover:text-foreground text-muted-foreground"><X size={14}/></button>
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
         <div className="flex flex-col gap-2">
            <MentionsInput
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                onFocus={onInputFocus}
                placeholder={replyingTo ? "Write a reply..." : (isGuest ? `Posting as ${guestName}...` : "Leave a comment...")}
                className="w-full bg-background border border-input rounded-md p-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary min-h-[80px]"
                onKeyDown={e => {
                    if(e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                    }
                }}
                teamMembers={teamMembers}
                teamRoles={teamRoles}
            />

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"></div>
                <div className="flex items-center gap-2">
                   {!replyingTo && (
                       <span className="text-xs font-mono text-muted-foreground bg-muted px-1 rounded">
                          {formatTime(currentTime)}
                       </span>
                   )}
                   <button
                      onClick={onToggleDrawing}
                      className="bg-muted text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/80 transition-colors"
                      title="Draw on video"
                   >
                      <Pencil size={14} />
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

export default ActivityPanel;
