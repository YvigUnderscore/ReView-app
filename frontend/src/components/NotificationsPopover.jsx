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
          // Navigate to Team Dashboard or just Dashboard
          navigate('/team'); // Or maybe `/dashboard` if Team view is generic
      } else if ((n.type === 'PROJECT_CREATE' || n.type === 'STATUS_CHANGE') && n.projectId) {
          // Navigate to Project view
          navigate(`/project/${n.projectId}`);
      } else if (n.projectId && n.videoId) {
          // Video related (Comment, Reply, Mention, Version Upload)
          let url = `/project/${n.projectId}?video=${n.videoId}`;
          if (n.referenceId && (n.type === 'MENTION' || n.type === 'REPLY')) {
              url += `&commentId=${n.referenceId}`;
          }
          navigate(url);
      }

      if (onClose) onClose();
  };

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
              Object.entries(notifications.reduce((groups, n) => {
                  const projectName = n.project?.name || 'System';
                  if (!groups[projectName]) groups[projectName] = [];
                  groups[projectName].push(n);
                  return groups;
              }, {})).map(([projectName, projectNotifications]) => (
                  <div key={projectName}>
                      <div className="bg-muted/30 px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 backdrop-blur-sm border-b border-border">
                          {projectName}
                      </div>
                      {projectNotifications.map(n => (
                          <div
                            key={n.id}
                            className={`p-3 border-b border-border hover:bg-muted/50 transition-colors relative group flex gap-3 ${!n.isRead ? 'bg-primary/5' : ''}`}
                          >
                              <div
                                className="flex-1 cursor-pointer"
                                onClick={() => handleNotificationClick(n)}
                              >
                                  <div className={`text-sm ${!n.isRead ? 'font-medium' : 'text-muted-foreground'}`}>
                                      {n.content}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                      {new Date(n.createdAt).toLocaleDateString()} {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                              </div>

                              <div className="flex flex-col gap-1 md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity justify-center">
                                  {!n.isRead && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                                        className="text-muted-foreground hover:text-primary p-1 rounded hover:bg-background"
                                        title="Mark as read"
                                      >
                                          <Check size={14} />
                                      </button>
                                  )}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                                    className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-background"
                                    title="Delete"
                                  >
                                      <X size={14} />
                                  </button>
                              </div>

                              {!n.isRead && (
                                  <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-primary pointer-events-none group-hover:hidden"></div>
                              )}
                          </div>
                      ))}
                  </div>
              ))
          ) : (
            <div className="text-sm text-muted-foreground py-10 text-center flex flex-col items-center gap-2">
                <Bell size={24} className="opacity-20" />
                <span>No notifications</span>
            </div>
          )}
      </div>
    </div>
  );
};

export default NotificationsPopover;
