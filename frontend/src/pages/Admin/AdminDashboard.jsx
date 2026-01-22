import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useHeader } from '../../context/HeaderContext';
import { useBranding } from '../../context/BrandingContext';
import { useNavigate } from 'react-router-dom';
import { Edit, X, Users, Database, Shield, Activity, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import io from 'socket.io-client';
import ConfirmDialog from '../../components/ConfirmDialog';
import { toast } from 'sonner';

const AdminDashboard = () => {
    const { user } = useAuth();
    const { searchQuery } = useHeader();
    const { title: currentTitle, dateFormat: currentDateFormat, refreshConfig } = useBranding();
    const navigate = useNavigate();

    // Tab State
    const [activeTab, setActiveTab] = useState('settings'); // 'settings', 'users', 'teams'

    // Confirmation Dialog
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { }, isDestructive: false });

    // Data State
    const [users, setUsers] = useState([]);
    const [teams, setTeams] = useState([]);

    // Settings State
    const [siteTitle, setSiteTitle] = useState('');
    const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
    const [retentionDays, setRetentionDays] = useState('7');
    const [publicUrl, setPublicUrl] = useState('');
    const [settingsLoading, setSettingsLoading] = useState(false);
    const [uploadingIcon, setUploadingIcon] = useState(false);
    const [uploadingSound, setUploadingSound] = useState(false);
    const [globalUserLimit, setGlobalUserLimit] = useState(10); // GB
    const [globalTeamLimit, setGlobalTeamLimit] = useState(25); // GB
    const [fbxServerConversion, setFbxServerConversion] = useState(true); // FBX conversion enabled by default
    const [enable3dGif, setEnable3dGif] = useState(true); // 3D GIF generation enabled by default
    const [digestVideoEnabled, setDigestVideoEnabled] = useState(true); // Digest video generation enabled by default

    // Digest Video Settings State
    const [digestFpsMax, setDigestFpsMax] = useState(24);
    const [digestFpsDefault, setDigestFpsDefault] = useState(18);
    const [digestTransitionMax, setDigestTransitionMax] = useState(3);
    const [digestTransitionDefault, setDigestTransitionDefault] = useState(1);
    const [digestPauseMax, setDigestPauseMax] = useState(10);
    const [digestPauseDefault, setDigestPauseDefault] = useState(2);
    const [digestWidth, setDigestWidth] = useState(1280);
    const [digestHeight, setDigestHeight] = useState(720);

    const [recalcLoading, setRecalcLoading] = useState(false);

    // System Stats State
    const [systemStats, setSystemStats] = useState(null);

    // SMTP State
    const [smtpConfig, setSmtpConfig] = useState({
        smtp_host: '', smtp_port: '', smtp_user: '', smtp_pass: '', smtp_secure: 'false', smtp_from: ''
    });
    const [smtpLoading, setSmtpLoading] = useState(false);
    const [testEmailLoading, setTestEmailLoading] = useState(false);
    const [testEmailType, setTestEmailType] = useState('SIMPLE');

    // Invitation State
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteLink, setInviteLink] = useState('');
    const [inviteLoading, setInviteLoading] = useState(false);

    // Bulk Invite State
    const [bulkEmails, setBulkEmails] = useState('');
    const [bulkResults, setBulkResults] = useState('');
    const [bulkLoading, setBulkLoading] = useState(false);

    // Modals State
    const [editingUser, setEditingUser] = useState(null);
    const [editingTeam, setEditingTeam] = useState(null);

    // Global Announcement State
    const [announcementMsg, setAnnouncementMsg] = useState('');
    const [announcementTitle, setAnnouncementTitle] = useState('');
    const [announcementType, setAnnouncementType] = useState('popup');
    const [announcementIcon, setAnnouncementIcon] = useState('Sparkles');
    const [announcementStart, setAnnouncementStart] = useState('');
    const [announcementEnd, setAnnouncementEnd] = useState('');
    const [announcementActive, setAnnouncementActive] = useState(false);
    const [announcementSaving, setAnnouncementSaving] = useState(false);

    // Email Broadcast State
    const [broadcast, setBroadcast] = useState({ subject: '', message: '' });
    const [broadcastLoading, setBroadcastLoading] = useState(false);

    const SMTP_PRESETS = {
        ovh: { host: 'ssl0.ovh.net', port: '465', secure: true },
        gmail: { host: 'smtp.gmail.com', port: '465', secure: true },
        outlook: { host: 'smtp.office365.com', port: '587', secure: false }
    };

    useEffect(() => {
        if (user && user.role !== 'admin') {
            navigate('/');
            return;
        }
        fetchSettings();
        if (activeTab === 'users') fetchUsers();
        if (activeTab === 'teams') fetchTeams();

        // Socket Connection for System Stats
        if (activeTab === 'settings') {
            const socketUrl = window.location.origin;

            const socket = io(socketUrl, {
                query: { token: localStorage.getItem('token') },
                transports: ['websocket', 'polling']
            });

            socket.emit('join_room', 'admin_stats');

            socket.on('SYSTEM_STATS', (stats) => {
                setSystemStats(stats);
            });

            return () => socket.disconnect();
        }
    }, [user, currentTitle, currentDateFormat, activeTab]);

    const fetchSettings = () => {
        setSiteTitle(currentTitle);
        setDateFormat(currentDateFormat || 'DD/MM/YYYY');

        // Fetch Retention
        fetch('/api/admin/settings/retention', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
            .then(res => res.json())
            .then(data => setRetentionDays(data.retentionDays))
            .catch(e => console.error(e));

        // Fetch SMTP
        fetch('/api/admin/settings/smtp', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
            .then(res => res.json())
            .then(data => setSmtpConfig(data))
            .catch(e => console.error(e));

        fetch('/api/admin/settings/storage', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
            .then(res => {
                if (res.ok) return res.json();
                return { userLimit: 10 * 1024 * 1024 * 1024, teamLimit: 25 * 1024 * 1024 * 1024 }; // Default fallback
            })
            .then(data => {
                setGlobalUserLimit(Math.round(Number(data.userLimit) / (1024 * 1024 * 1024)));
                setGlobalTeamLimit(Math.round(Number(data.teamLimit) / (1024 * 1024 * 1024)));
            })
            .catch(() => { });

        // Fetch System Settings (Public URL, FBX Conversion)
        fetch('/api/admin/system/settings', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
            .then(res => res.json())
            .then(data => {
                if (data.public_url) setPublicUrl(data.public_url);
                // FBX conversion defaults to true if not set
                setFbxServerConversion(data.fbx_server_conversion !== 'false');
                setEnable3dGif(data.enable_3d_gif !== 'false');
                setDigestVideoEnabled(data.digest_video_enabled !== 'false');

                // Digest Video Settings
                if (data.digest_fps_max) setDigestFpsMax(parseInt(data.digest_fps_max));
                if (data.digest_fps_default) setDigestFpsDefault(parseInt(data.digest_fps_default));
                if (data.digest_transition_max) setDigestTransitionMax(parseFloat(data.digest_transition_max));
                if (data.digest_transition_default) setDigestTransitionDefault(parseFloat(data.digest_transition_default));
                if (data.digest_pause_max) setDigestPauseMax(parseFloat(data.digest_pause_max));
                if (data.digest_pause_default) setDigestPauseDefault(parseFloat(data.digest_pause_default));
                if (data.digest_width) setDigestWidth(parseInt(data.digest_width));
                if (data.digest_height) setDigestHeight(parseInt(data.digest_height));

                // Fetch Announcement Config
                if (window.announcementConfig) {
                    // If we already have it from context or props? No, fetch fresh from config endpoint
                }
            })
            .catch(() => { });

        // Fetch Global Config (including announcement)
        fetch('/api/system/config')
            .then(res => res.json())
            .then(data => {
                if (data.announcement) {
                    setAnnouncementMsg(data.announcement.message || '');
                    setAnnouncementTitle(data.announcement.title || '');
                    setAnnouncementType(data.announcement.type || 'popup');
                    setAnnouncementIcon(data.announcement.icon || 'Sparkles');
                    setAnnouncementStart(data.announcement.startAt || '');
                    setAnnouncementEnd(data.announcement.endAt || '');
                    setAnnouncementActive(data.announcement.isActive || false);
                }
            })
            .catch(err => console.error("Error fetching announcement config", err));
    };

    const fetchUsers = () => {
        fetch('/api/admin/users', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
            .then(res => res.json())
            .then(data => setUsers(data));
    };

    const fetchTeams = () => {
        fetch('/api/admin/teams', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
            .then(res => res.json())
            .then(data => setTeams(data));
    };

    const handleUpdateSettings = async (e) => {
        e.preventDefault();
        setSettingsLoading(true);
        try {
            // Update Basic Settings
            await fetch('/api/admin/settings', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ title: siteTitle, dateFormat, retentionDays })
            });

            // Update System Settings (Public URL, FBX Conversion)
            await fetch('/api/admin/system/settings', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    public_url: publicUrl,
                    fbx_server_conversion: fbxServerConversion ? 'true' : 'false',
                    enable_3d_gif: enable3dGif ? 'true' : 'false',
                    digest_video_enabled: digestVideoEnabled ? 'true' : 'false',
                    // Digest Video Settings
                    digest_fps_max: String(digestFpsMax),
                    digest_fps_default: String(digestFpsDefault),
                    digest_transition_max: String(digestTransitionMax),
                    digest_transition_default: String(digestTransitionDefault),
                    digest_pause_max: String(digestPauseMax),
                    digest_pause_default: String(digestPauseDefault),
                    digest_width: String(digestWidth),
                    digest_height: String(digestHeight)
                })
            });

            // Update Storage Settings (Bytes)
            await fetch('/api/admin/settings/storage', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    userLimit: globalUserLimit * 1024 * 1024 * 1024,
                    teamLimit: globalTeamLimit * 1024 * 1024 * 1024
                })
            });

            toast.success("Settings updated");
            refreshConfig();
        } catch (e) {
            toast.error("Failed to update settings");
        } finally {
            setSettingsLoading(false);
        }
    };

    const handlePresetChange = (e) => {
        const preset = SMTP_PRESETS[e.target.value];
        if (preset) {
            setSmtpConfig(prev => ({
                ...prev,
                smtp_host: preset.host,
                smtp_port: preset.port,
                smtp_secure: preset.secure ? 'true' : 'false'
            }));
        }
    };

    const handleUpdateSmtp = async (e) => {
        e.preventDefault();
        setSmtpLoading(true);
        try {
            const res = await fetch('/api/admin/settings/smtp', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(smtpConfig)
            });
            if (res.ok) toast.success("SMTP Settings updated");
            else toast.error("Failed to update SMTP settings");
        } catch (e) {
            toast.error("Error updating settings");
        } finally {
            setSmtpLoading(false);
        }
    };

    const handleTestEmail = async () => {
        setTestEmailLoading(true);
        try {
            const res = await fetch('/api/admin/mail/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ email: user.email, type: testEmailType })
            });
            const data = await res.json();
            if (res.ok) toast.success(data.message);
            else toast.error("Failed to send test email: " + (data.error || 'Unknown error'));
        } catch (e) { toast.error("Error sending test email"); }
        finally { setTestEmailLoading(false); }
    };

    const handleIconUpload = async (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setUploadingIcon(true);
            const formData = new FormData();
            formData.append('icon', file);
            try {
                const res = await fetch('/api/admin/settings/icon', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                    body: formData
                });
                if (res.ok) { toast.success("Icon updated"); refreshConfig(); }
            } catch (e) { toast.error("Failed to upload icon"); }
            finally { setUploadingIcon(false); }
        }
    };

    const handleSoundUpload = async (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setUploadingSound(true);
            const formData = new FormData();
            formData.append('sound', file);
            try {
                const res = await fetch('/api/admin/settings/sound', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                    body: formData
                });
                if (res.ok) { toast.success("Sound updated"); refreshConfig(); }
                else toast.error("Failed to upload sound");
            } catch (e) { toast.error("Failed to upload sound"); }
            finally { setUploadingSound(false); }
        }
    };

    const handleRecalculateStorage = async () => {
        setConfirmDialog({
            isOpen: true,
            title: "Recalculate Storage",
            message: "This will recalculate storage usage for all users and teams. It may take some time.",
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                setRecalcLoading(true);
                try {
                    const res = await fetch('/api/admin/storage/recalculate', {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                    });
                    if (res.ok) {
                        toast.success("Storage recalculation started.");
                        if (activeTab === 'users') fetchUsers();
                        if (activeTab === 'teams') fetchTeams();
                    } else {
                        toast.error("Failed to start recalculation");
                    }
                } catch (e) {
                    toast.error("Error starting recalculation");
                } finally {
                    setRecalcLoading(false);
                }
            }
        });
    };

    const handleGenerateInvite = async (e) => {
        e.preventDefault();
        setInviteLoading(true);
        try {
            const res = await fetch('/api/invites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ email: inviteEmail || undefined })
            });
            const data = await res.json();
            const link = `${window.location.origin}/register?token=${data.token}`;
            setInviteLink(link);
        } catch (err) { toast.error('Failed to generate invite'); }
        finally { setInviteLoading(false); }
    };

    const handleBulkInvite = async (e) => {
        e.preventDefault();
        setBulkLoading(true);
        setBulkResults('');

        try {
            // Parse emails from textarea (one per line or comma-separated)
            const emailList = bulkEmails
                .split(/[\n,]/)
                .map(e => e.trim())
                .filter(e => e.length > 0 && e.includes('@'));

            if (emailList.length === 0) {
                toast.error('No valid emails found');
                setBulkLoading(false);
                return;
            }

            const res = await fetch('/api/invites/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ emails: emailList })
            });

            const data = await res.json();

            if (!res.ok) {
                toast.error(data.error || 'Failed to generate bulk invites');
                setBulkLoading(false);
                return;
            }

            // Format results as requested
            const formattedResults = data.invites.map(inv =>
                `${inv.email}\n${window.location.origin}/register?token=${inv.token}\n--------------------`
            ).join('\n');

            setBulkResults(formattedResults);
            toast.success(`Generated ${data.count} invite links`);
        } catch (err) {
            toast.error('Failed to generate bulk invites');
        } finally {
            setBulkLoading(false);
        }
    };

    const handleSaveAnnouncement = async (e) => {
        e.preventDefault();
        setAnnouncementSaving(true);
        try {
            const payload = {
                message: announcementMsg,
                title: announcementTitle,
                type: announcementType,
                icon: announcementIcon,
                startAt: announcementStart,
                endAt: announcementEnd,
                isActive: announcementActive
            };

            const res = await fetch('/api/admin/settings/announcement', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                toast.success("Announcement updated");
                refreshConfig();
            } else {
                toast.error("Failed to update announcement");
            }
        } catch (error) {
            toast.error("Error updating announcement");
        } finally {
            setAnnouncementSaving(false);
        }
    };

    const handleSendBroadcast = async (e) => {
        e.preventDefault();
        setConfirmDialog({
            isOpen: true,
            title: "Send Announcement",
            message: "Are you sure you want to send this email to ALL users?",
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                setAnnouncementLoading(true);
                try {
                    const res = await fetch('/api/admin/mail/broadcast', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
                        body: JSON.stringify(broadcast)
                    });
                    const data = await res.json();
                    if (res.ok) {
                        toast.success(`Broadcast sent! Success: ${data.stats.sent}, Failed: ${data.stats.failed}`);
                        setBroadcast({ subject: '', message: '' });
                    } else { toast.error("Failed to send broadcast"); }
                } catch (e) { toast.error("Error sending broadcast"); }
                finally { setBroadcastLoading(false); }
            }
        });
    };

    // User Management Handlers
    const handleDeleteUser = (id) => {
        setConfirmDialog({
            isOpen: true,
            title: "Delete User",
            message: "Are you sure you want to delete this user?",
            isDestructive: true,
            onConfirm: () => {
                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                fetch(`/api/admin/users/${id}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                }).then(res => { if (res.ok) fetchUsers(); else toast.error('Failed to delete user'); });
            }
        });
    };

    const handleUpdateUser = async (e) => {
        e.preventDefault();
        const { id, name, email, role, password, storageLimitGB } = editingUser;

        const storageLimit = (storageLimitGB === '' || storageLimitGB === null) ? null : BigInt(storageLimitGB * 1024 * 1024 * 1024).toString();

        try {
            const res = await fetch(`/api/admin/users/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ name, email, role, password: password || undefined, storageLimit })
            });
            if (res.ok) { setEditingUser(null); fetchUsers(); }
            else { const data = await res.json(); toast.error(data.error || 'Failed to update user'); }
        } catch (err) { toast.error('Error updating user'); }
    };

    // Team Management Handlers
    const handleUpdateTeam = async (e) => {
        e.preventDefault();
        const { id, storageLimitGB } = editingTeam;
        const storageLimit = (storageLimitGB === '' || storageLimitGB === null) ? null : BigInt(storageLimitGB * 1024 * 1024 * 1024).toString();

        try {
            const res = await fetch(`/api/admin/teams/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ storageLimit })
            });
            if (res.ok) { setEditingTeam(null); fetchTeams(); }
            else { const data = await res.json(); toast.error(data.error || 'Failed to update team'); }
        } catch (err) { toast.error('Error updating team'); }
    };

    // Utilities
    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                title={confirmDialog.title}
                message={confirmDialog.message}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                isDestructive={confirmDialog.isDestructive}
            />
            <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

            {/* Tabs */}
            <div className="flex border-b border-border mb-8 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('settings')}
                    className={clsx("px-6 py-3 font-medium text-sm transition-colors border-b-2 whitespace-nowrap", activeTab === 'settings' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
                >
                    System Settings
                </button>
                <button
                    onClick={() => setActiveTab('users')}
                    className={clsx("px-6 py-3 font-medium text-sm transition-colors border-b-2 whitespace-nowrap", activeTab === 'users' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
                >
                    Users & Quotas
                </button>
                <button
                    onClick={() => setActiveTab('teams')}
                    className={clsx("px-6 py-3 font-medium text-sm transition-colors border-b-2 whitespace-nowrap", activeTab === 'teams' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
                >
                    Teams & Quotas
                </button>
            </div>

            {/* Settings Tab */}
            {activeTab === 'settings' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="lg:col-span-2 bg-card border border-border rounded-lg p-6">
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <Activity size={20} /> System Health (Live)
                        </h2>
                        {systemStats ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="p-4 bg-muted/30 rounded border border-border">
                                    <div className="text-sm font-medium text-muted-foreground mb-2">CPU Load</div>
                                    <div className="text-2xl font-bold">{systemStats.cpu}%</div>
                                    <div className="h-2 w-full bg-muted mt-2 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${systemStats.cpu}%` }} />
                                    </div>
                                </div>
                                <div className="p-4 bg-muted/30 rounded border border-border">
                                    <div className="text-sm font-medium text-muted-foreground mb-2">RAM Usage</div>
                                    <div className="text-2xl font-bold">{systemStats.ram}%</div>
                                    <div className="text-xs text-muted-foreground">{systemStats.ramUsed} / {systemStats.ramTotal}</div>
                                    <div className="h-2 w-full bg-muted mt-2 rounded-full overflow-hidden">
                                        <div className="h-full bg-purple-500 transition-all duration-500" style={{ width: `${systemStats.ram}%` }} />
                                    </div>
                                </div>
                                <div className="p-4 bg-muted/30 rounded border border-border">
                                    <div className="text-sm font-medium text-muted-foreground mb-2">Global Storage (App)</div>
                                    <div className="text-2xl font-bold">{systemStats.storage}</div>
                                    <div className="text-xs text-muted-foreground">Total Quota Consumed</div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-muted-foreground text-center py-4">Connecting to system stats...</div>
                        )}
                    </div>

                    {/* General Settings */}
                    <div className="bg-card border border-border rounded-lg p-6">
                        <h2 className="text-xl font-semibold mb-4">General Configuration</h2>
                        <form onSubmit={handleUpdateSettings} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Site Title</label>
                                <input type="text" className="w-full bg-background border border-border rounded p-2" value={siteTitle} onChange={e => setSiteTitle(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Date Format</label>
                                <select className="w-full bg-background border border-border rounded p-2" value={dateFormat} onChange={e => setDateFormat(e.target.value)}>
                                    <option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2023)</option>
                                    <option value="MM/DD/YYYY">MM/DD/YYYY (12/31/2023)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Trash Retention (Days)</label>
                                <input type="number" min="0" className="w-full bg-background border border-border rounded p-2" value={retentionDays} onChange={e => setRetentionDays(e.target.value)} />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1 flex items-center gap-2">
                                    Public System URL
                                    <span className="text-muted-foreground text-xs font-normal" title="Used for Discord Notifications and Email links.">
                                        (i)
                                    </span>
                                </label>
                                <input
                                    type="url"
                                    className="w-full bg-background border border-border rounded p-2"
                                    placeholder="https://review.yourdomain.com"
                                    value={publicUrl}
                                    onChange={e => setPublicUrl(e.target.value)}
                                />
                            </div>

                            <div className="pt-4 border-t border-border mt-4">
                                <h3 className="text-md font-semibold mb-2 flex items-center justify-between">
                                    Global Storage Defaults
                                    <button
                                        type="button"
                                        onClick={handleRecalculateStorage}
                                        disabled={recalcLoading}
                                        className="text-xs bg-muted hover:bg-muted/80 px-2 py-1 rounded flex items-center gap-1 font-normal"
                                        title="Recalculate storage usage for all users"
                                    >
                                        <RefreshCw size={12} className={recalcLoading ? "animate-spin" : ""} />
                                        Recalculate Usage
                                    </button>
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">User Limit (GB)</label>
                                        <input type="number" min="0" className="w-full bg-background border border-border rounded p-2" value={globalUserLimit} onChange={e => setGlobalUserLimit(e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Team Limit (GB)</label>
                                        <input type="number" min="0" className="w-full bg-background border border-border rounded p-2" value={globalTeamLimit} onChange={e => setGlobalTeamLimit(e.target.value)} />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-border mt-4">
                                <h3 className="text-md font-semibold mb-2">3D Assets Configuration</h3>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        id="fbx_server_conversion"
                                        checked={fbxServerConversion}
                                        onChange={e => setFbxServerConversion(e.target.checked)}
                                        className="w-4 h-4 rounded border-border"
                                    />
                                    <label htmlFor="fbx_server_conversion" className="text-sm">
                                        <span className="font-medium">FBX Server Conversion</span>
                                        <span className="text-muted-foreground ml-2">— Automatically convert FBX files to GLB format on upload (requires fbx2gltf)</span>
                                    </label>
                                </div>
                                <div className="flex items-center gap-3 mt-3">
                                    <input
                                        type="checkbox"
                                        id="enable_3d_gif"
                                        checked={enable3dGif}
                                        onChange={e => setEnable3dGif(e.target.checked)}
                                        className="w-4 h-4 rounded border-border"
                                    />
                                    <label htmlFor="enable_3d_gif" className="text-sm">
                                        <span className="font-medium">3D GIF Turnaround</span>
                                        <span className="text-muted-foreground ml-2">— Automatically generate animated GIF turnarounds for 3D Uploads (CPU Intensive)</span>
                                    </label>
                                </div>
                                <div className="flex items-center gap-3 mt-3">
                                    <input
                                        type="checkbox"
                                        id="digest_video_enabled"
                                        checked={digestVideoEnabled}
                                        onChange={e => setDigestVideoEnabled(e.target.checked)}
                                        className="w-4 h-4 rounded border-border"
                                    />
                                    <label htmlFor="digest_video_enabled" className="text-sm">
                                        <span className="font-medium">Discord Digest Video</span>
                                        <span className="text-muted-foreground ml-2">— Generate WebM video digest for Discord notifications (CPU Intensive)</span>
                                    </label>
                                </div>
                            </div>

                            {/* Digest Video Configuration */}
                            {digestVideoEnabled && (
                                <div className="pt-4 border-t border-border mt-4">
                                    <h3 className="text-md font-semibold mb-4 text-purple-600 dark:text-purple-400">Digest Video Settings</h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                        {/* FPS Settings */}
                                        <div className="space-y-4 p-4 bg-muted/20 rounded border border-border">
                                            <div className="flex items-center gap-2 mb-2 font-medium">
                                                <Activity size={16} /> Framerate (FPS)
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium mb-1 text-muted-foreground">Max Allowed (System)</label>
                                                <div className="flex items-center gap-4">
                                                    <input
                                                        type="range" min="1" max="60"
                                                        value={digestFpsMax}
                                                        onChange={e => setDigestFpsMax(parseInt(e.target.value))}
                                                        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                                                    />
                                                    <span className="text-sm font-mono w-12 text-right">{digestFpsMax} fps</span>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium mb-1 text-muted-foreground">Default Value</label>
                                                <div className="flex items-center gap-4">
                                                    <input
                                                        type="range" min="1" max={digestFpsMax}
                                                        value={Math.min(digestFpsDefault, digestFpsMax)}
                                                        onChange={e => setDigestFpsDefault(parseInt(e.target.value))}
                                                        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                                                    />
                                                    <span className="text-sm font-mono w-12 text-right">{Math.min(digestFpsDefault, digestFpsMax)} fps</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Transition Settings */}
                                        <div className="space-y-4 p-4 bg-muted/20 rounded border border-border">
                                            <div className="flex items-center gap-2 mb-2 font-medium">
                                                <RefreshCw size={16} /> Transition Duration
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium mb-1 text-muted-foreground">Max Allowed (Seconds)</label>
                                                <div className="flex items-center gap-4">
                                                    <input
                                                        type="range" min="0" max="10" step="0.5"
                                                        value={digestTransitionMax}
                                                        onChange={e => setDigestTransitionMax(parseFloat(e.target.value))}
                                                        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                                                    />
                                                    <span className="text-sm font-mono w-12 text-right">{digestTransitionMax}s</span>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium mb-1 text-muted-foreground">Default Value</label>
                                                <div className="flex items-center gap-4">
                                                    <input
                                                        type="range" min="0" max={digestTransitionMax} step="0.5"
                                                        value={Math.min(digestTransitionDefault, digestTransitionMax)}
                                                        onChange={e => setDigestTransitionDefault(parseFloat(e.target.value))}
                                                        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                                                    />
                                                    <span className="text-sm font-mono w-12 text-right">{Math.min(digestTransitionDefault, digestTransitionMax)}s</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Pause Settings */}
                                        <div className="space-y-4 p-4 bg-muted/20 rounded border border-border md:col-span-2">
                                            <div className="flex items-center gap-2 mb-2 font-medium">
                                                <Database size={16} /> Pause Duration (Static Frame)
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                <div>
                                                    <label className="block text-xs font-medium mb-1 text-muted-foreground">Max Allowed (Seconds)</label>
                                                    <div className="flex items-center gap-4">
                                                        <input
                                                            type="range" min="0" max="30" step="0.5"
                                                            value={digestPauseMax}
                                                            onChange={e => setDigestPauseMax(parseFloat(e.target.value))}
                                                            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                                                        />
                                                        <span className="text-sm font-mono w-12 text-right">{digestPauseMax}s</span>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium mb-1 text-muted-foreground">Default Value</label>
                                                    <div className="flex items-center gap-4">
                                                        <input
                                                            type="range" min="0" max={digestPauseMax} step="0.5"
                                                            value={Math.min(digestPauseDefault, digestPauseMax)}
                                                            onChange={e => setDigestPauseDefault(parseFloat(e.target.value))}
                                                            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                                                        />
                                                        <span className="text-sm font-mono w-12 text-right">{Math.min(digestPauseDefault, digestPauseMax)}s</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Resolution Settings */}
                                        <div className="space-y-4 p-4 bg-muted/20 rounded border border-border md:col-span-2">
                                            <div className="flex items-center gap-2 mb-2 font-medium">
                                                <Shield size={16} /> Video Resolution
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                <div>
                                                    <label className="block text-xs font-medium mb-1 text-muted-foreground">Width (pixels)</label>
                                                    <div className="flex items-center gap-4">
                                                        <input
                                                            type="number" min="320" max="3840" step="1"
                                                            value={digestWidth}
                                                            onChange={e => setDigestWidth(parseInt(e.target.value))}
                                                            className="w-full bg-background border border-border rounded p-2 text-sm font-mono"
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium mb-1 text-muted-foreground">Height (pixels)</label>
                                                    <div className="flex items-center gap-4">
                                                        <input
                                                            type="number" min="180" max="2160" step="1"
                                                            value={digestHeight}
                                                            onChange={e => setDigestHeight(parseInt(e.target.value))}
                                                            className="w-full bg-background border border-border rounded p-2 text-sm font-mono"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                            <p className="text-xs text-muted-foreground">Default: 1280x720 (720p). Lower resolutions improve performance on slower servers.</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="pt-2">
                                <button type="submit" disabled={settingsLoading} className="bg-primary text-primary-foreground px-4 py-2 rounded font-medium hover:bg-primary/90 w-full md:w-auto">
                                    {settingsLoading ? 'Saving...' : 'Save System Settings'}
                                </button>
                            </div>
                        </form>

                        <div className="mt-6 pt-6 border-t border-border space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Site Icon (Favicon)</label>
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <input type="file" onChange={handleIconUpload} className="hidden" id="icon-upload" accept="image/*" />
                                        <label htmlFor="icon-upload" className="cursor-pointer bg-muted hover:bg-muted/80 text-foreground px-4 py-2 rounded border border-border flex items-center gap-2 text-sm">
                                            {uploadingIcon ? 'Uploading...' : 'Upload New Icon'}
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Notification Sound (MP3)</label>
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <input type="file" onChange={handleSoundUpload} className="hidden" id="sound-upload" accept="audio/mpeg, audio/mp3" />
                                        <label htmlFor="sound-upload" className="cursor-pointer bg-muted hover:bg-muted/80 text-foreground px-4 py-2 rounded border border-border flex items-center gap-2 text-sm">
                                            {uploadingSound ? 'Uploading...' : 'Upload MP3 Sound'}
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SMTP Settings */}
                    <div className="bg-card border border-border rounded-lg p-6">
                        <h2 className="text-xl font-semibold mb-4">Email Configuration</h2>
                        <form onSubmit={handleUpdateSmtp} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium mb-1">Load Preset</label>
                                <select className="w-full bg-input border border-border rounded p-2" onChange={handlePresetChange} defaultValue="">
                                    <option value="">Select a provider...</option>
                                    <option value="ovh">OVH</option>
                                    <option value="gmail">Gmail</option>
                                    <option value="outlook">Outlook</option>
                                </select>
                            </div>
                            {['host', 'port', 'user', 'pass', 'from'].map(field => (
                                <div key={field} className={field === 'from' ? "md:col-span-2" : ""}>
                                    <label className="block text-sm font-medium mb-1 capitalize">{field === 'pass' ? 'Password' : field}</label>
                                    <input
                                        type={field === 'pass' ? 'password' : (field === 'port' ? 'number' : 'text')}
                                        className="w-full bg-input border border-border rounded p-2"
                                        value={smtpConfig[`smtp_${field}`]}
                                        onChange={e => setSmtpConfig({ ...smtpConfig, [`smtp_${field}`]: e.target.value })}
                                    />
                                </div>
                            ))}
                            <div className="md:col-span-2 flex items-center gap-2 pt-2">
                                <input type="checkbox" id="smtp_secure" checked={smtpConfig.smtp_secure === 'true'} onChange={e => setSmtpConfig({ ...smtpConfig, smtp_secure: e.target.checked ? 'true' : 'false' })} />
                                <label htmlFor="smtp_secure" className="text-sm">Secure (SSL/TLS)</label>
                            </div>
                            <div className="md:col-span-2 pt-2 flex gap-4 items-center flex-wrap">
                                <button type="submit" disabled={smtpLoading} className="bg-primary text-primary-foreground px-4 py-2 rounded font-medium hover:bg-primary/90">Save</button>

                                <div className="flex gap-2 items-center border-l border-border pl-4">
                                    <select
                                        className="bg-input border border-border rounded p-2 text-sm"
                                        value={testEmailType}
                                        onChange={e => setTestEmailType(e.target.value)}
                                    >
                                        <option value="SIMPLE">Ping Test (Simple)</option>
                                        <option value="COMMENT">New Comment</option>
                                        <option value="MENTION">Mention</option>
                                        <option value="PROJECT_CREATE">Project Created</option>
                                        <option value="VIDEO_VERSION">New Version</option>
                                        <option value="STATUS_CHANGE">Status Change</option>
                                        <option value="TEAM_ADD">Added to Team</option>
                                    </select>
                                    <button type="button" onClick={handleTestEmail} disabled={testEmailLoading} className="bg-secondary text-secondary-foreground px-4 py-2 rounded font-medium border border-border whitespace-nowrap">
                                        {testEmailLoading ? 'Sending...' : 'Send Test'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* Announcements & Invites Side-by-Side on large screens */}
                    <div className="bg-card border border-border rounded-lg p-6 lg:col-span-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Invite Generator */}
                            <div>
                                <h2 className="text-xl font-semibold mb-4">Generate Invite</h2>
                                <form onSubmit={handleGenerateInvite} className="space-y-4">
                                    <input type="email" className="w-full bg-background border border-border rounded p-2" placeholder="user@example.com (Optional)" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                                    <button type="submit" disabled={inviteLoading} className="w-full bg-primary text-primary-foreground py-2 rounded font-medium hover:bg-primary/90">
                                        {inviteLoading ? 'Generating...' : 'Generate Link'}
                                    </button>
                                </form>
                                {inviteLink && (
                                    <div className="mt-4 p-4 bg-muted/50 rounded border border-border">
                                        <div className="text-xs text-muted-foreground mb-1">Invite Link (Expires in 7 days):</div>
                                        <div className="font-mono text-sm break-all select-all bg-background p-2 rounded border border-border">{inviteLink}</div>
                                    </div>
                                )}

                                {/* Bulk Invite Section */}
                                <div className="mt-8 pt-6 border-t border-border">
                                    <h3 className="text-lg font-semibold mb-3 text-purple-600 dark:text-purple-400">Bulk Invites</h3>
                                    <form onSubmit={handleBulkInvite} className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1 text-muted-foreground">
                                                Paste emails (one per line or comma-separated)
                                            </label>
                                            <textarea
                                                className="w-full bg-background border border-border rounded p-2 h-32 font-mono text-sm"
                                                placeholder="example1@mail.com&#10;example2@mail.com&#10;example3@mail.com"
                                                value={bulkEmails}
                                                onChange={e => setBulkEmails(e.target.value)}
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={bulkLoading || !bulkEmails.trim()}
                                            className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white py-2 rounded font-medium transition-colors"
                                        >
                                            {bulkLoading ? 'Generating...' : 'Generate Bulk Invites'}
                                        </button>
                                    </form>
                                    {bulkResults && (
                                        <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded border border-purple-200 dark:border-purple-800">
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="text-xs font-medium text-purple-600 dark:text-purple-400">Generated Invite Links:</div>
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(bulkResults);
                                                        toast.success('Copied to clipboard');
                                                    }}
                                                    className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded"
                                                >
                                                    Copy All
                                                </button>
                                            </div>
                                            <pre className="font-mono text-xs whitespace-pre-wrap break-all select-all bg-background p-3 rounded border border-border max-h-60 overflow-y-auto">{bulkResults}</pre>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Global Announcement Setting */}
                            <div>
                                <h2 className="text-xl font-semibold mb-4 text-blue-600 dark:text-blue-400">Global Announcement</h2>
                                <div className="space-y-4 bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-100 dark:border-blue-900">
                                    <form onSubmit={handleSaveAnnouncement} className="space-y-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <input
                                                type="checkbox"
                                                id="announcement_active"
                                                checked={announcementActive}
                                                onChange={e => setAnnouncementActive(e.target.checked)}
                                                className="w-4 h-4"
                                            />
                                            <label htmlFor="announcement_active" className="font-medium cursor-pointer select-none">Enable Announcement</label>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Type</label>
                                                <select
                                                    className="w-full bg-background border border-border rounded p-2 text-sm"
                                                    value={announcementType}
                                                    onChange={e => setAnnouncementType(e.target.value)}
                                                >
                                                    <option value="popup">Popup (Modal)</option>
                                                    <option value="banner">Banner (Dashboard Top)</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Title</label>
                                                <input
                                                    type="text"
                                                    className="w-full bg-background border border-border rounded p-2 text-sm"
                                                    value={announcementTitle}
                                                    onChange={e => setAnnouncementTitle(e.target.value)}
                                                    placeholder="Announcement Title"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1">
                                                Icon (Lucide React Name)
                                                <a href="https://lucide.dev/icons" target="_blank" rel="noreferrer" className="text-xs text-blue-400 ml-2 hover:underline">Browse Icons</a>
                                            </label>
                                            <input
                                                type="text"
                                                className="w-full bg-background border border-border rounded p-2 text-sm"
                                                value={announcementIcon}
                                                onChange={e => setAnnouncementIcon(e.target.value)}
                                                placeholder="e.g. Sparkles, AlertTriangle, Info"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1">Message (Markdown Supported)</label>
                                            <textarea
                                                className="w-full bg-background border border-border rounded p-2 h-24 text-sm font-mono"
                                                value={announcementMsg}
                                                onChange={e => setAnnouncementMsg(e.target.value)}
                                                placeholder="Enter announcement text. Supports **bold**, *italic*, [links](url)..."
                                                required={announcementActive}
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Start Date (Optional)</label>
                                                <input
                                                    type="date"
                                                    className="w-full bg-background border border-border rounded p-2 text-sm"
                                                    value={announcementStart}
                                                    onChange={e => setAnnouncementStart(e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">End Date (Optional)</label>
                                                <input
                                                    type="date"
                                                    className="w-full bg-background border border-border rounded p-2 text-sm"
                                                    value={announcementEnd}
                                                    onChange={e => setAnnouncementEnd(e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={announcementSaving}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-medium transition-colors text-sm"
                                        >
                                            {announcementSaving ? 'Saving...' : 'Update Announcement'}
                                        </button>
                                    </form>

                                    {/* Live Preview */}
                                    <div className="mt-6 pt-6 border-t border-blue-200 dark:border-blue-800">
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Live Preview (Approximation)</h3>

                                        {announcementType === 'banner' ? (
                                            <div className="w-full bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-white/10 relative overflow-hidden rounded-lg">
                                                <div className="p-6 relative flex flex-col items-center text-center">
                                                    {/* Background Effect - Simplified for Preview */}
                                                    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                                                        {/* Icon placeholder since we can't easily dynamically render string-name icon in this file without advanced logic, 
                                                            but we can show what it IS. Actually, we can if we import all * as Icons but that's heavy. 
                                                            We'll just show text or fixed icon. */}
                                                        <Activity size={100} />
                                                    </div>

                                                    <div className="relative z-0 w-full max-w-3xl mx-auto">
                                                        {announcementTitle && (
                                                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold tracking-widest uppercase mb-3">
                                                                {announcementTitle}
                                                            </div>
                                                        )}
                                                        <div className="text-zinc-300 leading-relaxed font-medium text-sm prose prose-invert max-w-none">
                                                            {/* Simple preview without full markdown rendering to avoid heavy deps in this file if not present */}
                                                            {announcementMsg}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-black/50 p-4 rounded-lg flex items-center justify-center">
                                                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-sm overflow-hidden border border-gray-200 dark:border-gray-700">
                                                    <div className="flex justify-between items-center p-3 border-b border-gray-200 dark:border-gray-700">
                                                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Announcement</h3>
                                                        <X size={16} className="text-gray-500" />
                                                    </div>
                                                    <div className="p-4">
                                                        {announcementTitle && <h4 className="font-bold mb-2 text-sm">{announcementTitle}</h4>}
                                                        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap text-xs">
                                                            {announcementMsg || "Your message here..."}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Email Broadcast */}
                            <div>
                                <h2 className="text-xl font-semibold mb-4">Email Broadcast</h2>
                                <form onSubmit={handleSendBroadcast} className="space-y-4">
                                    <input type="text" className="w-full bg-input border border-border rounded p-2" value={broadcast.subject} onChange={e => setBroadcast({ ...broadcast, subject: e.target.value })} placeholder="Subject" required />
                                    <textarea className="w-full bg-input border border-border rounded p-2 h-24" value={broadcast.message} onChange={e => setBroadcast({ ...broadcast, message: e.target.value })} placeholder="Message to email all users..." required />
                                    <button type="submit" disabled={broadcastLoading} className="bg-primary text-primary-foreground px-4 py-2 rounded font-medium w-full">Send Email to All</button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
                <div className="bg-card border border-border rounded-lg overflow-hidden animate-in fade-in duration-300">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-muted text-muted-foreground border-b border-border">
                                <tr>
                                    <th className="p-4 font-medium">User</th>
                                    <th className="p-4 font-medium">Role</th>
                                    <th className="p-4 font-medium">Storage Usage</th>
                                    <th className="p-4 font-medium">Teams</th>
                                    <th className="p-4 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {users.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase())).map(u => {
                                    const limit = u.storageLimit ? Number(u.storageLimit) : globalUserLimit * 1024 * 1024 * 1024;
                                    const usage = u.storageUsed ? Number(u.storageUsed) : 0;
                                    const percent = Math.min(100, (usage / limit) * 100);

                                    return (
                                        <tr key={u.id} className="hover:bg-muted/20">
                                            <td className="p-4">
                                                <div className="font-medium">{u.name}</div>
                                                <div className="text-muted-foreground text-xs">{u.email}</div>
                                            </td>
                                            <td className="p-4 capitalize">
                                                <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium", u.role === 'admin' ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                                                    {u.role}
                                                </span>
                                            </td>
                                            <td className="p-4 w-48">
                                                <div className="text-xs mb-1 flex justify-between">
                                                    <span>{formatBytes(usage)}</span>
                                                    <span className="text-muted-foreground">/ {formatBytes(limit)}</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                                    <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
                                                </div>
                                            </td>
                                            <td className="p-4 text-xs text-muted-foreground max-w-xs truncate">
                                                {[...(u.teams || []), ...(u.ownedTeams || [])].map(t => t.name).join(', ') || '-'}
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => setEditingUser({ ...u, password: '', storageLimitGB: u.storageLimit ? Math.round(Number(u.storageLimit) / (1024 * 1024 * 1024)) : '' })}
                                                        className="p-2 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                    {u.id !== user.id && (
                                                        <button onClick={() => handleDeleteUser(u.id)} className="p-2 hover:bg-destructive/10 rounded text-destructive hover:text-destructive/80">
                                                            <X size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Teams Tab */}
            {activeTab === 'teams' && (
                <div className="bg-card border border-border rounded-lg overflow-hidden animate-in fade-in duration-300">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-muted text-muted-foreground border-b border-border">
                                <tr>
                                    <th className="p-4 font-medium">Team Name</th>
                                    <th className="p-4 font-medium">Owner</th>
                                    <th className="p-4 font-medium">Members</th>
                                    <th className="p-4 font-medium">Storage Usage</th>
                                    <th className="p-4 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {teams.map(t => {
                                    const limit = t.storageLimit ? Number(t.storageLimit) : globalTeamLimit * 1024 * 1024 * 1024;
                                    const usage = t.storageUsed ? Number(t.storageUsed) : 0;
                                    const percent = Math.min(100, (usage / limit) * 100);

                                    return (
                                        <tr key={t.id} className="hover:bg-muted/20">
                                            <td className="p-4 font-medium">{t.name}</td>
                                            <td className="p-4 text-xs">
                                                {t.owner?.name}
                                                <div className="text-muted-foreground">{t.owner?.email}</div>
                                            </td>
                                            <td className="p-4">{t._count?.members || 0}</td>
                                            <td className="p-4 w-48">
                                                <div className="text-xs mb-1 flex justify-between">
                                                    <span>{formatBytes(usage)}</span>
                                                    <span className="text-muted-foreground">/ {formatBytes(limit)}</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                                    <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
                                                </div>
                                            </td>
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => setEditingTeam({ ...t, storageLimitGB: t.storageLimit ? Math.round(Number(t.storageLimit) / (1024 * 1024 * 1024)) : '' })}
                                                    className="p-2 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Edit User Modal */}
            {editingUser && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-background rounded-lg shadow-xl w-full max-w-md border border-border">
                        <div className="p-4 border-b border-border flex justify-between items-center">
                            <h3 className="font-bold text-lg">Edit User</h3>
                            <button onClick={() => setEditingUser(null)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleUpdateUser} className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Name</label>
                                <input type="text" className="w-full bg-input border border-border rounded p-2" value={editingUser.name} onChange={e => setEditingUser({ ...editingUser, name: e.target.value })} required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Email</label>
                                <input type="email" className="w-full bg-input border border-border rounded p-2" value={editingUser.email} onChange={e => setEditingUser({ ...editingUser, email: e.target.value })} required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Role</label>
                                    <select className="w-full bg-input border border-border rounded p-2" value={editingUser.role} onChange={e => setEditingUser({ ...editingUser, role: e.target.value })}>
                                        <option value="user">User</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Storage Limit (GB)</label>
                                    <input type="number" min="0" className="w-full bg-input border border-border rounded p-2" placeholder={`Default: ${globalUserLimit}`} value={editingUser.storageLimitGB} onChange={e => setEditingUser({ ...editingUser, storageLimitGB: e.target.value })} />
                                    <p className="text-[10px] text-muted-foreground mt-1">Leave blank for default</p>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">New Password</label>
                                <input type="password" className="w-full bg-input border border-border rounded p-2" placeholder="Leave blank to keep current" value={editingUser.password} onChange={e => setEditingUser({ ...editingUser, password: e.target.value })} />
                            </div>
                            <div className="pt-4 flex justify-end gap-2">
                                <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 rounded hover:bg-muted">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Team Modal */}
            {editingTeam && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-background rounded-lg shadow-xl w-full max-w-md border border-border">
                        <div className="p-4 border-b border-border flex justify-between items-center">
                            <h3 className="font-bold text-lg">Edit Team: {editingTeam.name}</h3>
                            <button onClick={() => setEditingTeam(null)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleUpdateTeam} className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Storage Limit (GB)</label>
                                <input type="number" min="0" className="w-full bg-input border border-border rounded p-2" placeholder={`Default: ${globalTeamLimit}`} value={editingTeam.storageLimitGB} onChange={e => setEditingTeam({ ...editingTeam, storageLimitGB: e.target.value })} />
                                <p className="text-[10px] text-muted-foreground mt-1">Leave blank for default</p>
                            </div>
                            <div className="pt-4 flex justify-end gap-2">
                                <button type="button" onClick={() => setEditingTeam(null)} className="px-4 py-2 rounded hover:bg-muted">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
