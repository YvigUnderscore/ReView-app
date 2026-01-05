import React, { useState, useEffect, useCallback } from 'react';
import { Plus, UserPlus, Shield, X, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const TeamDashboard = () => {
  const { activeTeam, switchTeam, checkStatus } = useAuth();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Roles state
  const [teamRoles, setTeamRoles] = useState([]);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('#3b82f6');
  const [activeMemberMenuId, setActiveMemberMenuId] = useState(null); // Member ID for whom the role menu is open


  // Forms
  const [newTeamName, setNewTeamName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Member');

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
                myRole: t.isOwner ? 'Owner' : 'Member'
            }));
        } else if (data && data.team) {
             teamsArray = [{
                ...data.team,
                myRole: data.isOwner ? 'Owner' : 'Member'
            }];
        }
        setTeams(teamsArray);
        setLoading(false);

        // Ensure activeTeam is fresh from the list if possible
        if (activeTeam) {
            // No action needed, context handles selection, but we might want to refresh its data (members)
            // Ideally AuthContext should update user on major changes, but here we just list them.
        }
    })
    .catch((err) => {
        console.error("Failed to fetch teams:", err);
        setLoading(false);
        setTeams([]);
    });
  }, [activeTeam]); // Re-fetch if activeTeam changes? Not strictly needed but safe

  const fetchRoles = useCallback((teamId) => {
     if (!teamId) return;
     fetch(`/api/teams/${teamId}/roles`, {
         headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
     })
     .then(res => {
         if (!res.ok) throw new Error(res.statusText);
         return res.json();
     })
     .then(data => {
         if (Array.isArray(data)) {
            setTeamRoles(data);
         } else {
             setTeamRoles([]);
             console.warn("Expected array for roles, got:", data);
         }
     })
     .catch(err => {
         console.error("Failed to fetch roles", err);
         setTeamRoles([]);
     });
  }, []);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  useEffect(() => {
    if (activeTeam) {
        fetchRoles(activeTeam.id);
    }
  }, [activeTeam, fetchRoles]);

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
            await checkStatus(); // Refresh auth context to get new team list
            fetchTeams();
            switchTeam(newTeam.id);
        }
    } catch (err) {
        console.error(err);
    }
  };

  const inviteMember = async (e) => {
    e.preventDefault();
    if (!activeTeam) return;

    try {
        const res = await fetch(`/api/teams/members`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ email: inviteEmail, role: inviteRole, teamId: activeTeam.id })
        });
        if (res.ok) {
            setInviteEmail('');
            setShowInviteModal(false);
            fetchTeams();
            alert('Member added successfully');
        } else {
            const data = await res.json();
            alert(data.error);
        }
    } catch (err) {
        console.error(err);
    }
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
      if(!confirm('Are you sure you want to delete this role?')) return;
      try {
          await fetch(`/api/teams/${activeTeam.id}/roles/${roleId}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          });
          fetchRoles(activeTeam.id);
          fetchTeams(); // Refresh members to clear removed roles locally if needed, though simpler to just let it be
      } catch (err) { console.error(err); }
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
          // Keep menu open for multiple assignments
          fetchTeams();
      } catch (err) { console.error(err); }
  };

  const removeRole = async (userId, roleId) => {
       if(!confirm('Remove role from user?')) return;
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
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="p-8">
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
                            {/* We check team ownership from the team list found in 'teams' state, or activeTeam if updated */}
                            {(teams.find(t => t.id === activeTeam.id)?.isOwner) && (
                                <div className="flex gap-2">
                                     <button
                                        onClick={() => {
                                            if (confirm('Are you sure you want to delete this team? This action cannot be undone.')) {
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
                                        }}
                                        className="border border-red-500/30 text-red-500 hover:bg-red-500/10 px-3 py-1.5 rounded text-sm flex items-center gap-2"
                                     >
                                        <X size={14} /> Delete Team
                                     </button>
                                     <button
                                        onClick={() => setShowRoleModal(true)}
                                        className="border border-border hover:bg-muted px-3 py-1.5 rounded text-sm flex items-center gap-2"
                                     >
                                        <Shield size={14} /> Manage Roles
                                     </button>
                                    <button
                                        onClick={() => setShowInviteModal(true)}
                                        className="border border-border hover:bg-muted px-3 py-1.5 rounded text-sm flex items-center gap-2"
                                     >
                                        <UserPlus size={14} /> Add Member
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="bg-card border border-border rounded-lg overflow-hidden mt-6">
                            <div className="p-4 bg-muted/20 border-b border-border font-semibold text-sm">Team Members</div>
                            <div className="divide-y divide-border">
                                {teams.find(t => t.id === activeTeam.id)?.members && teams.find(t => t.id === activeTeam.id)?.members.length > 0 ? (
                                    teams.find(t => t.id === activeTeam.id)?.members.map(member => (
                                        <div key={member.id} className="p-4 flex items-center justify-between hover:bg-muted/10">
                                            <div>
                                                <div className="font-medium flex items-center gap-2">
                                                    {member.name || 'Unknown'}
                                                    {member.teamRoles && member.teamRoles.map(r => (
                                                        <span key={r.id} className="text-[10px] px-1.5 py-0.5 rounded text-white flex items-center gap-1" style={{ backgroundColor: r.color }}>
                                                            {r.name}
                                                            {(teams.find(t => t.id === activeTeam.id)?.isOwner) && (
                                                                <button onClick={(e) => { e.stopPropagation(); removeRole(member.id, r.id); }} className="hover:opacity-80"><X size={8} /></button>
                                                            )}
                                                        </span>
                                                    ))}
                                                    {(teams.find(t => t.id === activeTeam.id)?.isOwner) && (
                                                        <div className="relative">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setActiveMemberMenuId(activeMemberMenuId === member.id ? null : member.id);
                                                                }}
                                                                className="bg-muted hover:bg-muted/80 p-0.5 rounded-full text-muted-foreground"
                                                                title="Add Role"
                                                            >
                                                                <Plus size={12} />
                                                            </button>
                                                            {activeMemberMenuId === member.id && (
                                                                <div className="absolute top-full left-0 mt-1 bg-popover border border-border shadow-lg rounded z-10 w-48 py-1" onMouseLeave={() => setActiveMemberMenuId(null)}>
                                                                    {teamRoles.length > 0 ? (
                                                                        teamRoles.map(role => {
                                                                            const isAssigned = member.teamRoles?.some(r => r.id === role.id);
                                                                            return (
                                                                                <button
                                                                                    key={role.id}
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        if (isAssigned) {
                                                                                            removeRole(member.id, role.id);
                                                                                        } else {
                                                                                            assignRole(member.id, role.id);
                                                                                        }
                                                                                    }}
                                                                                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted flex items-center justify-between"
                                                                                >
                                                                                    <div className="flex items-center gap-2">
                                                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: role.color }}></div>
                                                                                        <span>{role.name}</span>
                                                                                    </div>
                                                                                    {isAssigned && <Check size={12} className="text-primary" />}
                                                                                </button>
                                                                            );
                                                                        })
                                                                    ) : (
                                                                        <div className="px-3 py-2 text-xs text-muted-foreground text-center">No roles created</div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="text-sm text-muted-foreground">{member.email}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs px-2 py-1 rounded-full ${
                                                    member.role === 'OWNER' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                                                }`}>
                                                    {member.role || 'Member'}
                                                </span>
                                                {(teams.find(t => t.id === activeTeam.id)?.isOwner) && member.id !== activeTeam.ownerId && (
                                                    <button
                                                        onClick={async () => {
                                                            if (confirm(`Remove ${member.name} from team?`)) {
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

      {/* Invite Modal */}
      {showInviteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <form onSubmit={inviteMember} className="bg-card p-6 rounded-lg w-96 border border-border">
                  <h3 className="font-bold mb-4">Add Member</h3>
                  <input
                    className="w-full bg-background border border-input rounded p-2 mb-4 text-sm"
                    placeholder="User Email"
                    type="email"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    required
                  />
                  <select
                     className="w-full bg-background border border-input rounded p-2 mb-4 text-sm"
                     value={inviteRole}
                     onChange={e => setInviteRole(e.target.value)}
                  >
                      <option value="Member">Member</option>
                      <option value="Co-Owner">Co-Owner</option>
                      <option value="Client">Client</option>
                  </select>
                  <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setShowInviteModal(false)} className="px-3 py-1 text-sm hover:underline">Cancel</button>
                      <button type="submit" className="bg-primary text-primary-foreground px-3 py-1 rounded text-sm">Add</button>
                  </div>
              </form>
          </div>
      )}

      {/* Role Management Modal */}
      {showRoleModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-card p-6 rounded-lg w-96 border border-border">
                  <h3 className="font-bold mb-4">Manage Team Roles</h3>

                  {/* Create New Role */}
                  <form onSubmit={createRole} className="mb-6 p-3 bg-muted/20 rounded border border-border">
                      <div className="text-sm font-semibold mb-2">Create Role</div>
                      <div className="flex gap-2 mb-2">
                          <input
                            className="flex-1 bg-background border border-input rounded p-1.5 text-sm"
                            placeholder="Role Name"
                            value={newRoleName}
                            onChange={e => setNewRoleName(e.target.value)}
                            required
                          />
                          <input
                            type="color"
                            className="w-8 h-8 p-0 border-0 rounded cursor-pointer"
                            value={newRoleColor}
                            onChange={e => setNewRoleColor(e.target.value)}
                          />
                      </div>
                      <button type="submit" className="w-full bg-primary text-primary-foreground py-1 rounded text-sm">Add Role</button>
                  </form>

                  <div className="space-y-2 max-h-60 overflow-y-auto">
                      {teamRoles.map(role => (
                          <div key={role.id} className="flex justify-between items-center p-2 bg-muted/10 rounded border border-border text-sm">
                              <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: role.color }}></div>
                                  <span>{role.name}</span>
                              </div>
                              <button onClick={() => deleteRole(role.id)} className="text-muted-foreground hover:text-red-500"><X size={14}/></button>
                          </div>
                      ))}
                      {teamRoles.length === 0 && <div className="text-center text-muted-foreground text-xs py-2">No roles created yet</div>}
                  </div>

                  <div className="flex justify-end mt-4">
                      <button type="button" onClick={() => setShowRoleModal(false)} className="px-3 py-1 text-sm hover:underline">Close</button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default TeamDashboard;
