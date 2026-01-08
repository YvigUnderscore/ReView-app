import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { useHeader } from '../context/HeaderContext';
import { useAuth } from '../context/AuthContext';
import ConfirmDialog from '../components/ConfirmDialog';
import ProjectListToolbar from '../components/ProjectListToolbar';
import ProjectCard from '../components/ProjectCard';
import ProjectEmptyState from '../components/ProjectEmptyState';
import ProjectSkeleton from '../components/ProjectSkeleton';
import CreateProjectModal from '../components/CreateProjectModal';
import EditProjectModal from '../components/EditProjectModal';

const RecentActivity = () => {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const { setBreadcrumbPath } = useHeader();
    const { user } = useAuth();
    const [teams, setTeams] = useState([]);

    // Toolbar State
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState({
        status: [],
        teams: [],
        dateFrom: '',
        dateTo: ''
    });
    const [sort, setSort] = useState('date_desc');
    const [viewMode, setViewMode] = useState(localStorage.getItem('dashboard_view_mode') || 'grid');

    // Modals
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingProject, setEditingProject] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, isDestructive: false });

    // Persist view mode
    useEffect(() => {
        localStorage.setItem('dashboard_view_mode', viewMode);
    }, [viewMode]);

    // Load saved filters on mount (User Prefs > LocalStorage)
    useEffect(() => {
        if (user && user.preferences) {
            try {
                const prefs = typeof user.preferences === 'string' ? JSON.parse(user.preferences) : user.preferences;
                if (prefs.dashboardFilters) {
                    setFilters(prefs.dashboardFilters);
                    return;
                }
            } catch (e) { console.error(e); }
        }

        const saved = localStorage.getItem('dashboard_filters');
        if (saved) {
            try {
                setFilters(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse saved filters", e);
            }
        }
    }, [user]);

    useEffect(() => {
        setBreadcrumbPath(['Dashboard']);
        fetchProjects();
        fetchTeams();
    }, [setBreadcrumbPath]);

    const fetchProjects = () => {
        setLoading(true);
        fetch('/api/projects', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        .then(res => res.json())
        .then(data => {
            if (Array.isArray(data)) {
                setProjects(data);
            } else {
                setProjects([]);
            }
            setLoading(false);
        })
        .catch(err => {
            console.error(err);
            setLoading(false);
        });
    };

    const fetchTeams = () => {
        fetch('/api/teams', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        .then(res => res.json())
        .then(data => {
            if (Array.isArray(data)) setTeams(data);
        })
        .catch(console.error);
    };

    const handleFilterChange = (newFilters) => {
        setFilters(newFilters);
        // Save to user preferences
        if (user) {
             fetch('/api/users/me/client-preferences', {
                  method: 'PATCH',
                  headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${localStorage.getItem('token')}`
                  },
                  body: JSON.stringify({ dashboardFilters: newFilters })
             }).catch(console.error);
        }
        localStorage.setItem('dashboard_filters', JSON.stringify(newFilters));
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

    const handleDelete = async (project) => {
        setConfirmDialog({
            isOpen: true,
            title: "Delete Project",
            message: `Are you sure you want to delete "${project.name}"?`,
            isDestructive: true,
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
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
        });
    };

    // Filter & Sort Logic
    const processedProjects = projects
        .filter(p => {
            // Search
            if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;

            // Status
            if (filters.status.length > 0 && !filters.status.includes(p.status)) return false;

            // Team
            if (filters.teams.length > 0) {
                if (!p.team && !filters.teams.includes('No Team')) return false;
                if (p.team && !filters.teams.includes(p.team.id)) return false;
            }

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

    return (
        <div className="p-8">
            <div className="flex flex-col gap-6">
                <div className="flex justify-between items-center mb-2">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Clock className="w-6 h-6" />
                        Recent Activity
                    </h2>
                </div>

                <ProjectListToolbar
                    search={search}
                    onSearchChange={setSearch}
                    filters={filters}
                    onFilterChange={handleFilterChange}
                    sort={sort}
                    onSortChange={setSort}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    onNewProject={() => setShowCreateModal(true)}
                    teams={teams}
                />

                {loading ? (
                    <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "space-y-2"}>
                        {[...Array(8)].map((_, i) => (
                            <ProjectSkeleton key={i} viewMode={viewMode} />
                        ))}
                    </div>
                ) : processedProjects.length === 0 ? (
                    <ProjectEmptyState
                        title={search || filters.status.length > 0 ? "No matching projects" : "No recent activity"}
                        description={search || filters.status.length > 0 ? "Try adjusting your filters or search." : "Projects you work on will appear here."}
                        actionLabel="Create Project"
                        onAction={() => setShowCreateModal(true)}
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
            </div>

            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                title={confirmDialog.title}
                message={confirmDialog.message}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                isDestructive={confirmDialog.isDestructive}
            />

            {showCreateModal && (
                <CreateProjectModal
                    onClose={() => setShowCreateModal(false)}
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
};

export default RecentActivity;
