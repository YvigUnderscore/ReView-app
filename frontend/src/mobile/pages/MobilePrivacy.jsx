import React, { useState } from 'react';
import { ArrowLeft, Shield, Key, Eye, FileText, ChevronRight, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';

const MobilePrivacy = () => {
    const navigate = useNavigate();
    const { logout } = useAuth();

    // Modal States
    const [view, setView] = useState('main'); // 'main', 'change_password', 'delete_confirm'

    // Change Password State
    const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
    const [loading, setLoading] = useState(false);

    // Delete Account State
    const [deleteConfirmText, setDeleteConfirmText] = useState('');

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (passwordData.new !== passwordData.confirm) {
            toast.error("New passwords don't match");
            return;
        }

        setLoading(true);
        try {
            await axios.put('/api/auth/me', {
                currentPassword: passwordData.current,
                password: passwordData.new
            }, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            toast.success('Password changed successfully');
            setView('main');
            setPasswordData({ current: '', new: '', confirm: '' });
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to change password');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (deleteConfirmText !== 'DELETE') return;

        setLoading(true);
        try {
            await axios.delete('/api/users/me', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            toast.success('Account deleted');
            logout(); // Clear auth and redirect
        } catch (err) {
            console.error(err);
            if (err.response?.data?.error === 'CANNOT_DELETE_OWNER') {
                toast.error("Cannot delete: You own teams. Check desktop to transfer ownership.");
            } else {
                toast.error('Failed to delete account');
            }
        } finally {
            setLoading(false);
        }
    };

    const menuItems = [
        { icon: Key, label: 'Change Password', description: 'Update your security key', action: () => setView('change_password') },
        { icon: Shield, label: 'Two-Factor Authentication', description: 'Extra layer of protection', action: () => toast.info('Please visit desktop to configure 2FA') },
        { icon: Eye, label: 'Privacy Policy', description: 'Read our latest terms', action: () => window.open('/privacy', '_blank') },
        { icon: FileText, label: 'Terms of Service', description: 'Usage guidelines', action: () => window.open('/terms', '_blank') },
    ];

    if (view === 'change_password') {
        return (
            <div className="h-full bg-[#020613] text-white flex flex-col">
                <div className="flex items-center gap-4 p-4 bg-background/80 backdrop-blur-md sticky top-0 z-10 border-b border-white/5">
                    <button onClick={() => setView('main')} className="p-2 -ml-2 rounded-full active:bg-zinc-800 transition-colors">
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="font-bold text-lg">Change Password</h1>
                </div>
                <div className="p-6">
                    <form onSubmit={handleChangePassword} className="space-y-4">
                        <div>
                            <input
                                type="password"
                                placeholder="Current Password"
                                value={passwordData.current}
                                onChange={e => setPasswordData({ ...passwordData, current: e.target.value })}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-base focus:outline-none focus:border-primary text-white"
                                required
                            />
                        </div>
                        <div>
                            <input
                                type="password"
                                placeholder="New Password"
                                value={passwordData.new}
                                onChange={e => setPasswordData({ ...passwordData, new: e.target.value })}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-base focus:outline-none focus:border-primary text-white"
                                required
                                minLength={8}
                            />
                        </div>
                        <div>
                            <input
                                type="password"
                                placeholder="Confirm New Password"
                                value={passwordData.confirm}
                                onChange={e => setPasswordData({ ...passwordData, confirm: e.target.value })}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-base focus:outline-none focus:border-primary text-white"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 bg-primary text-white font-bold rounded-xl mt-4 disabled:opacity-50"
                        >
                            {loading ? 'Updating...' : 'Update Password'}
                        </button>
                    </form>
                </div>
            </div>
        )
    }

    if (view === 'delete_confirm') {
        return (
            <div className="h-full bg-[#020613] text-white flex flex-col">
                <div className="flex items-center gap-4 p-4 bg-background/80 backdrop-blur-md sticky top-0 z-10 border-b border-white/5">
                    <button onClick={() => setView('main')} className="p-2 -ml-2 rounded-full active:bg-zinc-800 transition-colors">
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="font-bold text-lg text-red-500">Delete Account</h1>
                </div>
                <div className="p-6">
                    <div className="flex flex-col items-center text-center mb-8">
                        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-4">
                            <AlertTriangle size={40} />
                        </div>
                        <h2 className="text-xl font-bold mb-2">Are you absolutely sure?</h2>
                        <p className="text-zinc-400 text-sm leading-relaxed">
                            This action cannot be undone. This will permanently delete your account and remove your data from our servers.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs text-zinc-500 mb-1 block">Type "DELETE" to confirm</label>
                            <input
                                type="text"
                                placeholder="DELETE"
                                value={deleteConfirmText}
                                onChange={e => setDeleteConfirmText(e.target.value)}
                                className="w-full bg-zinc-900 border border-red-900/50 rounded-xl p-4 text-base focus:outline-none focus:border-red-500 text-white"
                            />
                        </div>
                        <button
                            onClick={handleDeleteAccount}
                            disabled={deleteConfirmText !== 'DELETE' || loading}
                            className="w-full py-4 bg-red-600 text-white font-bold rounded-xl disabled:opacity-50 disabled:bg-zinc-800"
                        >
                            {loading ? 'Deleting...' : 'Permanently Delete Account'}
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // Main View
    return (
        <div className="h-full bg-[#020613] text-white flex flex-col">
            <div className="flex items-center gap-4 p-4 bg-background/80 backdrop-blur-md sticky top-0 z-10 border-b border-white/5">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full active:bg-zinc-800 transition-colors">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="font-bold text-lg">Privacy & Security</h1>
            </div>

            <div className="p-6">
                <div className="space-y-4">
                    {menuItems.map((item, idx) => (
                        <button
                            key={idx}
                            onClick={item.action}
                            className="w-full flex items-center justify-between p-4 bg-zinc-900/50 rounded-2xl active:bg-zinc-800 transition-colors border border-transparent active:border-white/5 text-left"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-white/5 rounded-full text-zinc-300">
                                    <item.icon size={20} />
                                </div>
                                <div>
                                    <p className="font-medium">{item.label}</p>
                                    <p className="text-xs text-zinc-500">{item.description}</p>
                                </div>
                            </div>
                            <ChevronRight size={18} className="text-zinc-600" />
                        </button>
                    ))}
                </div>

                <div className="mt-8 p-6 bg-red-500/5 border border-red-500/10 rounded-3xl">
                    <h3 className="font-bold text-red-500 mb-2">Danger Zone</h3>
                    <p className="text-sm text-zinc-400 mb-4">
                        Permanently remove your account and all of its contents. This action is not reversible.
                    </p>
                    <button
                        onClick={() => setView('delete_confirm')}
                        className="w-full py-3 bg-red-500 text-white rounded-xl font-bold text-sm hover:bg-red-600 transition-colors"
                    >
                        Delete Account
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MobilePrivacy;
