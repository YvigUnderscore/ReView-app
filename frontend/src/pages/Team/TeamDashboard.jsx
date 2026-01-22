import React, { useState, useEffect, useCallback } from 'react';
import { Plus, UserPlus, Shield, X, Search, ChevronDown, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ConfirmDialog from '../../components/ConfirmDialog';
import { toast } from 'sonner';

const TeamDashboard = () => {
    const { activeTeam, switchTeam, checkStatus } = useAuth();
    const navigate = useNavigate();
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);

    const [activeRoleDropdownId, setActiveRoleDropdownId] = useState(null);

    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { }, isDestructive: false });

    // Forms
    const [newTeamName, setNewTeamName] = useState('');


    // Invite / Add Member State
    const [inviteRole, setInviteRole] = useState('MEMBER'); // Default to MEMBER
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    const fetchTeams = useCallback(() => {
        fetch('/api/teams', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
            .then(res => res.json())
            .then(data => {
                let teamsArray = [];
                if (Array.isArray(data)) {
                    teamsArray = data.map(t => ({
                        ...t,
                        // myRole is now coming from the backend as part of team object logic, or fallback
                        myRole: t.myRole || (t.isOwner ? 'OWNER' : 'MEMBER')
                    }));
                } else if (data && data.team) {
                    teamsArray = [{
                        ...data.team,
                        myRole: data.myRole || (data.isOwner ? 'OWNER' : 'MEMBER')
                    }];
                }
                setTeams(teamsArray);
                setLoading(false);
            })
            .catch((err) => {
                console.error("Failed to fetch teams:", err);
                setLoading(false);
                setTeams([]);
            });
    }, []);



    // Search Logic - Placeholder for spacing
    useEffect(() => {
        fetchTeams();
    }, [fetchTeams]);
    useEffect(() => {
        if (searchQuery.length < 2) {
            setSearchResults([]);
            return;
        }
        setIsSearching(true);
        const timer = setTimeout(() => {
            fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}&context=addMember`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            })
                .then(res => res.json())
                .then(data => {
                    // Filter out existing members
                    const currentMemberIds = teams.find(t => t.id === activeTeam.id)?.members?.map(m => m.id) || [];
                    const filtered = data.filter(u => !currentMemberIds.includes(u.id));
                    setSearchResults(filtered);
                })
                .catch(console.error)
                .finally(() => setIsSearching(false));
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, activeTeam, teams]);

    const createTeam = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/teams', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ name: newTeamName })
            });
            if (res.ok) {
                const newTeam = await res.json();
                setNewTeamName('');
                setShowCreateModal(false);
                await checkStatus();
                fetchTeams();
                switchTeam(newTeam.id);
            }
        } catch (err) { console.error(err); }
    };

    const addMemberDirectly = async (email) => {
        if (!activeTeam) return;
        try {
            const res = await fetch(`/api/teams/members`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ email, role: inviteRole, teamId: activeTeam.id })
            });
            if (res.ok) {
                toast.success('Member added successfully');
                setShowInviteModal(false);
                setSearchQuery('');
                fetchTeams();
            } else {
                const data = await res.json();
                toast.error(data.error);
            }
        } catch (err) { console.error(err); }
    };

    const changeMemberRole = async (userId, newRole) => {
        if (!activeTeam) return;
        try {
            const res = await fetch(`/api/teams/${activeTeam.id}/members/${userId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ role: newRole })
            });
            if (res.ok) {
                toast.success('Role updated');
                fetchTeams();
                setActiveRoleDropdownId(null);
            } else {
                const data = await res.json();
                toast.error(data.error);
            }
        } catch (err) { console.error(err); }
    };



    const createRole = async (e) => {
        e.preventDefault();
        if (!activeTeam) return;
        try {
            const res = await fetch(`/api/teams/${activeTeam.id}/roles`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ name: newRoleName, color: newRoleColor })
            });
            if (res.ok) {
                setNewRoleName('');
                setNewRoleColor('#3b82f6');
                setShowRoleModal(false);
                fetchRoles(activeTeam.id);
            }
        } catch (err) { console.error(err); }
    };

    const deleteRole = async (roleId) => {
        setConfirmDialog({
            isOpen: true,
            title: "Delete Role",
            message: "Are you sure you want to delete this role?",
            isDestructive: true,
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                try {
                    await fetch(`/api/teams/${activeTeam.id}/roles/${roleId}`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                    });
                    fetchRoles(activeTeam.id);
                    fetchTeams();
                } catch (err) { console.error(err); }
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
            fetchTeams();
        } catch (err) { console.error(err); }
    };

    const removeRole = async (userId, roleId) => {
        setConfirmDialog({
            isOpen: true,
            title: "Remove Role",
            message: "Remove role from user?",
            isDestructive: true,
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                try {
                    await fetch(`/api/teams/${activeTeam.id}/roles/${roleId}/remove`, {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        },
                        body: JSON.stringify({ userId })
                    });
                    fetchTeams();
                } catch (err) { console.error(err); }
            }
        });
    };

    if (loading) return <div>Loading...</div>;

    const currentTeam = teams.find(t => t.id === activeTeam?.id);
    const isOwner = currentTeam?.isOwner;
    const isAdmin = currentTeam?.myRole === 'ADMIN';

    return (
        <div className="p-8" onClick={() => {
            setActiveMemberMenuId(null);
            setActiveRoleDropdownId(null);
        }}>
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold">Teams</h2>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-primary text-primary-foreground px-4 py-2 rounded flex items-center gap-2 text-sm font-medium"
                >
                    <Plus size={16} /> Create Team
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Sidebar List */}
                <div className="bg-card border border-border rounded-lg overflow-hidden">
                    <div className="p-4 bg-muted/20 border-b border-border font-semibold">My Teams</div>
                    <div className="divide-y divide-border">
                        {teams.map(team => (
                            <div
                                key={team.id}
                                className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${activeTeam?.id === team.id ? 'bg-primary/5 border-l-2 border-primary' : ''}`}
                                onClick={() => switchTeam(team.id)}
                            >
                                <div className="font-medium">{team.name}</div>
                                <div className="text-xs text-muted-foreground mt-1 capitalize">{team.myRole}</div>
                            </div>
                        ))}
                        {teams.length === 0 && (
                            <div className="p-8 text-center text-muted-foreground text-sm">
                                You are not in any teams.
                            </div>
                        )}
                    </div>
                </div>

                {/* Details */}
                <div className="col-span-2 space-y-6">
                    {activeTeam ? (
                        <>
                            <div className="bg-card border border-border rounded-lg p-6">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h3 className="text-xl font-bold">{activeTeam.name}</h3>
                                        <p className="text-muted-foreground text-sm">Manage members and roles</p>
                                    </div>
                                    <div className="flex gap-2">
                                        {isOwner && (
                                            <button
                                                onClick={() => {
                                                    setConfirmDialog({
                                                        isOpen: true,
                                                        title: "Delete Team",
                                                        message: "Are you sure you want to delete this team? This action cannot be undone.",
                                                        isDestructive: true,
                                                        onConfirm: () => {
                                                            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                                                            fetch(`/api/teams/${activeTeam.id}`, {
                                                                method: 'DELETE',
                                                                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                                                            }).then(res => {
                                                                if (res.ok) {
                                                                    fetchTeams();
                                                                    switchTeam(null);
                                                                } else {
                                                                    res.json().then(d => alert(d.error || 'Failed to delete team'));
                                                                }
                                                            });
                                                        }
                                                    });
                                                }}
                                                className="border border-red-500/30 text-red-500 hover:bg-red-500/10 px-3 py-1.5 rounded text-sm flex items-center gap-2"
                                            >
                                                <X size={14} /> Delete Team
                                            </button>
                                        )}
                                        {(isOwner || isAdmin) && (
                                            <>
                                                <button
                                                    onClick={() => navigate('/team/roles')}
                                                    className="border border-border hover:bg-muted px-3 py-1.5 rounded text-sm flex items-center gap-2"
                                                >
                                                    <Shield size={14} /> Manage Roles
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setSearchQuery('');
                                                        setSearchResults([]);
                                                        setShowInviteModal(true);
                                                    }}
                                                    className="border border-border hover:bg-muted px-3 py-1.5 rounded text-sm flex items-center gap-2"
                                                >
                                                    <UserPlus size={14} /> Add Member
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {isOwner || isAdmin ? (
                                    <div className="bg-card border border-border rounded-lg mb-6 overflow-hidden">
                                        <button
                                            onClick={() => navigate('/team/settings')}
                                            className="w-full flex items-center justify-between p-4 bg-muted/20 hover:bg-muted/30 transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-semibold text-sm">Team Settings</h4>
                                                <span className="text-xs text-muted-foreground font-normal">(Timecode, Discord)</span>
                                            </div>
                                            <Settings size={16} />
                                        </button>
                                    </div>
                                ) : null}                               <div className="bg-card border border-border rounded-lg mt-6">
                                    <div className="p-4 bg-muted/20 border-b border-border font-semibold text-sm rounded-t-lg">Team Members</div>
                                    <div className="divide-y divide-border">
                                        {currentTeam?.members && currentTeam.members.length > 0 ? (
                                            currentTeam.members.map(member => (
                                                <div key={member.id} className="p-4 flex items-center justify-between hover:bg-muted/10 last:rounded-b-lg">
                                                    <div>
                                                        <div className="font-medium flex items-center gap-3">
                                                            {/* Avatar */}
                                                            <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
                                                                {member.avatarPath ? (
                                                                    <img src={`/api/media/avatars/${member.avatarPath}`} alt={member.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                                                                        {member.name?.charAt(0) || 'U'}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="flex flex-col">
                                                                <div className="flex items-center gap-2">
                                                                    {member.name || 'Unknown'}

                                                                </div>
                                                                {/* Roles List */}
                                                                <div className="flex flex-wrap gap-1 mt-1">
                                                                    {member.teamRoles && member.teamRoles.map(r => (
                                                                        <span key={r.id} className="text-[10px] px-1.5 py-0.5 rounded text-white flex items-center gap-1" style={{ backgroundColor: r.color }}>
                                                                            {r.name}
                                                                            {(isOwner || isAdmin) && (
                                                                                <button onClick={(e) => { e.stopPropagation(); removeRole(member.id, r.id); }} className="hover:opacity-80"><X size={8} /></button>
                                                                            )}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">

                                                        {/* Role Switcher */}
                                                        {(isOwner || (isAdmin && member.role !== 'ADMIN' && member.role !== 'OWNER')) ? (
                                                            <div className="relative">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setActiveRoleDropdownId(activeRoleDropdownId === member.id ? null : member.id);
                                                                        setActiveMemberMenuId(null);
                                                                    }}
                                                                    className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 hover:opacity-80 ${member.role === 'ADMIN' ? 'bg-purple-500/10 text-purple-500' :
                                                                        member.role === 'CLIENT' ? 'bg-orange-500/10 text-orange-500' :
                                                                            'bg-muted text-muted-foreground'
                                                                        }`}
                                                                >
                                                                    {member.role || 'Member'} <ChevronDown size={10} />
                                                                </button>

                                                                {activeRoleDropdownId === member.id && (
                                                                    <div className="absolute top-full right-0 mt-1 bg-popover border border-border shadow-lg rounded z-10 w-32 py-1" onClick={e => e.stopPropagation()}>
                                                                        <button onClick={() => changeMemberRole(member.id, 'ADMIN')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted">Admin</button>
                                                                        <button onClick={() => changeMemberRole(member.id, 'MEMBER')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted">Member</button>
                                                                        <button onClick={() => changeMemberRole(member.id, 'CLIENT')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted">Client</button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className={`text-xs px-2 py-1 rounded-full ${member.role === 'OWNER' ? 'bg-primary/10 text-primary' :
                                                                member.role === 'ADMIN' ? 'bg-purple-500/10 text-purple-500' :
                                                                    member.role === 'CLIENT' ? 'bg-orange-500/10 text-orange-500' :
                                                                        'bg-muted text-muted-foreground'
                                                                }`}>
                                                                {member.role || 'Member'}
                                                            </span>
                                                        )}

                                                        {(isOwner || (isAdmin && member.role !== 'ADMIN' && member.role !== 'OWNER')) && member.id !== activeTeam.ownerId && (
                                                            <button
                                                                onClick={async () => {
                                                                    setConfirmDialog({
                                                                        isOpen: true,
                                                                        title: "Remove Member",
                                                                        message: `Remove ${member.name} from team?`,
                                                                        isDestructive: true,
                                                                        onConfirm: async () => {
                                                                            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                                                                            try {
                                                                                await fetch(`/api/teams/${activeTeam.id}/members/${member.id}`, {
                                                                                    method: 'DELETE',
                                                                                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                                                                                });
                                                                                fetchTeams();
                                                                            } catch (e) {
                                                                                console.error(e);
                                                                                alert('Failed to remove member');
                                                                            }
                                                                        }
                                                                    });
                                                                }}
                                                                className="text-muted-foreground hover:text-red-500 p-1 rounded hover:bg-muted"
                                                                title="Remove Member"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-8 text-center text-muted-foreground text-sm">
                                                No members in this team yet.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground bg-muted/10 rounded-lg border border-dashed border-border">
                            Select a team to view details
                        </div>
                    )}
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

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <form onSubmit={createTeam} className="bg-card p-6 rounded-lg w-96 border border-border">
                        <h3 className="font-bold mb-4">Create New Team</h3>
                        <input
                            className="w-full bg-background border border-input rounded p-2 mb-4 text-sm"
                            placeholder="Team Name"
                            value={newTeamName}
                            onChange={e => setNewTeamName(e.target.value)}
                            required
                        />
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setShowCreateModal(false)} className="px-3 py-1 text-sm hover:underline">Cancel</button>
                            <button type="submit" className="bg-primary text-primary-foreground px-3 py-1 rounded text-sm">Create</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Invite / Add Member Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-card p-6 rounded-lg w-[400px] border border-border">
                        <h3 className="font-bold mb-4">Add Member to Team</h3>

                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <input
                                className="w-full bg-background border border-input rounded p-2 pl-9 text-sm"
                                placeholder="Search by name or email..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                autoFocus
                            />
                        </div>

                        {/* Search Results */}
                        {searchQuery.length >= 2 && (
                            <div className="mb-4 max-h-60 overflow-y-auto border border-border rounded bg-muted/20">
                                {isSearching ? (
                                    <div className="p-4 text-sm text-center text-muted-foreground">Searching...</div>
                                ) : searchResults.length > 0 ? (
                                    searchResults.map(user => (
                                        <button
                                            key={user.id}
                                            onClick={() => addMemberDirectly(user.email)}
                                            className="w-full flex items-center gap-2 p-2 hover:bg-muted text-left transition-colors"
                                        >
                                            <div className="w-6 h-6 rounded-full overflow-hidden bg-primary/20 shrink-0">
                                                {user.avatarPath ? (
                                                    <img src={`/api/media/avatars/${user.avatarPath}`} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-[10px]">{user.name.charAt(0)}</div>
                                                )}
                                            </div>
                                            <div className="flex flex-col overflow-hidden">
                                                <span className="text-sm font-medium truncate">{user.name}</span>
                                                <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                                            </div>
                                            <Plus size={14} className="ml-auto text-muted-foreground" />
                                        </button>
                                    ))
                                ) : (
                                    <div className="p-4 text-sm text-center text-muted-foreground">No users found. The user must have an account on ReView to be added.</div>
                                )}
                            </div>
                        )}

                        <div className="flex justify-end gap-2 mt-4 border-t border-border pt-4">
                            <button onClick={() => setShowInviteModal(false)} className="px-3 py-1 text-sm hover:underline">Close</button>
                        </div>
                    </div>
                </div>
            )}



        </div>
    );
};

export default TeamDashboard;
