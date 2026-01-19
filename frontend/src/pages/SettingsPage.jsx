import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { User, Bell, Users, AlertTriangle, Save, Trash2, Mail, Smartphone, ArrowRight, ShieldAlert } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import { toast } from 'sonner';

const SettingsPage = () => {
    const { user, setUser, logout } = useAuth(); // Assuming logout exists or I can just clear token
    const [activeTab, setActiveTab] = useState('profile');
    const navigate = useNavigate();
    const location = useLocation();
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { }, isDestructive: false });

    // Handle Unsubscribe Action from Email Link
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('action') === 'unsubscribe') {
            setActiveTab('notifications');
            // Small delay to ensure render
            setTimeout(() => {
                setConfirmDialog({
                    isOpen: true,
                    title: 'Unsubscribe from Emails',
                    message: 'Are you sure you want to disable ALL email notifications?',
                    isDestructive: true,
                    onConfirm: async () => {
                        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                        try {
                            const res = await fetch('/api/users/me/preferences/unsubscribe-all', {
                                method: 'POST',
                                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                            });
                            if (res.ok) {
                                toast.success('You have been unsubscribed from all emails.');
                                // Remove query param
                                navigate('/settings', { replace: true });
                            } else {
                                toast.error('Failed to unsubscribe.');
                            }
                        } catch (e) {
                            toast.error('Error processing request.');
                        }
                    }
                });
            }, 500);
        }
    }, [location.search, navigate]);

    const tabs = [
        { id: 'profile', label: 'Profile', icon: User },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'teams', label: 'Teams', icon: Users },
        { id: 'danger', label: 'Danger Zone', icon: AlertTriangle, danger: true },
    ];

    return (
        <div className="flex h-full bg-background">
            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                title={confirmDialog.title}
                message={confirmDialog.message}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                isDestructive={confirmDialog.isDestructive}
            />
            {/* Sidebar */}
            <div className="w-64 border-r border-border p-4">
                <h1 className="text-xl font-bold mb-6 px-2">Settings</h1>
                <nav className="space-y-1">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab.id
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                } ${tab.danger ? 'text-destructive hover:bg-destructive/10 hover:text-destructive' : ''}`}
                        >
                            <tab.icon size={18} />
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-2xl mx-auto">
                    {activeTab === 'profile' && <ProfileSettings user={user} setUser={setUser} />}
                    {activeTab === 'notifications' && <NotificationSettings />}
                    {activeTab === 'teams' && <TeamSettings user={user} setConfirmDialog={setConfirmDialog} />}
                    {activeTab === 'danger' && <DangerZone user={user} logout={logout} setConfirmDialog={setConfirmDialog} />}
                </div>
            </div>
        </div>
    );
};

const ProfileSettings = ({ user, setUser }) => {
    const [name, setName] = useState(user?.name || '');
    const [email, setEmail] = useState(user?.email || '');
    const [password, setPassword] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [avatar, setAvatar] = useState(null);
    const [preview, setPreview] = useState(user?.avatarPath ? `/api/media/avatars/${user.avatarPath}` : null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleAvatarChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setAvatar(file);
            setPreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        setError('');

        try {
            const formData = new FormData();
            formData.append('name', name);
            formData.append('email', email);
            if (password) {
                if (!currentPassword) {
                    setError('Current password is required to set a new password');
                    setLoading(false);
                    return;
                }
                formData.append('password', password);
                formData.append('currentPassword', currentPassword);
            }
            if (avatar) formData.append('avatar', avatar);

            const res = await fetch('/api/auth/me', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: formData
            });

            const data = await res.json();
            if (res.ok) {
                setMessage('Profile updated successfully');
                setUser(data);
            } else {
                setError(data.error || 'Update failed');
            }
        } catch (err) {
            console.error(err);
            setError('An error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold">Profile Settings</h2>
                <p className="text-muted-foreground text-sm">Manage your account information.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 bg-card border border-border rounded-lg p-6">
                {message && <div className="bg-green-500/10 text-green-500 p-3 rounded text-sm border border-green-500/20">{message}</div>}
                {error && <div className="bg-destructive/10 text-destructive p-3 rounded text-sm border border-destructive/20">{error}</div>}

                <div className="flex items-center gap-6">
                    <div className="w-24 h-24 rounded-full overflow-hidden bg-muted border border-border flex items-center justify-center text-3xl font-bold text-muted-foreground">
                        {preview ? (
                            <img src={preview} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                            name ? name.charAt(0).toUpperCase() : '?'
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Profile Picture</label>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarChange}
                            className="text-xs text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                        />
                    </div>
                </div>

                <div className="grid gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Display Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full bg-input border border-border rounded-md p-2 focus:ring-1 focus:ring-primary outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Email Address</label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full bg-input border border-border rounded-md p-2 focus:ring-1 focus:ring-primary outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">New Password</label>
                        <input
                            type="password"
                            placeholder="Leave blank to keep current"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full bg-input border border-border rounded-md p-2 focus:ring-1 focus:ring-primary outline-none"
                        />
                    </div>
                    {password && (
                        <div>
                            <label className="block text-sm font-medium mb-1 text-primary">Current Password (Required)</label>
                            <input
                                type="password"
                                placeholder="Required to set new password"
                                value={currentPassword}
                                onChange={e => setCurrentPassword(e.target.value)}
                                className="w-full bg-input border border-primary rounded-md p-2 focus:ring-1 focus:ring-primary outline-none"
                                required
                            />
                        </div>
                    )}
                </div>

                <div className="flex justify-end pt-4 border-t border-border">
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading ? 'Saving...' : <><Save size={16} /> Save Changes</>}
                    </button>
                </div>
            </form>
        </div>
    );
};

const NotificationSettings = () => {
    const [preferences, setPreferences] = useState([]);
    const [loading, setLoading] = useState(true);

    const notificationTypes = [
        { id: 'MENTION', label: 'Mentions', description: 'When someone mentions you in a comment' },
        { id: 'REPLY', label: 'Replies', description: 'When someone replies to your comment' },
        { id: 'PROJECT_CREATE', label: 'New Projects', description: 'When a project is created in your team' },
        { id: 'VIDEO_VERSION', label: 'Video Updates', description: 'When a new video version is uploaded' },
        { id: 'STATUS_CHANGE', label: 'Status Changes', description: 'When a project status changes' },
        { id: 'TEAM_ADD', label: 'Team Updates', description: 'When you are added to a team' },
    ];

    useEffect(() => {
        fetch('/api/users/me/preferences', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setPreferences(data);
                } else {
                    console.error("Failed to load preferences:", data);
                    setPreferences([]);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setPreferences([]);
                setLoading(false);
            });
    }, []);

    const toggle = async (type, channel) => {
        // Optimistic update - use correct defaults: email=false, inApp=true
        const currentPref = preferences.find(p => p.type === type) || { type, email: false, inApp: true };
        const newValue = !currentPref[channel];

        const updatedPref = { ...currentPref, [channel]: newValue };
        setPreferences(prev => {
            const idx = prev.findIndex(p => p.type === type);
            if (idx === -1) return [...prev, updatedPref];
            const newArr = [...prev];
            newArr[idx] = updatedPref;
            return newArr;
        });

        try {
            await fetch('/api/users/me/preferences', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ type, channel, enabled: newValue })
            });
        } catch (err) {
            console.error("Failed to save pref");
        }
    };

    const isEnabled = (type, channel) => {
        const pref = preferences.find(p => p.type === type);
        // Default values: email=false, inApp=true
        if (!pref) {
            if (channel === 'email') return false;
            return true; // inApp defaults to true
        }
        return pref[channel];
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold">Notification Preferences</h2>
                <p className="text-muted-foreground text-sm">Choose how and when you want to be notified.</p>
            </div>

            <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 bg-muted/50 p-4 border-b border-border text-sm font-medium">
                    <div className="col-span-6">Notification Type</div>
                    <div className="col-span-3 text-center flex items-center justify-center gap-2"><Smartphone size={16} /> In-App</div>
                    <div className="col-span-3 text-center flex items-center justify-center gap-2"><Mail size={16} /> Email</div>
                </div>
                {notificationTypes.map(type => (
                    <div key={type.id} className="grid grid-cols-12 p-4 border-b border-border last:border-0 hover:bg-muted/20">
                        <div className="col-span-6 pr-4">
                            <div className="font-medium">{type.label}</div>
                            <div className="text-xs text-muted-foreground">{type.description}</div>
                        </div>
                        <div className="col-span-3 flex justify-center items-center">
                            <Switch
                                checked={isEnabled(type.id, 'inApp')}
                                onChange={() => toggle(type.id, 'inApp')}
                            />
                        </div>
                        <div className="col-span-3 flex justify-center items-center">
                            <Switch
                                checked={isEnabled(type.id, 'email')}
                                onChange={() => toggle(type.id, 'email')}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const Switch = ({ checked, onChange }) => (
    <button
        onClick={onChange}
        className={`w-10 h-6 rounded-full transition-colors relative focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary ${checked ? 'bg-primary' : 'bg-input'
            }`}
    >
        <span
            className={`absolute top-1 left-1 w-4 h-4 rounded-full transition-transform ${checked ? 'translate-x-4 bg-primary-foreground' : 'translate-x-0 bg-white'
                }`}
        />
    </button>
);

const TeamSettings = ({ user, setConfirmDialog }) => {
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [transferModal, setTransferModal] = useState(null); // teamId
    const [members, setMembers] = useState([]);
    const [editingTeam, setEditingTeam] = useState(null);

    const fetchTeams = () => {
        fetch('/api/teams', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
            .then(res => res.json())
            .then(data => {
                // Filter only owned teams for this view, or show all but only manage owned
                setTeams(data.filter(t => t.isOwner));
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchTeams();
    }, []);

    const openTransfer = (team) => {
        setMembers(team.members || []);
        setTransferModal(team.id);
    };

    const handleUpdateTeam = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`/api/teams/${editingTeam.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({
                    discordWebhookUrl: editingTeam.discordWebhookUrl,
                    discordBotName: editingTeam.discordBotName,
                    discordBotAvatar: editingTeam.discordBotAvatar,
                    discordTiming: editingTeam.discordTiming,
                    discordBurnAnnotations: editingTeam.discordBurnAnnotations
                })
            });
            if (res.ok) {
                toast.success('Team settings updated');
                setEditingTeam(null);
                fetchTeams();
            } else {
                toast.error('Failed to update settings');
            }
        } catch (error) {
            toast.error('Error updating settings');
        }
    };

    const handleTransfer = async (teamId, newOwnerId) => {
        setConfirmDialog({
            isOpen: true,
            title: "Transfer Ownership",
            message: "Are you sure? You will lose ownership of this team.",
            isDestructive: true,
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                try {
                    const res = await fetch(`/api/teams/${teamId}/transfer`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${localStorage.getItem('token')}`
                        },
                        body: JSON.stringify({ newOwnerId })
                    });
                    if (res.ok) {
                        toast.success("Ownership transferred.");
                        setTransferModal(null);
                        fetchTeams();
                    } else {
                        const data = await res.json();
                        toast.error(data.error);
                    }
                } catch (e) {
                    toast.error("Transfer failed");
                }
            }
        });
    };

    const handleDeleteTeam = async (teamId) => {
        setConfirmDialog({
            isOpen: true,
            title: "Delete Team",
            message: "Are you sure? This will delete the team and ALL its projects permanently.",
            isDestructive: true,
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                try {
                    const res = await fetch(`/api/teams/${teamId}`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                    });
                    if (res.ok) {
                        fetchTeams();
                    } else {
                        toast.error("Failed to delete team");
                    }
                } catch (e) {
                    toast.error("Error deleting team");
                }
            }
        });
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold">My Teams</h2>
                <p className="text-muted-foreground text-sm">Manage teams you own. Transfer ownership or delete teams.</p>
            </div>

            {teams.length === 0 ? (
                <div className="text-muted-foreground italic">You don't own any teams.</div>
            ) : (
                <div className="space-y-4">
                    {teams.map(team => (
                        <div key={team.id} className="bg-card border border-border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <div className="font-bold text-lg">{team.name}</div>
                                    <div className="text-sm text-muted-foreground">{team.members?.length || 0} members</div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setEditingTeam(team)}
                                        className="px-3 py-1 text-sm bg-primary/10 text-primary rounded hover:bg-primary/20 flex items-center gap-1"
                                    >
                                        Settings
                                    </button>
                                    <button
                                        onClick={() => openTransfer(team)}
                                        className="px-3 py-1 text-sm border border-border rounded hover:bg-accent flex items-center gap-1"
                                    >
                                        <ArrowRight size={14} /> Transfer
                                    </button>
                                    <button
                                        onClick={() => handleDeleteTeam(team.id)}
                                        className="px-3 py-1 text-sm bg-destructive/10 text-destructive rounded hover:bg-destructive/20 flex items-center gap-1"
                                    >
                                        <Trash2 size={14} /> Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {editingTeam && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-background rounded-lg shadow-xl w-full max-w-lg border border-border overflow-y-auto max-h-[90vh]">
                        <div className="p-4 border-b border-border flex justify-between items-center">
                            <h3 className="font-bold text-lg">Team Settings: {editingTeam.name}</h3>
                            <button onClick={() => setEditingTeam(null)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleUpdateTeam} className="p-6 space-y-6">
                            <div>
                                <h4 className="font-medium mb-4 flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-full bg-[#5865F2] flex items-center justify-center text-white text-xs">D</span>
                                    Discord Integration
                                </h4>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Webhook URL</label>
                                        <input
                                            type="url"
                                            className="w-full bg-input border border-border rounded p-2"
                                            placeholder="https://discord.com/api/webhooks/..."
                                            value={editingTeam.discordWebhookUrl || ''}
                                            onChange={e => setEditingTeam({ ...editingTeam, discordWebhookUrl: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Bot Name (Optional)</label>
                                            <input
                                                type="text"
                                                className="w-full bg-input border border-border rounded p-2"
                                                placeholder="ReView Bot"
                                                value={editingTeam.discordBotName || ''}
                                                onChange={e => setEditingTeam({ ...editingTeam, discordBotName: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Bot Avatar URL (Optional)</label>
                                            <input
                                                type="url"
                                                className="w-full bg-input border border-border rounded p-2"
                                                placeholder="https://..."
                                                value={editingTeam.discordBotAvatar || ''}
                                                onChange={e => setEditingTeam({ ...editingTeam, discordBotAvatar: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-1">Notification Timing</label>
                                        <select
                                            className="w-full bg-input border border-border rounded p-2"
                                            value={editingTeam.discordTiming || 'REALTIME'}
                                            onChange={e => setEditingTeam({ ...editingTeam, discordTiming: e.target.value })}
                                        >
                                            <option value="REALTIME">Realtime (Immediate)</option>
                                            <option value="GROUPED">Grouped (Smart Batching - 5min Delay)</option>
                                            <option value="HYBRID">Hybrid (Urgent Realtime, Comments Grouped)</option>
                                            <option value="HOURLY">Hourly Digest</option>
                                            <option value="MAJOR">Major Events Only</option>
                                        </select>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            {editingTeam.discordTiming === 'REALTIME' && "Sends a message for every action immediately. Can be spammy."}
                                            {editingTeam.discordTiming === 'GROUPED' && "Waits for 5 minutes of inactivity before sending a summary."}
                                            {editingTeam.discordTiming === 'HYBRID' && "Mentions & Status changes are immediate. Comments are grouped."}
                                            {editingTeam.discordTiming === 'HOURLY' && "Sends one summary per hour."}
                                            {editingTeam.discordTiming === 'MAJOR' && "Only notifies for Status Changes, New Versions, and New Projects."}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id="burnAnnot"
                                            checked={editingTeam.discordBurnAnnotations !== false} // Default true
                                            onChange={e => setEditingTeam({ ...editingTeam, discordBurnAnnotations: e.target.checked })}
                                        />
                                        <label htmlFor="burnAnnot" className="text-sm font-medium">Burn-in Annotations</label>
                                    </div>
                                    <p className="text-xs text-muted-foreground ml-5">
                                        If enabled, drawing annotations will be merged into the preview image sent to Discord.
                                    </p>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-border flex justify-end gap-2">
                                <button type="button" onClick={() => setEditingTeam(null)} className="px-4 py-2 rounded hover:bg-muted">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {transferModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-background p-6 rounded-lg max-w-sm w-full border border-border">
                        <h3 className="text-lg font-bold mb-4">Select New Owner</h3>
                        <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
                            {members.filter(m => m.id !== user.id).length === 0 ? (
                                <div className="text-sm text-muted-foreground">No other members in this team.</div>
                            ) : (
                                members.filter(m => m.id !== user.id).map(m => (
                                    <button
                                        key={m.id}
                                        onClick={() => handleTransfer(transferModal, m.id)}
                                        className="w-full text-left p-2 hover:bg-accent rounded text-sm"
                                    >
                                        {m.name} ({m.email})
                                    </button>
                                ))
                            )}
                        </div>
                        <button onClick={() => setTransferModal(null)} className="w-full border border-border p-2 rounded text-sm">Cancel</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const DangerZone = ({ user, logout }) => {
    const [confirming, setConfirming] = useState(false);
    const [password, setPassword] = useState(''); // If we want to verify password, backend logic exists to delete, but frontend check is good too.
    // Actually, backend DELETE /me endpoint doesn't strictly require password in body currently (it uses token),
    // but for security normally we should ask.
    // I'll skip password *re-verification* in API call for now to keep it simple, but UI should be scary.

    const handleDelete = async () => {
        try {
            const res = await fetch('/api/users/me', {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();

            if (res.ok) {
                // Logout and redirect
                // Since logout() might just clear context, we also need to reload or clear storage
                localStorage.removeItem('token');
                window.location.href = '/login';
            } else {
                if (data.error === 'CANNOT_DELETE_OWNER') {
                    alert(`${data.message}\nTeams: ${data.teams.join(', ')}`);
                } else {
                    alert(data.error || "Failed to delete account");
                }
            }
        } catch (e) {
            alert("Error deleting account");
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-destructive">Danger Zone</h2>
                <p className="text-muted-foreground text-sm">Irreversible actions for your account.</p>
            </div>

            <div className="border border-destructive/50 bg-destructive/5 rounded-lg p-6">
                <h3 className="font-bold text-lg mb-2 flex items-center gap-2"><ShieldAlert className="text-destructive" /> Delete Account</h3>
                <p className="text-sm text-muted-foreground mb-4">
                    Once you delete your account, there is no going back. All your personal data and comments will be permanently removed.
                    If you own any teams, you must transfer ownership or delete them first.
                </p>

                {!confirming ? (
                    <button
                        onClick={() => setConfirming(true)}
                        className="bg-destructive text-destructive-foreground px-4 py-2 rounded font-medium hover:opacity-90"
                    >
                        Delete Account
                    </button>
                ) : (
                    <div className="space-y-2">
                        <p className="text-sm font-bold">Are you absolutely sure?</p>
                        <div className="flex gap-2">
                            <button
                                onClick={handleDelete}
                                className="bg-destructive text-destructive-foreground px-4 py-2 rounded font-medium hover:opacity-90"
                            >
                                Yes, Delete My Account
                            </button>
                            <button
                                onClick={() => setConfirming(false)}
                                className="bg-muted text-foreground px-4 py-2 rounded font-medium hover:bg-muted/80"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SettingsPage;
