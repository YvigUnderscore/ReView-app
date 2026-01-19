import React, { useState, useEffect, useRef } from 'react';

/**
 * Annotation3DOverlay
 * 
 * Renders 3D-anchored annotation hotspots on the model surface.
 * Each hotspot shows the user's profile picture (or default) and can be clicked to zoom.
 */
const Annotation3DOverlay = ({
    comments = [],
    modelViewerRef,
    onZoom,
    showConnectionLines = false,
    onCommentClick
}) => {
    const [visibleHotspots, setVisibleHotspots] = useState({});

    // Check occlusion periodically
    useEffect(() => {
        const mv = modelViewerRef?.current;
        if (!mv) return;

        const checkOcclusion = () => {
            const newVisibility = {};

            comments.forEach((comment, index) => {
                if (!comment.annotation) return;

                let annotation;
                try {
                    annotation = typeof comment.annotation === 'string'
                        ? JSON.parse(comment.annotation)
                        : comment.annotation;
                } catch (e) {
                    return;
                }

                // Check if this is a 3D-anchored annotation
                if (!annotation.is3DAnchoredAnnotation || !annotation.surfaceAnchor3D) {
                    return;
                }

                // Get the hotspot element
                const slot = `hotspot-annotation-${comment.id}`;
                const hotspot = mv.querySelector(`[slot="${slot}"]`);

                if (hotspot) {
                    const rect = hotspot.getBoundingClientRect();
                    const mvRect = mv.getBoundingClientRect();

                    // Check if visible in viewport
                    const x = rect.left + rect.width / 2 - mvRect.left;
                    const y = rect.top + rect.height / 2 - mvRect.top;
                    const isInBounds = x >= 0 && x <= mvRect.width && y >= 0 && y <= mvRect.height;

                    newVisibility[comment.id] = isInBounds;
                }
            });

            setVisibleHotspots(newVisibility);
        };

        checkOcclusion();
        const interval = setInterval(checkOcclusion, 200);
        mv.addEventListener('camera-change', checkOcclusion);

        return () => {
            clearInterval(interval);
            mv.removeEventListener('camera-change', checkOcclusion);
        };
    }, [comments, modelViewerRef]);

    // Filter comments with 3D-anchored annotations
    const anchoredComments = comments.filter(comment => {
        if (!comment.annotation) return false;
        try {
            const annotation = typeof comment.annotation === 'string'
                ? JSON.parse(comment.annotation)
                : comment.annotation;
            return annotation.is3DAnchoredAnnotation && annotation.surfaceAnchor3D;
        } catch (e) {
            return false;
        }
    });

    // Calculate annotation number (based on order of 3D annotations)
    const getAnnotationNumber = (commentId) => {
        const index = anchoredComments.findIndex(c => c.id === commentId);
        return index + 1;
    };

    if (anchoredComments.length === 0) return null;

    return (
        <>
            {/* CSS for hotspots */}
            <style>{`
                .annotation-hotspot {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 4px;
                    pointer-events: auto;
                    cursor: pointer;
                    transition: transform 0.2s ease, opacity 0.3s ease;
                    transform-origin: center bottom;
                }
                
                .annotation-hotspot:hover {
                    transform: scale(1.15);
                    z-index: 100;
                }
                
                .annotation-hotspot.occluded {
                    opacity: 0.2;
                    pointer-events: none;
                }
                
                .annotation-hotspot-avatar {
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    border: 2px solid white;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
                    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 14px;
                    font-weight: bold;
                    overflow: hidden;
                }
                
                .annotation-hotspot-avatar img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                
                .annotation-hotspot-label {
                    background: rgba(0, 0, 0, 0.85);
                    backdrop-filter: blur(8px);
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: 600;
                    color: white;
                    white-space: nowrap;
                    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                }
                
                .annotation-hotspot-connector {
                    width: 2px;
                    height: 12px;
                    background: linear-gradient(to bottom, rgba(255,255,255,0.6), rgba(255,255,255,0.2));
                    display: ${showConnectionLines ? 'block' : 'none'};
                }
                
                .annotation-hotspot-dot {
                    width: 8px;
                    height: 8px;
                    background: white;
                    border-radius: 50%;
                    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
                    display: ${showConnectionLines ? 'block' : 'none'};
                }
            `}</style>

            {/* Render hotspots */}
            {anchoredComments.map((comment, index) => {
                let annotation;
                try {
                    annotation = typeof comment.annotation === 'string'
                        ? JSON.parse(comment.annotation)
                        : comment.annotation;
                } catch (e) {
                    return null;
                }

                const isOccluded = visibleHotspots[comment.id] === false;
                const authorName = comment.user?.name || comment.guestName || 'Guest';
                const annotationNumber = getAnnotationNumber(comment.id);
                const avatarPath = comment.user?.avatarPath;

                // Get initials for fallback
                const initials = authorName.charAt(0).toUpperCase();

                return (
                    <button
                        key={comment.id}
                        slot={`hotspot-annotation-${comment.id}`}
                        data-surface={annotation.surfaceAnchor3D}
                        className={`annotation-hotspot ${isOccluded ? 'occluded' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onZoom) {
                                onZoom(comment, annotation);
                            }
                            if (onCommentClick) {
                                onCommentClick(
                                    comment.timestamp,
                                    annotation.shapes || annotation,
                                    comment.id,
                                    comment
                                );
                            }
                        }}
                        title={`${authorName} #${annotationNumber}`}
                    >
                        {/* Profile picture or default */}
                        <div className="annotation-hotspot-avatar">
                            {avatarPath ? (
                                <img
                                    src={`/api/media/${avatarPath}`}
                                    alt={authorName}
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.parentElement.innerHTML = initials;
                                    }}
                                />
                            ) : (
                                initials
                            )}
                        </div>

                        {/* Label: Username #N */}
                        <div className="annotation-hotspot-label">
                            {authorName} #{annotationNumber}
                        </div>

                        {/* Connection line (optional) */}
                        <div className="annotation-hotspot-connector" />
                        <div className="annotation-hotspot-dot" />
                    </button>
                );
            })}
        </>
    );
};

export default Annotation3DOverlay;
