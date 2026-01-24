import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, ArrowUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const MobileCommentsSheet = ({
    isOpen,
    onClose,
    comments = [],
    onCommentSubmit,
    onCommentClick,
    currentTime
}) => {
    const [text, setText] = useState('');
    const inputRef = useRef(null);
    const messagesEndRef = useRef(null);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        onCommentSubmit(text);
        setText('');
    };

    useEffect(() => {
        if (isOpen && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [isOpen, comments]);

    // Sort comments by timestamp
    const sortedComments = [...comments].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
                    />

                    {/* Sheet */}
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed bottom-0 left-0 right-0 h-[70vh] bg-zinc-900 rounded-t-3xl z-50 flex flex-col shadow-2xl border-t border-white/10"
                        drag="y"
                        dragConstraints={{ top: 0, bottom: 0 }}
                        dragElastic={0.2}
                        onDragEnd={(e, info) => {
                            if (info.offset.y > 100) onClose();
                        }}
                    >
                        {/* Drag Handle */}
                        <div className="w-full flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing">
                            <div className="w-12 h-1.5 bg-zinc-700/50 rounded-full" />
                        </div>

                        {/* Header */}
                        <div className="px-6 py-2 flex justify-between items-center border-b border-white/5">
                            <span className="font-bold text-lg">{comments.length} Comments</span>
                            <button onClick={onClose} className="p-2 bg-zinc-800 rounded-full text-zinc-400">
                                <X size={16} />
                            </button>
                        </div>

                        {/* Comments List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {sortedComments.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-zinc-500">
                                    <p>No comments yet</p>
                                    <p className="text-sm">Be the first to leave feedback</p>
                                </div>
                            ) : (
                                sortedComments.map((comment) => (
                                    <div
                                        key={comment.id}
                                        onClick={() => {
                                            if (comment.timestamp) onCommentClick(comment.timestamp, comment.annotation);
                                        }}
                                        className="bg-black/20 p-3 rounded-xl border border-white/5 active:bg-white/5 transition-colors"
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-[10px] font-bold">
                                                    {comment.user?.name?.[0] || 'U'}
                                                </div>
                                                <span className="font-semibold text-sm">{comment.user?.name || 'Unknown'}</span>
                                            </div>
                                            {comment.timestamp && (
                                                <span className="text-xs text-primary font-mono bg-primary/10 px-1.5 py-0.5 rounded">
                                                    {Math.floor(comment.timestamp / 60)}:{Math.floor(comment.timestamp % 60).toString().padStart(2, '0')}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">{comment.content}</p>
                                        <div className="mt-2 text-[10px] text-zinc-600 flex gap-2">
                                            <span>{formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-zinc-900 border-t border-white/10 pb-safe-area-bottom">
                            {/* Optional: Show timestamp being commented on if video paused */}
                            {/* <div className="mb-2 text-xs text-zinc-500">Commenting at {Math.floor(currentTime/60)}:{Math.floor(currentTime%60).toString().padStart(2,'0')}</div> */}

                            <form onSubmit={handleSubmit} className="flex gap-2 relative">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={text}
                                    onChange={(e) => setText(e.target.value)}
                                    placeholder="Add a comment..."
                                    className="flex-1 bg-black/40 border border-zinc-700 rounded-full pl-4 pr-12 py-3 text-sm focus:outline-none focus:border-primary transition-colors text-white placeholder:text-zinc-600"
                                />
                                <button
                                    type="submit"
                                    disabled={!text.trim()}
                                    className="absolute right-1 top-1 bottom-1 aspect-square bg-primary text-white rounded-full flex items-center justify-center disabled:opacity-50 disabled:bg-zinc-800 transition-all"
                                >
                                    <ArrowUp size={18} strokeWidth={3} />
                                </button>
                            </form>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default MobileCommentsSheet;
