import React, { useRef, useState, useEffect } from 'react';
import '@google/model-viewer';
import { Play, Pause, RotateCcw, Box, MousePointer2, MessageSquare, Send, CheckCircle, Pencil, MoveRight, Square, Circle, Eraser } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MOCK_COMMENTS = [
    { id: 1, author: 'Sarah (Art Director)', text: "Let's make the texture a bit rougher here.", position: '0.1m 0.5m 0.1m', normal: '0 1 0', timestamp: '2h ago', color: '#ef4444' },
    { id: 2, author: 'Mike (Lead)', text: "Good silhouette! animation looks smooth.", position: null, normal: null, timestamp: '1h ago', color: '#3b82f6' }
];

const DemoReview = () => {
    const modelViewerRef = useRef(null);
    const timelineRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(true);
    const [isScrubbing, setIsScrubbing] = useState(false);
    const [tool, setTool] = useState('pointer'); // pointer, pencil, arrow, rect, circle, eraser
    const [comments, setComments] = useState(MOCK_COMMENTS);
    const [isLoading, setIsLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [newCommentStart, setNewCommentStart] = useState(null); // { x, y, position, normal }
    const [commentText, setCommentText] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);

    // Animation Loop
    useEffect(() => {
        let raf;
        const loop = () => {
            const mv = modelViewerRef.current;
            if (mv && isPlaying && !isScrubbing) {
                setCurrentTime(mv.currentTime);
                if (mv.duration !== duration) setDuration(mv.duration);
            }
            raf = requestAnimationFrame(loop);
        };
        loop();
        return () => cancelAnimationFrame(raf);
    }, [isPlaying, duration, isScrubbing]);

    const handleScrubStart = (e) => {
        setIsScrubbing(true);
        handleScrubMove(e);
        window.addEventListener('mousemove', handleScrubMove);
        window.addEventListener('mouseup', handleScrubEnd);
    };

    const handleScrubMove = (e) => {
        const timeline = timelineRef.current;
        if (!timeline) return;

        const rect = timeline.getBoundingClientRect();
        const fill = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const time = fill * duration;

        setCurrentTime(time);
        if (modelViewerRef.current) {
            modelViewerRef.current.currentTime = time;
        }
    };

    const handleScrubEnd = () => {
        setIsScrubbing(false);
        window.removeEventListener('mousemove', handleScrubMove);
        window.removeEventListener('mouseup', handleScrubEnd);
    };

    const handleModelClick = (e) => {
        const mv = modelViewerRef.current;
        if (!mv) return;

        // Prevent clicking if we are already typing a comment
        if (newCommentStart) return;

        const rect = mv.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const hit = mv.positionAndNormalFromPoint(x, y);
        if (hit) {
            setNewCommentStart({
                x, y,
                position: `${hit.position.x}m ${hit.position.y}m ${hit.position.z}m`,
                normal: `${hit.normal.x} ${hit.normal.y} ${hit.normal.z}`
            });
            // Pause while commenting
            mv.pause();
            setIsPlaying(false);
        }
    };

    const handleAddComment = () => {
        if (!commentText.trim()) return;

        const newComment = {
            id: Date.now(),
            author: 'You (Guest)',
            text: commentText,
            position: newCommentStart?.position,
            normal: newCommentStart?.normal,
            timestamp: 'Just now',
            color: '#22c55e' // Green for user
        };

        setComments([...comments, newComment]);
        setNewCommentStart(null);
        setCommentText('');

        // Resume play? maybe let user decide
        // setIsPlaying(true);
    };

    const handleSeek = (e) => {
        const mv = modelViewerRef.current;
        if (!mv) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const fill = (e.clientX - rect.left) / rect.width;
        const time = fill * duration;
        mv.currentTime = time;
        setCurrentTime(time);
    };

    const togglePlay = () => {
        const mv = modelViewerRef.current;
        if (mv) {
            if (isPlaying) mv.pause();
            else mv.play();
            setIsPlaying(!isPlaying);
        }
    };

    const handleSubmitReview = () => {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
    };

    return (
        <div className="flex flex-col lg:flex-row h-[600px] bg-zinc-950 rounded-xl overflow-hidden border border-white/10 shadow-2xl relative">
            {/* 3D Viewport */}
            <div className="flex-1 relative bg-black/50 group">
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 z-20 backdrop-blur-sm transition-opacity">
                        <div className="flex flex-col items-center gap-4">
                            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"></div>
                            <span className="text-zinc-400 text-sm">Loading 3D Model...</span>
                        </div>
                    </div>
                )}

                <model-viewer
                    ref={modelViewerRef}
                    src="/demo.glb"
                    camera-controls
                    autoplay
                    auto-rotate={isPlaying}
                    rotation-per-second="30deg"
                    shadow-intensity="1"
                    environment-image="neutral"
                    class={`w-full h-full ${tool === 'pointer' ? 'cursor-crosshair' : 'cursor-default'}`}
                    onClick={handleModelClick}
                    onload={() => setIsLoading(false)}
                >
                    {comments.filter(c => c.position).map(c => (
                        <button
                            key={c.id}
                            slot={`hotspot-${c.id}`}
                            data-position={c.position}
                            data-normal={c.normal}
                            className="group/hotspot relative"
                        >
                            <div className={`w-4 h-4 rounded-full border-2 border-white shadow-lg transform transition-transform group-hover/hotspot:scale-125`} style={{ backgroundColor: c.color }}></div>
                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/90 backdrop-blur px-3 py-1.5 rounded-lg text-xs text-white whitespace-nowrap opacity-0 group-hover/hotspot:opacity-100 transition-opacity pointer-events-none border border-white/10">
                                <span className="font-bold mr-1">{c.author}:</span> {c.text.substring(0, 20)}...
                            </div>
                        </button>
                    ))}
                </model-viewer>

                {/* Toolbar Overlay */}
                <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
                    <div className="bg-black/60 backdrop-blur border border-white/10 rounded-full p-1.5 flex flex-col gap-1 shadow-xl">
                        {[
                            { id: 'pointer', icon: MousePointer2 },
                            { id: 'pencil', icon: Pencil },
                            { id: 'arrow', icon: MoveRight },
                            { id: 'rect', icon: Square },
                            { id: 'circle', icon: Circle },
                            { id: 'eraser', icon: Eraser },
                        ].map((t) => (
                            <button
                                key={t.id}
                                onClick={() => setTool(t.id)}
                                className={`p-2 rounded-full transition-all ${tool === t.id ? 'bg-primary text-black' : 'text-zinc-400 hover:text-white hover:bg-white/10'}`}
                            >
                                <t.icon size={18} />
                            </button>
                        ))}
                    </div>
                </div>

                {/* New Comment Popup */}
                <AnimatePresence>
                    {newCommentStart && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="absolute z-30 w-64 bg-zinc-900 border border-white/10 rounded-lg p-3 shadow-xl"
                            style={{ left: Math.min(newCommentStart.x, 500), top: Math.min(newCommentStart.y, 400) }}
                        >
                            <div className="text-xs font-semibold text-zinc-400 mb-2">Add Comment</div>
                            <textarea
                                autoFocus
                                value={commentText}
                                onChange={e => setCommentText(e.target.value)}
                                className="w-full bg-zinc-950 border border-white/10 rounded p-2 text-sm text-white focus:outline-none focus:border-primary/50 resize-none h-20 mb-2"
                                placeholder="Type your feedback..."
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                            />
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setNewCommentStart(null)} className="text-xs text-zinc-400 hover:text-white px-2 py-1">Cancel</button>
                                <button onClick={handleAddComment} className="bg-primary hover:bg-primary/90 text-black text-xs font-bold px-3 py-1 rounded">Post</button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Controls Overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                    {/* Timeline */}
                    <div className="flex items-center gap-3 mb-2">
                        <button
                            onClick={togglePlay}
                            className="p-2 hover:bg-white/10 rounded-full text-white transition-colors"
                        >
                            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                        </button>
                        <span className="text-xs font-mono text-zinc-400 w-12">{currentTime.toFixed(1)}s</span>
                        <div
                            ref={timelineRef}
                            className="flex-1 h-1.5 bg-white/20 rounded-full cursor-pointer relative group/timeline timeline-track"
                            onMouseDown={handleScrubStart}
                        >
                            <div
                                className="absolute top-0 left-0 h-full bg-primary rounded-full pointer-events-none"
                                style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                            ></div>
                            <div
                                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover/timeline:opacity-100 transition-opacity shadow pointer-events-none"
                                style={{ left: `${(currentTime / (duration || 1)) * 100}%` }}
                            ></div>
                        </div>
                        <span className="text-xs font-mono text-zinc-500 w-12">{duration.toFixed(1)}s</span>
                    </div>
                </div>

                {/* Instructions Badge */}
                <div className="absolute top-4 right-4 flex flex-col gap-2 items-end pointer-events-none">
                    <div className="bg-black/60 backdrop-blur px-3 py-1.5 rounded-full text-[10px] text-zinc-300 border border-white/5 flex items-center gap-2">
                        <MousePointer2 size={12} className="text-primary" /> Click model to comment
                    </div>
                </div>
            </div>

            {/* Sidebar (Comments) */}
            <div className="w-full lg:w-80 bg-zinc-900 border-l border-white/5 flex flex-col">
                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                    <div className="font-semibold text-sm flex items-center gap-2">
                        <MessageSquare size={16} className="text-primary" />
                        Comments <span className="text-zinc-500 text-xs">({comments.length})</span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {comments.length === 0 && (
                        <div className="text-center text-zinc-500 text-sm py-8">No comments yet. Be the first!</div>
                    )}
                    {comments.map(comment => (
                        <div key={comment.id} className="flex gap-3 group">
                            <div className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold text-white border border-white/10" style={{ backgroundColor: comment.color }}>
                                {comment.author.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-medium text-zinc-200 truncate">{comment.author}</span>
                                    <span className="text-[10px] text-zinc-500">{comment.timestamp}</span>
                                </div>
                                <div className="text-sm text-zinc-400 bg-white/5 p-2 rounded-lg rounded-tl-none border border-white/5 group-hover:border-white/10 transition-colors break-words">
                                    {comment.text}
                                </div>
                                {comment.position && (
                                    <div className="mt-1 flex items-center gap-1 text-[10px] text-primary cursor-pointer hover:underline">
                                        <Box size={10} /> Attached to model
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Submit Action */}
                <div className="p-4 border-t border-white/5 bg-zinc-950/50">
                    <AnimatePresence>
                        {showSuccess && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="mb-3 bg-green-500/20 border border-green-500/30 text-green-500 px-3 py-2 rounded-lg text-xs flex items-center gap-2"
                            >
                                <CheckCircle size={14} /> Review Submitted Successfully!
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <button
                        onClick={handleSubmitReview}
                        className="w-full bg-primary hover:bg-primary/90 text-black font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 text-sm"
                    >
                        <Send size={16} /> Complete Review
                    </button>
                    <p className="text-[10px] text-center text-zinc-500 mt-2">
                        *This is a demo. No data is actually saved.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default DemoReview;
