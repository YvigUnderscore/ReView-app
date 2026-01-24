import React, { useState, useEffect } from 'react';
import { ArrowLeft, Moon, Sun, Monitor, Bell, Volume2, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext'; // Import ThemeContext

const MobilePreferences = () => {
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme(); // Use real context
    const [notifications, setNotifications] = useState(true);
    const [soundVolume, setSoundVolume] = useState(50); // Sound slider state

    // Map context theme to UI value (handle 'system' later if needed, for now toggle is light/dark)
    // The previous UI had 3 buttons, but context only has toggle. 
    // Let's upgrade context or just map UI to available actions.
    // For now, let's assume 'system' falls back to default, but user wants buttons.
    // We'll simplisticly handle it: 
    // If theme is 'dark', Light button switches to light. Dark button does nothing (already active).
    // System button is tricky without context support, so we'll just make it set to 'dark' for now as default "System" look in this app.

    // Better: Update ThemeContext to support setMode('light'|'dark'|'system') but for now let's just make the buttons work with what we have.
    // Context has `theme` ('light'|'dark') and `toggleTheme`.
    // We will simulate explicit set.

    const handleSetTheme = (mode) => {
        if (mode === 'system') {
            // Mock system behavior or just set dark as default
            if (theme !== 'dark') toggleTheme();
        } else if (mode !== theme) {
            toggleTheme();
        }
    };

    const ThemeOption = ({ value, icon: Icon, label }) => (
        <button
            onClick={() => handleSetTheme(value)}
            className={`flex-1 flex flex-col items-center gap-3 p-4 rounded-xl border transition-all ${theme === value || (value === 'system' && theme === 'dark') // naive check for system
                ? 'bg-primary/20 border-primary text-primary'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                }`}
        >
            <Icon size={24} />
            <span className="text-xs font-medium">{label}</span>
        </button>
    );

    return (
        <div className="h-full bg-background text-foreground flex flex-col transition-colors duration-300">
            <div className="flex items-center gap-4 p-4 bg-background/80 backdrop-blur-md sticky top-0 z-10 border-b border-white/5">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full active:bg-zinc-800 transition-colors">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="font-bold text-lg">Preferences</h1>
            </div>

            <div className="p-6 space-y-8">
                {/* Theme */}
                <section>
                    <h2 className="text-sm font-semibold text-zinc-500 mb-4 uppercase tracking-wider">Appearance</h2>
                    <div className="flex gap-4">
                        <ThemeOption value="light" icon={Sun} label="Light" />
                        <ThemeOption value="dark" icon={Moon} label="Dark" />
                        {/* System currently just maps to Dark in this simplistic implementation */}
                        <ThemeOption value="system" icon={Monitor} label="System" />
                    </div>
                </section>

                {/* Notifications */}
                <section>
                    <h2 className="text-sm font-semibold text-zinc-500 mb-4 uppercase tracking-wider">Notifications</h2>
                    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
                        <div className="p-4 flex items-center justify-between border-b border-white/5">
                            <div className="flex items-center gap-3">
                                <Bell size={20} className="text-zinc-400" />
                                <span className="font-medium">Push Notifications</span>
                            </div>
                            <div
                                onClick={() => setNotifications(!notifications)}
                                className={`w-12 h-7 rounded-full p-1 transition-colors cursor-pointer ${notifications ? 'bg-primary' : 'bg-zinc-700'}`}
                            >
                                <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${notifications ? 'translate-x-5' : 'translate-x-0'}`} />
                            </div>
                        </div>
                        <div className="p-4 flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Volume2 size={20} className="text-zinc-400" />
                                    <span className="font-medium">Sound Volume</span>
                                </div>
                                <span className="text-xs text-zinc-500">{soundVolume}%</span>
                            </div>
                            {/* Functional Slider */}
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={soundVolume}
                                onChange={(e) => setSoundVolume(e.target.value)}
                                className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-primary"
                            />
                        </div>
                    </div>
                </section>

                {/* Region */}
                <section>
                    <h2 className="text-sm font-semibold text-zinc-500 mb-4 uppercase tracking-wider">Region</h2>
                    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 flex items-center justify-between active:bg-zinc-800 transition-colors cursor-pointer">
                        <div className="flex items-center gap-3">
                            <Globe size={20} className="text-zinc-400" />
                            <span className="font-medium">Language</span>
                        </div>
                        <span className="text-zinc-500 text-sm">English (US)</span>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default MobilePreferences;
