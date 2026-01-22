import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { ChevronLeft, Plus, X, Shield, Hash, Webhook, Edit2, Send, Video, Image as ImageIcon, Check } from 'lucide-react';
import ConfirmDialog from '../../components/ConfirmDialog';

const TeamRoles = () => {
    const { activeTeam } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [teamRoles, setTeamRoles] = useState([]);
    const [teamMembers, setTeamMembers] = useState([]);

    // Create Role Form
    const [newRoleName, setNewRoleName] = useState('');
    const [newRoleColor, setNewRoleColor] = useState('#3b82f6');
    const [showCreateForm, setShowCreateForm] = useState(false);

    // Discord Channels State
    const [discordChannels, setDiscordChannels] = useState([]);
    const [showChannelForm, setShowChannelForm] = useState(false);
    const [editingChannel, setEditingChannel] = useState(null);
    const [channelForm, setChannelForm] = useState({
        name: '',
        webhookUrl: '',
        botName: '',
        botAvatar: '',
        notificationMode: 'VIDEO',
        timing: '',
        teamRoleIds: []
    });
    const [testingChannelId, setTestingChannelId] = useState(null);

    // Confirmation Dialog
    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        isDestructive: false
    });

    // Permission check
    const [canManage, setCanManage] = useState(false);

    const fetchRoles = useCallback(async () => {
        if (!activeTeam) return;
        try {
            const res = await fetch(`/api/teams/${activeTeam.id}/roles`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (Array.isArray(data)) setTeamRoles(data);
        } catch (err) {
            console.error('Failed to fetch roles:', err);
        }
    }, [activeTeam]);

    const fetchDiscordChannels = useCallback(async () => {
        if (!activeTeam) return;
        try {
            const res = await fetch(`/api/teams/${activeTeam.id}/discord-channels`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                const data = await res.json();
                setDiscordChannels(data);
            }
        } catch (err) {
            console.error('Failed to fetch Discord channels:', err);
        }
    }, [activeTeam]);

    const fetchTeamDetails = useCallback(async () => {
        if (!activeTeam) return;
        try {
            const res = await fetch('/api/teams', {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            let teamsArray = Array.isArray(data) ? data : (data?.team ? [data.team] : []);
            const current = teamsArray.find(t => t.id === activeTeam.id);
            if (current) {
                setTeamMembers(current.members || []);
                const myRole = current.myRole || (current.isOwner ? 'OWNER' : 'MEMBER');
                setCanManage(current.isOwner || myRole === 'ADMIN' || myRole === 'OWNER');
            }
        } catch (err) {
            console.error('Failed to fetch team details:', err);
        } finally {
            setLoading(false);
        }
    }, [activeTeam]);

    useEffect(() => {
        if (activeTeam) {
            fetchRoles();
            fetchTeamDetails();
            fetchDiscordChannels();
        }
    }, [activeTeam, fetchRoles, fetchTeamDetails, fetchDiscordChannels]);

    const createRole = async (e) => {
        e.preventDefault();
        if (!activeTeam || !newRoleName.trim()) return;
        try {
            const res = await fetch(`/api/teams/${activeTeam.id}/roles`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ name: newRoleName.trim(), color: newRoleColor })
            });
            if (res.ok) {
                toast.success('Role created');
                setNewRoleName('');
                setNewRoleColor('#3b82f6');
                setShowCreateForm(false);
                fetchRoles();
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to create role');
            }
        } catch (err) {
            console.error(err);
            toast.error('Failed to create role');
        }
    };

    const deleteRole = (roleId, roleName) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Delete Role',
            message: `Are you sure you want to delete the role "${roleName}"? This will remove it from all assigned users.`,
            isDestructive: true,
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                try {
                    const res = await fetch(`/api/teams/${activeTeam.id}/roles/${roleId}`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                    });
                    if (res.ok) {
                        toast.success('Role deleted');
                        fetchRoles();
                        fetchTeamDetails();
                    } else {
                        toast.error('Failed to delete role');
                    }
                } catch (err) {
                    console.error(err);
                    toast.error('Failed to delete role');
                }
            }
        });
    };

    const assignRole = async (userId, roleId) => {
        try {
            await fetch(`/api/teams/${activeTeam.id}/roles/${roleId}/assign`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ userId })
            });
            fetchTeamDetails();
            fetchRoles();
        } catch (err) {
            console.error(err);
        }
    };

    const removeRoleFromUser = async (userId, roleId) => {
        try {
            await fetch(`/api/teams/${activeTeam.id}/roles/${roleId}/remove`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ userId })
            });
            fetchTeamDetails();
            fetchRoles();
        } catch (err) {
            console.error(err);
        }
    };

    // Discord Channel Functions
    const resetChannelForm = () => {
        setChannelForm({
            name: '',
            webhookUrl: '',
            botName: '',
            botAvatar: '',
            notificationMode: 'VIDEO',
            timing: '',
            teamRoleIds: []
        });
        setEditingChannel(null);
        setShowChannelForm(false);
    };

    const openEditChannel = (channel) => {
        setChannelForm({
            name: channel.name,
            webhookUrl: channel.webhookUrl,
            botName: channel.botName || '',
            botAvatar: channel.botAvatar || '',
            notificationMode: channel.notificationMode || 'VIDEO',
            timing: channel.timing || '',
            teamRoleIds: channel.teamRoles?.map(r => r.id) || []
        });
        setEditingChannel(channel);
        setShowChannelForm(true);
    };

    const saveChannel = async (e) => {
        e.preventDefault();
        if (!channelForm.name || !channelForm.webhookUrl) {
            toast.error('Name and Webhook URL are required');
            return;
        }

        try {
            const url = editingChannel
                ? `/api/teams/${activeTeam.id}/discord-channels/${editingChannel.id}`
                : `/api/teams/${activeTeam.id}/discord-channels`;
            const method = editingChannel ? 'PATCH' : 'POST';

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(channelForm)
            });

            if (res.ok) {
                toast.success(editingChannel ? 'Channel updated' : 'Channel created');
                resetChannelForm();
                fetchDiscordChannels();
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to save channel');
            }
        } catch (err) {
            console.error(err);
            toast.error('Failed to save channel');
        }
    };

    const deleteChannel = (channelId, channelName) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Delete Discord Channel',
            message: `Are you sure you want to delete "${channelName}"?`,
            isDestructive: true,
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                try {
                    const res = await fetch(`/api/teams/${activeTeam.id}/discord-channels/${channelId}`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                    });
                    if (res.ok) {
                        toast.success('Channel deleted');
                        fetchDiscordChannels();
                    } else {
                        toast.error('Failed to delete channel');
                    }
                } catch (err) {
                    console.error(err);
                    toast.error('Failed to delete channel');
                }
            }
        });
    };

    const testChannel = async (channelId) => {
        setTestingChannelId(channelId);
        try {
            const res = await fetch(`/api/teams/${activeTeam.id}/discord-channels/${channelId}/test`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                toast.success('Test message sent!');
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to send test message');
            }
        } catch (err) {
            toast.error('Failed to send test message');
        } finally {
            setTestingChannelId(null);
        }
    };

    const toggleRoleInChannel = (roleId) => {
        setChannelForm(prev => ({
            ...prev,
            teamRoleIds: prev.teamRoleIds.includes(roleId)
                ? prev.teamRoleIds.filter(id => id !== roleId)
                : [...prev.teamRoleIds, roleId]
        }));
    };

    if (loading) return <div className="p-8">Loading...</div>;
    if (!activeTeam) return <div className="p-8">No team selected</div>;

    const getMembersWithRole = (roleId) => {
        return teamMembers.filter(m => m.teamRoles?.some(r => r.id === roleId));
    };

    return (
        <div className="p-8 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => navigate('/team')}
                    className="p-2 hover:bg-muted rounded-full transition-colors"
                >
                    <ChevronLeft size={24} />
                </button>
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Shield size={24} className="text-primary" />
                        Manage Roles & Channels
                    </h2>
                    <p className="text-muted-foreground">{activeTeam.name}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Roles List */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Team Roles</h3>
                        {canManage && (
                            <button
                                onClick={() => setShowCreateForm(true)}
                                className="bg-primary text-primary-foreground px-3 py-1.5 rounded text-sm flex items-center gap-2"
                            >
                                <Plus size={14} /> New Role
                            </button>
                        )}
                    </div>

                    {/* Create Form */}
                    {showCreateForm && canManage && (
                        <form onSubmit={createRole} className="bg-card border border-border rounded-lg p-4">
                            <div className="flex gap-3 items-end">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium mb-1">Role Name</label>
                                    <input
                                        type="text"
                                        className="w-full bg-background border border-input rounded p-2 text-sm"
                                        placeholder="e.g. Art Director, Animator..."
                                        value={newRoleName}
                                        onChange={e => setNewRoleName(e.target.value)}
                                        autoFocus
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Color</label>
                                    <input
                                        type="color"
                                        className="w-10 h-10 p-0 border-0 rounded cursor-pointer"
                                        value={newRoleColor}
                                        onChange={e => setNewRoleColor(e.target.value)}
                                    />
                                </div>
                                <button type="submit" className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm">
                                    Create
                                </button>
                                <button type="button" onClick={() => setShowCreateForm(false)} className="text-muted-foreground hover:text-foreground p-2">
                                    <X size={18} />
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Roles Grid */}
                    {teamRoles.length > 0 ? (
                        <div className="space-y-3">
                            {teamRoles.map(role => {
                                const members = getMembersWithRole(role.id);
                                return (
                                    <div key={role.id} className="bg-card border border-border rounded-lg p-4 hover:border-primary/30 transition-colors">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: role.color }} />
                                                <span className="font-semibold">{role.name}</span>
                                                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                                    {members.length} member{members.length !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                            {canManage && (
                                                <button onClick={() => deleteRole(role.id, role.name)} className="text-muted-foreground hover:text-red-500 p-1" title="Delete Role">
                                                    <X size={16} />
                                                </button>
                                            )}
                                        </div>
                                        {members.length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {members.map(member => (
                                                    <div key={member.id} className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-full text-xs">
                                                        <div className="w-4 h-4 rounded-full overflow-hidden bg-primary/20">
                                                            {member.avatarPath ? (
                                                                <img src={`/api/media/avatars/${member.avatarPath}`} alt="" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-[8px]">{member.name?.charAt(0) || 'U'}</div>
                                                            )}
                                                        </div>
                                                        <span>{member.name}</span>
                                                        {canManage && (
                                                            <button onClick={() => removeRoleFromUser(member.id, role.id)} className="text-muted-foreground hover:text-red-500 ml-1">
                                                                <X size={10} />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="bg-card border border-dashed border-border rounded-lg p-8 text-center text-muted-foreground">
                            <Hash size={32} className="mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No roles created yet</p>
                            {canManage && <p className="text-xs mt-1">Create roles to organize your team by department</p>}
                        </div>
                    )}

                    {/* Discord Channels Section */}
                    <div className="mt-8">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <Webhook size={18} className="text-[#5865F2]" />
                                Discord Channels
                            </h3>
                            {canManage && (
                                <button
                                    onClick={() => { resetChannelForm(); setShowChannelForm(true); }}
                                    className="bg-[#5865F2] text-white px-3 py-1.5 rounded text-sm flex items-center gap-2"
                                >
                                    <Plus size={14} /> New Channel
                                </button>
                            )}
                        </div>

                        {/* Channel Form */}
                        {showChannelForm && canManage && (
                            <form onSubmit={saveChannel} className="bg-card border border-border rounded-lg p-4 mb-4 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Channel Name *</label>
                                        <input
                                            type="text"
                                            className="w-full bg-background border border-input rounded p-2 text-sm"
                                            placeholder="e.g. Art Department"
                                            value={channelForm.name}
                                            onChange={e => setChannelForm(f => ({ ...f, name: e.target.value }))}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Webhook URL *</label>
                                        <input
                                            type="url"
                                            className="w-full bg-background border border-input rounded p-2 text-sm"
                                            placeholder="https://discord.com/api/webhooks/..."
                                            value={channelForm.webhookUrl}
                                            onChange={e => setChannelForm(f => ({ ...f, webhookUrl: e.target.value }))}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Bot Name (Optional)</label>
                                        <input
                                            type="text"
                                            className="w-full bg-background border border-input rounded p-2 text-sm"
                                            placeholder="Leave empty for team default"
                                            value={channelForm.botName}
                                            onChange={e => setChannelForm(f => ({ ...f, botName: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Notification Mode</label>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setChannelForm(f => ({ ...f, notificationMode: 'VIDEO' }))}
                                                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded border ${channelForm.notificationMode === 'VIDEO' ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-muted'}`}
                                            >
                                                <Video size={14} /> Video
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setChannelForm(f => ({ ...f, notificationMode: 'IMAGE' }))}
                                                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded border ${channelForm.notificationMode === 'IMAGE' ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-muted'}`}
                                            >
                                                <ImageIcon size={14} /> Image
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Role Selection */}
                                {teamRoles.length > 0 && (
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Filter by Roles (Optional)</label>
                                        <p className="text-xs text-muted-foreground mb-2">Only notify when projects include these roles. Leave empty for all.</p>
                                        <div className="flex flex-wrap gap-2">
                                            {teamRoles.map(role => (
                                                <button
                                                    key={role.id}
                                                    type="button"
                                                    onClick={() => toggleRoleInChannel(role.id)}
                                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border transition-all ${channelForm.teamRoleIds.includes(role.id) ? 'border-transparent text-white' : 'border-border hover:border-primary/30'}`}
                                                    style={channelForm.teamRoleIds.includes(role.id) ? { backgroundColor: role.color } : {}}
                                                >
                                                    {channelForm.teamRoleIds.includes(role.id) && <Check size={12} />}
                                                    {role.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                                    <button type="button" onClick={resetChannelForm} className="px-4 py-2 text-sm hover:bg-muted rounded">Cancel</button>
                                    <button type="submit" className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm">
                                        {editingChannel ? 'Update' : 'Create'} Channel
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Channels List */}
                        {discordChannels.length > 0 ? (
                            <div className="space-y-3">
                                {discordChannels.map(channel => (
                                    <div key={channel.id} className="bg-card border border-border rounded-lg p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-[#5865F2] flex items-center justify-center text-white">
                                                    <Webhook size={14} />
                                                </div>
                                                <div>
                                                    <div className="font-medium">{channel.name}</div>
                                                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                        {channel.notificationMode === 'IMAGE' ? <ImageIcon size={10} /> : <Video size={10} />}
                                                        {channel.notificationMode} mode
                                                        {channel.teamRoles?.length > 0 && (
                                                            <span className="ml-2">• {channel.teamRoles.length} role{channel.teamRoles.length > 1 ? 's' : ''}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            {canManage && (
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => testChannel(channel.id)}
                                                        disabled={testingChannelId === channel.id}
                                                        className="text-muted-foreground hover:text-primary p-2 rounded hover:bg-muted disabled:opacity-50"
                                                        title="Send Test Message"
                                                    >
                                                        <Send size={14} />
                                                    </button>
                                                    <button onClick={() => openEditChannel(channel)} className="text-muted-foreground hover:text-primary p-2 rounded hover:bg-muted" title="Edit">
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button onClick={() => deleteChannel(channel.id, channel.name)} className="text-muted-foreground hover:text-red-500 p-2 rounded hover:bg-muted" title="Delete">
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        {channel.teamRoles?.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-3">
                                                {channel.teamRoles.map(role => (
                                                    <span key={role.id} className="text-[10px] px-2 py-0.5 rounded text-white" style={{ backgroundColor: role.color }}>
                                                        {role.name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-card border border-dashed border-border rounded-lg p-6 text-center text-muted-foreground">
                                <Webhook size={24} className="mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No Discord channels configured</p>
                                <p className="text-xs mt-1">Create channels to route notifications by department</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Assign Panel */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Quick Assign</h3>
                    <div className="bg-card border border-border rounded-lg p-4">
                        {teamMembers.length > 0 ? (
                            <div className="space-y-3 max-h-[400px] overflow-y-auto">
                                {teamMembers.map(member => (
                                    <div key={member.id} className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full overflow-hidden bg-primary/20 shrink-0">
                                            {member.avatarPath ? (
                                                <img src={`/api/media/avatars/${member.avatarPath}`} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-sm font-bold text-primary">
                                                    {member.name?.charAt(0) || 'U'}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium truncate">{member.name}</div>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {member.teamRoles?.map(r => (
                                                    <span key={r.id} className="text-[10px] px-1.5 py-0.5 rounded text-white flex items-center gap-1" style={{ backgroundColor: r.color }}>
                                                        {r.name}
                                                        {canManage && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    removeRoleFromUser(member.id, r.id);
                                                                }}
                                                                className="hover:text-red-200 transition-colors"
                                                                title="Remove Role"
                                                            >
                                                                <X size={10} />
                                                            </button>
                                                        )}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        {canManage && teamRoles.length > 0 && (
                                            <select
                                                className="bg-background border border-input rounded p-1 text-xs"
                                                value=""
                                                onChange={e => {
                                                    if (e.target.value) {
                                                        assignRole(member.id, parseInt(e.target.value));
                                                        e.target.value = '';
                                                    }
                                                }}
                                            >
                                                <option value="">+ Add</option>
                                                {teamRoles.filter(r => !member.teamRoles?.some(mr => mr.id === r.id)).map(r => (
                                                    <option key={r.id} value={r.id}>{r.name}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">No team members yet</p>
                        )}
                    </div>
                </div>
            </div>

            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                title={confirmDialog.title}
                message={confirmDialog.message}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                isDestructive={confirmDialog.isDestructive}
            />
        </div>
    );
};

export default TeamRoles;

