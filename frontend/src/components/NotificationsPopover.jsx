import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../context/NotificationContext';
import { Bell, Check, Trash2, X } from 'lucide-react';

const NotificationsPopover = ({ onClose }) => {
    const { notifications, markAsRead, markAllAsRead, deleteNotification, deleteAll } = useNotification();
    const navigate = useNavigate();

    const handleNotificationClick = (n) => {
        markAsRead(n.id);

        // Determine navigation based on type
        if (n.type === 'TEAM_ADD') {
            navigate('/team');
        } else if ((n.type === 'PROJECT_CREATE' || n.type === 'STATUS_CHANGE') && n.projectId) {
            if (n.project && n.project.team && n.project.team.slug && n.project.slug) {
                navigate(`/${n.project.team.slug}/${n.project.slug}`);
            } else {
                navigate(`/project/${n.projectId}`);
            }
        } else if (n.projectId && n.videoId) {
            let baseUrl = `/project/${n.projectId}`;
            if (n.project && n.project.team && n.project.team.slug && n.project.slug) {
                baseUrl = `/${n.project.team.slug}/${n.project.slug}`;
            }
            let url = `${baseUrl}?video=${n.videoId}`;
            if (n.referenceId && (n.type === 'MENTION' || n.type === 'REPLY')) {
                url += `&commentId=${n.referenceId}`;
            }
            navigate(url);
        }

        if (onClose) onClose();
    };

    // Grouping Logic
    const groupedNotifications = notifications.reduce((groups, n) => {
        const projectName = n.project?.name || 'System';
        if (!groups[projectName]) groups[projectName] = [];
        groups[projectName].push(n);
        return groups;
    }, {});

    return (
        <div className="w-80 bg-card border border-border shadow-lg rounded-lg flex flex-col max-h-[500px]">
            <div className="flex items-center justify-between p-3 border-b border-border bg-muted/20">
                <h3 className="font-semibold text-sm">Notifications</h3>
                <div className="flex gap-1">
                    <button
                        onClick={markAllAsRead}
                        className="text-xs text-primary hover:underline px-2 py-1 rounded hover:bg-accent"
                        title="Mark all as read"
                    >
                        Mark all read
                    </button>
                    <button
                        onClick={deleteAll}
                        className="text-xs text-destructive hover:underline px-2 py-1 rounded hover:bg-accent"
                        title="Delete all"
                    >
                        Clear all
                    </button>
                </div>
            </div>

            <div className="overflow-y-auto flex-1">
                {notifications.length > 0 ? (
                    Object.entries(groupedNotifications).map(([projectName, projectNotifications]) => {
                        // Secondary Grouping - Stack by context (type + reference)
                        const stackedGroups = projectNotifications.reduce((stacks, n) => {
                            // Use referenceId (commentId) for stacking comments/replies/mentions on same thread
                            // Use videoId for general video updates
                            // Fallback to type
                            const key = `${n.type}_${n.referenceId || n.videoId || 'general'}`;
                            if (!stacks[key]) stacks[key] = [];
                            stacks[key].push(n);
                            return stacks;
                        }, {});

                        return (
                            <div key={projectName}>
                                <div className="bg-muted/30 px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 backdrop-blur-sm border-b border-border">
                                    {projectName}
                                </div>

                                {Object.values(stackedGroups).map(group => {
                                    const mainNotif = group[0];
                                    const count = group.length;
                                    // Use Set to filter unique names/avatars
                                    const uniqueUsers = Array.from(new Map(group.map(n => [n.user?.id, n.user])).values()).filter(Boolean);
                                    const userNames = uniqueUsers.map(u => u.name).join(', ');

                                    let content = mainNotif.content;
                                    // Custom content for stacked items
                                    if (count > 1) {
                                        if (mainNotif.type === 'COMMENT') {
                                            content = `${uniqueUsers[0]?.name} and ${count - 1} others commented`;
                                        } else if (mainNotif.type === 'REPLY') {
                                            content = `${uniqueUsers[0]?.name} and ${count - 1} others replied`;
                                        } else if (mainNotif.type === 'MENTION') {
                                            content = `${uniqueUsers[0]?.name} and ${count - 1} others mentioned you`;
                                        }
                                    }

                                    return (
                                        <div
                                            key={mainNotif.id}
                                            className={`p-3 border-b border-border hover:bg-muted/50 transition-colors relative group flex gap-3 ${group.some(n => !n.isRead) ? 'bg-primary/5' : ''}`}
                                        >
                                            {/* Avatars Stack - Enhanced Visuals */}
                                            <div className="flex -space-x-3 overflow-hidden items-start pt-1 shrink-0 pl-1">
                                                {uniqueUsers.slice(0, 3).map((u, i) => (
                                                    <div key={i} className="relative z-10 hover:z-20 transition-all">
                                                        {u.avatarPath ? (
                                                            <img
                                                                src={`/api/media/avatars/${u.avatarPath}`}
                                                                className="inline-block h-8 w-8 rounded-full ring-2 ring-card object-cover"
                                                                alt={u.name}
                                                                title={u.name}
                                                            />
                                                        ) : (
                                                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold ring-2 ring-card text-muted-foreground" title={u.name}>
                                                                {u.name?.charAt(0)}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                                {uniqueUsers.length > 3 && (
                                                    <div className="relative z-0 h-8 w-8 rounded-full bg-muted flex items-center justify-center text-[9px] font-medium ring-2 ring-card text-muted-foreground">
                                                        +{uniqueUsers.length - 3}
                                                    </div>
                                                )}
                                                {uniqueUsers.length === 0 && (
                                                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground ring-2 ring-card">
                                                        <Bell size={14} />
                                                    </div>
                                                )}
                                            </div>

                                            <div
                                                className="flex-1 cursor-pointer min-w-0 flex flex-col justify-center"
                                                onClick={() => group.forEach(n => handleNotificationClick(n))}
                                            >
                                                <div className={`text-sm ${group.some(n => !n.isRead) ? 'font-semibold text-foreground' : 'text-muted-foreground'} line-clamp-2`}>
                                                    {content}
                                                </div>
                                                <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-2">
                                                    <span>{new Date(mainNotif.createdAt).toLocaleDateString()} {new Date(mainNotif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    {count > 1 && <span className="bg-primary/10 text-primary px-1.5 rounded-full font-medium">{count} events</span>}
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-center self-center">
                                                {group.some(n => !n.isRead) && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); group.forEach(n => markAsRead(n.id)); }}
                                                        className="text-muted-foreground hover:text-primary p-1.5 rounded-full hover:bg-background shadow-sm border border-transparent hover:border-border"
                                                        title="Mark as read"
                                                    >
                                                        <Check size={14} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); group.forEach(n => deleteNotification(n.id)); }}
                                                    className="text-muted-foreground hover:text-destructive p-1.5 rounded-full hover:bg-background shadow-sm border border-transparent hover:border-border"
                                                    title="Delete"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>

                                            {group.some(n => !n.isRead) && (
                                                <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-primary pointer-events-none group-hover:hidden shadow-sm"></div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
                        <div className="p-4 bg-muted/20 rounded-full">
                            <Bell size={32} className="opacity-50" />
                        </div>
                        <span className="text-sm font-medium">No notifications</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotificationsPopover;
