import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useProjects } from '../../hooks/useProjects';
import MobileProjectCard from '../components/MobileProjectCard';
import { NavLink } from 'react-router-dom';

const MobileDashboard = () => {
    const { user } = useAuth();
    const { projects, loading } = useProjects();

    const recentProjects = projects
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, 4);

    return (
        <div className="pb-24 pt-12">
            <div className="px-6 mb-8">
                <h1 className="text-3xl font-bold mb-1">Good morning,</h1>
                <p className="text-zinc-400 text-xl font-medium">{user?.name?.split(' ')[0]}</p>
            </div>

            {/* Recents Section */}
            <div className="px-6 mb-6">
                <div className="flex justify-between items-end mb-4">
                    <h2 className="text-lg font-semibold">Recent Projects</h2>
                    <NavLink to="/projects" className="text-primary text-sm font-medium">View all</NavLink>
                </div>

                {loading ? (
                    <div className="grid grid-cols-2 gap-4">
                        {[1, 2].map(i => (
                            <div key={i} className="aspect-video bg-zinc-900 rounded-xl animate-pulse"></div>
                        ))}
                    </div>
                ) : recentProjects.length === 0 ? (
                    <div className="bg-zinc-900 rounded-2xl p-6 border border-white/5 text-center">
                        <p className="text-zinc-500 mb-2">No projects yet.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4">
                        {recentProjects.map(p => (
                            <MobileProjectCard key={p.id} project={p} />
                        ))}
                    </div>
                )}
            </div>

            {/* Quick Actions (Future placeholder) */}
            <div className="px-6">
                <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
                <div className="flex gap-4 overflow-x-auto no-scrollbar">
                    <div className="min-w-[120px] h-[100px] bg-zinc-900 rounded-xl flex flex-col items-center justify-center border border-white/5 disabled opacity-50">
                        <span className="text-zinc-400 text-xs">New Project</span>
                        <span className="text-zinc-600 text-[10px]">(Desktop Only)</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MobileDashboard;
