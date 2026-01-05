import React from 'react';
import { X, Command, Keyboard } from 'lucide-react';

const ShortcutsModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    const shortcuts = [
        { key: 'Space', desc: 'Play / Pause' },
        { key: '← / →', desc: 'Seek -1s / +1s' },
        { key: 'J / L', desc: 'Seek -10s / +10s' },
        { key: 'F', desc: 'Toggle Fullscreen' },
        { key: 'M', desc: 'Mute / Unmute' },
        { key: 'Esc', desc: 'Exit Fullscreen / Close Modal' },
        { key: 'Shift + ?', desc: 'Show Shortcuts' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-md p-6 relative" onClick={e => e.stopPropagation()}>
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
                >
                    <X size={20} />
                </button>

                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                        <Keyboard size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
                        <p className="text-xs text-muted-foreground">Master the controls for faster review.</p>
                    </div>
                </div>

                <div className="space-y-2">
                    {shortcuts.map((shortcut, index) => (
                        <div key={index} className="flex items-center justify-between p-2 rounded hover:bg-muted/50 transition-colors">
                            <span className="text-sm font-medium">{shortcut.desc}</span>
                            <span className="text-xs font-mono bg-muted border border-border px-2 py-1 rounded text-muted-foreground min-w-[60px] text-center">
                                {shortcut.key}
                            </span>
                        </div>
                    ))}
                </div>

                <div className="mt-6 pt-4 border-t border-border text-center">
                    <button
                        onClick={onClose}
                        className="text-sm text-primary hover:underline"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ShortcutsModal;
