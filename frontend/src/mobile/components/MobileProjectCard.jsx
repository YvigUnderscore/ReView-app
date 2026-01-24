import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, Film, Image as ImageIcon, MoreVertical } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../../context/AuthContext';

const MobileProjectCard = ({ project }) => {
    const { getMediaUrl } = useAuth();
    const activeVersion = project.versions?.[0]; // Show latest version thumbnail

    // Construct thumbnail URL (Robust Desktop Logic)
    let thumbnail = null;
    if (project.thumbnailPath) {
        const rawPath = project.thumbnailPath.includes('/') || project.thumbnailPath.includes('\\') ?
            `/api/media/${project.thumbnailPath}` :
            `/api/thumbnails/${project.thumbnailPath}`;
        thumbnail = getMediaUrl(rawPath);
    } else if (activeVersion) {
        // Fallback checks if project has no global thumbnail
        if (activeVersion.type === 'image_bundle' && activeVersion.images?.length > 0) {
            thumbnail = getMediaUrl(`/api/media/${activeVersion.images[0].filename}`);
        }
    }

    return (
        <Link
            to={`/project/${project.id}`}
            className="block bg-zinc-900 rounded-xl overflow-hidden shadow-lg border border-white/5 active:scale-95 transition-transform duration-200"
        >
            {/* Thumbnail Area */}
            <div className="aspect-video bg-zinc-800 relative">
                {thumbnail ? (
                    <img
                        src={thumbnail}
                        alt={project.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-600">
                        <Film size={32} />
                    </div>
                )}

                {/* Status Badge */}
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-black/60 backdrop-blur-md text-white border border-white/10">
                    {project.status}
                </div>
            </div>

            {/* Content Area */}
            <div className="p-3">
                <div className="flex justify-between items-start mb-1">
                    <h3 className="font-semibold text-white truncate text-sm leading-tight pr-2">
                        {project.name}
                    </h3>
                    <button className="text-zinc-500 p-1 -mr-2 -mt-1 active:text-white" onClick={(e) => { e.preventDefault(); /* Open menu */ }}>
                        <MoreVertical size={16} />
                    </button>
                </div>

                <div className="flex justify-between items-center text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                        {activeVersion?.type === 'image_bundle' ? <ImageIcon size={12} /> : <Film size={12} />}
                        {project.versions?.length || 0} v
                    </span>
                    <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
                    </span>
                </div>
            </div>
        </Link>
    );
};

export default MobileProjectCard;
