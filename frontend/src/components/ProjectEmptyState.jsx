import React from 'react';
import { Plus, Box } from 'lucide-react';

const ProjectEmptyState = ({
    title = "No projects found",
    description = "Create a new project to get started.",
    actionLabel = "Create Project",
    onAction
}) => {
    return (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-card/30 border border-dashed border-border rounded-xl animate-in fade-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center mb-4">
                <Box className="w-10 h-10 text-muted-foreground/50" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">{title}</h3>
            <p className="text-muted-foreground max-w-sm mb-6">{description}</p>
            {onAction && (
                <button
                    onClick={onAction}
                    className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 rounded-md font-medium transition-all shadow-sm hover:shadow-md hover:scale-105 active:scale-95"
                >
                    <Plus size={18} />
                    {actionLabel}
                </button>
            )}
        </div>
    );
};

export default ProjectEmptyState;
