import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MoreVertical, Pencil, Trash2, Clock, Box, Play } from 'lucide-react';
import { formatDate } from '../lib/dateUtils';
import { useBranding } from '../context/BrandingContext';

const ProjectCard = ({
    project,
    viewMode = 'grid',
    onStatusChange,
    onEdit,
    onDelete
}) => {
    const { dateFormat } = useBranding();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const thumbUrl = project.thumbnailPath ? `/api/thumbnails/${project.thumbnailPath}` : null;

    // Check for unread activity
    const lastVisited = localStorage.getItem(`last_visited_${project.id}`);
    const isUnread = !lastVisited || new Date(project.updatedAt) > new Date(lastVisited);

    const handleMenuClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsMenuOpen(!isMenuOpen);
    };

    const handleLinkClick = () => {
        localStorage.setItem(`last_visited_${project.id}`, new Date().toISOString());
    };

    // Render STATUS BADGE
    const StatusBadge = ({ status, className }) => (
        <span className={`text-[10px] px-1.5 py-0.5 rounded shadow-sm backdrop-blur-md border ${
            status === 'CLIENT_REVIEW' ? 'bg-green-500/80 text-white border-transparent' :
            status === 'ALL_REVIEWS_DONE' ? 'bg-blue-500/80 text-white border-transparent' :
            'bg-black/60 text-white border-white/10'
        } ${className}`}>
            {status.replace(/_/g, ' ')}
        </span>
    );

    // MENU COMPONENT
    const MenuDropdown = () => (
        <>
            <div className="absolute right-0 top-full mt-1 w-48 bg-popover border border-border rounded-lg shadow-xl z-50 overflow-hidden flex flex-col py-1 text-foreground animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-b border-border mb-1 bg-muted/30">Change Status</div>
                <button onClick={(e) => { e.stopPropagation(); onStatusChange(project, 'INTERNAL_REVIEW'); setIsMenuOpen(false); }} className="text-left px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground w-full transition-colors">Internal Review</button>
                <button onClick={(e) => { e.stopPropagation(); onStatusChange(project, 'CLIENT_REVIEW'); setIsMenuOpen(false); }} className="text-left px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground w-full transition-colors">Client Review</button>
                <button onClick={(e) => { e.stopPropagation(); onStatusChange(project, 'ALL_REVIEWS_DONE'); setIsMenuOpen(false); }} className="text-left px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground w-full transition-colors">Done</button>

                <div className="border-t border-border my-1"></div>

                <button onClick={(e) => { e.stopPropagation(); onEdit(project); setIsMenuOpen(false); }} className="text-left px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground w-full flex items-center gap-2 transition-colors">
                    <Pencil size={14}/> Edit Project
                </button>
                <button onClick={(e) => { e.stopPropagation(); onDelete(project); setIsMenuOpen(false); }} className="text-left px-4 py-2 text-sm hover:bg-destructive/10 text-destructive w-full flex items-center gap-2 transition-colors">
                    <Trash2 size={14}/> Delete
                </button>
            </div>
            <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); }} />
        </>
    );

    // LIST VIEW
    if (viewMode === 'list') {
        return (
            <div className="group flex items-center gap-4 p-3 bg-card border border-border rounded-lg hover:border-primary/50 hover:shadow-md transition-all relative">
                {isUnread && <div className="w-2 h-2 bg-red-500 rounded-full absolute top-2 right-2 border border-background z-20" title="New activity"></div>}

                <Link to={`/project/${project.id}`} className="absolute inset-0 z-0" onClick={handleLinkClick}>
                    <span className="sr-only">View {project.name}</span>
                </Link>

                {/* Thumbnail */}
                <div className="w-24 h-14 bg-black/90 rounded overflow-hidden shrink-0 flex items-center justify-center relative border border-border/50">
                    {thumbUrl ? (
                        <img src={thumbUrl} alt={project.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="text-white/50 text-xs">
                             {project.threeDAssets?.length > 0 ? <Box size={20} /> : '▶️'}
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">{project.name}</h3>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                             <Clock size={10} />
                             {formatDate(project.updatedAt, dateFormat)}
                        </span>
                        {project.team && (
                             <span className="px-1.5 py-0.5 rounded bg-muted/50 border border-border">
                                 {project.team.name}
                             </span>
                        )}
                         {/* Avatar Stack in List View */}
                         {project.team?.members && project.team.members.length > 0 && (
                            <div className="flex -space-x-1.5 items-center">
                                {project.team.members.slice(0, 3).map(member => (
                                    <div key={member.id} className="w-4 h-4 rounded-full ring-1 ring-background bg-muted flex items-center justify-center text-[8px] overflow-hidden" title={member.name}>
                                        {member.avatarPath ? (
                                            <img src={`/api/media/avatars/${member.avatarPath}`} alt={member.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <span>{member.name.charAt(0)}</span>
                                        )}
                                    </div>
                                ))}
                                {project.team.members.length > 3 && (
                                    <div className="w-4 h-4 rounded-full ring-1 ring-background bg-muted flex items-center justify-center text-[8px] font-medium text-muted-foreground">
                                        +{project.team.members.length - 3}
                                    </div>
                                )}
                            </div>
                        )}
                        <StatusBadge status={project.status} className="!bg-transparent !text-muted-foreground !border !border-border !shadow-none !backdrop-blur-none" />
                    </div>
                </div>

                {/* Actions */}
                <div className="relative z-10 flex items-center gap-2 pr-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity focus-within:opacity-100">
                    <button
                        onClick={handleMenuClick}
                        className={`p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors ${isMenuOpen ? 'bg-muted text-foreground opacity-100' : ''}`}
                    >
                        <MoreVertical size={16} />
                    </button>
                    {isMenuOpen && <MenuDropdown />}
                </div>
            </div>
        );
    }

    // GRID VIEW
    return (
        <div className="group bg-card border border-border rounded-xl hover:ring-2 ring-primary/50 transition-all duration-300 shadow-sm hover:shadow-xl hover:scale-[1.02] relative flex flex-col h-full z-0 hover:z-10">
            {isUnread && (
                <div className="absolute top-3 right-3 z-30 pointer-events-none">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-black"></span>
                    </span>
                </div>
            )}

            <Link to={`/project/${project.id}`} className="absolute inset-0 z-10 rounded-xl" onClick={handleLinkClick}>
                <span className="sr-only">View project {project.name}</span>
            </Link>

            {/* Thumbnail Container - Needs overflow hidden for zoom effect and rounded corners */}
            <div className="aspect-video bg-black relative flex items-center justify-center overflow-hidden rounded-t-xl isolate">
                {thumbUrl ? (
                    <img src={thumbUrl} alt={project.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
                ) : (
                    <div className="text-4xl opacity-50 text-white/30 group-hover:scale-110 transition-transform duration-500">
                        {project.threeDAssets?.length > 0 ? <Box size={48} strokeWidth={1} /> : '▶️'}
                    </div>
                )}

                {/* Overlay Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />

                {/* Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20 pointer-events-none">
                    <div className="bg-white/20 backdrop-blur-md p-3 rounded-full shadow-lg border border-white/30 transform scale-90 group-hover:scale-100 transition-transform">
                        <Play className="fill-white text-white translate-x-0.5" size={28} />
                    </div>
                </div>

                {/* Status Badge */}
                <div className="absolute top-3 left-3 flex flex-col items-start gap-1 z-20">
                    <StatusBadge status={project.status} />
                </div>
            </div>

            {/* Content Container - No overflow hidden to allow menu to pop out */}
            <div className="p-4 relative flex-1 flex flex-col justify-between bg-card rounded-b-xl">
                <div>
                    <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors pr-8">{project.name}</h3>
                    <div className="flex items-center justify-between mt-2">
                         <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock size={12} />
                            {formatDate(project.updatedAt, dateFormat)}
                        </span>

                        <div className="flex items-center gap-2">
                            {/* Avatar Stack */}
                            {project.team?.members && project.team.members.length > 0 && (
                                <div className="flex -space-x-2 items-center">
                                    {project.team.members.slice(0, 3).map(member => (
                                        <div key={member.id} className="w-5 h-5 rounded-full ring-2 ring-card bg-muted flex items-center justify-center text-[9px] overflow-hidden" title={member.name}>
                                            {member.avatarPath ? (
                                                <img src={`/api/media/avatars/${member.avatarPath}`} alt={member.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <span>{member.name.charAt(0)}</span>
                                            )}
                                        </div>
                                    ))}
                                    {project.team.members.length > 3 && (
                                        <div className="w-5 h-5 rounded-full ring-2 ring-card bg-muted flex items-center justify-center text-[9px] font-medium text-muted-foreground">
                                            +{project.team.members.length - 3}
                                        </div>
                                    )}
                                </div>
                            )}

                            {project.team && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border/50 truncate max-w-[80px]">
                                    {project.team.name}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Actions (Absolute to allow stacking over content if needed, but here spaced nicely) */}
                <div className="absolute top-3 right-2 z-20">
                     <button
                        onClick={handleMenuClick}
                        className={`p-1.5 text-muted-foreground hover:text-foreground bg-transparent hover:bg-muted/50 rounded-full transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 ${isMenuOpen ? 'opacity-100 bg-muted/50' : ''}`}
                    >
                        <MoreVertical size={18} />
                    </button>
                    {isMenuOpen && <MenuDropdown />}
                </div>
            </div>
        </div>
    );
};

export default ProjectCard;
