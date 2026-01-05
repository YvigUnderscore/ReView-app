import React, { useState, useEffect, useRef } from 'react';
import { Folder, Home, Settings, LogOut, Plus, X, Users, Shield, ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, Check, UserCircle, Search, User } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import CreateProjectModal from './CreateProjectModal';

const Sidebar = ({ isOpen, onClose, isMobile, isDocked }) => {
  const { logout, user, activeTeam, switchTeam } = useAuth();
  const { title } = useBranding();
  const navigate = useNavigate();
  const location = useLocation();
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [teamSearch, setTeamSearch] = useState('');

  const teamDropdownRef = useRef(null);
  const userMenuRef = useRef(null);
  const teamSearchRef = useRef(null);

  // Compact state - Default to true if not set (User requirement: collapsed by default)
  const [isCompactState, setIsCompactState] = useState(() => {
    const stored = localStorage.getItem('sidebarCompact');
    return stored === null ? true : stored === 'true';
  });

  // Force compact if docked in mobile landscape
  const isCompact = (isMobile && isDocked) ? true : isCompactState;

  const toggleCompact = () => {
    if (isMobile && isDocked) return; // Disable toggle when docked in mobile
    const newState = !isCompactState;
    setIsCompactState(newState);
    localStorage.setItem('sidebarCompact', String(newState));
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => {
      if (path === '/') return location.pathname === '/';
      if (path === '/projects') return location.pathname.startsWith('/projects') || location.pathname.startsWith('/project/');
      if (path === '/team') return location.pathname.startsWith('/team');
      if (path === '/admin') return location.pathname.startsWith('/admin');
      return location.pathname === path;
  };

  const getLinkClass = (path) => {
      const activeClass = "bg-accent text-accent-foreground";
      const inactiveClass = "hover:bg-accent hover:text-accent-foreground";
      const baseClass = "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors relative group";

      // Center icons in compact mode
      const compactClass = isCompact ? "justify-center px-2" : "";

      return `${baseClass} ${isActive(path) ? activeClass : inactiveClass} ${compactClass}`;
  };

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (teamDropdownRef.current && !teamDropdownRef.current.contains(event.target)) {
        setShowTeamDropdown(false);
        setTeamSearch(''); // Reset search on close
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter teams based on search
  const filteredTeams = user?.teams?.filter(team =>
    team.name.toLowerCase().includes(teamSearch.toLowerCase())
  ) || [];

  // Mobile Bottom Bar (Portrait Mode)
  if (isMobile && !isDocked) {
    return (
        <>
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border flex justify-around items-end h-[60px] pb-safe shadow-lg-up">
                <Link to="/" className={`flex-1 flex flex-col items-center justify-center h-full pb-1 ${isActive('/') ? 'text-primary' : 'text-muted-foreground'}`}>
                    <Home size={22} />
                    <span className="text-[10px] font-medium mt-1">Home</span>
                </Link>
                <Link to="/projects" className={`flex-1 flex flex-col items-center justify-center h-full pb-1 ${isActive('/projects') ? 'text-primary' : 'text-muted-foreground'}`}>
                    <Folder size={22} />
                    <span className="text-[10px] font-medium mt-1">Projects</span>
                </Link>

                <button
                    onClick={() => setShowNewProjectModal(true)}
                    className="flex-1 flex flex-col items-center justify-center h-full pb-1 text-muted-foreground hover:text-primary transition-colors"
                >
                    <Plus size={22} />
                    <span className="text-[10px] font-medium mt-1">New</span>
                </button>

                <Link to="/team" className={`flex-1 flex flex-col items-center justify-center h-full pb-1 ${isActive('/team') ? 'text-primary' : 'text-muted-foreground'}`}>
                    <Users size={22} />
                    <span className="text-[10px] font-medium mt-1">Team</span>
                </Link>

                <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className={`flex-1 flex flex-col items-center justify-center h-full pb-1 ${showUserMenu ? 'text-primary' : 'text-muted-foreground'}`}
                >
                    <div className="w-6 h-6 rounded-full overflow-hidden mb-1 ring-2 ring-transparent transition-all">
                        {user?.avatarPath ? (
                            <img src={`/api/media/avatars/${user.avatarPath}`} alt="User" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-muted flex items-center justify-center text-xs">
                                {user?.name?.charAt(0) || 'U'}
                            </div>
                        )}
                    </div>
                    <span className="text-[10px] font-medium">Profile</span>
                </button>
            </div>

            {/* Mobile User Menu Bottom Sheet */}
            {showUserMenu && (
                <>
                <div className="fixed inset-0 bg-black/60 z-50 animate-in fade-in duration-200" onClick={() => setShowUserMenu(false)} />
                <div className="fixed bottom-0 left-0 right-0 bg-popover z-50 rounded-t-2xl border-t border-border p-4 pb-8 animate-in slide-in-from-bottom-full duration-300 shadow-2xl">
                    <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mb-6" />

                    <div className="flex items-center gap-4 mb-6 px-2">
                            {user?.avatarPath ? (
                                <img src={`/api/media/avatars/${user.avatarPath}`} alt="User" className="w-14 h-14 rounded-full object-cover ring-2 ring-border" />
                            ) : (
                            <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xl ring-2 ring-border">
                                {user?.name?.charAt(0) || 'U'}
                            </div>
                            )}
                        <div>
                            <p className="font-bold text-lg">{user?.name}</p>
                            <p className="text-sm text-muted-foreground">{user?.email}</p>
                            <span className="inline-block mt-1 text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium uppercase">{user?.role}</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                            {user?.role === 'admin' && (
                                <button onClick={() => { navigate('/admin'); setShowUserMenu(false); }} className="w-full flex items-center gap-4 px-4 py-4 hover:bg-muted rounded-xl transition-colors">
                                    <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
                                        <Shield size={20} />
                                    </div>
                                    <span className="font-medium">Admin Dashboard</span>
                                </button>
                            )}

                            <button className="w-full flex items-center gap-4 px-4 py-4 hover:bg-muted rounded-xl transition-colors opacity-50">
                                <div className="p-2 bg-muted text-muted-foreground rounded-lg">
                                    <Settings size={20} />
                                </div>
                                <span className="font-medium">Settings</span>
                            </button>

                            <button onClick={handleLogout} className="w-full flex items-center gap-4 px-4 py-4 hover:bg-red-500/10 text-destructive rounded-xl transition-colors mt-4">
                                <div className="p-2 bg-red-500/10 rounded-lg">
                                    <LogOut size={20} />
                                </div>
                                <span className="font-medium">Log Out</span>
                            </button>
                    </div>
                </div>
                </>
            )}

            {/* New Project Modal (Mobile Trigger) */}
            {showNewProjectModal && (
                 <CreateProjectModal
                    onClose={() => setShowNewProjectModal(false)}
                    onProjectCreated={(project) => {
                        navigate(`/project/${project.id}`);
                    }}
                 />
            )}
        </>
    );
  }

  return (
    <>
      <div className={`
        ${(isMobile && isDocked) ? 'relative' : 'fixed'} ${!isMobile ? 'md:relative' : ''} inset-y-0 left-0 z-50 bg-card border-r border-border h-[100dvh] flex flex-col transition-all duration-300 ease-in-out
        ${isOpen || (isMobile && isDocked) ? 'translate-x-0' : `-translate-x-full ${!isMobile ? 'md:translate-x-0' : ''}`}
        ${isCompact ? `${(!isMobile || isDocked) ? 'md:w-16 w-16' : 'w-64'}` : `w-64 ${!isMobile ? 'md:w-64' : ''}`}
        ${(isMobile && isDocked) ? 'shrink-0' : ''}
      `}>
        {/* Header Section */}
        <div className={`p-4 border-b border-border relative flex flex-col gap-4 transition-all duration-300 ${isCompact && !isMobile ? 'items-center px-2' : ''}`}>
            <Link to="/" className={`flex items-center gap-2 ${(isCompact && !isMobile) ? 'justify-center w-full' : ''}`}>
                <div className="min-w-8 w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold shrink-0">
                    {title ? title.charAt(0) : 'R'}
                </div>
                {(!isCompact || isMobile) && <span className="font-bold text-lg truncate">{title || 'ReView'}</span>}
            </Link>

            {/* Mobile Close Button */}
            <button
                onClick={onClose}
                className={`absolute top-4 right-4 text-muted-foreground hover:text-foreground ${!isMobile ? 'md:hidden' : ''}`}
            >
                <X size={20} />
            </button>

            {/* Custom Team Switcher */}
            {user?.teams && user.teams.length > 0 && (
                <div className="relative w-full" ref={teamDropdownRef}>
                    {!isCompact ? (
                        <button
                            onClick={() => {
                                setShowTeamDropdown(!showTeamDropdown);
                                if (!showTeamDropdown) setTimeout(() => teamSearchRef.current?.focus(), 100);
                            }}
                            className="w-full flex items-center justify-between bg-muted/50 hover:bg-muted border border-border rounded-md px-3 py-2 text-sm transition-colors"
                        >
                            <span className="truncate font-medium">{activeTeam?.name || 'Select Team'}</span>
                            <ChevronDown size={14} className={`text-muted-foreground transition-transform ${showTeamDropdown ? 'rotate-180' : ''}`} />
                        </button>
                    ) : (
                        <button
                            onClick={() => setShowTeamDropdown(!showTeamDropdown)}
                            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0 hover:ring-2 ring-primary transition-all"
                            title={activeTeam?.name}
                        >
                            {activeTeam?.name?.substring(0, 2).toUpperCase() || 'TM'}
                        </button>
                    )}

                    {showTeamDropdown && (
                        <div className={`absolute z-50 mt-2 w-56 bg-popover border border-border rounded-md shadow-lg p-1 overflow-hidden animate-in fade-in zoom-in-95 ${isCompact ? 'left-full ml-2 top-0' : 'left-0 right-0'}`}>
                            <div className="text-xs font-semibold text-muted-foreground px-2 py-1.5">Switch Team</div>

                            {/* Search Input */}
                            <div className="px-2 pb-2">
                                <div className="relative">
                                    <Search className="absolute left-2 top-1.5 h-3 w-3 text-muted-foreground" />
                                    <input
                                        ref={teamSearchRef}
                                        type="text"
                                        placeholder="Find team..."
                                        className="w-full pl-7 pr-2 py-1 text-xs bg-muted/50 border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                        value={teamSearch}
                                        onChange={(e) => setTeamSearch(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>
                            </div>

                            <div className="max-h-48 overflow-y-auto">
                                {filteredTeams.length > 0 ? (
                                    filteredTeams.map(team => (
                                        <button
                                            key={team.id}
                                            onClick={() => {
                                                switchTeam(team.id);
                                                setShowTeamDropdown(false);
                                                setTeamSearch('');
                                            }}
                                            className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm text-left ${activeTeam?.id === team.id ? 'bg-accent text-accent-foreground' : 'hover:bg-muted text-popover-foreground'}`}
                                        >
                                            <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center text-[10px] font-bold shrink-0">
                                                {team.name.substring(0, 1).toUpperCase()}
                                            </div>
                                            <span className="truncate flex-1">{team.name}</span>
                                            {activeTeam?.id === team.id && <Check size={14} className="shrink-0" />}
                                        </button>
                                    ))
                                ) : (
                                    <div className="px-2 py-2 text-xs text-muted-foreground text-center">No teams found</div>
                                )}
                            </div>

                            <div className="h-px bg-border my-1" />
                            <Link
                                to="/team"
                                onClick={() => {
                                    setShowTeamDropdown(false);
                                    setTeamSearch('');
                                }}
                                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-muted text-popover-foreground transition-colors"
                            >
                                <Plus size={14} />
                                <span>Create New Team</span>
                            </Link>
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* New Project Button */}
        <div className="p-2">
          <button
            onClick={() => setShowNewProjectModal(true)}
            className={`flex items-center bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-all ${isCompact ? 'w-full justify-center p-2' : 'w-full gap-2 px-4 py-2'}`}
            disabled={!activeTeam && user?.role !== 'admin'}
            title={isCompact ? "New Project" : ""}
          >
              <Plus size={16} />
              {!isCompact && <span>New Project</span>}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-2 space-y-4 overflow-y-auto overflow-x-hidden">
            {/* Workspace Section */}
            <div className="space-y-1">
                {(!isCompact || isMobile) && <div className="px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Workspace</div>}

                <Link to="/" className={getLinkClass('/')}>
                    <Home size={18} className="shrink-0" />
                    {!isCompact && <span className="truncate">Dashboard</span>}
                    {isCompact && !isMobile && (
                        <span className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-border">
                            Dashboard
                        </span>
                    )}
                </Link>
                <Link to={activeTeam ? `/projects?teamId=${activeTeam.id}` : '/projects'} className={getLinkClass('/projects')}>
                    <Folder size={18} className="shrink-0" />
                    {!isCompact && <span className="truncate">Projects</span>}
                     {isCompact && !isMobile && (
                        <span className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-border">
                            Projects
                        </span>
                    )}
                </Link>
            </div>

            {/* Management Section */}
            <div className="space-y-1">
                 {(!isCompact || isMobile) && <div className="px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Management</div>}

                <Link to="/team" className={getLinkClass('/team')}>
                    <Users size={18} className="shrink-0" />
                    {!isCompact && <span className="truncate">Team</span>}
                     {isCompact && !isMobile && (
                        <span className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-border">
                            Team
                        </span>
                    )}
                </Link>
                {user?.role === 'admin' && (
                    <Link to="/admin" className={getLinkClass('/admin')}>
                        <Shield size={18} className="shrink-0" />
                        {!isCompact && <span className="truncate">Admin</span>}
                         {isCompact && !isMobile && (
                            <span className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-border">
                                Admin
                            </span>
                        )}
                    </Link>
                )}
            </div>
        </nav>

        {/* User Footer Section */}
        <div className="p-2 border-t border-border mt-auto relative" ref={userMenuRef}>
          <button
             onClick={() => setShowUserMenu(!showUserMenu)}
             className={`flex items-center rounded-md hover:bg-accent transition-colors ${isCompact ? 'w-full justify-center p-2' : 'w-full gap-3 px-3 py-2 text-sm font-medium'}`}
          >
             {user?.avatarPath ? (
                 <img src={`/api/media/avatars/${user.avatarPath}`} alt="User" className="w-6 h-6 rounded-full object-cover shrink-0" />
             ) : (
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs shrink-0">
                    {user?.name?.charAt(0) || 'U'}
                </div>
             )}

            {!isCompact && (
                <div className="flex flex-col items-start truncate text-left flex-1">
                    <span className="text-sm font-medium truncate w-full">{user?.name}</span>
                    <span className="text-xs text-muted-foreground truncate w-full">{user?.email}</span>
                </div>
            )}

            {!isCompact && <ChevronDown size={14} className="text-muted-foreground" />}
          </button>

          {/* User Menu Popup */}
          {showUserMenu && (
             <div className={`absolute z-50 bottom-full mb-2 w-56 bg-popover border border-border rounded-md shadow-lg p-1 overflow-hidden animate-in fade-in slide-in-from-bottom-2 ${isCompact ? 'left-full ml-2 mb-[-40px]' : 'left-0 right-0'}`}>
                <div className="px-2 py-2 border-b border-border mb-1">
                    <p className="font-medium text-sm truncate">{user?.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>

                {/* Profile/Preferences */}
                <Link
                    to="/settings"
                    onClick={() => setShowUserMenu(false)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-muted text-popover-foreground transition-colors text-left"
                >
                    <UserCircle size={16} />
                    <span>Profile</span>
                </Link>
                 <Link
                    to="/settings"
                    onClick={() => setShowUserMenu(false)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-muted text-popover-foreground transition-colors text-left"
                >
                    <Settings size={16} />
                    <span>Settings</span>
                </Link>

                <div className="h-px bg-border my-1" />

                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-destructive/10 hover:text-destructive text-destructive transition-colors text-left"
                >
                    <LogOut size={16} />
                    <span>Log Out</span>
                </button>
             </div>
          )}

          {/* Desktop Compact Toggle Button */}
          <button
             onClick={toggleCompact}
             className="hidden md:flex w-full items-center justify-center p-2 mt-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
          >
             {isCompact ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </div>

      {/* New Project Modal using shared component */}
      {showNewProjectModal && (
         <CreateProjectModal
            onClose={() => setShowNewProjectModal(false)}
            onProjectCreated={(project) => {
                navigate(`/project/${project.id}`);
            }}
         />
      )}
    </>
  );
};

export default Sidebar;
