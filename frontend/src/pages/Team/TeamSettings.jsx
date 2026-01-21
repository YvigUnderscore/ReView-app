import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { ChevronLeft, Save, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TeamSettings = () => {
    const { activeTeam, checkStatus } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [teamDetails, setTeamDetails] = useState(null);

    // Settings State
    const [startFrame, setStartFrame] = useState(0);
    const [discordWebhookUrl, setDiscordWebhookUrl] = useState('');
    const [discordBotName, setDiscordBotName] = useState('');
    const [discordBotAvatar, setDiscordBotAvatar] = useState('');
    const [discordTiming, setDiscordTiming] = useState('REALTIME');
    const [discordBurnAnnotations, setDiscordBurnAnnotations] = useState(true);

    // Digest Settings State
    const [digestFps, setDigestFps] = useState(''); // Empty string for "Default"
    const [digestTransition, setDigestTransition] = useState('');
    const [digestPause, setDigestPause] = useState('');
    const [digestVideoEnabled, setDigestVideoEnabled] = useState(true);

    // Global Limits (Fetched from system settings)
    const [globalLimits, setGlobalLimits] = useState({
        fpsMax: 24, fpsDefault: 18,
        transitionMax: 3, transitionDefault: 1,
        pauseMax: 10, pauseDefault: 2
    });

    useEffect(() => {
        if (!activeTeam) return;

        // Fetch Global System Settings for Limits
        fetch('/api/admin/system/settings', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
            .then(res => {
                if (res.status === 403) return null; // Regular users might not see this, handled gracefully
                return res.json();
            })
            .then(data => {
                if (data) {
                    setGlobalLimits({
                        fpsMax: parseInt(data.digest_fps_max || 24),
                        fpsDefault: parseInt(data.digest_fps_default || 18),
                        transitionMax: parseFloat(data.digest_transition_max || 3),
                        transitionDefault: parseFloat(data.digest_transition_default || 1),
                        pauseMax: parseFloat(data.digest_pause_max || 10),
                        pauseDefault: parseFloat(data.digest_pause_default || 2)
                    });
                }
            })
            .catch(() => { }); // Ignore error if not admin or failure

        // Fetch fresh team details
        fetch('/api/teams', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
            .then(res => res.json())
            .then(data => {
                let teamsArray = [];
                if (Array.isArray(data)) {
                    teamsArray = data;
                } else if (data && data.team) {
                    teamsArray = [data.team];
                }

                const current = teamsArray.find(t => t.id === activeTeam.id);
                if (current) {
                    setTeamDetails(current);
                    // Populate Form
                    setStartFrame(current.startFrame || 0);
                    setDiscordWebhookUrl(current.discordWebhookUrl || '');
                    setDiscordBotName(current.discordBotName || '');
                    setDiscordBotAvatar(current.discordBotAvatar || '');
                    setDiscordTiming(current.discordTiming || 'REALTIME');
                    setDiscordBurnAnnotations(current.discordBurnAnnotations !== false);

                    // Digest Settings (null handles "Default")
                    setDigestFps(current.digestFps !== null ? current.digestFps : '');
                    setDigestTransition(current.digestTransition !== null ? current.digestTransition : '');
                    setDigestPause(current.digestPause !== null ? current.digestPause : '');
                    setDigestVideoEnabled(current.digestVideoEnabled !== false);

                    setLoading(false);

                    // Permission Check
                    const myRole = current.myRole || (current.isOwner ? 'OWNER' : 'MEMBER');
                    const isOwner = current.isOwner;
                    const isAdmin = myRole === 'ADMIN';
                    // const isGlobalAdmin = ... (handled by backend usually)

                    if (!isOwner && !isAdmin) { // Allow global admin too if logic supported, but client side check usually enough
                        // toast.error("You don't have permission to view this page");
                        // navigate('/team');
                    }
                }
            })
            .catch(err => {
                console.error("Failed to fetch team details:", err);
                toast.error("Failed to load team settings");
                setLoading(false);
            });
    }, [activeTeam, navigate]);

    const updateTeamSettings = async () => {
        if (!activeTeam) return;
        try {
            const res = await fetch(`/api/teams/${activeTeam.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    startFrame: parseInt(startFrame),
                    discordWebhookUrl,
                    discordBotName,
                    discordBotAvatar,
                    discordTiming,
                    discordBurnAnnotations,

                    // Digest Settings
                    digestFps: digestFps === '' ? null : parseInt(digestFps),
                    digestTransition: digestTransition === '' ? null : parseFloat(digestTransition),
                    digestPause: digestPause === '' ? null : parseFloat(digestPause),
                    digestVideoEnabled: digestVideoEnabled
                })
            });
            if (res.ok) {
                toast.success('Team settings updated');
                // Refresh context if needed, or just stay here
            } else {
                const d = await res.json();
                toast.error(d.error || 'Failed to update settings');
            }
        } catch (e) { console.error(e); }
    };

    if (loading) return <div className="p-8">Loading...</div>;

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => navigate('/team')}
                    className="p-2 hover:bg-muted rounded-full transition-colors"
                >
                    <ChevronLeft size={24} />
                </button>
                <div>
                    <h2 className="text-2xl font-bold">Team Settings</h2>
                    <p className="text-muted-foreground">{teamDetails?.name}</p>
                </div>
            </div>

            <div className="space-y-6">
                {/* General Settings */}
                <div className="bg-card border border-border rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4">General</h3>
                    <div className="max-w-md">
                        <label className="block text-sm font-medium mb-1">Start Timecode Frame</label>
                        <input
                            type="number"
                            className="w-full bg-background border border-input rounded p-2 text-sm"
                            value={startFrame}
                            onChange={e => setStartFrame(e.target.value)}
                            placeholder="0"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            The starting frame number for timecode display (e.g. 0, 1, 1001).
                        </p>
                    </div>
                </div>

                {/* Discord Settings */}
                <div className="bg-card border border-border rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-[#5865F2] flex items-center justify-center text-white text-xs">D</span>
                        Discord Integration
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium mb-1">Webhook URL</label>
                            <input
                                type="url"
                                className="w-full bg-background border border-input rounded p-2 text-sm"
                                placeholder="https://discord.com/api/webhooks/..."
                                value={discordWebhookUrl}
                                onChange={e => setDiscordWebhookUrl(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Bot Name (Optional)</label>
                            <input
                                type="text"
                                className="w-full bg-background border border-input rounded p-2 text-sm"
                                placeholder="ReView Bot"
                                value={discordBotName}
                                onChange={e => setDiscordBotName(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Bot Avatar URL (Optional)</label>
                            <input
                                type="url"
                                className="w-full bg-background border border-input rounded p-2 text-sm"
                                placeholder="https://..."
                                value={discordBotAvatar}
                                onChange={e => setDiscordBotAvatar(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Notification Timing</label>
                            <select
                                className="w-full bg-background border border-input rounded p-2 text-sm"
                                value={discordTiming}
                                onChange={e => setDiscordTiming(e.target.value)}
                            >
                                <option value="REALTIME">Realtime (Immediate)</option>
                                <option value="GROUPED">Grouped (Smart Batching)</option>
                                <option value="HYBRID">Hybrid (Urgent + Grouped)</option>
                                <option value="HOURLY">Hourly Digest</option>
                                <option value="MAJOR">Major Events Only</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-2 pt-6">
                            <input
                                type="checkbox"
                                id="burnAnnot"
                                className="rounded border-input w-4 h-4"
                                checked={discordBurnAnnotations}
                                onChange={e => setDiscordBurnAnnotations(e.target.checked)}
                            />
                            <label htmlFor="burnAnnot" className="text-sm">Burn-in Annotations to Images</label>
                        </div>
                    </div>
                </div>

                {/* Digest Video Settings */}
                <div className="bg-card border border-border rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4 text-purple-600 dark:text-purple-400">Digest Video Settings</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                        Customize the generated digest video quality and timing.
                        Leave blank or set to "Default" to use system global settings.
                        Values are capped by system maximums.
                    </p>

                    <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                id="digestEnabled"
                                className="w-5 h-5 rounded border-input"
                                checked={digestVideoEnabled}
                                onChange={e => setDigestVideoEnabled(e.target.checked)}
                            />
                            <div>
                                <label htmlFor="digestEnabled" className="block text-sm font-medium">Activer le Video Digest</label>
                                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-0.5">
                                    Attention : cette fonctionnalité est plus longue à générer et peut être instable (expérimental).
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className={`grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 ${!digestVideoEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                        {/* FPS */}
                        <div className="space-y-3">
                            <label className="block text-sm font-medium">Framerate (FPS)</label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="range" min="1" max={globalLimits.fpsMax}
                                    value={digestFps === '' ? globalLimits.fpsDefault : digestFps}
                                    onChange={e => setDigestFps(e.target.value)}
                                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                                />
                                <span className="text-sm font-mono w-16 text-right">
                                    {digestFps === '' ? `${globalLimits.fpsDefault} (Def)` : `${digestFps}`} fps
                                </span>
                            </div>
                            <div className="flex justify-end">
                                <button
                                    onClick={() => setDigestFps('')}
                                    className={`text-xs px-2 py-1 rounded ${digestFps === '' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                                >
                                    Use Default
                                </button>
                            </div>
                        </div>

                        {/* Transition */}
                        <div className="space-y-3">
                            <label className="block text-sm font-medium">Transition Duration</label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="range" min="0" max={globalLimits.transitionMax} step="0.5"
                                    value={digestTransition === '' ? globalLimits.transitionDefault : digestTransition}
                                    onChange={e => setDigestTransition(e.target.value)}
                                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                                />
                                <span className="text-sm font-mono w-16 text-right">
                                    {digestTransition === '' ? `${globalLimits.transitionDefault} (Def)` : `${digestTransition}`}s
                                </span>
                            </div>
                            <div className="flex justify-end">
                                <button
                                    onClick={() => setDigestTransition('')}
                                    className={`text-xs px-2 py-1 rounded ${digestTransition === '' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                                >
                                    Use Default
                                </button>
                            </div>
                        </div>

                        {/* Pause */}
                        <div className="space-y-3 md:col-span-2">
                            <label className="block text-sm font-medium">Pause Duration</label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="range" min="0" max={globalLimits.pauseMax} step="0.5"
                                    value={digestPause === '' ? globalLimits.pauseDefault : digestPause}
                                    onChange={e => setDigestPause(e.target.value)}
                                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                                />
                                <span className="text-sm font-mono w-16 text-right">
                                    {digestPause === '' ? `${globalLimits.pauseDefault} (Def)` : `${digestPause}`}s
                                </span>
                            </div>
                            <div className="flex justify-end">
                                <button
                                    onClick={() => setDigestPause('')}
                                    className={`text-xs px-2 py-1 rounded ${digestPause === '' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                                >
                                    Use Default
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="bg-card border border-border rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4">Actions</h3>

                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">Force Digest Send</p>
                            <p className="text-sm text-muted-foreground">
                                Manually trigger the digest email and Discord notifications for all queued items, bypassing the debounce timer.
                            </p>
                        </div>
                        <button
                            onClick={async () => {
                                if (!confirm('Are you sure you want to force send all pending digests?')) return;
                                try {
                                    setActionLoading(true);
                                    const promise = fetch(`/api/teams/${activeTeam.id}/force-digest`, {
                                        method: 'POST',
                                        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                                    });

                                    toast.promise(promise, {
                                        loading: 'Triggering digest...',
                                        success: 'Digest processing triggered!',
                                        error: 'Failed to trigger digest'
                                    });

                                    await promise;
                                } catch (e) {
                                    console.error(e);
                                } finally {
                                    setActionLoading(false);
                                }
                            }}
                            disabled={actionLoading}
                            className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {actionLoading ? 'Processing...' : 'Force Send Now'}
                        </button>
                    </div>

                    {/* Leave Team Section - Only for non-owners */}
                    {teamDetails && !teamDetails.isOwner && (
                        <div className="flex items-center justify-between mt-6 pt-6 border-t border-border">
                            <div>
                                <p className="font-medium text-red-500">Leave Team</p>
                                <p className="text-sm text-muted-foreground">
                                    Remove yourself from this team. This action cannot be undone.
                                </p>
                            </div>
                            <button
                                onClick={async () => {
                                    if (!confirm(`Are you sure you want to leave "${teamDetails.name}"? You will lose access to all team projects.`)) return;
                                    try {
                                        setActionLoading(true);
                                        const res = await fetch(`/api/teams/${activeTeam.id}/leave`, {
                                            method: 'POST',
                                            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                                        });
                                        if (res.ok) {
                                            toast.success('You have left the team');
                                            await checkStatus(); // Refresh user data
                                            navigate('/');
                                        } else {
                                            const data = await res.json();
                                            toast.error(data.error || 'Failed to leave team');
                                        }
                                    } catch (e) {
                                        console.error(e);
                                        toast.error('Failed to leave team');
                                    } finally {
                                        setActionLoading(false);
                                    }
                                }}
                                disabled={actionLoading}
                                className="bg-red-500/10 text-red-500 border border-red-500/20 px-4 py-2 rounded-md hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <LogOut size={16} />
                                {actionLoading ? 'Leaving...' : 'Leave Team'}
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex justify-end pt-4">
                    <button
                        onClick={updateTeamSettings}
                        className="bg-primary text-primary-foreground px-6 py-2 rounded-md flex items-center gap-2 hover:opacity-90 transition-opacity"
                    >
                        <Save size={18} />
                        Save Settings
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TeamSettings;
