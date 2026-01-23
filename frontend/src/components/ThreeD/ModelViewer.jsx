import React, { useRef, useState, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react';
import '@google/model-viewer';
import {
    Keyboard, Play, Pause, RotateCcw, Maximize2, Sun,
    Eye, EyeOff, RotateCw, Camera, Info, Ruler, Palette,
    Settings, Box, MapPin, Target, Plus, Trash2, Video,
    Rotate3D, Pencil, Eraser, Move, Undo, Redo, MousePointer2, ChevronUp, Check, Image as ImageIcon, Send, X
} from 'lucide-react';
import { isPointInShape, moveShape } from '../../utils/annotationUtils';
import DrawingToolbar from '../DrawingToolbar';
import Timeline from '../Timeline';
import ShortcutsModal from '../ShortcutsModal';
import JSZip from 'jszip';
import { useAuth } from '../../context/AuthContext';

// ... (HDR_ENVIRONMENTS and CAMERA_PRESETS remain unchanged)

// 3D Annotation tools
// ANNOTATION_3D_TOOLS removed as requested


const ModelViewer = forwardRef(({
    src: rawSrc,
    onAnnotationSave,
    viewingAnnotation,
    isDrawingModeTrigger,
    onCameraChange,
    onCameraInteractionStart,
    onTimeUpdate, // Callback for animation time updates
    onDurationChange, // Callback for animation duration updates
    assetId,
    extension,
    onModelLoaded,
    entryFile,
    existingHotspots = [],
    existingCameraViews = [],
    onHotspotsChange,
    onCameraViewsChange,
    onReviewSubmit, // Callback to trigger "Send Review" logic (e.g. open comments)
    onAnnotationAdded, // New callback for when an annotation is added
    // Props for 3D billboard annotations
    existingComments = [], // Comments to display as 3D billboards
    onCommentClick // Callback when a billboard is clicked
}, ref) => {
    const { getMediaUrl } = useAuth();
    const src = getMediaUrl(rawSrc);

    const modelViewerRef = useRef(null);
    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const svgRef = useRef(null);
    const fileInputRef = useRef(null);

    // Model state
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [modelSrc, setModelSrc] = useState(null);

    // Animation state
    const [animations, setAnimations] = useState([]);
    const [selectedAnimIndex, setSelectedAnimIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(() => {
        const saved = localStorage.getItem('3d_autoplay');
        return saved !== null ? JSON.parse(saved) : true;
    });
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    // UI state
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [showToolsPanel, setShowToolsPanel] = useState(false);
    const [showStatsPanel, setShowStatsPanel] = useState(false);

    // Viewer settings
    const [environmentImage, setEnvironmentImage] = useState('neutral');
    const [exposure, setExposure] = useState(1);
    const [shadowIntensity, setShadowIntensity] = useState(1);
    const [shadowEnabled, setShadowEnabled] = useState(true);
    const [autoRotate, setAutoRotate] = useState(false);
    const [autoRotateSpeed, setAutoRotateSpeed] = useState(30);
    const [modelStats, setModelStats] = useState(null);
    const [modelDimensions, setModelDimensions] = useState(null);
    const [showDimensions, setShowDimensions] = useState(false);
    const [materialVariants, setMaterialVariants] = useState([]);
    const [selectedVariant, setSelectedVariant] = useState(null);

    // 3D Annotation state
    const [annotation3DTool, setAnnotation3DTool] = useState('pointer');
    const [hotspots, setHotspots] = useState(existingHotspots);
    const [cameraViews, setCameraViews] = useState(existingCameraViews);
    const [dimensionStart, setDimensionStart] = useState(null);
    const [hoveredHotspot, setHoveredHotspot] = useState(null);
    const [selectedHotspot, setSelectedHotspot] = useState(null);

    // 2D Annotation state
    const [isDrawingMode, setIsDrawingMode] = useState(false);
    const [annotations, setAnnotations] = useState([]);
    const [tool, setTool] = useState('pointer');
    const [color, setColor] = useState('#ef4444');
    const [strokeWidth, setStrokeWidth] = useState(5);
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
    const [currentAnnotation, setCurrentAnnotation] = useState(null);
    const [draggingAnnotation, setDraggingAnnotation] = useState(null);
    const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
    const [hoveredShapeIndex, setHoveredShapeIndex] = useState(-1);
    const [commentText, setCommentText] = useState(''); // New state for annotation comment
    const [selectedImage, setSelectedImage] = useState(null); // New state for image upload
    const [imagePreview, setImagePreview] = useState(null); // New state for image preview

    // History for Undo/Redo
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const isUndoing = useRef(false);

    const currentCameraState = useRef(null);
    const blobUrlsRef = useRef([]);

    // 3D Surface Anchor state for billboard annotations
    const [surfaceAnchor3D, setSurfaceAnchor3D] = useState(null);
    const [captureCamera, setCaptureCamera] = useState(null);
    const [showAnnotationLines, setShowAnnotationLines] = useState(
        () => localStorage.getItem('3d_annotation_lines') === 'true'
    );
    const [zoomed3DAnnotation, setZoomed3DAnnotation] = useState(null);
    const savedCameraBeforeZoom = useRef(null);

    // Load Draft on Mount
    useEffect(() => {
        if (assetId) {
            const saved = localStorage.getItem(`draft_model_${assetId}`);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    // Only load if explicit existing data is empty, or maybe user prefers draft?
                    // "Reprendre de 0" logic... I'll load draft if it exists.
                    if (parsed.hotspots) setHotspots(parsed.hotspots);
                    if (parsed.cameraViews) setCameraViews(parsed.cameraViews);
                    if (parsed.annotations) setAnnotations(parsed.annotations);
                } catch (e) {
                    console.error("Failed to load draft", e);
                }
            }
        }
    }, [assetId]);

    // Save Draft & History on Change
    useEffect(() => {
        if (assetId) {
            const draft = { hotspots, cameraViews, annotations };
            localStorage.setItem(`draft_model_${assetId}`, JSON.stringify(draft));
        }

        if (hotspots.length === 0 && cameraViews.length === 0 && annotations.length === 0) {
            // No need to push empty state if history is empty
            if (history.length === 0) return;
        }

        if (isUndoing.current) {
            isUndoing.current = false;
            return;
        }

        const state = { hotspots, cameraViews, annotations };
        setHistory(prev => {
            const newHist = prev.slice(0, historyIndex + 1);
            newHist.push(state);
            return newHist;
        });
        setHistoryIndex(prev => prev + 1);

    }, [hotspots, cameraViews, annotations, assetId]); // Note: This will trigger on mount (history[0]), which is correct

    const handleUndo = () => {
        if (historyIndex > 0) {
            isUndoing.current = true;
            const prev = history[historyIndex - 1];
            setHotspots(prev.hotspots);
            setCameraViews(prev.cameraViews);
            setAnnotations(prev.annotations);
            setHistoryIndex(historyIndex - 1);
        }
    };

    const handleSendReview = () => {
        // Trigger parent callback
        if (onAnnotationSave) {
            // Already synced state to parent?
            // onAnnotationSave typically updates pendingAnnotations in ClientReview.
            onAnnotationSave([...annotations, ...hotspots]); // Send combined?
            // Actually ClientReview handles them separately usually?
            // Let's check logic: ClientReview sets pendingAnnotations = data.
        }

        // Notify user to open comments / submit
        // Since we don't have direct access to "Open Comments Panel", we assume ClientReview might react to this
        // or we dispatch an event?
        // Simpler: Just ensure pending annotations are set, and maybe toast?
        // But user asked for "Send Review Button".
        // I will assume the parent 'ClientReview' needs to know.

        // Dispatch Custom Event for "open-comments" if needed, 
        // OR rely on props if I can add one. 
        // I added onReviewSubmit prop to ModelViewer.
        if (onReviewSubmit) {
            onReviewSubmit(commentText, selectedImage);
            setCommentText(''); // Clear input
            setSelectedImage(null);
            setImagePreview(null);
            setIsDrawingMode(false); // Close drawing mode? Or keep open? User might want to stay.
            // But if "Send", usually implies submission.
        } else {
            // Fallback: Notify parent that we are ready
            if (onAnnotationSave) onAnnotationSave(hotspots); // Trigger update
        }
    };

    // Sync hotspots with parent
    useEffect(() => {
        if (onHotspotsChange) {
            onHotspotsChange(hotspots);
        }
    }, [hotspots, onHotspotsChange]);

    // Sync camera views with parent
    useEffect(() => {
        if (onCameraViewsChange) {
            onCameraViewsChange(cameraViews);
        }
    }, [cameraViews, onCameraViewsChange]);

    // Cleanup blob URLs on unmount
    useEffect(() => {
        return () => {
            blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
        };
    }, []);

    // Handle ZIP files and model loading
    useEffect(() => {
        const loadModel = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const ext = extension?.toLowerCase().replace('.', '') ||
                    src.split('?')[0].split('.').pop().toLowerCase();

                if (ext === 'zip') {
                    const response = await fetch(src);
                    const blob = await response.blob();
                    const zip = await JSZip.loadAsync(blob);

                    const files = Object.keys(zip.files).filter(f => !zip.files[f].dir);
                    let mainFile = null;

                    if (entryFile && files.includes(entryFile)) {
                        mainFile = entryFile;
                    } else {
                        mainFile = files.find(f => f.toLowerCase().endsWith('.glb') && !f.includes('/')) ||
                            files.find(f => f.toLowerCase().endsWith('.gltf') && !f.includes('/')) ||
                            files.find(f => f.toLowerCase().endsWith('.glb')) ||
                            files.find(f => f.toLowerCase().endsWith('.gltf'));
                    }

                    if (!mainFile) {
                        throw new Error('No GLB/GLTF file found in ZIP archive');
                    }

                    const fileBlob = await zip.files[mainFile].async('blob');
                    const blobUrl = URL.createObjectURL(fileBlob);
                    blobUrlsRef.current.push(blobUrl);
                    setModelSrc(blobUrl);
                } else if (['glb', 'gltf'].includes(ext)) {
                    setModelSrc(src);
                } else if (ext === 'fbx') {
                    throw new Error(`FBX format requires server-side conversion to GLB. Please contact admin to install fbx2gltf.`);
                } else {
                    throw new Error(`Unsupported format: ${ext}. Only GLB/GLTF are supported.`);
                }
            } catch (err) {
                console.error('Error loading model:', err);
                setError(err.message);
                setIsLoading(false);
            }
        };

        if (src) {
            loadModel();
        }
    }, [src, extension, entryFile]);

    // Model-viewer event handlers
    useEffect(() => {
        const mv = modelViewerRef.current;
        if (!mv) return;

        const handleLoad = async () => {
            setIsLoading(false);

            if (mv.availableAnimations && mv.availableAnimations.length > 0) {
                setAnimations(mv.availableAnimations);
                mv.animationName = mv.availableAnimations[0];
                mv.play();
                setIsPlaying(true);
                setDuration(mv.duration);
            }

            if (mv.availableVariants && mv.availableVariants.length > 0) {
                setMaterialVariants(mv.availableVariants);
            }

            try {
                const stats = {
                    animations: mv.availableAnimations?.length || 0,
                    variants: mv.availableVariants?.length || 0,
                };
                setModelStats(stats);
            } catch (e) {
                console.log('Could not get model stats:', e);
            }

            // Initialize camera state
            if (mv) {
                const orbit = mv.getCameraOrbit();
                const target = mv.getCameraTarget();
                currentCameraState.current = {
                    orbit: { theta: orbit.theta, phi: orbit.phi, radius: orbit.radius },
                    target: { x: target.x, y: target.y, z: target.z },
                    fov: mv.getFieldOfView()
                };
            }

            try {
                const dims = mv.getDimensions();
                if (dims) {
                    setModelDimensions({
                        width: (dims.x * 100).toFixed(1),
                        height: (dims.y * 100).toFixed(1),
                        depth: (dims.z * 100).toFixed(1),
                    });
                }
            } catch (e) {
                console.log('Could not get dimensions:', e);
            }

            if (onModelLoaded) {
                onModelLoaded();
            }

            setTimeout(() => {
                if (mv) {
                    mv.cameraOrbit = 'auto auto auto';
                    mv.fieldOfView = 'auto';
                }
            }, 100);
        };

        const handleError = (e) => {
            console.error('Model-viewer error:', e);
            setError('Failed to load 3D model');
            setIsLoading(false);
        };

        const handleCameraChange = () => {
            // UPDATE: We do NOT trigger onCameraInteractionStart here anymore to avoid 
            // clearing annotations during programmatic moves (like restoring view).
            // We now listen to specific user interaction events (mousedown, touchstart, wheel) instead.

            const orbit = mv.getCameraOrbit();
            const target = mv.getCameraTarget();
            currentCameraState.current = {
                orbit: { theta: orbit.theta, phi: orbit.phi, radius: orbit.radius },
                target: { x: target.x, y: target.y, z: target.z },
                fov: mv.getFieldOfView()
            };

            if (onCameraChange) {
                onCameraChange(currentCameraState.current);
            }

            // Update SVG dimension lines
            updateDimensionLines();
        };

        const handleInteraction = () => {
            if (onCameraInteractionStart) {
                onCameraInteractionStart();
            }
        };

        mv.addEventListener('load', handleLoad);
        mv.addEventListener('error', handleError);
        mv.addEventListener('camera-change', handleCameraChange);

        // Listen for explicit user interactions to clear annotations
        mv.addEventListener('mousedown', handleInteraction);
        mv.addEventListener('touchstart', handleInteraction, { passive: true });
        mv.addEventListener('wheel', handleInteraction, { passive: true });

        return () => {
            mv.removeEventListener('load', handleLoad);
            mv.removeEventListener('error', handleError);
            mv.removeEventListener('camera-change', handleCameraChange);

            mv.removeEventListener('mousedown', handleInteraction);
            mv.removeEventListener('touchstart', handleInteraction);
            mv.removeEventListener('wheel', handleInteraction);
        };
    }, [modelSrc, onModelLoaded, onCameraChange, onCameraInteractionStart]);

    // Update dimension lines on camera change
    const updateDimensionLines = useCallback(() => {
        const mv = modelViewerRef.current;
        const svg = svgRef.current;
        if (!mv || !svg) return;

        const dimensionHotspots = hotspots.filter(h => h.type === 'dimension');
        dimensionHotspots.forEach(dim => {
            const startEl = mv.querySelector(`[slot="hotspot-${dim.id}-start"]`);
            const endEl = mv.querySelector(`[slot="hotspot-${dim.id}-end"]`);
            const line = svg.querySelector(`#line-${dim.id}`);
            const text = svg.querySelector(`#text-${dim.id}`);

            if (startEl && endEl && line && text) {
                const startRect = startEl.getBoundingClientRect();
                const endRect = endEl.getBoundingClientRect();
                const svgRect = svg.getBoundingClientRect();

                const x1 = startRect.left - svgRect.left + startRect.width / 2;
                const y1 = startRect.top - svgRect.top + startRect.height / 2;
                const x2 = endRect.left - svgRect.left + endRect.width / 2;
                const y2 = endRect.top - svgRect.top + endRect.height / 2;

                line.setAttribute('x1', x1);
                line.setAttribute('y1', y1);
                line.setAttribute('x2', x2);
                line.setAttribute('y2', y2);

                text.setAttribute('x', (x1 + x2) / 2);
                text.setAttribute('y', (y1 + y2) / 2 - 10);
            }
        });
    }, [hotspots]);

    // Animation Loop for Timeline
    useEffect(() => {
        let animationFrameId;

        const updateTime = () => {
            const mv = modelViewerRef.current;
            if (mv && isPlaying) {
                const newTime = mv.currentTime;
                setCurrentTime(newTime);

                // Notify parent of time update
                if (onTimeUpdate) {
                    onTimeUpdate(newTime);
                }

                if (mv.duration !== duration) {
                    const newDuration = mv.duration;
                    setDuration(newDuration);

                    // Notify parent of duration change
                    if (onDurationChange) {
                        onDurationChange(newDuration);
                    }
                }
            }
            animationFrameId = requestAnimationFrame(updateTime);
        };

        if (isPlaying) {
            updateTime();
        }

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, [isPlaying, duration, onTimeUpdate, onDurationChange]);


    const handleSeek = (time) => {
        console.log('[ModelViewer] handleSeek called with time:', time);
        const mv = modelViewerRef.current;
        if (!mv) {
            console.warn('[ModelViewer] No model-viewer ref');
            return;
        }

        // Only proceed if there are animations
        if (!mv.availableAnimations || mv.availableAnimations.length === 0) {
            console.warn('[ModelViewer] No animations available for seeking');
            return;
        }

        const startTime = mv.currentTime;
        const endTime = time;
        const delta = endTime - startTime;

        console.log('[ModelViewer] Seek from', startTime, 'to', endTime, 'delta:', delta);

        // Pause immediately
        mv.pause();
        setIsPlaying(false);

        // For backwards seeks or very small jumps, do instant jump
        // (animated backwards transition doesn't look good with model-viewer)
        if (delta < 0 || Math.abs(delta) < 0.5) {
            console.log('[ModelViewer] Instant seek (backwards or small delta)');
            mv.currentTime = endTime;
            setCurrentTime(endTime);
            setHotspots(h => [...h]);

            if (onTimeUpdate) {
                onTimeUpdate(endTime);
            }
            return;
        }

        // For forward seeks, animate smoothly
        const animDuration = Math.min(1000, Math.abs(delta) * 200); // Adaptive duration, max 1 second
        const startTs = performance.now();

        console.log('[ModelViewer] Smooth seek forward, duration:', animDuration);

        // Easing function (easeOutQuad for smooth deceleration)
        const easeOutQuad = (t) => t * (2 - t);

        const animate = (currentTs) => {
            const elapsed = currentTs - startTs;
            const progress = Math.min(elapsed / animDuration, 1);
            const easedProgress = easeOutQuad(progress);

            // Interpolate time
            const newTime = startTime + delta * easedProgress;
            mv.currentTime = newTime;
            setCurrentTime(newTime);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Animation complete - set exact final time
                mv.currentTime = endTime;
                setCurrentTime(endTime);

                // Force hotspot update
                setHotspots(h => [...h]);

                // Notify parent with exact time
                if (onTimeUpdate) {
                    onTimeUpdate(endTime);
                }

                console.log('[ModelViewer] Smooth seek complete, current time:', mv.currentTime);
            }
        };

        requestAnimationFrame(animate);
    };




    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            const tag = document.activeElement.tagName.toLowerCase();
            if (tag === 'input' || tag === 'textarea') return;

            // Undo shortcut
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                handleUndo();
                return;
            }

            const mv = modelViewerRef.current;
            if (!mv) return;

            if (e.key.toLowerCase() === 'h') {
                mv.cameraOrbit = '0deg 75deg auto';
                mv.cameraTarget = 'auto auto auto';
                mv.fieldOfView = 'auto';
            }
            if (e.key.toLowerCase() === 'f') {
                mv.cameraOrbit = 'auto auto auto';
                mv.fieldOfView = 'auto';
            }
            if (e.key.toLowerCase() === 't') {
                setAutoRotate(prev => !prev);
            }
            if (e.key.toLowerCase() === 'i') {
                setShowStatsPanel(prev => !prev);
            }
            if (e.key === 'Escape') {
                setAnnotation3DTool('pointer');
                setDimensionStart(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [history, historyIndex]); // Depend on history for clear undo context if needed

    // Animation controls
    const togglePlay = () => {
        setIsPlaying(prev => {
            const newState = !prev;
            localStorage.setItem('3d_autoplay', JSON.stringify(newState));
            if (modelViewerRef.current) {
                if (newState) modelViewerRef.current.play();
                else modelViewerRef.current.pause();
            }
            return newState;
        });
    };

    const handleAnimChange = (index) => {
        const mv = modelViewerRef.current;
        if (!mv || !animations[index]) return;

        mv.animationName = animations[index];
        mv.play();
        setSelectedAnimIndex(index);
        setIsPlaying(true);
    };

    const handleVariantChange = (variantName) => {
        const mv = modelViewerRef.current;
        if (!mv) return;

        mv.variantName = variantName;
        setSelectedVariant(variantName);
    };

    const applyCameraPreset = (preset) => {
        const mv = modelViewerRef.current;
        if (!mv) return;

        mv.cameraOrbit = preset.orbit;
        mv.cameraTarget = 'auto auto auto';
    };

    // 3D Annotation handlers
    const handleModelClick = async (e) => {
        const mv = modelViewerRef.current;
        if (!mv || annotation3DTool === 'pointer') return;

        const rect = mv.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (annotation3DTool === 'hotspot') {
            // Point hotspot
            const hit = mv.positionAndNormalFromPoint(x, y);
            if (hit) {
                const newHotspot = {
                    id: `hotspot-${Date.now()}`,
                    type: 'point',
                    position: `${hit.position.x}m ${hit.position.y}m ${hit.position.z}m`,
                    normal: `${hit.normal.x} ${hit.normal.y} ${hit.normal.z}`,
                    label: `Point ${hotspots.filter(h => h.type === 'point').length + 1}`,
                    color: color
                };
                setHotspots([...hotspots, newHotspot]);
                setAnnotation3DTool('pointer'); // <--- SWITCH BACK TO POINTER
            }
        } else if (annotation3DTool === 'surface-hotspot') {
            // Surface hotspot (follows animation)
            const surface = mv.surfaceFromPoint(x, y);
            if (surface) {
                const newHotspot = {
                    id: `surface-${Date.now()}`,
                    type: 'surface',
                    surface: surface,
                    label: `Point ${hotspots.filter(h => h.type === 'surface').length + 1}`,
                    color: color
                };
                setHotspots([...hotspots, newHotspot]);
                setAnnotation3DTool('pointer'); // <--- SWITCH BACK TO POINTER

                // Notify parent to open comment input
                if (onAnnotationAdded) {
                    onAnnotationAdded();
                }
            }
        } else if (annotation3DTool === 'dimension') {
            // Dimension tool (two-point)
            const hit = mv.positionAndNormalFromPoint(x, y);
            if (hit) {
                if (!dimensionStart) {
                    setDimensionStart({
                        position: hit.position,
                        normal: hit.normal
                    });
                } else {
                    // Calculate distance
                    const dx = hit.position.x - dimensionStart.position.x;
                    const dy = hit.position.y - dimensionStart.position.y;
                    const dz = hit.position.z - dimensionStart.position.z;
                    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

                    const newDimension = {
                        id: `dim-${Date.now()}`,
                        type: 'dimension',
                        start: {
                            position: `${dimensionStart.position.x}m ${dimensionStart.position.y}m ${dimensionStart.position.z}m`,
                            normal: `${dimensionStart.normal.x} ${dimensionStart.normal.y} ${dimensionStart.normal.z}`
                        },
                        end: {
                            position: `${hit.position.x}m ${hit.position.y}m ${hit.position.z}m`,
                            normal: `${hit.normal.x} ${hit.normal.y} ${hit.normal.z}`
                        },
                        distance: (distance * 100).toFixed(1), // cm
                        color: color
                    };
                    setHotspots([...hotspots, newDimension]);
                    setDimensionStart(null);
                    setAnnotation3DTool('pointer'); // <--- SWITCH BACK TO POINTER
                }
            }
        } else if (annotation3DTool === 'camera-view') {
            // Save current camera view
            const orbit = mv.getCameraOrbit();
            const target = mv.getCameraTarget();
            const newView = {
                id: `view-${Date.now()}`,
                name: `View ${cameraViews.length + 1}`,
                orbit: `${orbit.theta}rad ${orbit.phi}rad ${orbit.radius}m`,
                target: `${target.x}m ${target.y}m ${target.z}m`,
                fov: `${mv.getFieldOfView()}deg`
            };
            setCameraViews([...cameraViews, newView]);
            setAnnotation3DTool('pointer'); // <--- SWITCH BACK TO POINTER
        }
    };

    const deleteHotspot = (id) => {
        setHotspots(hotspots.filter(h => h.id !== id));
    };

    const deleteCameraView = (id) => {
        setCameraViews(cameraViews.filter(v => v.id !== id));
    };

    const goToCameraView = (view) => {
        const mv = modelViewerRef.current;
        if (!mv) return;

        mv.cameraOrbit = view.orbit;
        mv.cameraTarget = view.target;
        if (view.fov) mv.fieldOfView = view.fov;
    };

    // Calculate Adaptive FOV to maintain horizontal framing
    const calculateAdaptiveFov = useCallback((savedFovStr, savedAspect) => {
        const mv = modelViewerRef.current;
        if (!mv || !savedAspect) return savedFovStr;

        const rect = mv.getBoundingClientRect();
        const currentAspect = rect.width / rect.height;

        const savedFovDeg = parseFloat(savedFovStr);
        if (isNaN(savedFovDeg)) return savedFovStr;

        const savedFovRad = (savedFovDeg * Math.PI) / 180;
        const tanHalfH = Math.tan(savedFovRad / 2) * savedAspect;
        const newTanHalfV = tanHalfH / currentAspect;
        const newFovRad = 2 * Math.atan(newTanHalfV);
        const newFovDeg = (newFovRad * 180) / Math.PI;

        return `${newFovDeg}deg`;
    }, []);

    // Handle contextual zoom when clicking on a 3D billboard annotation
    const handleBillboardZoom = (comment, annotation) => {
        const mv = modelViewerRef.current;
        if (!mv || !annotation.captureCamera) return;

        // Save current camera state before zooming
        const orbit = mv.getCameraOrbit();
        const target = mv.getCameraTarget();
        savedCameraBeforeZoom.current = {
            orbit: `${orbit.theta}rad ${orbit.phi}rad ${orbit.radius}m`,
            target: `${target.x}m ${target.y}m ${target.z}m`,
            fov: `${mv.getFieldOfView()}deg`
        };

        // Zoom to the captured camera state with Adaptive FOV
        const cam = annotation.captureCamera;
        mv.cameraOrbit = cam.orbit;
        mv.cameraTarget = cam.target;

        if (cam.fov) {
            if (cam.aspectRatio) {
                mv.fieldOfView = calculateAdaptiveFov(cam.fov, cam.aspectRatio);
            } else {
                mv.fieldOfView = cam.fov;
            }
        }

        setZoomed3DAnnotation({ comment, annotation });
    };

    // Update FOV on window resize if currently zoomed
    useEffect(() => {
        if (!zoomed3DAnnotation) return;

        const handleResize = () => {
            const annotation = zoomed3DAnnotation.annotation;
            if (annotation?.captureCamera?.fov && annotation.captureCamera.aspectRatio) {
                const mv = modelViewerRef.current;
                if (mv) {
                    mv.fieldOfView = calculateAdaptiveFov(
                        annotation.captureCamera.fov,
                        annotation.captureCamera.aspectRatio
                    );
                }
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [zoomed3DAnnotation, calculateAdaptiveFov]);

    // Exit zoomed mode on camera interaction
    useEffect(() => {
        const mv = modelViewerRef.current;
        if (!mv || !zoomed3DAnnotation) return;

        const handleExitZoom = () => {
            // Only exit if user interacts (mousedown/wheel), NOT if it's a programmatic update
            // We can check if the interaction was user-initiated?
            // Actually, 'camera-change' fires even on FOV change.
            // But we are listening to 'mousedown', 'touchstart', 'wheel' below.
            setZoomed3DAnnotation(null);
        };

        mv.addEventListener('mousedown', handleExitZoom);
        mv.addEventListener('touchstart', handleExitZoom, { passive: true });
        mv.addEventListener('wheel', handleExitZoom, { passive: true });

        return () => {
            mv.removeEventListener('mousedown', handleExitZoom);
            mv.removeEventListener('touchstart', handleExitZoom);
            mv.removeEventListener('wheel', handleExitZoom);
        };
    }, [zoomed3DAnnotation]);

    // Imperative API
    useImperativeHandle(ref, () => ({
        // Return annotations with 3D surface anchor metadata
        getAnnotations: () => {
            // If we have a surface anchor, wrap the annotations with metadata
            if (surfaceAnchor3D && annotations.length > 0) {
                return {
                    shapes: annotations,
                    surfaceAnchor3D: surfaceAnchor3D,
                    captureCamera: captureCamera,
                    is3DAnchoredAnnotation: true
                };
            }
            // Legacy: return plain array for backward compatibility
            return annotations;
        },
        getCameraState: () => currentCameraState.current,
        getHotspots: () => hotspots,
        getCameraViews: () => cameraViews,
        getScreenshot: () => {
            const mv = modelViewerRef.current;
            const canvas = canvasRef.current;

            if (!mv) return null;

            try {
                // Get the data URL directly from model-viewer (it handles shadow DOM canvas internally)
                const mvDataUrl = mv.toDataURL('image/jpeg', 0.8);

                // If we also have a 2d overlay canvas with content
                if (canvas && annotations.length > 0) {
                    return new Promise((resolve) => {
                        const img = new Image();
                        img.onload = () => {
                            const mergedCanvas = document.createElement('canvas');
                            mergedCanvas.width = img.width;
                            mergedCanvas.height = img.height;
                            const ctx = mergedCanvas.getContext('2d');

                            // Draw 3D Model
                            ctx.drawImage(img, 0, 0);

                            // Draw Annotations (need to scale if resolution differs)
                            // Canvas is typically sized to offsetWidth/Height, but internal resolution might differ.
                            // However, we want to draw the canvas ON TOP.
                            // Let's assume simplest case: Draw canvas scaled to image size.
                            ctx.drawImage(canvas, 0, 0, img.width, img.height);

                            resolve(mergedCanvas.toDataURL('image/jpeg', 0.8));
                        };
                        img.src = mvDataUrl;
                    });
                }

                // Return just the 3D model screenshot if no annotations or simple sync return
                // NOTE: toDataURL is synchronous in model-viewer? No, usually not for webgl context but model-viewer wrapper might be. 
                // Wait, model-viewer toDataURL IS synchronous.
                return mvDataUrl;

            } catch (e) {
                console.error('Screenshot error:', e);
                return null;
            }
        },
        clearAnnotations: () => {
            setAnnotations([]);
            setIsDrawingMode(false);
            setTool('pointer');
            setCurrentAnnotation(null);
            setIsDrawing(false);
            setSurfaceAnchor3D(null);
            setCaptureCamera(null);
        },
        setCameraState: (state) => {
            const mv = modelViewerRef.current;
            if (!mv || !state) return;

            try {
                // Handle JSON string input (from DB)
                let parsedState = state;
                if (typeof state === 'string') {
                    try {
                        parsedState = JSON.parse(state);
                    } catch (e) {
                        console.error('Failed to parse camera state JSON:', e);
                        return;
                    }
                }

                // Enable smooth camera transition (lower = slower, 50 ≈ 1 second transition)
                const originalDecay = mv.interpolationDecay;
                mv.interpolationDecay = 50;

                if (parsedState.orbit) {
                    // Check if orbit is object or string
                    if (typeof parsedState.orbit === 'object') {
                        mv.cameraOrbit = `${parsedState.orbit.theta}rad ${parsedState.orbit.phi}rad ${parsedState.orbit.radius}m`;
                    } else {
                        mv.cameraOrbit = parsedState.orbit;
                    }
                }
                if (parsedState.target) {
                    if (typeof parsedState.target === 'object') {
                        mv.cameraTarget = `${parsedState.target.x}m ${parsedState.target.y}m ${parsedState.target.z}m`;
                    } else {
                        mv.cameraTarget = parsedState.target;
                    }
                }
                if (parsedState.fov) {
                    mv.fieldOfView = typeof parsedState.fov === 'number' ? `${parsedState.fov}deg` : parsedState.fov;
                }

                // Reset interpolation decay after transition completes (~1.5 seconds)
                setTimeout(() => {
                    if (modelViewerRef.current) {
                        modelViewerRef.current.interpolationDecay = originalDecay || 100;
                    }
                }, 1500);

            } catch (e) {
                console.error('Error setting camera state:', e);
            }
        },
        setHotspots: (newHotspots) => setHotspots(newHotspots || []),
        setCameraViews: (newViews) => setCameraViews(newViews || []),
        seek: handleSeek,
        resetView: () => {
            const mv = modelViewerRef.current;
            if (mv) {
                mv.cameraOrbit = '0deg 75deg auto';
                mv.cameraTarget = 'auto auto auto';
                mv.fieldOfView = 'auto';
            }
        },
        fitView: () => {
            const mv = modelViewerRef.current;
            if (mv) {
                mv.cameraOrbit = 'auto auto auto';
                mv.fieldOfView = 'auto';
            }
        }
    }));

    // 2D Drawing logic
    const getPos = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        return {
            pixel: { x, y },
            norm: { x: x / rect.width, y: y / rect.height }
        };
    };

    const startDrawing = (e) => {
        if (!isDrawingMode) return;
        if (e.touches) e.preventDefault();
        const pos = getPos(e);
        setStartPos(pos.norm);
        setLastPos(pos.norm);

        if (tool === 'object-eraser') {
            const clickedIndex = [...annotations].reverse().findIndex(shape => isPointInShape(pos.norm, shape, canvasRef.current.getBoundingClientRect()));
            if (clickedIndex !== -1) {
                const actualIndex = annotations.length - 1 - clickedIndex;
                const newAnnotations = [...annotations];
                newAnnotations.splice(actualIndex, 1);
                setAnnotations(newAnnotations);
            }
            return;
        }
        if (tool === 'pointer') {
            const clickedIndex = [...annotations].reverse().findIndex(shape => isPointInShape(pos.norm, shape, canvasRef.current.getBoundingClientRect()));
            if (clickedIndex !== -1) {
                const actualIndex = annotations.length - 1 - clickedIndex;
                setDraggingAnnotation({ ...annotations[actualIndex], index: actualIndex });
                setIsDrawing(true);
            }
            return;
        }
        setIsDrawing(true);
        if (tool === 'pencil' || tool === 'highlighter' || tool === 'eraser') {
            setCurrentAnnotation({ tool, color, strokeWidth, points: [pos.norm], isNormalized: true });
        } else if (tool === 'text') {
            const text = prompt("Enter text:");
            if (text) {
                setAnnotations([...annotations, { tool, color, strokeWidth, x: pos.norm.x, y: pos.norm.y, text, isNormalized: true }]);
            }
            setIsDrawing(false);
        } else {
            setCurrentAnnotation({ tool, color, strokeWidth, x: pos.norm.x, y: pos.norm.y, w: 0, h: 0, isNormalized: true });
        }
    };

    const draw = (e) => {
        const pos = getPos(e);
        setCursorPos(pos.pixel);
        if (tool === 'object-eraser') {
            const hitIndex = [...annotations].reverse().findIndex(shape => isPointInShape(pos.norm, shape, canvasRef.current.getBoundingClientRect()));
            const actualIndex = hitIndex !== -1 ? annotations.length - 1 - hitIndex : -1;
            if (hoveredShapeIndex !== actualIndex) setHoveredShapeIndex(actualIndex);
        } else if (hoveredShapeIndex !== -1) setHoveredShapeIndex(-1);

        if (tool === 'pointer' && !isDrawing) {
            const hit = annotations.some(shape => isPointInShape(pos.norm, shape, canvasRef.current.getBoundingClientRect()));
            canvasRef.current.style.cursor = hit ? 'move' : 'default';
        }

        if (tool === 'object-eraser') {
            canvasRef.current.style.cursor = 'cell'; // Or 'crosshair'
        }

        if (!isDrawing || !isDrawingMode) return;
        if (tool === 'pointer' && draggingAnnotation) {
            const deltaX = pos.norm.x - lastPos.x;
            const deltaY = pos.norm.y - lastPos.y;
            const updatedShape = moveShape(draggingAnnotation, { x: deltaX, y: deltaY });
            setDraggingAnnotation(updatedShape);
            setLastPos(pos.norm);
            const newAnnotations = [...annotations];
            newAnnotations[draggingAnnotation.index] = updatedShape;
            setAnnotations(newAnnotations);
            return;
        }
        if (tool === 'pencil' || tool === 'highlighter' || tool === 'eraser') {
            setCurrentAnnotation(prev => ({ ...prev, points: [...prev.points, pos.norm] }));
        } else {
            setCurrentAnnotation(prev => ({ ...prev, w: pos.norm.x - startPos.x, h: pos.norm.y - startPos.y }));
        }
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        setDraggingAnnotation(null);
        if (currentAnnotation) {
            // Save aspect ratio to allow responsiveness correction
            const finalAnnotation = {
                ...currentAnnotation,
                aspectRatio: canvasRef.current ? (canvasRef.current.width / canvasRef.current.height) : 1.5
            };
            setAnnotations([...annotations, finalAnnotation]);
            setCurrentAnnotation(null);
        }
    };

    // Animation state for annotations
    const [annotationProgress, setAnnotationProgress] = useState(1);
    const animationRef = useRef(null);
    const isProgrammaticCamera = useRef(false);

    // Animate annotations when viewing different ones
    useEffect(() => {
        if (viewingAnnotation) {
            setAnnotationProgress(0);
            const startTime = performance.now();
            const duration = 1000; // 1 second animation

            const animate = (time) => {
                const elapsed = time - startTime;
                const progress = Math.min(elapsed / duration, 1);
                // Ease out cubic
                const eased = 1 - Math.pow(1 - progress, 3);
                setAnnotationProgress(eased);

                if (progress < 1) {
                    animationRef.current = requestAnimationFrame(animate);
                }
            };
            animationRef.current = requestAnimationFrame(animate);
        } else {
            setAnnotationProgress(1);
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        }

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [viewingAnnotation]);

    // Draw shapes on canvas
    const drawShape = useCallback((ctx, shape, progress = 1) => {
        ctx.beginPath();
        ctx.strokeStyle = shape.color;

        const canvas = ctx.canvas;
        const w = canvas.width;
        const h = canvas.height;
        const currentAspect = w / h;

        // Calculate scale correction based on Aspect Ratio regimes (Landscape > 1 vs Portrait <= 1)
        // model-viewer typically switches from Fixed VFOV (Landscape) to Fixed HFOV (Portrait) at Aspect = 1.
        let scaleX = 1;
        let scaleY = 1;

        if (shape.aspectRatio) {
            const savedAspect = shape.aspectRatio;
            const isSavedLandscape = savedAspect > 1;
            const isCurrentLandscape = currentAspect > 1;

            if (isSavedLandscape && isCurrentLandscape) {
                // Both Landscape: Fixed VFOV. Scale X only.
                scaleX = savedAspect / currentAspect;
                scaleY = 1;
            } else if (!isSavedLandscape && !isCurrentLandscape) {
                // Both Portrait: Fixed HFOV. Scale Y only.
                scaleX = 1;
                scaleY = currentAspect / savedAspect;
            } else if (isSavedLandscape && !isCurrentLandscape) {
                // Landscape -> Portrait. 
                // L -> Square (ScaleX = Saved/1, Y=1) -> Portrait (ScaleX=1, ScaleY = Current/1)
                scaleX = savedAspect;
                scaleY = currentAspect;
            } else if (!isSavedLandscape && isCurrentLandscape) {
                // Portrait -> Landscape.
                // P -> Square (X=1, ScaleY = 1/Saved) -> Landscape (ScaleX = 1/Current, Y=1)
                scaleX = 1 / currentAspect;
                scaleY = 1 / savedAspect;
            }
        }

        const scaleFactor = Math.max((currentAspect > 1 ? h : w) / 1080, 0.5);
        const width = shape.strokeWidth || 5;
        const baseWidth = shape.tool === 'highlighter' ? width * 3 : width;
        ctx.lineWidth = baseWidth * scaleFactor;

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = shape.tool === 'highlighter' ? 0.4 : 1.0;
        ctx.fillStyle = shape.color;

        const isNormalized = (val) => val <= 1.5;

        const getCoord = (sx, sy) => {
            let x = sx;
            let y = sy;

            // Apply Aspect Ratio Correction
            if (scaleX !== 1) x = (x - 0.5) * scaleX + 0.5;
            if (scaleY !== 1) y = (y - 0.5) * scaleY + 0.5;

            if (shape.isNormalized || (shape.points && shape.points.length > 0 && isNormalized(shape.points[0].x))) {
                return { x: x * w, y: y * h };
            }
            return { x: sx, y: sy };
        };

        if (shape.tool === 'pencil' || shape.tool === 'highlighter' || shape.tool === 'eraser') {
            if (!shape.points || shape.points.length < 2) return;

            // Progressive drawing based on points count
            const totalPoints = shape.points.length;
            const drawCount = Math.max(2, Math.floor(totalPoints * progress)); // Ensure at least 2 points to draw line

            const p0 = getCoord(shape.points[0].x, shape.points[0].y);
            ctx.moveTo(p0.x, p0.y);
            for (let i = 1; i < drawCount; i++) {
                const pi = getCoord(shape.points[i].x, shape.points[i].y);
                ctx.lineTo(pi.x, pi.y);
            }
            if (shape.tool === 'eraser') {
                ctx.globalCompositeOperation = 'destination-out';
                ctx.lineWidth = (width * 3) * scaleFactor;
            } else {
                ctx.globalCompositeOperation = 'source-over';
            }
            ctx.stroke();
        } else {
            const p = getCoord(shape.x, shape.y);
            // Apply scale to dimensions
            const dims = { w: shape.w * w * scaleX, h: shape.h * h * scaleY };

            // Apply opacity/reveal based on progress for primitive shapes
            if (progress < 1) {
                //   ctx.globalAlpha = progress; // Simple fade in for shapes
            }

            if (shape.tool === 'rect') {
                // Animate stroke dash
                if (progress < 1) {
                    const perimeter = 2 * (Math.abs(dims.w) + Math.abs(dims.h));
                    ctx.setLineDash([perimeter * progress, perimeter]);
                }
                ctx.strokeRect(p.x, p.y, dims.w, dims.h);
                ctx.setLineDash([]);
            } else if (shape.tool === 'circle') {
                if (progress < 1) {
                    // Arc length animation
                    ctx.beginPath();
                    ctx.ellipse(p.x + dims.w / 2, p.y + dims.h / 2, Math.abs(dims.w / 2), Math.abs(dims.h / 2), 0, 0, 2 * Math.PI * progress);
                    ctx.stroke();
                } else {
                    ctx.ellipse(p.x + dims.w / 2, p.y + dims.h / 2, Math.abs(dims.w / 2), Math.abs(dims.h / 2), 0, 0, 2 * Math.PI);
                    ctx.stroke();
                }
            } else if (shape.tool === 'line') {
                const tox = p.x + dims.w * progress;
                const toy = p.y + dims.h * progress;
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(tox, toy);
                ctx.stroke();
            } else if (shape.tool === 'arrow') {
                // Animate line then head
                const lineProgress = Math.min(progress * 1.2, 1); // Line done at 80%
                const headProgress = Math.max((progress - 0.8) * 5, 0); // Head starts at 80%

                const tox = p.x + dims.w * lineProgress;
                const toy = p.y + dims.h * lineProgress;

                ctx.moveTo(p.x, p.y);
                ctx.lineTo(tox, toy);
                ctx.stroke();

                if (headProgress > 0) {
                    const fullTox = p.x + dims.w;
                    const fullToy = p.y + dims.h;
                    const headlen = width * 3 * scaleFactor * headProgress;
                    const angle = Math.atan2(dims.h, dims.w); // Angle is constant based on full vector

                    ctx.beginPath();
                    ctx.moveTo(fullTox, fullToy);
                    ctx.lineTo(fullTox - headlen * Math.cos(angle - Math.PI / 6), fullToy - headlen * Math.sin(angle - Math.PI / 6));
                    ctx.moveTo(fullTox, fullToy);
                    ctx.lineTo(fullTox - headlen * Math.cos(angle + Math.PI / 6), fullToy - headlen * Math.sin(angle + Math.PI / 6));
                    ctx.stroke();
                }

            } else if (shape.tool === 'text') {
                ctx.globalAlpha = progress;
                ctx.font = `${(width * 3) * scaleFactor}px sans-serif`;
                ctx.fillText(shape.text || 'Text', p.x, p.y);
            }
        }
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = 'source-over';
    }, []);

    const [resizeTrigger, setResizeTrigger] = useState(0);
    useEffect(() => {
        const handleResize = () => setResizeTrigger(prev => prev + 1);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Render annotations
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const rect = canvas.getBoundingClientRect();
        if (canvas.width !== rect.width || canvas.height !== rect.height) {
            canvas.width = rect.width;
            canvas.height = rect.height;
        }

        // If viewing an annotation, only render that one with animation
        if (viewingAnnotation) {
            // Handle 3D anchored annotations which have a different structure
            let shapes;
            if (viewingAnnotation.is3DAnchoredAnnotation && viewingAnnotation.shapes) {
                shapes = viewingAnnotation.shapes;
            } else if (Array.isArray(viewingAnnotation)) {
                shapes = viewingAnnotation;
            } else {
                shapes = [viewingAnnotation];
            }
            shapes.forEach(shape => drawShape(ctx, shape, annotationProgress));
        } else {
            const all = [...annotations, currentAnnotation].filter(Boolean);
            // Flatten in case some annotations are arrays
            const flattened = all.flatMap(a => Array.isArray(a) ? a : [a]);
            flattened.forEach(shape => drawShape(ctx, shape, 1)); // Draw others fully
        }

    }, [annotations, currentAnnotation, viewingAnnotation, isDrawingMode, drawShape, annotationProgress, resizeTrigger]);

    // Handle touch events manually to support non-passive listener for preventDefault
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const handleTouchStart = (e) => {
            startDrawing(e);
        };

        const handleTouchMove = (e) => {
            draw(e);
        };

        const handleTouchEnd = (e) => {
            stopDrawing(e);
        };

        canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
        canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
        canvas.addEventListener('touchend', handleTouchEnd);
        canvas.addEventListener('touchcancel', handleTouchEnd);

        return () => {
            canvas.removeEventListener('touchstart', handleTouchStart);
            canvas.removeEventListener('touchmove', handleTouchMove);
            canvas.removeEventListener('touchend', handleTouchEnd);
            canvas.removeEventListener('touchcancel', handleTouchEnd);
        };
    }, [startDrawing, draw, stopDrawing]); // Dependencies for the handlers

    // Handle drawing mode trigger - capture 3D surface anchor from screen center
    // This captures the surface when the external trigger fires
    useEffect(() => {
        if (isDrawingModeTrigger) {
            setIsDrawingMode(true);
            setAnnotations([]);
            setTool('pointer');
        }
    }, [isDrawingModeTrigger]);

    // Capture 3D surface anchor whenever drawing mode is activated
    // This works for both external trigger AND toolbar activation
    const wasDrawingModeRef = useRef(false);
    useEffect(() => {
        // Only capture when drawing mode just became true
        if (isDrawingMode && !wasDrawingModeRef.current) {
            // Capture surface anchor from center of viewer
            const mv = modelViewerRef.current;
            if (mv) {
                const rect = mv.getBoundingClientRect();
                // surfaceFromPoint expects CLIENT coordinates (viewport-relative), not element-relative!
                const centerClientX = rect.left + rect.width / 2;
                const centerClientY = rect.top + rect.height / 2;

                // Get surface from center point using CLIENT coordinates
                const surface = mv.surfaceFromPoint(centerClientX, centerClientY);
                if (surface) {
                    setSurfaceAnchor3D(surface);
                } else {
                    // Fallback: try multiple points around center to find a surface
                    const offsets = [
                        [50, 0], [-50, 0], [0, 50], [0, -50],
                        [100, 0], [-100, 0], [0, 100], [0, -100],
                        [100, 100], [-100, -100], [100, -100], [-100, 100]
                    ];
                    for (const [ox, oy] of offsets) {
                        const s = mv.surfaceFromPoint(centerClientX + ox, centerClientY + oy);
                        if (s) {
                            setSurfaceAnchor3D(s);
                            break;
                        }
                    }
                }

                // Capture camera state and aspect ratio
                const orbit = mv.getCameraOrbit();
                const target = mv.getCameraTarget();
                setCaptureCamera({
                    orbit: `${orbit.theta}rad ${orbit.phi}rad ${orbit.radius}m`,
                    target: `${target.x}m ${target.y}m ${target.z}m`,
                    fov: `${mv.getFieldOfView()}deg`,
                    aspectRatio: rect.width / rect.height
                });
            }
        }
        wasDrawingModeRef.current = isDrawingMode;
    }, [isDrawingMode]);

    // Render hotspots including annotation hotspots from comments
    const renderHotspots = () => {
        const elements = [];

        // Regular hotspots
        hotspots.forEach(hotspot => {
            if (hotspot.type === 'point') {
                elements.push(
                    <button
                        key={hotspot.id}
                        slot={`hotspot-${hotspot.id}`}
                        data-position={hotspot.position}
                        data-normal={hotspot.normal}
                        className="hotspot-point"
                        style={{
                            '--hotspot-color': hotspot.color || '#ef4444',
                            backgroundColor: hotspot.color || '#ef4444'
                        }}
                        onClick={() => setSelectedHotspot(hotspot)}
                        onMouseEnter={() => setHoveredHotspot(hotspot)}
                        onMouseLeave={() => setHoveredHotspot(null)}
                    >
                        <span className="hotspot-label">{hotspot.label}</span>
                    </button>
                );
            } else if (hotspot.type === 'surface') {
                elements.push(
                    <button
                        key={hotspot.id}
                        slot={`hotspot-${hotspot.id}`}
                        data-surface={hotspot.surface}
                        className="hotspot-surface"
                        style={{
                            '--hotspot-color': hotspot.color || '#22c55e',
                            backgroundColor: hotspot.color || '#22c55e'
                        }}
                        onClick={() => setSelectedHotspot(hotspot)}
                    >
                        <span className="hotspot-label">{hotspot.label}</span>
                    </button>
                );
            } else if (hotspot.type === 'dimension') {
                elements.push(
                    <React.Fragment key={hotspot.id}>
                        <button
                            slot={`hotspot-${hotspot.id}-start`}
                            data-position={hotspot.start.position}
                            data-normal={hotspot.start.normal}
                            className="hotspot-dimension"
                        />
                        <button
                            slot={`hotspot-${hotspot.id}-end`}
                            data-position={hotspot.end.position}
                            data-normal={hotspot.end.normal}
                            className="hotspot-dimension"
                        />
                    </React.Fragment>
                );
            }
        });

        // Annotation hotspots from comments (with profile pictures)
        let annotationCounter = 0;
        existingComments.forEach(comment => {
            if (!comment.annotation) return;

            let annotation;
            try {
                annotation = typeof comment.annotation === 'string'
                    ? JSON.parse(comment.annotation)
                    : comment.annotation;
            } catch (e) {
                return;
            }

            // Check if this is a 3D-anchored annotation
            if (!annotation.is3DAnchoredAnnotation || !annotation.surfaceAnchor3D) {
                return;
            }

            annotationCounter++;
            const authorName = comment.user?.name || comment.guestName || 'Guest';
            const avatarPath = comment.user?.avatarPath;
            const initials = authorName.charAt(0).toUpperCase();

            elements.push(
                <button
                    key={`annotation-${comment.id}`}
                    slot={`hotspot-annotation-${comment.id}`}
                    data-surface={annotation.surfaceAnchor3D}
                    className="annotation-hotspot-3d"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onCommentClick) {
                            onCommentClick(
                                comment.timestamp,
                                annotation.shapes || annotation,
                                comment.id,
                                comment
                            );
                        }
                        // Zoom to captured camera
                        if (annotation.captureCamera) {
                            const mv = modelViewerRef.current;
                            if (mv) {
                                mv.cameraOrbit = annotation.captureCamera.orbit;
                                mv.cameraTarget = annotation.captureCamera.target;
                                if (annotation.captureCamera.fov) mv.fieldOfView = annotation.captureCamera.fov;
                            }
                        }
                    }}
                    title={`${authorName} #${annotationCounter}`}
                >
                    <div className="annotation-avatar">
                        {avatarPath ? (
                            <img
                                src={`/api/media/avatars/${avatarPath}`}
                                alt={authorName}
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.parentElement.textContent = initials;
                                }}
                            />
                        ) : (
                            initials
                        )}
                    </div>
                    <div className="annotation-label">{authorName} #{annotationCounter}</div>
                </button>
            );
        });

        return elements;
    };

    return (
        <div className="w-full h-full relative bg-gray-900 group flex flex-col items-center justify-center" ref={containerRef}>
            <ShortcutsModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} mode="3d" />

            {/* Hotspot & Dimension Styles */}
            <style>{`
                .hotspot-point, .hotspot-surface {
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    border: 2px solid white;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: transform 0.2s;
                    pointer-events: auto;
                    transform: translate(-50%, -50%);
                }
                .hotspot-point:hover, .hotspot-surface:hover {
                    transform: translate(-50%, -50%) scale(1.2);
                }
                .hotspot-label {
                    position: absolute;
                    top: -28px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(0,0,0,0.8);
                    color: white;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 11px;
                    white-space: nowrap;
                    pointer-events: none;
                }
                .hotspot-dimension {
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    background: #3b82f6;
                    border: 2px solid white;
                }
                
                /* Annotation hotspot styles (3D comments) */
                .annotation-hotspot-3d {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: transform 0.2s ease;
                    pointer-events: auto;
                    background: transparent;
                    border: none;
                    padding: 0;
                    transform: translate(-50%, -50%);
                    width: 36px;
                    height: 36px;
                    position: relative;
                }
                .annotation-hotspot-3d:hover {
                    transform: translate(-50%, -50%) scale(1.15);
                    z-index: 100;
                }
                .annotation-avatar {
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    border: 2px solid white;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
                    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 14px;
                    font-weight: bold;
                    overflow: hidden;
                    flex-shrink: 0;
                }
                .annotation-avatar img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                .annotation-label {
                    position: absolute;
                    top: 42px; /* 36px height + 6px gap */
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(0, 0, 0, 0.85);
                    backdrop-filter: blur(8px);
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: 600;
                    color: white;
                    white-space: nowrap;
                    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    width: max-content;
                    max-width: 200px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                /* Hide interaction prompt */
                model-viewer::part(interaction-prompt) {
                    display: none;
                }
                model-viewer > #prompt {
                    display: none !important;
                }
            `}</style>

            <div className="flex-1 min-h-0 w-full flex items-center justify-center relative overflow-hidden">
                <div className="w-full h-full relative bg-black touch-none overflow-hidden">
                    {/* Loading State */}
                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                            <div className="text-white text-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                                <p>Loading 3D Model...</p>
                            </div>
                        </div>
                    )}

                    {/* Error State */}
                    {error && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                            <div className="text-red-500 text-center p-4">
                                <p className="font-bold mb-2">Error</p>
                                <p>{error}</p>
                            </div>
                        </div>
                    )}

                    {/* Model Viewer */}
                    {modelSrc && (
                        <model-viewer
                            ref={modelViewerRef}
                            src={modelSrc}
                            alt="3D Model"
                            camera-controls
                            touch-action="pan-y"
                            shadow-intensity={shadowEnabled ? shadowIntensity : 0}
                            environment-image={environmentImage}
                            exposure={exposure}
                            auto-rotate={autoRotate ? '' : undefined}
                            auto-rotate-delay="0"
                            rotation-per-second={`${autoRotateSpeed}deg`}
                            style={{ width: '100%', height: '100%', backgroundColor: '#1a1a1a' }}
                            onClick={handleModelClick}
                            interaction-prompt="none"
                        >
                            <div slot="progress-bar" className="hidden"></div>
                            {renderHotspots()}
                        </model-viewer>
                    )}

                    {/* SVG Overlay for Dimension Lines */}
                    <svg
                        ref={svgRef}
                        className="absolute inset-0 w-full h-full pointer-events-none z-10"
                        style={{ overflow: 'visible' }}
                    >
                        {hotspots.filter(h => h.type === 'dimension').map(dim => (
                            <g key={dim.id}>
                                <line
                                    id={`line-${dim.id}`}
                                    stroke={dim.color || '#3b82f6'}
                                    strokeWidth="2"
                                    strokeDasharray="5,5"
                                />
                                <text
                                    id={`text-${dim.id}`}
                                    fill="white"
                                    fontSize="14"
                                    fontWeight="bold"
                                    textAnchor="middle"
                                    style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
                                >
                                    {dim.distance} cm
                                </text>
                            </g>
                        ))}
                    </svg>

                    {/* Left Controls - MOVED TO TOP RIGHT BELOW SHORTCUTS */}
                    <div className="absolute top-28 right-4 flex flex-col gap-2 z-[30] pointer-events-auto">
                        <div className="bg-black/50 backdrop-blur p-2 rounded flex flex-col gap-2">
                            <button
                                onClick={() => {
                                    const mv = modelViewerRef.current;
                                    if (mv) {
                                        mv.cameraOrbit = '0deg 75deg auto';
                                        mv.cameraTarget = 'auto auto auto';
                                    }
                                }}
                                className="p-1 rounded hover:bg-white/20"
                                title="Reset View (H)"
                            >
                                <RotateCcw size={20} color="white" />
                            </button>
                            <button
                                onClick={() => {
                                    const mv = modelViewerRef.current;
                                    if (mv) {
                                        mv.cameraOrbit = 'auto auto auto';
                                        mv.fieldOfView = 'auto';
                                    }
                                }}
                                className="p-1 rounded hover:bg-white/20"
                                title="Fit View (F)"
                            >
                                <Maximize2 size={20} color="white" />
                            </button>

                            <button
                                onClick={() => setAutoRotate(!autoRotate)}
                                className={`p-1 rounded transition-colors ${autoRotate ? 'bg-blue-500/50' : 'hover:bg-white/20'}`}
                                title="Turntable (T)"
                            >
                                <RotateCw size={20} color="white" />
                            </button>

                            <button
                                onClick={() => setShowStatsPanel(!showStatsPanel)}
                                className={`p-1 rounded transition-colors ${showStatsPanel ? 'bg-blue-500/50' : 'hover:bg-white/20'}`}
                                title="Model Info (I)"
                            >
                                <Info size={20} color="white" />
                            </button>

                            <button
                                onClick={() => setShowDimensions(!showDimensions)}
                                className={`p-1 rounded transition-colors ${showDimensions ? 'bg-blue-500/50' : 'hover:bg-white/20'}`}
                                title="Show Dimensions"
                            >
                                <Box size={20} color="white" />
                            </button>

                            <button
                                onClick={() => setShowToolsPanel(!showToolsPanel)}
                                className={`p-1 rounded transition-colors ${showToolsPanel ? 'bg-blue-500/50' : 'hover:bg-white/20'}`}
                                title="Viewer Settings"
                            >
                                <Settings size={20} color="white" />
                            </button>
                        </div>
                    </div>

                    {/* Settings Panel - Top Right aligned */}
                    {showToolsPanel && (
                        <div className="absolute top-28 right-16 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-white/10 z-10 min-w-[280px]">
                            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                                <Settings size={16} /> Viewer Settings
                            </h3>

                            {/* HDR Environment */}
                            <div className="mb-4">
                                <label className="text-white/70 text-xs block mb-2">Environment (HDR)</label>
                                <div className="flex flex-wrap gap-1">
                                    {HDR_ENVIRONMENTS.map(env => (
                                        <button
                                            key={env.id}
                                            onClick={() => setEnvironmentImage(env.id)}
                                            className={`px-2 py-1 rounded text-xs transition-colors ${environmentImage === env.id
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-white/10 text-white/70 hover:bg-white/20'
                                                }`}
                                        >
                                            {env.icon} {env.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Exposure */}
                            <div className="mb-4">
                                <label className="text-white/70 text-xs block mb-2">
                                    <Sun size={12} className="inline mr-1" />
                                    Exposure: {exposure.toFixed(1)}
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="3"
                                    step="0.1"
                                    value={exposure}
                                    onChange={(e) => setExposure(parseFloat(e.target.value))}
                                    className="w-full accent-blue-500"
                                />
                            </div>

                            {/* Shadow */}
                            <div className="mb-4">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-white/70 text-xs">
                                        Shadow: {shadowIntensity.toFixed(1)}
                                    </label>
                                    <button
                                        onClick={() => setShadowEnabled(!shadowEnabled)}
                                        className={`p-1 rounded ${shadowEnabled ? 'bg-blue-500/50' : 'bg-white/10'}`}
                                    >
                                        {shadowEnabled ? <Eye size={14} color="white" /> : <EyeOff size={14} color="white" />}
                                    </button>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="2"
                                    step="0.1"
                                    value={shadowIntensity}
                                    onChange={(e) => setShadowIntensity(parseFloat(e.target.value))}
                                    className="w-full accent-blue-500"
                                    disabled={!shadowEnabled}
                                />
                            </div>

                            {/* Annotation Lines Toggle */}
                            {existingComments.length > 0 && (
                                <div className="mb-4">
                                    <div className="flex items-center justify-between">
                                        <label className="text-white/70 text-xs">
                                            Show Annotation Lines
                                        </label>
                                        <button
                                            onClick={() => {
                                                const newVal = !showAnnotationLines;
                                                setShowAnnotationLines(newVal);
                                                localStorage.setItem('3d_annotation_lines', newVal.toString());
                                            }}
                                            className={`p-1 rounded ${showAnnotationLines ? 'bg-blue-500/50' : 'bg-white/10'}`}
                                            title="Toggle connection lines between annotations and model"
                                        >
                                            {showAnnotationLines ? <Eye size={14} color="white" /> : <EyeOff size={14} color="white" />}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Turntable Speed */}
                            {autoRotate && (
                                <div className="mb-4">
                                    <label className="text-white/70 text-xs block mb-2">
                                        <RotateCw size={12} className="inline mr-1" />
                                        Rotation Speed: {autoRotateSpeed}°/s
                                    </label>
                                    <input
                                        type="range"
                                        min="5"
                                        max="120"
                                        step="5"
                                        value={autoRotateSpeed}
                                        onChange={(e) => setAutoRotateSpeed(parseInt(e.target.value))}
                                        className="w-full accent-blue-500"
                                    />
                                </div>
                            )}

                            {/* Camera Presets */}
                            <div className="mb-4">
                                <label className="text-white/70 text-xs block mb-2">
                                    <Camera size={12} className="inline mr-1" />
                                    Camera Presets
                                </label>
                                <div className="grid grid-cols-4 gap-1">
                                    {CAMERA_PRESETS.map(preset => (
                                        <button
                                            key={preset.id}
                                            onClick={() => applyCameraPreset(preset)}
                                            className="px-2 py-1 bg-white/10 rounded text-xs text-white/70 hover:bg-white/20 transition-colors"
                                        >
                                            {preset.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Material Variants */}
                            {materialVariants.length > 0 && (
                                <div className="mb-4">
                                    <label className="text-white/70 text-xs block mb-2">
                                        <Palette size={12} className="inline mr-1" />
                                        Material Variants
                                    </label>
                                    <select
                                        value={selectedVariant || ''}
                                        onChange={(e) => handleVariantChange(e.target.value)}
                                        className="w-full bg-white/10 text-white text-sm rounded px-2 py-1 border border-white/20"
                                    >
                                        <option value="">Default</option>
                                        {materialVariants.map((variant, i) => (
                                            <option key={i} value={variant}>{variant}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Stats Panel - Top Right */}
                    {showStatsPanel && (
                        <div className="absolute top-28 right-16 bg-black/80 backdrop-blur-md rounded-lg p-3 border border-white/10 z-10 min-w-[200px]">
                            <h4 className="text-white text-sm font-semibold mb-2 flex items-center gap-2">
                                <Box size={14} /> Model Info
                            </h4>
                            <div className="text-white/70 text-xs space-y-1">
                                {modelStats && (
                                    <>
                                        <div className="flex justify-between">
                                            <span>Animations:</span>
                                            <span className="text-white">{modelStats.animations}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Material Variants:</span>
                                            <span className="text-white">{modelStats.variants}</span>
                                        </div>
                                    </>
                                )}
                                {modelDimensions && (
                                    <>
                                        <div className="border-t border-white/10 my-2"></div>
                                        <div className="flex justify-between">
                                            <span>Width:</span>
                                            <span className="text-white">{modelDimensions.width} cm</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Height:</span>
                                            <span className="text-white">{modelDimensions.height} cm</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Depth:</span>
                                            <span className="text-white">{modelDimensions.depth} cm</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Dimensions Overlay */}
                    {showDimensions && modelDimensions && (
                        <div className="absolute bottom-4 right-4 bg-black/80 backdrop-blur-md rounded-lg p-3 border border-white/10 z-10">
                            <div className="text-white text-sm font-mono">
                                <span className="text-blue-400">{modelDimensions.width}</span> ×
                                <span className="text-green-400"> {modelDimensions.height}</span> ×
                                <span className="text-red-400"> {modelDimensions.depth}</span> cm
                            </div>
                        </div>
                    )}

                    {/* Shortcuts Button */}
                    <div className="absolute top-16 right-4 flex flex-col gap-2 z-30">
                        <button
                            onClick={() => setShowShortcuts(true)}
                            className="bg-black/50 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur border border-white/10 transition-colors"
                            title="Shortcuts"
                        >
                            <Keyboard size={20} />
                        </button>
                    </div>

                    {/* 2D Overlay Canvas */}
                    <canvas
                        ref={canvasRef}
                        className={`absolute top-0 left-0 w-full h-full z-20 touch-none ${isDrawingMode ? (tool === 'pointer' ? 'cursor-default' : (tool === 'object-eraser' ? 'cursor-cell' : 'cursor-none')) : 'pointer-events-none'}`}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                    // Touch events handled by effect for non-passive listener
                    />

                    {/* Cursor Preview */}
                    {isDrawingMode && tool !== 'pointer' && tool !== 'text' && tool !== 'object-eraser' && (
                        <div
                            className="absolute pointer-events-none rounded-full border border-white z-20"
                            style={{
                                left: cursorPos.x,
                                top: cursorPos.y,
                                width: Math.max(strokeWidth * (canvasRef.current ? canvasRef.current.clientWidth / canvasRef.current.width : 1) * (tool === 'highlighter' ? 3 : 1), 4) + 'px',
                                height: Math.max(strokeWidth * (canvasRef.current ? canvasRef.current.clientWidth / canvasRef.current.width : 1) * (tool === 'highlighter' ? 3 : 1), 4) + 'px',
                                transform: 'translate(-50%, -50%)',
                                backgroundColor: tool === 'eraser' ? 'rgba(255,255,255,0.5)' : color,
                                opacity: 0.8
                            }}
                        />
                    )}
                </div>

                {/* Layout Container */}
                <div className="absolute bottom-6 left-0 w-full px-6 flex items-end gap-4 pointer-events-none z-40">
                    {/* Playback Controls (Left or Hidden) */}
                    {animations.length > 0 ? (
                        <div className="flex-1 flex items-center gap-3 px-4 py-2 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full shadow-lg transition-all hover:bg-white/15 pointer-events-auto min-w-0">
                            <button
                                onClick={togglePlay}
                                className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/20 transition-colors text-white shrink-0"
                            >
                                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                            </button>

                            <div className="h-4 w-[1px] bg-white/20 mx-1 shrink-0" />

                            {/* Timeline */}
                            <div className="flex items-center flex-1 min-w-[120px] group/timeline relative">
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    value={duration ? (currentTime / duration) * 100 : 0}
                                    onChange={(e) => handleSeek((parseFloat(e.target.value) / 100) * duration)}
                                    className="w-full h-1 bg-white/30 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:hover:scale-125 [&::-webkit-slider-thumb]:transition-transform"
                                />
                            </div>

                            <span className="text-xs font-mono text-white/90 min-w-[80px] text-center tabular-nums shrink-0">
                                {Number(currentTime || 0).toFixed(2)} / {Number(duration || 0).toFixed(2)}s
                            </span>

                            <div className="h-4 w-[1px] bg-white/20 mx-1 shrink-0" />

                            {/* Animation Select (Opens Up) */}
                            <div className="relative group/anim shrink-0">
                                <button className="text-xs text-white/70 cursor-pointer hover:text-white px-2 py-1 flex items-center gap-1 max-w-[120px]">
                                    <span className="truncate">
                                        {animations[selectedAnimIndex] ? animations[selectedAnimIndex] : 'Anim'}
                                    </span>
                                    <ChevronUp size={14} className="opacity-50 group-hover/anim:opacity-100 transition-opacity" />
                                </button>

                                {/* Dropdown Menu (With Bridge for Hover) */}
                                <div className="absolute bottom-full left-0 pb-3 w-48 hidden group-hover/anim:block">
                                    <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl shadow-xl overflow-hidden p-1">
                                        {animations.map((anim, i) => (
                                            <button
                                                key={i}
                                                onClick={() => handleAnimChange(i)}
                                                className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors flex items-center justify-between ${selectedAnimIndex === i ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
                                            >
                                                <span className="truncate">{anim}</span>
                                                {selectedAnimIndex === i && <Check size={12} />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1" />
                    )}

                    {/* Tools (Right) */}
                    <div className={`pointer-events-auto transition-all duration-300 shrink-0`}>
                        <div className="relative flex items-center gap-2 px-2 py-2 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full shadow-lg transition-all hover:bg-white/15 min-h-[50px]">

                            {/* Annotation Input (Floating Above) */}
                            {isDrawingMode && (
                                <div className="absolute bottom-full right-0 mb-4 w-[400px] bg-black/60 backdrop-blur-2xl border border-white/10 rounded-2xl p-3 shadow-2xl flex flex-col gap-2 pointer-events-auto transition-all origin-bottom-right animate-in fade-in slide-in-from-bottom-4 z-50">
                                    <textarea
                                        value={commentText}
                                        onChange={(e) => {
                                            setCommentText(e.target.value);
                                            e.target.style.height = 'auto';
                                            e.target.style.height = e.target.scrollHeight + 'px';
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendReview();
                                            }
                                        }}
                                        placeholder="Add a comment..."
                                        className="w-full bg-transparent text-white/90 text-sm placeholder:text-white/40 resize-none outline-none p-1 min-h-[40px] max-h-[200px] overflow-y-auto"
                                        autoFocus
                                        rows={1}
                                        style={{ height: 'auto' }}
                                    />

                                    {/* Image Preview */}
                                    {imagePreview && (
                                        <div className="relative w-full max-h-[150px] overflow-hidden rounded-lg border border-white/20 mb-2 group">
                                            <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                            <button
                                                onClick={() => {
                                                    setImagePreview(null);
                                                    setSelectedImage(null);
                                                }}
                                                className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-red-500/80 transition-colors"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between border-t border-white/10 pt-2">
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            className="hidden"
                                            accept="image/*"
                                            onChange={(e) => {
                                                const file = e.target.files[0];
                                                if (file) {
                                                    setSelectedImage(file);
                                                    const reader = new FileReader();
                                                    reader.onload = (ev) => {
                                                        setImagePreview(ev.target.result);
                                                    };
                                                    reader.readAsDataURL(file);
                                                }
                                            }}
                                        />
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                            title="Attach Image"
                                        >
                                            <ImageIcon size={18} />
                                        </button>
                                        <button
                                            onClick={handleSendReview}
                                            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/20"
                                        >
                                            <Send size={18} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={() => {
                                    setTool('pointer');
                                    setAnnotation3DTool('pointer');
                                    setIsDrawingMode(false);
                                }}
                                className={`p-2 rounded-full transition-all ${(!isDrawingMode && tool === 'pointer') ? 'bg-white text-black shadow-lg shadow-white/20' : 'text-white hover:bg-white/20'}`}
                                title="Rotate 3D"
                            >
                                <Rotate3D size={20} />
                            </button>
                            <button
                                onClick={() => {
                                    const newMode = !isDrawingMode;
                                    setIsDrawingMode(newMode);
                                    if (newMode) setTool('pencil');
                                }}
                                className={`p-2 rounded-full transition-all ${isDrawingMode ? 'bg-white text-black shadow-lg shadow-white/20' : 'text-white hover:bg-white/20'}`}
                                title="Draw"
                            >
                                <Pencil size={20} />
                            </button>

                            {/* Integrated Drawing Toolbar */}
                            {isDrawingMode && (
                                <>
                                    <div className="h-6 w-[1px] bg-white/20 mx-1" />
                                    <DrawingToolbar
                                        tool={tool}
                                        setTool={setTool}
                                        color={color}
                                        setColor={setColor}
                                        strokeWidth={strokeWidth}
                                        setStrokeWidth={setStrokeWidth}
                                        onClose={() => { setAnnotations([]); setIsDrawingMode(false); }}
                                        setIsDrawingMode={setIsDrawingMode}
                                        extraTools={[]}
                                        onUndo={handleUndo}
                                        canUndo={historyIndex > 0}
                                        onSend={handleSendReview}
                                        hasChanges={hotspots.length > 0 || annotations.length > 0 || cameraViews.length > 0}
                                    />
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>



            {/* Hotspot Edit Modal Removed */}
        </div >
    );
});

export default ModelViewer;
