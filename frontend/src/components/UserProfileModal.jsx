import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const UserProfileModal = ({ onClose }) => {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
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
      if (password) formData.append('password', password);
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
       <div className="bg-card w-full max-w-md p-6 rounded-lg border border-border shadow-xl relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>

          <h2 className="text-xl font-bold mb-4">Edit Profile</h2>

          {message && <div className="bg-green-500/10 text-green-500 p-2 rounded mb-4 text-sm">{message}</div>}
          {error && <div className="bg-destructive/10 text-destructive p-2 rounded mb-4 text-sm">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
             <div className="flex flex-col items-center mb-4">
                 <div className="w-20 h-20 rounded-full overflow-hidden bg-muted mb-2 border border-border">
                     {preview ? (
                         <img src={preview} alt="Avatar" className="w-full h-full object-cover" />
                     ) : (
                         <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-muted-foreground">
                             {name ? name.charAt(0).toUpperCase() : '?'}
                         </div>
                     )}
                 </div>
                 <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="text-xs text-muted-foreground file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                 />
             </div>

             <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                   type="text"
                   value={name}
                   onChange={e => setName(e.target.value)}
                   className="w-full bg-input border border-border rounded p-2 focus:ring-1 focus:ring-primary outline-none"
                />
             </div>

             <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                   type="email"
                   value={email}
                   onChange={e => setEmail(e.target.value)}
                   className="w-full bg-input border border-border rounded p-2 focus:ring-1 focus:ring-primary outline-none"
                />
             </div>

             <div>
                <label className="block text-sm font-medium mb-1">New Password (leave blank to keep current)</label>
                <input
                   type="password"
                   value={password}
                   onChange={e => setPassword(e.target.value)}
                   className="w-full bg-input border border-border rounded p-2 focus:ring-1 focus:ring-primary outline-none"
                />
             </div>

             <div className="flex justify-end pt-4">
                <button
                   type="button"
                   onClick={onClose}
                   className="px-4 py-2 text-sm mr-2 hover:bg-accent rounded"
                >
                   Close
                </button>
                <button
                   type="submit"
                   disabled={loading}
                   className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                   {loading ? 'Saving...' : 'Save Changes'}
                </button>
             </div>
          </form>
       </div>
    </div>
  );
};

export default UserProfileModal;
