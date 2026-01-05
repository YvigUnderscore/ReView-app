import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ActivityPanel from '../components/ActivityPanel';
import { useAuth } from '../context/AuthContext';

const CommentsPopup = () => {
    const { id } = useParams();
    const { loading: authLoading } = useAuth();
    const [project, setProject] = useState(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [highlightedCommentId, setHighlightedCommentId] = useState(null);
    const [activeVersionIndex, setActiveVersionIndex] = useState(0);

    // Sync Channel
    const [channel, setChannel] = useState(null);

    useEffect(() => {
        const bc = new BroadcastChannel(`review_sync_${id}`);
        setChannel(bc);

        bc.onmessage = (event) => {
            const { type, payload } = event.data;
            if (type === 'timeUpdate') {
                setCurrentTime(payload.time);
            } else if (type === 'seek') {
                // Main window sends seek, maybe we should highlight?
                // Actually mainly we send seek to main window.
            } else if (type === 'versionChange') {
                setActiveVersionIndex(payload.index);
            } else if (type === 'commentHighlight') {
                setHighlightedCommentId(payload.id);
            }
        };

        return () => bc.close();
    }, [id]);

    const fetchProject = () => {
        fetch(`/api/projects/${id}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        .then(res => res.json())
        .then(data => {
            setProject(data);
        })
        .catch(err => console.error(err));
    };

    useEffect(() => {
        fetchProject();
        // Poll for updates (e.g. new comments via simple polling if socket not perfect in popup)
        // Ideally we reuse socket logic. NotificationContext handles global socket.
        // But ActivityPanel just takes props.
        // We will rely on simple refetch or maybe socket works if NotificationProvider is in App.
    }, [id]);

    if (authLoading) return <div>Loading...</div>;
    if (!project) return <div>Loading Project...</div>;

    const activeVersion = project.versions[activeVersionIndex];
    if (!activeVersion) return <div>No Version</div>;

    const isVideo = activeVersion.type === 'video';
    const isImageBundle = activeVersion.type === 'image_bundle';
    const isThreeD = activeVersion.type === 'three_d_asset';

    // Get comments based on version type (Simplified logic compared to ProjectView)
    // We assume default image index 0 for bundles in popup for now, or sync it?
    // Let's assume sync image index too later.
    let activeComments = [];
    if (isVideo) activeComments = activeVersion.comments || [];
    else if (isThreeD) activeComments = activeVersion.comments || [];
    // Image bundle support in popup might be limited without full sync

    return (
        <div className="h-screen w-full bg-background flex flex-col">
            <ActivityPanel
                projectId={id}
                videoId={isVideo ? activeVersion.id : null}
                threeDAssetId={isThreeD ? activeVersion.id : null}
                comments={activeComments}
                currentTime={currentTime}
                onCommentClick={(time, annotation, commentId, comment) => {
                    channel?.postMessage({
                        type: 'seek',
                        payload: { time, commentId, annotation }
                    });
                    setHighlightedCommentId(commentId);
                }}
                onCommentAdded={(comment) => {
                    // Refresh or add locally
                    fetchProject();
                    channel?.postMessage({ type: 'commentAdded' });
                }}
                onCommentUpdated={() => {
                    fetchProject();
                }}
                highlightedCommentId={highlightedCommentId}
                isWindowMode={true}
                onClose={() => window.close()}
            />
        </div>
    );
};

export default CommentsPopup;
