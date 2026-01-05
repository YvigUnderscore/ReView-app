import React from 'react';

const ProjectSkeleton = ({ viewMode = 'grid' }) => {
    if (viewMode === 'list') {
        return (
            <div className="flex items-center gap-4 p-3 border border-border rounded-lg animate-pulse bg-card/50">
                <div className="w-16 h-10 bg-muted rounded shrink-0" />
                <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-1/3" />
                    <div className="h-3 bg-muted rounded w-1/4" />
                </div>
                <div className="w-8 h-8 bg-muted rounded-full shrink-0" />
            </div>
        );
    }

    return (
        <div className="bg-card border border-border rounded-lg overflow-hidden animate-pulse">
            <div className="aspect-video bg-muted relative">
                 <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
            </div>
            <div className="p-4 space-y-3">
                <div className="h-5 bg-muted rounded w-3/4" />
                <div className="flex justify-between items-center">
                    <div className="h-4 bg-muted rounded w-20" />
                    <div className="h-3 bg-muted rounded w-24" />
                </div>
            </div>
        </div>
    );
};

export default ProjectSkeleton;
