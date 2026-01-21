import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MousePointer, Pencil, Square, Circle, MoveRight, Minus, Type, Highlighter, Eraser, Trash2, Undo, Redo, Palette } from 'lucide-react';

const DrawingToolbar = ({
    tool,
    setTool,
    color,
    setColor,
    strokeWidth,
    setStrokeWidth,
    onClose,
    setIsDrawingMode,
    extraTools = [], // Array of { id, icon, name, onClick, active }
    onUndo,
    canUndo,
}) => {
    // Standard 2D Tools
    const tools2D = [
        { id: 'pointer', icon: MousePointer, label: 'Select' },
        { id: 'pencil', icon: Pencil, label: 'Pencil' },
        { id: 'rect', icon: Square, label: 'Rectangle' },
        { id: 'circle', icon: Circle, label: 'Circle' },
        { id: 'arrow', icon: MoveRight, label: 'Arrow' },
        { id: 'line', icon: Minus, label: 'Line' },
        { id: 'text', icon: Type, label: 'Text' },
    ];

    const utilityTools = [
        { id: 'eraser', icon: Eraser, label: 'Eraser' },
        { id: 'object-eraser', icon: Trash2, label: 'Delete Object' }
    ];

    return (
        <motion.div
            initial={{ opacity: 0, x: -10, width: 0 }}
            animate={{ opacity: 1, x: 0, width: 'auto' }}
            exit={{ opacity: 0, x: -10, width: 0 }}
            transition={{ duration: 0.3, ease: "circOut" }}
            className="flex items-center overflow-hidden"
        >
            <div className="flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-xl border border-white/20 rounded-full shadow-lg ml-2 h-[42px]">

                {/* 3D Tools (if any) */}
                {extraTools.length > 0 && (
                    <>
                        <div className="flex items-center gap-1">
                            {extraTools.map(t => (
                                <button
                                    key={t.id}
                                    onClick={t.onClick}
                                    className={`p-1.5 rounded-full transition-colors ${t.active ? 'bg-white text-black' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
                                    title={t.name}
                                >
                                    <t.icon size={16} />
                                </button>
                            ))}
                        </div>
                        <div className="w-[1px] h-4 bg-white/10 mx-1" />
                    </>
                )}

                {/* Draw Tools */}
                <div className="flex items-center gap-1">
                    {tools2D.map(t => (
                        <button
                            key={t.id}
                            onClick={() => {
                                setTool(t.id);
                                if (setIsDrawingMode) setIsDrawingMode(true);
                            }}
                            className={`p-1.5 rounded-full transition-colors ${tool === t.id ? 'bg-white text-black shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
                            title={t.label}
                        >
                            <t.icon size={16} />
                        </button>
                    ))}
                </div>

                <div className="w-[1px] h-4 bg-white/10 mx-1" />

                {/* Utilities */}
                <div className="flex items-center gap-1">
                    {utilityTools.map(t => (
                        <button
                            key={t.id}
                            onClick={() => {
                                setTool(t.id);
                            }}
                            className={`p-1.5 rounded-full transition-colors ${tool === t.id ? 'bg-red-500/80 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
                            title={t.label}
                        >
                            <t.icon size={16} />
                        </button>
                    ))}
                </div>

                <div className="w-[1px] h-4 bg-white/10 mx-1" />

                {/* Settings (Color/Size) */}
                <div className="flex items-center gap-3 px-1">
                    {/* Color */}
                    <div className="relative w-5 h-5 rounded-full overflow-hidden border border-white/20 cursor-pointer hover:scale-110 transition-transform">
                        <input
                            type="color"
                            value={color}
                            onChange={e => setColor(e.target.value)}
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] p-0 m-0 border-none cursor-pointer"
                        />
                    </div>

                    {/* Size */}
                    <div className="flex items-center gap-2 w-16">
                        <div
                            className="rounded-full bg-white/80"
                            style={{ width: `${Math.max(2, strokeWidth / 2)}px`, height: `${Math.max(2, strokeWidth / 2)}px` }}
                        />
                        <input
                            type="range"
                            min="1"
                            max="20"
                            value={strokeWidth}
                            onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
                            className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                        />
                    </div>
                </div>

                {/* Undo/Clear */}
                {(canUndo || onUndo) && (
                    <>
                        <div className="w-[1px] h-4 bg-white/10 mx-1" />
                        <button
                            onClick={onUndo}
                            disabled={!canUndo}
                            className={`p-1.5 rounded-full ${!canUndo ? 'text-white/20' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                            title="Undo"
                        >
                            <Undo size={16} />
                        </button>
                    </>
                )}
            </div>
        </motion.div>
    );
};

export default DrawingToolbar;
