import React, { useState, useRef } from 'react';
import { X, Upload, FileVideo, AlertCircle, Image as ImageIcon, Box, Loader2, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import JSZip from 'jszip';
import { useNotification } from '../context/NotificationContext';

const CreateProjectModal = ({ onClose, onProjectCreated, initialFile }) => {
  const { user, activeTeam } = useAuth();
  const { socket } = useNotification();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [projectType, setProjectType] = useState(() => {
    if (initialFile) {
      if (initialFile.type.startsWith('video/')) return 'video';
      if (/\.(glb|fbx|usd|usdz|usdc|usda|zip)$/i.test(initialFile.name)) return '3d';
      if (initialFile.type.startsWith('image/')) return 'images'; // Though drag drop single file usually video/3d
    }
    return 'video';
  });
  const [file, setFile] = useState(initialFile || null);
  const [imageFiles, setImageFiles] = useState([]); // For images
  const [thumbnail, setThumbnail] = useState(null);
  const [selectedTeamId, setSelectedTeamId] = useState(activeTeam?.id || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState(null);
  const [uploadStatusMessage, setUploadStatusMessage] = useState('');

  // Roles Logic
  const [teamRoles, setTeamRoles] = useState([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState([]);

  // Fetch roles when team changes
  React.useEffect(() => {
    if (selectedTeamId) {
      fetch(`/api/teams/${selectedTeamId}/roles`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setTeamRoles(data);
          else setTeamRoles([]);
        })
        .catch(console.error);
    } else {
      setTeamRoles([]);
    }
  }, [selectedTeamId]);

  const toggleRole = (roleId) => {
    setSelectedRoleIds(prev => prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]);
  };

  // Socket Listener for Status
  React.useEffect(() => {
    if (!socket) return;
    const handleStatus = (data) => {
      console.log('SOCKET EVENT: UPLOAD_STATUS received', data);
      if (data && data.message) setUploadStatusMessage(data.message);
    };
    socket.on('UPLOAD_STATUS', handleStatus);
    return () => {
      socket.off('UPLOAD_STATUS', handleStatus);
    };
  }, [socket]);

  // 3D Thumbnail Generation State
  // Removed client-side generation logic


  // Update selected team if activeTeam changes externally and we haven't touched it,
  // or initial load. But user might want to change it manually.
  // Best to just default it on mount or when activeTeam becomes available if empty.
  React.useEffect(() => {
    if (activeTeam && !selectedTeamId) {
      setSelectedTeamId(activeTeam.id);
    }
    if (initialFile) {
      // Auto set name from file name if empty
      const fileName = initialFile.name.substring(0, initialFile.name.lastIndexOf('.'));
      setName(fileName);
    }
  }, [activeTeam, initialFile]);

  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const thumbInputRef = useRef(null);

  const [zipEntries, setZipEntries] = useState([]);
  const [selectedEntryFile, setSelectedEntryFile] = useState('');

  const handleFileChange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setError('');
      setZipEntries([]);
      setSelectedEntryFile('');

      if (selectedFile.name.endsWith('.zip')) {
        try {
          // Inspect Zip content
          const zip = await JSZip.loadAsync(selectedFile);
          const entries = [];

          zip.forEach((relativePath, zipEntry) => {
            if (!zipEntry.dir) {
              const ext = relativePath.split('.').pop().toLowerCase();
              if (['usd', 'usdc', 'usda', 'glb', 'gltf', 'fbx'].includes(ext)) {
                entries.push(relativePath);
              }
            }
          });

          setZipEntries(entries);
          if (entries.length > 0) {
            // Default to first 'main' looking file or just first one
            const main = entries.find(e => !e.includes('/')) || entries[0];
            setSelectedEntryFile(main);
          }
        } catch (err) {
          console.error("Failed to inspect zip", err);
          // Don't block upload, backend validates too, but maybe warn?
        }
      }
    }
  };


  const handleImagesChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setImageFiles(Array.from(e.target.files));
      setError('');
    }
  };

  const handleThumbnailChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setThumbnail(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if ((projectType === 'video' || projectType === '3d') && !file) {
      setError(projectType === 'video' ? 'Please select a video file.' : 'Please select a 3D file.');
      return;
    }
    if (projectType === 'images' && imageFiles.length === 0) {
      setError('Please select at least one image.');
      return;
    }

    if (!selectedTeamId && user?.role !== 'admin') {
      setError('Please select a team for this project.');
      return;
    }

    setLoading(true);
    setError('');
    setUploadProgress(0);
    setEstimatedTime(null);

    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description);

    if (projectType === 'video' || projectType === '3d') {
      formData.append('file', file);
    } else {
      imageFiles.forEach(img => {
        formData.append('images', img);
      });
    }

    if (selectedTeamId) {
      formData.append('teamId', selectedTeamId);
    }
    if (thumbnail) {
      formData.append('thumbnail', thumbnail);
    }
    if (selectedEntryFile) {
      formData.append('entryFile', selectedEntryFile);
    }

    if (selectedRoleIds.length > 0) {
      formData.append('roleIds', JSON.stringify(selectedRoleIds));
    }

    const startTime = Date.now();

    try {
      const res = await axios.post('/api/projects', formData, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);

          // Calculate estimated time remaining
          const elapsedTime = (Date.now() - startTime) / 1000; // seconds
          if (elapsedTime > 0.5 && percentCompleted > 0) { // wait a bit for stability
            const speed = progressEvent.loaded / elapsedTime; // bytes per second
            const remainingBytes = progressEvent.total - progressEvent.loaded;
            const remainingSeconds = remainingBytes / speed;
            setEstimatedTime(remainingSeconds);
          }
        }
      });

      // Redirect to Project Page logic
      const needsThumbnailGeneration = projectType === '3d' && !thumbnail;

      // Robust Navigation
      if (res.data.team?.slug && res.data.slug) {
        navigate(`/${res.data.team.slug}/${res.data.slug}`, { state: { needsThumbnailGeneration } });
      } else if (res.data.slug) {
        // Try active team context or just fallback
        if (activeTeam?.slug) {
          navigate(`/${activeTeam.slug}/${res.data.slug}`, { state: { needsThumbnailGeneration } });
        } else {
          // Fallback to legacy ID route if no team slug found
          navigate(`/project/${res.data.id}`, { state: { needsThumbnailGeneration } });
        }
      } else {
        // Ultimate fallback
        navigate(`/project/${res.data.id}`, { state: { needsThumbnailGeneration } });
      }

      toast.success('Project created successfully!');
      onProjectCreated(res.data);
      onClose();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'An error occurred. Please try again.';
      setError(msg);
      toast.error(msg);
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
          <h2 className="text-xl font-bold">New Project</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-auto space-y-4">
          {error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5">Project Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Summer Campaign 2024"
              className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-shadow"
            />
          </div>

          {/* Team Selection */}
          {user?.teams && user.teams.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Team</label>
              <select
                value={selectedTeamId}
                onChange={e => setSelectedTeamId(e.target.value)}
                className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-shadow appearance-none"
                required
              >
                <option value="" disabled>Select a team</option>
                {user.teams.map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5">Description (Optional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of the project..."
              className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-shadow min-h-[80px]"
            />
          </div>

          {/* Project Roles */}
          {teamRoles.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Project Roles</label>
              <div className="flex flex-wrap gap-2">
                {teamRoles.map(role => {
                  const isSelected = selectedRoleIds.includes(role.id);
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => toggleRole(role.id)}
                      className={`px-3 py-1.5 rounded-full text-xs border transition-all flex items-center gap-2 ${isSelected ? 'border-transparent text-white' : 'border-border bg-background hover:border-primary/50'}`}
                      style={isSelected ? { backgroundColor: role.color } : {}}
                    >
                      {role.name}
                      {isSelected && <Check size={12} />}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Select roles to route notifications to specific channels.</p>
            </div>
          )}

          {/* Project Type Selection */}
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => { setProjectType('video'); setFile(null); setImageFiles([]); }}
              className={`flex-1 p-3 rounded-lg border text-sm font-medium transition-colors flex flex-col items-center justify-center gap-2 ${projectType === 'video'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border hover:bg-muted text-muted-foreground'
                }`}
            >
              <FileVideo size={18} />
              Video
            </button>
            <button
              type="button"
              onClick={() => { setProjectType('3d'); setFile(null); setImageFiles([]); setThumbnail(null); }}
              className={`flex-1 p-3 rounded-lg border text-sm font-medium transition-colors flex flex-col items-center justify-center gap-2 ${projectType === '3d'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border hover:bg-muted text-muted-foreground'
                }`}
            >
              <Box size={18} />
              3D Asset
            </button>
            <button
              type="button"
              onClick={() => { setProjectType('images'); setFile(null); setImageFiles([]); }}
              className={`flex-1 p-3 rounded-lg border text-sm font-medium transition-colors flex flex-col items-center justify-center gap-2 ${projectType === 'images'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border hover:bg-muted text-muted-foreground'
                }`}
            >
              <ImageIcon size={18} />
              Images
            </button>
          </div>

          {projectType === 'video' && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Video File</label>
              <div
                className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${file ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
                  }`}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label="Upload video file"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="video/*"
                  className="hidden"
                />

                {file ? (
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">
                      <FileVideo size={24} />
                    </div>
                    <p className="text-sm font-medium text-foreground">{file.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                      }}
                      className="mt-3 text-xs text-destructive hover:underline"
                    >
                      Remove file
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-muted text-muted-foreground flex items-center justify-center mx-auto mb-2">
                      <Upload size={24} />
                    </div>
                    <p className="text-sm font-medium text-foreground">Click to upload video</p>
                    <p className="text-xs text-muted-foreground mt-1">MP4, MOV, WebM</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {projectType === '3d' && (
            <div>
              <label className="block text-sm font-medium mb-1.5">3D Model</label>
              <div
                className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${file ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
                  }`}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label="Upload 3D file"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".glb,.fbx,.usd,.usdz,.usdc,.usda,.zip"
                  className="hidden"
                />

                {file ? (
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">
                      <Box size={24} />
                    </div>
                    <p className="text-sm font-medium text-foreground">{file.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        setZipEntries([]);
                        setSelectedEntryFile('');
                      }}
                      className="mt-3 text-xs text-destructive hover:underline"
                    >
                      Remove file
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-muted text-muted-foreground flex items-center justify-center mx-auto mb-2">
                      <Upload size={24} />
                    </div>
                    <p className="text-sm font-medium text-foreground">Click to upload 3D model</p>
                    <p className="text-xs text-muted-foreground mt-1">GLB, FBX, USD, or ZIP</p>
                    <p className="text-[10px] text-muted-foreground mt-2 max-w-[200px] mx-auto">
                      For ZIP files: The archive must contain .glb, .gltf, .fbx, or .usd files. Textures will be automatically detected relative to the model file.
                    </p>
                  </div>
                )}
              </div>

              {/* Zip Entry Selection */}
              {zipEntries.length > 1 && (
                <div className="mt-4 p-3 bg-secondary/20 rounded-md border border-secondary">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Select Main File to Load</label>
                  <select
                    value={selectedEntryFile}
                    onChange={(e) => setSelectedEntryFile(e.target.value)}
                    className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm"
                  >
                    {zipEntries.map(entry => (
                      <option key={entry} value={entry}>{entry}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    The zip contains multiple supported 3D files. Please select the one that should be loaded by default.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Hidden 3D Viewer for Thumbnail Generation */}


          {projectType === 'images' && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Images (Sequence or Gallery)</label>
              <div
                className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${imageFiles.length > 0 ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
                  }`}
                onClick={() => imageInputRef.current?.click()}
                role="button"
                tabIndex={0}
              >
                <input
                  type="file"
                  ref={imageInputRef}
                  onChange={handleImagesChange}
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  multiple
                  className="hidden"
                />

                {imageFiles.length > 0 ? (
                  <div className="text-center w-full">
                    <div className="flex flex-wrap gap-2 justify-center max-h-32 overflow-y-auto mb-2">
                      {imageFiles.slice(0, 5).map((img, idx) => (
                        <div key={idx} className="bg-background border px-2 py-1 rounded text-xs truncate max-w-[100px]">
                          {img.name}
                        </div>
                      ))}
                      {imageFiles.length > 5 && (
                        <div className="bg-background border px-2 py-1 rounded text-xs text-muted-foreground">
                          +{imageFiles.length - 5} more
                        </div>
                      )}
                    </div>
                    <p className="text-sm font-medium text-foreground">{imageFiles.length} images selected</p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setImageFiles([]);
                      }}
                      className="mt-3 text-xs text-destructive hover:underline"
                    >
                      Remove all
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-muted text-muted-foreground flex items-center justify-center mx-auto mb-2">
                      <ImageIcon size={24} />
                    </div>
                    <p className="text-sm font-medium text-foreground">Click to upload images</p>
                    <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WEBP</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5">Custom Thumbnail (Optional)</label>
            <div
              className="flex items-center gap-3"
            >
              <button
                type="button"
                onClick={() => thumbInputRef.current?.click()}
                className="flex items-center gap-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground px-3 py-2 rounded-md text-sm transition-colors"
              >
                <ImageIcon size={16} />
                {thumbnail ? 'Change Image' : 'Upload Image'}
              </button>
              <span className="text-sm text-muted-foreground">
                {thumbnail ? thumbnail.name : 'No file selected'}
              </span>
              <input
                type="file"
                ref={thumbInputRef}
                onChange={handleThumbnailChange}
                accept="image/*"
                className="hidden"
              />
              {thumbnail && (
                <button
                  type="button"
                  onClick={() => setThumbnail(null)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">If not provided, the first frame of the video will be used.</p>
          </div>
        </form>

        <div className="p-4 border-t border-border bg-muted/10 rounded-b-lg">
          {loading ? (
            <div className="flex justify-end gap-3 opacity-50 pointer-events-none">
              <span className="text-sm py-2 px-1">Processing... check screen</span>
            </div>
          ) : (
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || ((projectType === 'video' || projectType === '3d') ? !file : imageFiles.length === 0)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-md text-sm font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
              >
                <span>Create Project</span>
              </button>
            </div>
          )}
        </div>
      </motion.div>

      {
        loading && (
          <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center backdrop-blur-sm">
            <div className="bg-zinc-900/90 p-8 rounded-xl border border-zinc-700/50 w-96 text-center shadow-2xl">
              <h3 className="text-white text-lg font-medium mb-1">Creating Project</h3>
              <p className="text-zinc-400 text-xs mb-6 uppercase tracking-wider font-semibold">
                {uploadStatusMessage || (uploadProgress < 100 ? 'Uploading...' : 'Processing...')}
              </p>
              <div className="w-full bg-zinc-800 rounded-full h-2 mb-3 overflow-hidden">
                <div
                  className={`bg-primary h-full rounded-full transition-all duration-200 ease-out ${uploadProgress === 100 ? 'animate-pulse' : ''}`}
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <span className="text-zinc-300 font-mono text-sm">
                {uploadProgress}%
                {uploadProgress < 100 && estimatedTime !== null && ` • ~${Math.ceil(estimatedTime)}s left`}
              </span>
            </div>
          </div>
        )
      }
    </motion.div >
  );
};

export default CreateProjectModal;
