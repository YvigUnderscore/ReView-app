import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useHeader } from '../../context/HeaderContext';
import { useBranding } from '../../context/BrandingContext';
import { useNavigate } from 'react-router-dom';
import { Edit, X } from 'lucide-react';

const AdminDashboard = () => {
  const { user } = useAuth();
  const { searchQuery } = useHeader();
  const { title: currentTitle, dateFormat: currentDateFormat, refreshConfig } = useBranding();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // Settings State
  const [siteTitle, setSiteTitle] = useState('');
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);

  // SMTP State
  const [smtpConfig, setSmtpConfig] = useState({
      smtp_host: '', smtp_port: '', smtp_user: '', smtp_pass: '', smtp_secure: 'false', smtp_from: ''
  });
  const [smtpLoading, setSmtpLoading] = useState(false);
  const [testEmailLoading, setTestEmailLoading] = useState(false);

  const SMTP_PRESETS = {
      ovh: { host: 'ssl0.ovh.net', port: '465', secure: true },
      gmail: { host: 'smtp.gmail.com', port: '465', secure: true },
      outlook: { host: 'smtp.office365.com', port: '587', secure: false }
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

  // Announcement State
  const [announcement, setAnnouncement] = useState({ subject: '', message: '' });
  const [announcementLoading, setAnnouncementLoading] = useState(false);

  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/');
      return;
    }
    fetchUsers();
    fetchSmtp();
    setSiteTitle(currentTitle);
    setDateFormat(currentDateFormat || 'DD/MM/YYYY');
  }, [user, currentTitle, currentDateFormat]);

  const fetchSmtp = () => {
      fetch('/api/admin/settings/smtp', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      .then(res => res.json())
      .then(data => setSmtpConfig(data))
      .catch(e => console.error(e));
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
          if (res.ok) alert("SMTP Settings updated");
          else alert("Failed to update SMTP settings");
      } catch (e) {
          alert("Error updating settings");
      } finally {
          setSmtpLoading(false);
      }
  };

  const handleTestEmail = async () => {
      setTestEmailLoading(true);
      try {
          const res = await fetch('/api/admin/mail/test', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify({ email: user.email })
          });
          const data = await res.json();
          if (res.ok) alert(data.message);
          else alert("Failed to send test email: " + (data.error || 'Unknown error'));
      } catch (e) {
          alert("Error sending test email");
      } finally {
          setTestEmailLoading(false);
      }
  };

  const handleSendAnnouncement = async (e) => {
      e.preventDefault();
      if (!window.confirm("Are you sure you want to send this email to ALL users?")) return;

      setAnnouncementLoading(true);
      try {
          const res = await fetch('/api/admin/mail/broadcast', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify(announcement)
          });
          const data = await res.json();
          if (res.ok) {
              alert(`Announcement sent! Success: ${data.stats.sent}, Failed: ${data.stats.failed}`);
              setAnnouncement({ subject: '', message: '' });
          } else {
              alert("Failed to send announcement: " + (data.error || 'Unknown error'));
          }
      } catch (e) {
          alert("Error sending announcement");
      } finally {
          setAnnouncementLoading(false);
      }
  };

  const fetchUsers = () => {
    fetch('/api/admin/users', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
      .then(res => res.json())
      .then(data => setUsers(data));
  };

  const handleDeleteUser = (id) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    fetch(`/api/admin/users/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
      .then(res => {
        if (res.ok) fetchUsers();
        else alert('Failed to delete user');
      });
  };

  const handleUpdateUser = async (e) => {
      e.preventDefault();
      const { id, name, email, role, password } = editingUser;

      try {
          const res = await fetch(`/api/admin/users/${id}`, {
              method: 'PATCH',
              headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify({ name, email, role, password: password || undefined })
          });

          if (res.ok) {
              setEditingUser(null);
              fetchUsers();
          } else {
              const data = await res.json();
              alert(data.error || 'Failed to update user');
          }
      } catch (err) {
          alert('Error updating user');
      }
  };

  const handleGenerateInvite = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ email: inviteEmail || undefined })
      });
      const data = await res.json();
      // Assume frontend is on the same host, construct URL
      const link = `${window.location.origin}/register?token=${data.token}`;
      setInviteLink(link);
    } catch (err) {
      alert('Failed to generate invite');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSettings = async (e) => {
      e.preventDefault();
      setSettingsLoading(true);
      try {
          const res = await fetch('/api/admin/settings', {
              method: 'PATCH',
              headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify({ title: siteTitle, dateFormat })
          });
          if (res.ok) {
              alert("Settings updated");
              refreshConfig();
          }
      } catch (e) {
          alert("Failed to update settings");
      } finally {
          setSettingsLoading(false);
      }
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
              if (res.ok) {
                  alert("Icon updated");
                  refreshConfig();
              }
          } catch (e) {
              alert("Failed to upload icon");
          } finally {
              setUploadingIcon(false);
          }
      }
  };

  const filteredUsers = users.filter(u =>
      (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* System Settings */}
        <div className="bg-card border border-border rounded-lg p-6 lg:col-span-2">
            <h2 className="text-xl font-semibold mb-4">System Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <form onSubmit={handleUpdateSettings} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Site Title</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                className="flex-1 bg-background border border-border rounded p-2"
                                value={siteTitle}
                                onChange={e => setSiteTitle(e.target.value)}
                            />
                            <button
                                type="submit"
                                disabled={settingsLoading}
                                className="bg-primary text-primary-foreground px-4 py-2 rounded font-medium hover:bg-primary/90"
                            >
                                Save
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Date Format</label>
                        <select
                            className="w-full bg-background border border-border rounded p-2"
                            value={dateFormat}
                            onChange={e => setDateFormat(e.target.value)}
                        >
                            <option value="DD/MM/YYYY">DD/MM/YYYY (e.g., 31/12/2023)</option>
                            <option value="MM/DD/YYYY">MM/DD/YYYY (e.g., 12/31/2023)</option>
                        </select>
                    </div>
                </form>

                <div className="space-y-4">
                     <label className="block text-sm font-medium mb-1">Site Icon (Favicon)</label>
                     <div className="flex items-center gap-4">
                         <div className="relative">
                             <input
                                 type="file"
                                 onChange={handleIconUpload}
                                 className="hidden"
                                 id="icon-upload"
                                 accept="image/*"
                             />
                             <label
                                 htmlFor="icon-upload"
                                 className="cursor-pointer bg-muted hover:bg-muted/80 text-foreground px-4 py-2 rounded border border-border flex items-center gap-2"
                             >
                                 {uploadingIcon ? 'Uploading...' : 'Upload New Icon'}
                             </label>
                         </div>
                     </div>
                     <p className="text-xs text-muted-foreground">Recommended: 32x32 or 64x64 PNG.</p>
                </div>
            </div>
        </div>

        {/* SMTP Settings */}
        <div className="bg-card border border-border rounded-lg p-6 lg:col-span-2">
            <h2 className="text-xl font-semibold mb-4">Email Configuration (SMTP)</h2>
            <form onSubmit={handleUpdateSmtp} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Load Preset</label>
                    <select
                        className="w-full bg-input border border-border rounded p-2"
                        onChange={handlePresetChange}
                        defaultValue=""
                    >
                        <option value="">Select a provider...</option>
                        <option value="ovh">OVH</option>
                        <option value="gmail">Gmail</option>
                        <option value="outlook">Outlook / Office 365</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Host</label>
                    <input type="text" className="w-full bg-input border border-border rounded p-2"
                        value={smtpConfig.smtp_host} onChange={e => setSmtpConfig({...smtpConfig, smtp_host: e.target.value})} />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Port</label>
                    <input type="number" className="w-full bg-input border border-border rounded p-2"
                        value={smtpConfig.smtp_port} onChange={e => setSmtpConfig({...smtpConfig, smtp_port: e.target.value})} />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">User</label>
                    <input type="text" className="w-full bg-input border border-border rounded p-2"
                        value={smtpConfig.smtp_user} onChange={e => setSmtpConfig({...smtpConfig, smtp_user: e.target.value})} />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Password</label>
                    <input type="password" className="w-full bg-input border border-border rounded p-2"
                        value={smtpConfig.smtp_pass} onChange={e => setSmtpConfig({...smtpConfig, smtp_pass: e.target.value})} />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">From Address</label>
                    <input type="text" className="w-full bg-input border border-border rounded p-2" placeholder='"My App" <noreply@myapp.com>'
                        value={smtpConfig.smtp_from} onChange={e => setSmtpConfig({...smtpConfig, smtp_from: e.target.value})} />
                </div>
                <div className="flex items-center gap-2 pt-6">
                    <input type="checkbox" id="smtp_secure"
                        checked={smtpConfig.smtp_secure === 'true'}
                        onChange={e => setSmtpConfig({...smtpConfig, smtp_secure: e.target.checked ? 'true' : 'false'})} />
                    <label htmlFor="smtp_secure" className="text-sm">Secure (SSL/TLS - usually port 465)</label>
                </div>
                <div className="md:col-span-2 pt-2 flex gap-4">
                    <button type="submit" disabled={smtpLoading} className="bg-primary text-primary-foreground px-4 py-2 rounded font-medium hover:bg-primary/90">
                        {smtpLoading ? 'Saving...' : 'Save SMTP Settings'}
                    </button>
                    <button
                        type="button"
                        onClick={handleTestEmail}
                        disabled={testEmailLoading}
                        className="bg-secondary text-secondary-foreground px-4 py-2 rounded font-medium hover:bg-secondary/80 border border-border"
                    >
                        {testEmailLoading ? 'Sending...' : 'Send Test Email'}
                    </button>
                </div>
            </form>
        </div>

        {/* Announcements */}
        <div className="bg-card border border-border rounded-lg p-6 lg:col-span-2">
            <h2 className="text-xl font-semibold mb-4">Send Announcement / Newsletter</h2>
            <form onSubmit={handleSendAnnouncement} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Subject</label>
                    <input
                        type="text"
                        className="w-full bg-input border border-border rounded p-2"
                        value={announcement.subject}
                        onChange={e => setAnnouncement({...announcement, subject: e.target.value})}
                        placeholder="Update Notification..."
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Message</label>
                    <textarea
                        className="w-full bg-input border border-border rounded p-2 h-32"
                        value={announcement.message}
                        onChange={e => setAnnouncement({...announcement, message: e.target.value})}
                        placeholder="Write your message here..."
                        required
                    />
                </div>
                <button
                    type="submit"
                    disabled={announcementLoading}
                    className="bg-primary text-primary-foreground px-4 py-2 rounded font-medium hover:bg-primary/90"
                >
                    {announcementLoading ? 'Sending...' : 'Send to All Users'}
                </button>
            </form>
        </div>

        {/* User Management */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Users</h2>
          <div className="space-y-4">
            {filteredUsers.length === 0 ? (
                <div className="text-muted-foreground text-sm">No users found.</div>
            ) : filteredUsers.map(u => (
              <div key={u.id} className="flex items-center justify-between p-3 bg-muted/20 rounded border border-border">
                <div>
                  <div className="font-medium">{u.name}</div>
                  <div className="text-sm text-muted-foreground">{u.email}</div>
                  <div className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full inline-block mt-1 uppercase">{u.role}</div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setEditingUser({ ...u, password: '' })}
                        className="p-2 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                        title="Edit User"
                    >
                        <Edit size={16} />
                    </button>
                    {u.id !== user.id && (
                    <button
                        onClick={() => handleDeleteUser(u.id)}
                        className="p-2 hover:bg-destructive/10 rounded text-destructive hover:text-destructive/80"
                        title="Delete User"
                    >
                        <X size={16} />
                    </button>
                    )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Invite Generator */}
        <div className="bg-card border border-border rounded-lg p-6 h-fit">
          <h2 className="text-xl font-semibold mb-4">Generate Registration Invite</h2>
          <form onSubmit={handleGenerateInvite} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email (Optional)</label>
              <input
                type="email"
                className="w-full bg-background border border-border rounded p-2"
                placeholder="user@example.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground py-2 rounded font-medium hover:bg-primary/90"
            >
              {loading ? 'Generating...' : 'Generate Link'}
            </button>
          </form>

          {inviteLink && (
            <div className="mt-4 p-4 bg-muted/50 rounded border border-border">
              <div className="text-xs text-muted-foreground mb-1">Invite Link:</div>
              <div className="font-mono text-sm break-all select-all bg-background p-2 rounded border border-border">
                {inviteLink}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Share this link with the user. It expires in 7 days.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-background rounded-lg shadow-xl w-full max-w-md border border-border">
                  <div className="p-4 border-b border-border flex justify-between items-center">
                      <h3 className="font-bold text-lg">Edit User</h3>
                      <button onClick={() => setEditingUser(null)}><X size={20} /></button>
                  </div>
                  <form onSubmit={handleUpdateUser} className="p-4 space-y-4">
                      <div>
                          <label className="block text-sm font-medium mb-1">Name</label>
                          <input
                              type="text"
                              className="w-full bg-input border border-border rounded p-2"
                              value={editingUser.name}
                              onChange={e => setEditingUser({ ...editingUser, name: e.target.value })}
                              required
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-medium mb-1">Email</label>
                          <input
                              type="email"
                              className="w-full bg-input border border-border rounded p-2"
                              value={editingUser.email}
                              onChange={e => setEditingUser({ ...editingUser, email: e.target.value })}
                              required
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-medium mb-1">Role</label>
                          <select
                              className="w-full bg-input border border-border rounded p-2"
                              value={editingUser.role}
                              onChange={e => setEditingUser({ ...editingUser, role: e.target.value })}
                          >
                              <option value="user">User</option>
                              <option value="admin">Admin</option>
                          </select>
                      </div>
                      <div>
                          <label className="block text-sm font-medium mb-1">New Password (Optional)</label>
                          <input
                              type="password"
                              className="w-full bg-input border border-border rounded p-2"
                              placeholder="Leave blank to keep current"
                              value={editingUser.password}
                              onChange={e => setEditingUser({ ...editingUser, password: e.target.value })}
                          />
                      </div>
                      <div className="pt-4 flex justify-end gap-2">
                          <button
                              type="button"
                              onClick={() => setEditingUser(null)}
                              className="px-4 py-2 rounded hover:bg-muted"
                          >
                              Cancel
                          </button>
                          <button
                              type="submit"
                              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                          >
                              Save Changes
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default AdminDashboard;
