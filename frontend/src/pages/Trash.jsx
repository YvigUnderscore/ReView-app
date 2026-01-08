import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import { Clock, RefreshCcw, Trash2, AlertTriangle, FileVideo, Package, Box, Image } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import { toast } from 'sonner';

const Trash = () => {
    const { user, activeTeam } = useAuth();
    const navigate = useNavigate();
    const [deletedProjects, setDeletedProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [retentionDays, setRetentionDays] = useState(7);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, isDestructive: false });

    useEffect(() => {
        if (user) {
            fetchTrash();
            fetchRetention();
        }
    }, [user, activeTeam]); // Fetch if team changes too

    // Update countdown timer every second
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const fetchRetention = () => {
        fetch('/api/admin/settings/retention', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        .then(res => res.json())
        .then(data => setRetentionDays(parseInt(data.retentionDays) || 7))
        .catch(e => console.error(e));
    };

    const fetchTrash = () => {
        setLoading(true);
        // We reuse the main projects endpoint?
        // No, current projects endpoint only returns active (non-deleted) projects.
        // We need an endpoint for trash.
        // Or we modify GET /projects to accept `?deleted=true`?
        // Let's modify GET /projects? Or maybe a dedicated endpoint is cleaner.
        // But I didn't plan a dedicated endpoint in the backend plan for fetching trash.
        // Wait, did I?
        // Checking plan: "Create frontend/src/pages/Trash.jsx (List projects where deletedAt != null)".
        // Backend steps didn't explicitly mention `GET /trash`.
        // I need to add that endpoint or modify `GET /projects`.
        // Modifying `GET /projects` is risky if not careful with existing filters.
        // A dedicated `GET /api/projects/trash` seems safer and cleaner.
        // I'll add `GET /api/projects/trash` to `project.routes.js` right now via `replace_with_git_merge_diff`.
        fetch('/api/projects/trash', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        .then(res => {
            if (!res.ok) throw new Error("Failed to fetch trash");
            return res.json();
        })
        .then(data => setDeletedProjects(data))
        .catch(e => console.error(e))
        .finally(() => setLoading(false));
    };

    const handleRestore = async (id) => {
        setConfirmDialog({
            isOpen: true,
            title: "Restore Project",
            message: "Restore this project?",
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                try {
                    const res = await fetch(`/api/projects/${id}/restore`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                    });
                    if (res.ok) {
                        fetchTrash();
                        toast.success("Project restored");
                    } else {
                        toast.error("Failed to restore");
                    }
                } catch(e) { toast.error("Error restoring project"); }
            }
        });
    };

    const handlePermanentDelete = async (id) => {
        setConfirmDialog({
            isOpen: true,
            title: "Permanently Delete",
            message: "Permanently delete this project? This action CANNOT be undone.",
            isDestructive: true,
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                try {
                    const res = await fetch(`/api/projects/${id}/permanent`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                    });
                    if (res.ok) {
                        fetchTrash();
                        toast.success("Project deleted permanently");
                    } else {
                        toast.error("Failed to delete");
                    }
                } catch(e) { toast.error("Error deleting project"); }
            }
        });
    };

    const getRemainingTime = (deletedAt) => {
        if (!deletedAt) return null;
        const deleteDate = new Date(deletedAt);
        const expirationDate = new Date(deleteDate.getTime() + retentionDays * 24 * 60 * 60 * 1000);
        const diff = expirationDate - currentTime;

        if (diff <= 0) return "Expired (Pending Cleanup)";

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        return `${days}d ${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading trash...</div>;

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                title={confirmDialog.title}
                message={confirmDialog.message}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                isDestructive={confirmDialog.isDestructive}
            />
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
                <Trash2 /> Trash
            </h1>
            <p className="text-muted-foreground mb-8">
                Projects are stored here for {retentionDays} days before being permanently deleted.
            </p>

            {deletedProjects.length === 0 ? (
                <div className="text-center py-20 bg-muted/20 rounded-lg border border-border">
                    <Trash2 size={48} className="mx-auto text-muted-foreground mb-4 opacity-50" />
                    <h3 className="text-xl font-semibold mb-2">Trash is Empty</h3>
                    <p className="text-muted-foreground">No deleted projects found.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {deletedProjects.map(project => (
                        <div key={project.id} className="bg-card border border-border rounded-lg overflow-hidden group hover:border-primary/50 transition-colors flex flex-col">
                            {/* Thumbnail */}
                            <div className="relative aspect-video bg-muted flex items-center justify-center overflow-hidden">
                                {project.thumbnailPath ? (
                                    <img src={`/api/thumbnails/${project.thumbnailPath}`} alt={project.name} className="w-full h-full object-cover opacity-50 grayscale" />
                                ) : (
                                    <div className="text-muted-foreground opacity-50">
                                        {project.hasCustomThumbnail ? <Image size={48} /> : <FileVideo size={48} />}
                                    </div>
                                )}
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                    <div className="text-destructive font-mono font-bold text-xl flex items-center gap-2 bg-black/60 px-3 py-1 rounded backdrop-blur-sm">
                                        <Clock size={20} />
                                        {getRemainingTime(project.deletedAt)}
                                    </div>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-4 flex-1 flex flex-col">
                                <h3 className="font-semibold text-lg truncate mb-1 text-muted-foreground line-through decoration-destructive decoration-2">{project.name}</h3>
                                <p className="text-xs text-muted-foreground mb-4">Deleted: {new Date(project.deletedAt).toLocaleDateString()}</p>

                                <div className="mt-auto flex gap-2">
                                    <button
                                        onClick={() => handleRestore(project.id)}
                                        className="flex-1 flex items-center justify-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary py-2 rounded font-medium transition-colors"
                                    >
                                        <RefreshCcw size={16} /> Restore
                                    </button>
                                    <button
                                        onClick={() => handlePermanentDelete(project.id)}
                                        className="flex-1 flex items-center justify-center gap-2 bg-destructive/10 hover:bg-destructive/20 text-destructive py-2 rounded font-medium transition-colors"
                                    >
                                        <Trash2 size={16} /> Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Trash;
