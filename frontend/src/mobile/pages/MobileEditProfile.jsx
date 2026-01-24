import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ArrowLeft, Check, Camera, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';

const MobileEditProfile = () => {
    const { user, setUser } = useAuth();
    const navigate = useNavigate();
    const fileInputRef = useRef(null);

    const [formData, setFormData] = useState({
        name: user?.name || '',
        email: user?.email || '',
    });
    const [loading, setLoading] = useState(false);

    // Password Confirmation State for Sensitive Changes
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [pendingAction, setPendingAction] = useState(null); // 'email' or 'password'

    const handleAvatarClick = () => {
        fileInputRef.current.click();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const uploadData = new FormData();
        uploadData.append('avatar', file);

        try {
            toast.loading('Uploading avatar...');
            const res = await axios.put('/api/auth/me', uploadData, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            setUser(prev => ({ ...prev, avatarPath: res.data.avatarPath }));
            toast.success('Avatar updated');
        } catch (err) {
            console.error(err);
            toast.error('Failed to upload avatar');
        } finally {
            toast.dismiss();
        }
    };

    const handleSave = async (password = null) => {
        // If email changed, require password
        if (formData.email !== user.email && !password) {
            setPendingAction('save_email');
            setShowPasswordModal(true);
            return;
        }

        setLoading(true);
        try {
            const payload = {
                name: formData.name,
                email: formData.email,
            };
            if (password) payload.currentPassword = password;

            const res = await axios.put('/api/auth/me', payload, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            setUser(prev => ({ ...prev, ...res.data }));
            toast.success('Profile updated');
            setShowPasswordModal(false);
            setCurrentPassword('');
            // Optional: navigate back or stay
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.error || 'Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordSubmit = () => {
        if (!currentPassword) return;
        if (pendingAction === 'save_email') {
            handleSave(currentPassword);
        }
    };

    // Helper for Avatar URL
    const getAvatarUrl = (path) => {
        if (!path) return null;
        return path.startsWith('http') ? path : `/api/media/avatars/${path}`;
    };

    return (
        <div className="h-full bg-background text-foreground flex flex-col relative transition-colors duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-background/80 backdrop-blur-md sticky top-0 z-10 border-b border-white/5">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full active:bg-zinc-800 transition-colors">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="font-bold text-lg">Edit Profile</h1>
                <button
                    onClick={() => handleSave()}
                    disabled={loading}
                    className="text-primary font-bold text-sm disabled:opacity-50"
                >
                    {loading ? 'Saving...' : 'Save'}
                </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
                {/* Avatar */}
                <div className="flex flex-col items-center mb-8">
                    <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
                        <div className="w-24 h-24 bg-gradient-to-br from-primary to-purple-600 rounded-full flex items-center justify-center text-4xl font-bold shadow-2xl border-4 border-zinc-900 overflow-hidden">
                            {user?.avatarPath ? (
                                <img src={getAvatarUrl(user.avatarPath)} className="w-full h-full object-cover" alt="Avatar" />
                            ) : (
                                user?.name?.[0]?.toUpperCase()
                            )}
                        </div>
                        <button className="absolute bottom-0 right-0 p-2 bg-zinc-800 rounded-full border border-zinc-700 text-white shadow-lg active:scale-95 transition-transform">
                            <Camera size={16} />
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileChange}
                        />
                    </div>
                </div>

                {/* Form */}
                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-400 pl-1">Display Name</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-base focus:outline-none focus:border-primary transition-colors text-white"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-400 pl-1">Email Address</label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-base focus:outline-none focus:border-primary transition-colors text-white"
                        />
                        {formData.email !== user?.email && (
                            <p className="text-xs text-yellow-500 pl-1">Changing email requires password confirmation.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Password Confirmation Modal */}
            {showPasswordModal && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
                    <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                        <h3 className="text-lg font-bold mb-2">Confirm Password</h3>
                        <p className="text-zinc-400 text-sm mb-4">Please enter your current password to save changes.</p>

                        <input
                            type="password"
                            placeholder="Current Password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="w-full bg-black/50 border border-zinc-700 rounded-xl p-3 text-white mb-4 focus:outline-none focus:border-primary"
                            autoFocus
                        />

                        <div className="flex gap-3">
                            <button
                                onClick={() => { setShowPasswordModal(false); setCurrentPassword(''); }}
                                className="flex-1 py-3 rounded-xl font-medium bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handlePasswordSubmit}
                                className="flex-1 py-3 rounded-xl font-bold bg-primary text-white transition-colors"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MobileEditProfile;
