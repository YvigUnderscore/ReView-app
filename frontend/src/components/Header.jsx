import React, { Fragment, useState } from 'react';
import { Search, Bell, User, Sun, Moon, Menu, ChevronRight } from 'lucide-react';
import { useHeader } from '../context/HeaderContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import NotificationsPopover from './NotificationsPopover';
import { useNavigate, Link } from 'react-router-dom';

const Header = ({ onMenuClick }) => {
  const { breadcrumbs, searchQuery, setSearchQuery } = useHeader();
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { unreadCount } = useNotification();
  const [showNotifications, setShowNotifications] = useState(false);
  const navigate = useNavigate();

  // Helper to construct breadcrumb link path
  // Assumption: Breadcrumbs structure matches routes (e.g. "Projects" -> /projects, "Project Name" -> /project/:id)
  // Since we only have labels in breadcrumbs, making them clickable links requires knowing the target ID or path.
  // The current context only provides strings.
  // To solve this properly, I'll link "Projects" to /projects.
  // For dynamic project names, I would need the ID in the context.
  // As a safe fallback for now, "Projects" is the most useful link to restore.
  // The last item is the current page, so no link needed.

  const getBreadcrumbLink = (label) => {
      if (label === 'Projects') return '/projects';
      if (label === 'Team') return '/team';
      if (label === 'Admin') return '/admin';
      if (label === 'Dashboard') return '/dashboard';
      return null;
  };

  return (
    <>
      <header className="h-14 border-b border-border bg-background flex items-center justify-between px-4 relative z-40">
        <div className="flex items-center gap-4">
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="md:hidden text-muted-foreground hover:text-foreground mr-2"
            >
              <Menu size={24} />
            </button>
          )}

          {/* Enhanced Breadcrumbs */}
          <nav aria-label="Breadcrumb" className="hidden sm:flex items-center text-sm font-medium">
              <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
                  ReView
              </Link>
              {breadcrumbs.length > 0 && (
                  <ChevronRight size={14} className="mx-2 text-muted-foreground/50" />
              )}
              {breadcrumbs.map((item, index) => {
                  const isLast = index === breadcrumbs.length - 1;
                  const linkTarget = !isLast ? getBreadcrumbLink(item) : null;

                  return (
                      <Fragment key={index}>
                          {index > 0 && <ChevronRight size={14} className="mx-2 text-muted-foreground/50" />}
                          {linkTarget ? (
                               <Link to={linkTarget} className="text-muted-foreground hover:text-foreground transition-colors">
                                   {item}
                               </Link>
                          ) : (
                               <span className={`${isLast ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                                   {item}
                               </span>
                          )}
                      </Fragment>
                  );
              })}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="relative hidden md:block">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              className="h-9 w-64 rounded-md border border-input bg-muted/30 pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring transition-all focus:w-72 focus:bg-background"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <button
             onClick={toggleTheme}
             className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
             title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <button
             onClick={() => setShowNotifications(!showNotifications)}
             className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground relative transition-colors"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-background"></span>
            )}
          </button>

          {/* User Avatar - visible but compact on mobile */}
          <button
             onClick={() => navigate('/settings')}
             className="h-8 w-8 ml-1 bg-muted rounded-full flex items-center justify-center border border-border hover:ring-2 ring-primary overflow-hidden transition-all"
          >
             {user?.avatarPath ? (
                 <img src={`/api/media/avatars/${user.avatarPath}`} alt={user.name} className="w-full h-full object-cover" />
             ) : (
                 <div className="w-full h-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                    {user?.name?.charAt(0) || <User size={14} />}
                 </div>
             )}
          </button>
        </div>

        {showNotifications && (
           <div className="absolute top-14 right-4 z-50">
               <NotificationsPopover onClose={() => setShowNotifications(false)} />
           </div>
        )}
      </header>
    </>
  );
};

export default Header;
