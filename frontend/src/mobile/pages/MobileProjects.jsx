import React, { useState } from 'react';
import { useProjects } from '../../hooks/useProjects';
import MobileProjectCard from '../components/MobileProjectCard';

const MobileProjects = () => {
    const [selectedTeamId, setSelectedTeamId] = useState(null);
    const { teams, filteredProjects, loading, refresh } = useProjects(selectedTeamId);

    // Pull to refresh could be added here later

    return (
        <div className="pb-24">
            {/* Header */}
            <div className="pt-12 px-6 pb-4">
                <h1 className="text-3xl font-bold">Projects</h1>
            </div>

            {/* Team Filters */}
            {teams.length > 0 && (
                <div className="flex gap-2 px-6 overflow-x-auto pb-4 no-scrollbar">
                    <button
                        onClick={() => setSelectedTeamId(null)}
                        className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors ${!selectedTeamId
                                ? 'bg-white text-black'
                                : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                            }`}
                    >
                        All Teams
                    </button>
                    {teams.map(team => (
                        <button
                            key={team.id}
                            onClick={() => setSelectedTeamId(team.id)}
                            className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors ${selectedTeamId === team.id
                                    ? 'bg-white text-black'
                                    : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                                }`}
                        >
                            {team.name}
                        </button>
                    ))}
                </div>
            )}

            {/* Projects Grid */}
            <div className="px-6">
                {loading ? (
                    <div className="grid grid-cols-2 gap-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="aspect-video bg-zinc-900 rounded-xl animate-pulse"></div>
                        ))}
                    </div>
                ) : filteredProjects.length === 0 ? (
                    <div className="text-center py-12 text-zinc-500">
                        <p>No projects found.</p>
                        <button onClick={refresh} className="text-primary mt-2">Refresh</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4">
                        {filteredProjects.map(project => (
                            <MobileProjectCard key={project.id} project={project} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MobileProjects;
