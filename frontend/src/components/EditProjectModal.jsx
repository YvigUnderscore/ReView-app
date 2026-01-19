import React, { useState, useRef } from 'react';
import { X, AlertCircle, Trash2, Image as ImageIcon, Upload } from 'lucide-react';
import { motion } from 'framer-motion';

const EditProjectModal = ({ project, onClose, onProjectUpdated, onProjectDeleted }) => {
  const [activeTab, setActiveTab] = useState('details'); // details, thumbnail, version
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');

  const [thumbnail, setThumbnail] = useState(null);
  const thumbInputRef = useRef(null);

  const [newVersionFile, setNewVersionFile] = useState(null);
  const versionInputRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const handleUpdateDetails = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // If thumbnail is selected, use FormData
    // If not, use JSON (unless logic combines them)
    // The endpoint supports upload.single('thumbnail') with body fields.
    // But if we want to send JSON only (no file), we might need to be careful with Content-Type.
    // The backend `upload.single('thumbnail')` middleware expects multipart/form-data.
    // So we should always use FormData if we target that endpoint in a way that might contain files.

    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description);
    if (thumbnail) {
        formData.append('thumbnail', thumbnail);
    }

    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (res.ok) {
        const updated = await res.json();
        onProjectUpdated(updated);
        onClose();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to update project');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadVersion = async (e) => {
      e.preventDefault();
      if (!newVersionFile) return;

      setLoading(true);
      setError('');

      const formData = new FormData();
      formData.append('file', newVersionFile);

      try {
          const res = await fetch(`/api/projects/${project.id}/versions`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
              body: formData
          });

          if (res.ok) {
              // The response is the new video object.
              // We need to refetch the project or manually update it?
              // Ideally refetching the project to get updated videos list and potential new thumbnail.
              // For simplicity, let's close and trigger an update if we can,
              // but the parent expects a Project object in `onProjectUpdated`.
              // We can fetch the updated project.

              const pRes = await fetch(`/api/projects/${project.id}`, {
                  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
              });
              const updatedProject = await pRes.json();
              onProjectUpdated(updatedProject);
              onClose();
          } else {
              const data = await res.json();
              setError(data.error || 'Failed to upload version');
          }
      } catch (err) {
          setError('Failed to upload version');
      } finally {
          setLoading(false);
      }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (res.ok) {
        onProjectDeleted(project.id);
        onClose();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to delete project');
        setDeleteConfirm(false);
      }
    } catch (err) {
      setError('An error occurred deleting the project');
      setDeleteConfirm(false);
    } finally {
        setLoading(false);
    }
  };

  return (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        transition={{ type: "spring", duration: 0.4, bounce: 0.3 }}
        className="bg-card w-full max-w-lg rounded-lg border border-border shadow-xl relative flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-bold">Edit Project</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        {!deleteConfirm && (
            <div className="flex border-b border-border px-4">
                <button
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'details' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    onClick={() => setActiveTab('details')}
                >
                    Details
                </button>
                <button
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'version' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    onClick={() => setActiveTab('version')}
                >
                    New Version
                </button>
            </div>
        )}

        <div className="p-6 overflow-y-auto">
            {error && (
                <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm flex items-center gap-2 mb-4">
                    <AlertCircle size={16} />
                    {error}
                </div>
            )}

            {deleteConfirm ? (
                <div className="text-center py-4">
                    <div className="w-12 h-12 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-4">
                        <Trash2 size={24} />
                    </div>
                    <h3 className="text-lg font-bold mb-2">Delete Project?</h3>
                    <p className="text-muted-foreground text-sm mb-6">
                        Are you sure you want to delete <strong>{name}</strong>? This action cannot be undone and all associated videos and comments will be lost.
                    </p>
                    <div className="flex justify-center gap-4">
                        <button
                            onClick={() => setDeleteConfirm(false)}
                            className="px-4 py-2 rounded border border-border hover:bg-muted"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground px-4 py-2 rounded hover:opacity-90"
                            disabled={loading}
                        >
                            {loading ? 'Deleting...' : 'Yes, Delete Project'}
                        </button>
                    </div>
                </div>
            ) : (
                <>
                {activeTab === 'details' && (
                    <form onSubmit={handleUpdateDetails} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full bg-input border border-border rounded p-2 focus:ring-1 focus:ring-primary outline-none"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Description</label>
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                className="w-full bg-input border border-border rounded p-2 focus:ring-1 focus:ring-primary outline-none min-h-[100px]"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Thumbnail</label>
                            <div className="flex items-center gap-4">
                                <div className="w-24 h-16 bg-black border border-border rounded overflow-hidden flex-shrink-0 relative group">
                                    {thumbnail ? (
                                        <img src={URL.createObjectURL(thumbnail)} className="w-full h-full object-cover" alt="Preview" />
                                    ) : (
                                        project.thumbnailPath ? (
                                             <img src={`/api/thumbnails/${project.thumbnailPath}`} className="w-full h-full object-cover" alt="Current" />
                                        ) : (
                                            <div className="flex items-center justify-center h-full text-xs text-muted-foreground">Default</div>
                                        )
                                    )}
                                </div>
                                <div>
                                    <button
                                        type="button"
                                        onClick={() => thumbInputRef.current?.click()}
                                        className="text-xs bg-secondary hover:bg-secondary/80 text-secondary-foreground px-3 py-1.5 rounded flex items-center gap-2"
                                    >
                                        <ImageIcon size={14} />
                                        {thumbnail ? 'Change' : 'Upload Custom'}
                                    </button>
                                    <input
                                        type="file"
                                        ref={thumbInputRef}
                                        onChange={(e) => e.target.files && setThumbnail(e.target.files[0])}
                                        accept="image/*"
                                        className="hidden"
                                    />
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                        Upload an image to replace the auto-generated thumbnail.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between pt-4 items-center border-t border-border mt-6">
                            <button
                                type="button"
                                onClick={() => setDeleteConfirm(true)}
                                className="text-destructive hover:bg-destructive/10 px-3 py-2 rounded text-sm flex items-center gap-2 transition-colors"
                            >
                                <Trash2 size={16} /> Delete
                            </button>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 text-sm hover:bg-accent rounded"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-medium hover:opacity-90 disabled:opacity-50"
                                >
                                    {loading ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    </form>
                )}

                {activeTab === 'version' && (
                    <form onSubmit={handleUploadVersion} className="space-y-4">
                        <div className="border border-dashed border-border rounded-lg p-8 flex flex-col items-center justify-center text-center">
                             {newVersionFile ? (
                                 <div className="w-full">
                                     <div className="flex items-center justify-center w-12 h-12 bg-primary/10 text-primary rounded-full mx-auto mb-2">
                                         <Upload size={20} />
                                     </div>
                                     <p className="font-medium text-sm truncate max-w-full px-4">{newVersionFile.name}</p>
                                     <button
                                        type="button"
                                        onClick={() => setNewVersionFile(null)}
                                        className="text-xs text-destructive mt-2 hover:underline"
                                     >
                                         Remove
                                     </button>
                                 </div>
                             ) : (
                                 <div
                                    role="button"
                                    onClick={() => versionInputRef.current?.click()}
                                    className="cursor-pointer w-full h-full flex flex-col items-center"
                                 >
                                    <div className="flex items-center justify-center w-12 h-12 bg-muted text-muted-foreground rounded-full mb-2">
                                         <Upload size={20} />
                                     </div>
                                     <p className="text-sm font-medium">Click to upload new version</p>
                                     <p className="text-xs text-muted-foreground mt-1">MP4, MOV, WebM</p>
                                 </div>
                             )}
                             <input
                                type="file"
                                ref={versionInputRef}
                                onChange={(e) => e.target.files && setNewVersionFile(e.target.files[0])}
                                accept="video/*"
                                className="hidden"
                             />
                        </div>

                        <div className="flex justify-end pt-4">
                             <button
                                type="submit"
                                disabled={loading || !newVersionFile}
                                className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                            >
                                {loading && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                Upload Version
                            </button>
                        </div>
                    </form>
                )}
                </>
            )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default EditProjectModal;
