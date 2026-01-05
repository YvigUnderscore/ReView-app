import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Folder, ChevronRight, Plus, ArrowLeft } from 'lucide-react';
import { useHeader } from '../context/HeaderContext';
import { useBranding } from '../context/BrandingContext';
import { useAuth } from '../context/AuthContext';
import CreateProjectModal from '../components/CreateProjectModal';
import EditProjectModal from '../components/EditProjectModal';
import ProjectListToolbar from '../components/ProjectListToolbar';
import ProjectCard from '../components/ProjectCard';
import ProjectEmptyState from '../components/ProjectEmptyState';
import ProjectSkeleton from '../components/ProjectSkeleton';

const ProjectLibrary = () => {
    const [teams, setTeams] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTeamId = searchParams.get('teamId');
    const { setBreadcrumbPath } = useHeader();
    const { user, activeTeam } = useAuth();
    
    // Modals
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createModalFile, setCreateModalFile] = useState(null);
    const [editingProject, setEditingProject] = useState(null);

    // View State
    const [isDragging, setIsDragging] = useState(false);
    const [viewMode, setViewMode] = useState(localStorage.getItem('dashboard_view_mode') || 'grid');

    // Toolbar State
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState({
        status: [],
        teams: [], // Not used in team view but kept for consistency
        dateFrom: '',
        dateTo: ''
    });
    const [sort, setSort] = useState('date_desc');

    // Persist view mode
    useEffect(() => {
        localStorage.setItem('dashboard_view_mode', viewMode);
    }, [viewMode]);

    const fetchTeams = () => {
        setLoading(true);
        fetch('/api/teams', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        .then(res => res.json())
        .then(data => {
            if (Array.isArray(data)) {
                setTeams(data);

                // If no team selected but user has teams, redirect to the first one (or active from context)
                if (!activeTeamId && data.length > 0) {
                     const targetTeamId = activeTeam ? activeTeam.id : data[0].id;
                     setSearchParams({ teamId: targetTeamId });
                     return;
                }
            }
            if (!activeTeamId) setLoading(false);
        })
        .catch(console.error);
    };

    const fetchProjects = (teamId) => {
        setLoading(true);
        fetch('/api/projects', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        .then(res => res.json())
        .then(data => {
            if (Array.isArray(data)) {
                // Filter by team client-side for now
                const teamProjects = data.filter(p => p.teamId === parseInt(teamId));
                setProjects(teamProjects);
                
                // Update Breadcrumb
                const team = teams.find(t => t.id === parseInt(teamId));
                setBreadcrumbPath(['Projects', team ? team.name : 'Team']);
            }
            setLoading(false);
        })
        .catch(err => {
            console.error(err);
            setLoading(false);
        });
    };

    useEffect(() => {
        fetchTeams();
        if (activeTeamId) {
            fetchProjects(activeTeamId);
        } else {
            setBreadcrumbPath(['Projects']);
        }
    }, [activeTeamId]);

    const handleTeamClick = (teamId) => {
        setSearchParams({ teamId });
    };

    const handleBack = () => {
        setSearchParams({});
        setBreadcrumbPath(['Projects']);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            setCreateModalFile(files[0]);
            setShowCreateModal(true);
        }
    };

    const handleDelete = async (project) => {
        if (window.confirm(`Are you sure you want to delete "${project.name}"?`)) {
            try {
                const res = await fetch(`/api/projects/${project.id}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                });
                if (res.ok) {
                    setProjects(projects.filter(p => p.id !== project.id));
                }
            } catch (err) {
                console.error(err);
            }
        }
    };

    const handleStatusUpdate = async (project, status) => {
        try {
            const res = await fetch(`/api/projects/${project.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ status })
            });
            if (res.ok) {
                const updated = await res.json();
                setProjects(projects.map(p => p.id === updated.id ? { ...p, status: updated.status } : p));
            }
        } catch (err) {
            console.error(err);
        }
    };

    // Filter & Sort Logic
    const processedProjects = projects
        .filter(p => {
            // Search
            if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;

            // Status
            if (filters.status.length > 0 && !filters.status.includes(p.status)) return false;

            // Date Range
            const projectDate = new Date(p.updatedAt);
            if (filters.dateFrom && projectDate < new Date(filters.dateFrom)) return false;
            if (filters.dateTo) {
                const toDate = new Date(filters.dateTo);
                toDate.setHours(23, 59, 59);
                if (projectDate > toDate) return false;
            }

            return true;
        })
        .sort((a, b) => {
            if (sort === 'date_desc') return new Date(b.updatedAt) - new Date(a.updatedAt);
            if (sort === 'date_asc') return new Date(a.updatedAt) - new Date(b.updatedAt);
            if (sort === 'name_asc') return a.name.localeCompare(b.name);
            if (sort === 'name_desc') return b.name.localeCompare(a.name);
            if (sort === 'status') return a.status.localeCompare(b.status);
            return 0;
        });

    if (activeTeamId) {
        // TEAM PROJECTS VIEW
        const activeTeam = teams.find(t => t.id === parseInt(activeTeamId));

        return (
            <div
                className="p-8 relative min-h-[calc(100vh-64px)]"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {isDragging && (
                    <div className="absolute inset-0 bg-primary/10 border-4 border-dashed border-primary z-50 flex items-center justify-center rounded-xl pointer-events-none">
                        <div className="text-primary font-bold text-2xl flex flex-col items-center gap-4">
                            <Plus size={48} />
                            Drop file to create project
                        </div>
                    </div>
                )}

                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4">
                        <button onClick={handleBack} className="p-2 hover:bg-accent rounded-full transition-colors" title="Back to Teams">
                            <ArrowLeft size={20} />
                        </button>
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <Folder className="text-primary fill-current" />
                            {activeTeam ? activeTeam.name : 'Team Projects'}
                        </h2>
                    </div>
                </div>

                <ProjectListToolbar
                    search={search}
                    onSearchChange={setSearch}
                    filters={filters}
                    onFilterChange={setFilters}
                    sort={sort}
                    onSortChange={setSort}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    onNewProject={() => { setCreateModalFile(null); setShowCreateModal(true); }}
                    showTeamFilter={false} // Hide team filter since we are in a team folder
                />

                {loading ? (
                    <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "space-y-2"}>
                        {[...Array(8)].map((_, i) => (
                            <ProjectSkeleton key={i} viewMode={viewMode} />
                        ))}
                    </div>
                ) : processedProjects.length === 0 ? (
                    <ProjectEmptyState
                        title={search || filters.status.length > 0 ? "No matching projects" : "No projects in this folder"}
                        description={search || filters.status.length > 0 ? "Try adjusting your filters or search." : "Drag and drop a file or create a project to get started."}
                        actionLabel="Create Project"
                        onAction={() => { setCreateModalFile(null); setShowCreateModal(true); }}
                    />
                ) : (
                    <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "space-y-2"}>
                         {processedProjects.map(p => (
                            <ProjectCard
                                key={p.id}
                                project={p}
                                viewMode={viewMode}
                                onStatusChange={handleStatusUpdate}
                                onEdit={setEditingProject}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>
                )}

                {showCreateModal && (
                    <CreateProjectModal
                        initialTeamId={activeTeamId}
                        initialFile={createModalFile}
                        onClose={() => { setShowCreateModal(false); setCreateModalFile(null); }}
                        onProjectCreated={(newProject) => {
                            setProjects([newProject, ...projects]);
                        }}
                    />
                )}
                
                {editingProject && (
                    <EditProjectModal
                        project={editingProject}
                        onClose={() => setEditingProject(null)}
                        onProjectUpdated={(updated) => {
                            setProjects(projects.map(p => p.id === updated.id ? updated : p));
                        }}
                        onProjectDeleted={(id) => {
                            setProjects(projects.filter(p => p.id !== id));
                        }}
                    />
                )}
            </div>
        );
    }

    // TEAMS FOLDER VIEW (Keep as is, but maybe add loading skeleton too?)
    return (
        <div className="p-8">
            <h2 className="text-2xl font-bold mb-6">Projects Library</h2>
            
            {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="aspect-square bg-muted rounded-xl animate-pulse"></div>
                    ))}
                </div>
            ) : teams.length === 0 ? (
                <div className="text-center py-20 flex flex-col items-center">
                    <p className="text-muted-foreground mb-4">You don't belong to any teams yet.</p>
                    <Link to="/team" className="bg-primary text-primary-foreground px-4 py-2 rounded">Create a Team</Link>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {teams.map(team => (
                        <button
                            key={team.id}
                            onClick={() => handleTeamClick(team.id)}
                            className="flex flex-col items-center p-6 bg-card border border-border rounded-xl hover:border-primary hover:bg-accent/50 transition-all group text-center gap-4"
                        >
                            <div className="w-20 h-20 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                <Folder size={40} fill="currentColor" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg text-foreground group-hover:text-primary">{team.name}</h3>
                                <p className="text-xs text-muted-foreground mt-1">{team.members ? `${team.members.length} Members` : 'Team Folder'}</p>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ProjectLibrary;
