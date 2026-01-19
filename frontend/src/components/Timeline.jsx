import React, { useRef, useMemo, useState, useEffect } from 'react';
import { X } from 'lucide-react';

const Timeline = ({ currentTime, duration, onSeek, onRangeChange, onRangeCommit, markers = [], visible = true, selectionRange, highlightedCommentId }) => {
    const containerRef = useRef(null);
    const isDragging = useRef(false);
    const isRangeSelecting = useRef(false);
    const isEditingRange = useRef(null); // 'start' or 'end'

    // Group markers that are close to each other
    const groupedMarkers = useMemo(() => {
        if (!duration) return [];
        const threshold = duration * 0.02; // 2% threshold
        const groups = [];
        const sorted = markers.filter(m => !m.isResolved).sort((a, b) => a.timestamp - b.timestamp);
        sorted.forEach(marker => {
            const lastGroup = groups[groups.length - 1];
            if (lastGroup && (marker.timestamp - lastGroup.timestamp) < threshold) {
                lastGroup.items.push(marker);
            } else {
                groups.push({
                    timestamp: marker.timestamp,
                    items: [marker]
                });
            }
        });
        return groups;
    }, [markers, duration]);

    const calculateTime = (clientX) => {
        if (!containerRef.current || !Number.isFinite(duration) || duration <= 0) return 0;
        const rect = containerRef.current.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        return pct * duration;
    };

    const handleMouseDown = (e) => {
        // Check if clicking on a range handle
        if (e.target.dataset.handle) {
            isEditingRange.current = e.target.dataset.handle;
            e.stopPropagation();

            const handleMouseMove = (moveEvent) => {
                if (isEditingRange.current) {
                    const current = calculateTime(moveEvent.clientX);
                    let newStart = selectionRange ? selectionRange.start : 0;
                    let newEnd = selectionRange ? selectionRange.end : 0;

                    if (isEditingRange.current === 'start') {
                        newStart = Math.min(current, newEnd);
                        if (onRangeChange) onRangeChange(newStart, newEnd);
                    } else {
                        newEnd = Math.max(current, newStart);
                        if (onRangeChange) onRangeChange(newStart, newEnd);
                    }
                }
            };

            const handleMouseUp = () => {
                isEditingRange.current = null;
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
                // Commit the edit
                if (onRangeCommit && selectionRange) {
                    onRangeCommit(selectionRange.start, selectionRange.end);
                }
            };

            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return;
        }

        // Shift + Drag for Range Selection
        if (e.shiftKey) {
            isRangeSelecting.current = true;
            const startTime = calculateTime(e.clientX);
            if (onRangeChange) onRangeChange(startTime, startTime);

            const handleMouseMove = (moveEvent) => {
                if (isRangeSelecting.current) {
                    const current = calculateTime(moveEvent.clientX);
                    if (onRangeChange) onRangeChange(startTime, current);
                }
            };

            const handleMouseUp = (upEvent) => {
                isRangeSelecting.current = false;
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);

                const finalEnd = calculateTime(upEvent.clientX);
                if (onRangeCommit) {
                    onRangeCommit(Math.min(startTime, finalEnd), Math.max(startTime, finalEnd));
                }
            };

            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return;
        }

        isDragging.current = true;
        if (onSeek) onSeek(calculateTime(e.clientX));

        const handleMouseMove = (moveEvent) => {
            if (isDragging.current && onSeek) {
                onSeek(calculateTime(moveEvent.clientX));
            }
        };

        const handleMouseUp = () => {
            isDragging.current = false;
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    const handleTouchStart = (e) => {
        isDragging.current = true;
        if (e.touches && e.touches[0]) {
            if (onSeek) onSeek(calculateTime(e.touches[0].clientX));
        }

        const handleTouchMove = (moveEvent) => {
            if (isDragging.current && onSeek && moveEvent.touches && moveEvent.touches[0]) {
                moveEvent.preventDefault();
                onSeek(calculateTime(moveEvent.touches[0].clientX));
            }
        };

        const handleTouchEnd = () => {
            isDragging.current = false;
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
        };

        window.addEventListener('touchmove', handleTouchMove, { passive: false });
        window.addEventListener('touchend', handleTouchEnd);
    };

    const getPastelColor = (id) => {
        let hash = 0;
        const str = String(id);
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const h = Math.abs(hash % 360);
        return `hsl(${h}, 70%, 80%)`;
    };

    // Render Range Bars
    const renderRangeBars = () => {
        return markers.filter(m => !m.isResolved && m.duration).map(marker => {
            const leftPct = (marker.timestamp / duration) * 100;
            const widthPct = (marker.duration / duration) * 100;
            const isHighlighted = highlightedCommentId === marker.id;
            const pastelColor = getPastelColor(marker.id);
            const borderColor = pastelColor.replace('80%)', '60%)'); // Slightly darker border

            return (
                <div
                    key={`range-${marker.id}`}
                    className={`absolute top-1/2 -translate-y-1/2 h-4 rounded-sm pointer-events-none z-0 transition-colors duration-200 ${isHighlighted ? 'z-10 bg-yellow-500/60 border-yellow-500 border-2' : ''}`}
                    style={{
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        backgroundColor: isHighlighted ? undefined : pastelColor,
                        borderColor: isHighlighted ? undefined : borderColor,
                        borderWidth: isHighlighted ? undefined : '1px',
                        borderStyle: 'solid',
                        opacity: 0.8
                    }}
                >
                </div>
            );
        });
    };

    const renderMarkerGroup = (group) => {
        const latest = group.items[group.items.length - 1];
        const count = group.items.length;
        const leftPct = (group.timestamp / duration) * 100;

        let avatarUrl = null;
        let initials = '?';
        let name = 'Unknown';

        if (latest.user) {
            name = latest.user.name || 'User';
            if (latest.user.avatarPath) {
                avatarUrl = `/api/media/avatars/${latest.user.avatarPath}`;
            }
            initials = name.charAt(0).toUpperCase();
        } else if (latest.guestName) {
            name = latest.guestName;
            initials = name.charAt(0).toUpperCase();
        }

        return (
            <div
                key={group.timestamp}
                className="absolute bottom-4 transform -translate-x-1/2 flex flex-col-reverse items-center group/marker z-10"
                style={{ left: `${leftPct}%` }}
            >
                <div className="w-0.5 h-3 bg-white/70 group-hover/marker:bg-primary transition-colors mt-1 rounded-full"></div>
                <div
                    className="relative cursor-pointer transition-transform hover:scale-110"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onSeek) onSeek(group.timestamp, latest);
                    }}
                    title={`${count} comment${count > 1 ? 's' : ''}`}
                >
                    <div className="w-6 h-6 rounded-full border-2 border-background bg-muted overflow-hidden flex items-center justify-center shadow-sm">
                        {avatarUrl ? (
                            <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-[10px] font-bold text-muted-foreground">{initials}</span>
                        )}
                    </div>
                    {count > 1 && (
                        <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[8px] font-bold px-1 rounded-full min-w-[12px] text-center border border-background">
                            +{count - 1}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="w-full h-16 bg-gradient-to-t from-black/90 to-transparent flex flex-col justify-end pb-4 relative select-none group">
            <div
                ref={containerRef}
                className="absolute left-4 right-4 h-8 bottom-2 cursor-pointer z-10 touch-none"
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
            >
                <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors overflow-visible">
                    <div
                        className="absolute top-0 left-0 h-full bg-primary rounded-l-full"
                        style={{ width: `${(currentTime / duration) * 100}%` }}
                    ></div>

                    {selectionRange && selectionRange.start !== null && selectionRange.end !== null && (
                        <div
                            className="absolute top-0 h-full bg-yellow-400/50 z-20 group/range"
                            style={{
                                left: `${(Math.min(selectionRange.start, selectionRange.end) / duration) * 100}%`,
                                width: `${(Math.abs(selectionRange.end - selectionRange.start) / duration) * 100}%`
                            }}
                        >
                            <div
                                data-handle="start"
                                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-6 bg-white rounded-sm cursor-ew-resize shadow-md hover:scale-110 transition-transform"
                            />
                            <div
                                data-handle="end"
                                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-6 bg-white rounded-sm cursor-ew-resize shadow-md hover:scale-110 transition-transform"
                            />
                            <button
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    if (onRangeChange) onRangeChange(null, null);
                                }}
                                className="absolute -top-6 right-0 -translate-x-1/2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 shadow"
                                title="Clear Selection"
                            >
                                <X size={10} />
                            </button>
                        </div>
                    )}
                    {renderRangeBars()}
                </div>
                <div
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 md:w-4 md:h-4 bg-white rounded-full shadow-lg border border-black/10 transition-transform hover:scale-125 pointer-events-none"
                    style={{
                        left: `${(currentTime / duration) * 100}%`,
                        transform: 'translate(-50%, -50%)'
                    }}
                >
                    {/* Mobile visual enhancement: larger touch target visualization */}
                    <div className="md:hidden absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/20"></div>
                </div>
            </div>
            <div className={`absolute bottom-6 left-4 right-4 h-10 pointer-events-none transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}>
                <div className="relative w-full h-full pointer-events-auto">
                    {groupedMarkers.map(renderMarkerGroup)}
                </div>
            </div>
        </div>
    );
};

export default Timeline;
