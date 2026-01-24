import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBranding } from '../../context/BrandingContext';
import { LogOut, Settings, Moon, Sun, Monitor, ChevronRight, User, Shield } from 'lucide-react';

import { useNavigate } from 'react-router-dom';

const MobileProfile = () => {
    const { logout, user, getMediaUrl } = useAuth();
    const navigate = useNavigate();
    // Theme logic - assuming ThemeContext exists but reusing logic or ignoring for simplicity in v1
    // Branding logic
    const { logo } = useBranding();

    const menuItems = [
        { icon: User, label: 'Edit Profile', action: () => navigate('/settings/edit') },
        { icon: Settings, label: 'Preferences', action: () => navigate('/settings/preferences') },
        { icon: Shield, label: 'Privacy & Security', action: () => navigate('/settings/privacy') },
    ];

    return (
        <div className="pb-24 pt-12">
            <div className="px-6 mb-8">
                <h1 className="text-3xl font-bold mb-6">Settings</h1>



                {/* Profile Card */}
                <div className="bg-zinc-900 rounded-3xl p-6 border border-white/5 mb-8 flex items-center gap-5">
                    <div className="w-20 h-20 bg-gradient-to-br from-primary to-purple-600 rounded-full flex items-center justify-center text-3xl font-bold shadow-xl border-4 border-zinc-900 overflow-hidden relative">
                        {user?.avatarPath ? (
                            <img
                                src={getMediaUrl(`/api/media/avatars/${user.avatarPath}`)}
                                alt={user.name}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <span>{user?.name?.[0] || 'U'}</span>
                        )}
                    </div>
                    <div>
                        <h3 className="font-bold text-xl">{user?.name}</h3>
                        <p className="text-zinc-500 text-sm">{user?.email}</p>
                        <span className="inline-block mt-2 px-3 py-1 bg-white/5 rounded-full text-xs text-zinc-400 font-medium">
                            {user?.role || 'Member'}
                        </span>
                    </div>
                </div>

                {/* Menu */}
                <div className="space-y-4 mb-8">
                    {menuItems.map((item, idx) => (
                        <button
                            key={idx}
                            onClick={item.action}
                            className="w-full flex items-center justify-between p-4 bg-zinc-900/50 rounded-2xl active:bg-zinc-800 transition-colors border border-transparent active:border-white/5"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-white/5 rounded-full text-zinc-300">
                                    <item.icon size={20} />
                                </div>
                                <span className="font-medium">{item.label}</span>
                            </div>
                            <ChevronRight size={18} className="text-zinc-600" />
                        </button>
                    ))}
                </div>

                {/* Logout */}
                <button
                    onClick={logout}
                    className="w-full py-4 bg-red-500/10 text-red-500 rounded-2xl font-bold flex items-center justify-center gap-2 active:bg-red-500/20 transition-colors"
                >
                    <LogOut size={20} />
                    Log Out
                </button>

                <p className="text-center text-zinc-700 text-xs mt-8">
                    ReView Mobile v2.0.0
                </p>
            </div>
        </div>
    );
};

export default MobileProfile;
