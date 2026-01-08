import React, { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Play, Pause, Volume2, Maximize, Pencil, Square, Circle, MoveRight, Type, Eraser, Highlighter, Check, X, MousePointer, Minus, MessageSquare, CornerUpRight, Spline } from 'lucide-react';

const VideoPlayer = forwardRef(({ src, compareSrc, compareAudioEnabled, onTimeUpdate, onDurationChange, onAnnotationSave, viewingAnnotation, isDrawingModeTrigger, onUserPlay, isGuest, guestName, isReadOnly, onPlayStateChange, loop, playbackRate, frameRate = 24 }, ref) => {
  const videoRef = useRef(null);
  const compareVideoRef = useRef(null);
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoError, setVideoError] = useState(null);
  const [showFullscreenMessage, setShowFullscreenMessage] = useState(false);

  // Drawing State
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [tool, setTool] = useState('pencil'); // pencil, rect, circle, arrow, line, text, eraser, highlighter, bubble, curve
  const [color, setColor] = useState('#ef4444'); // red-500
  const [strokeWidth, setStrokeWidth] = useState(10);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentAnnotation, setCurrentAnnotation] = useState(null); // The active shape being drawn
  const [annotations, setAnnotations] = useState([]); // List of shapes for current frame

  // Refs for callbacks to avoid effect dependencies
  const annotationsRef = useRef(annotations);
  const currentAnnotationRef = useRef(currentAnnotation);

  useEffect(() => {
      annotationsRef.current = annotations;
  }, [annotations]);

  useEffect(() => {
      currentAnnotationRef.current = currentAnnotation;
  }, [currentAnnotation]);

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
      getAnnotations: () => {
          // If user is currently drawing, finish the shape
          if (isDrawing && currentAnnotation) {
              return [...annotations, currentAnnotation];
          }
          return annotations;
      },
      clearAnnotations: () => {
          setAnnotations([]);
          setIsDrawingMode(false);
          setCurrentAnnotation(null);
          setIsDrawing(false);
      },
      seek: (time) => {
          if (videoRef.current) {
              videoRef.current.currentTime = time;
          }
          if (compareVideoRef.current) {
              compareVideoRef.current.currentTime = time;
          }
      },
      togglePlay: () => {
          togglePlay();
      },
      pause: () => {
          if (videoRef.current) {
              videoRef.current.pause();
              setIsPlaying(false);
              if (onPlayStateChange) onPlayStateChange(false);
          }
          if (compareVideoRef.current) {
              compareVideoRef.current.pause();
          }
      },
      toggleFullscreen: () => {
          if (!document.fullscreenElement) {
              containerRef.current?.requestFullscreen();
          } else {
              document.exitFullscreen();
          }
      },
      setVolume: (vol) => {
          if (videoRef.current) {
              videoRef.current.volume = vol;
          }
          if (compareVideoRef.current && compareAudioEnabled) {
              compareVideoRef.current.volume = vol;
          }
      },
      setPlaybackRate: (rate) => {
          if (videoRef.current) {
              videoRef.current.playbackRate = rate;
          }
          if (compareVideoRef.current) {
              compareVideoRef.current.playbackRate = rate;
          }
      }
  }));

  const handleVideoPlay = () => {
      setIsPlaying(true);
      if (onPlayStateChange) onPlayStateChange(true);
  };

  const handleVideoPause = () => {
      setIsPlaying(false);
      if (onPlayStateChange) onPlayStateChange(false);
  };

  useEffect(() => {
     if (videoRef.current) videoRef.current.loop = loop;
     if (compareVideoRef.current) compareVideoRef.current.loop = loop;
  }, [loop]);

  useEffect(() => {
      if (videoRef.current) videoRef.current.playbackRate = playbackRate || 1;
      if (compareVideoRef.current) compareVideoRef.current.playbackRate = playbackRate || 1;
  }, [playbackRate]);

  useEffect(() => {
      if (compareVideoRef.current) {
          compareVideoRef.current.muted = !compareAudioEnabled;
      }
  }, [compareAudioEnabled]);

  useEffect(() => {
      const handleFullscreenChange = () => {
          if (document.fullscreenElement) {
              setShowFullscreenMessage(true);
              setTimeout(() => setShowFullscreenMessage(false), 2000);
          } else {
              setShowFullscreenMessage(false);
          }
      };

      document.addEventListener('fullscreenchange', handleFullscreenChange);
      return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Coordinate Normalization Helpers
  const normalize = (x, y) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    return {
        x: x / canvas.width,
        y: y / canvas.height
    };
  };

  const drawShape = useCallback((ctx, shape) => {
      ctx.beginPath();
      ctx.strokeStyle = shape.color;

      const canvas = ctx.canvas;
      const scaleFactor = Math.max(canvas.width / 1920, 0.5);
      // Use stored strokeWidth if available, default to 10
      const width = shape.strokeWidth || 10;
      const baseWidth = shape.tool === 'highlighter' ? width * 3 : width;
      ctx.lineWidth = baseWidth * scaleFactor;

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = shape.tool === 'highlighter' ? 0.4 : 1.0;
      ctx.fillStyle = shape.color;

      const w = canvas.width;
      const h = canvas.height;
      const isNormalized = (val) => val <= 1.5;

      const getCoord = (sx, sy) => {
          if (shape.isNormalized || (shape.points && shape.points.length > 0 && isNormalized(shape.points[0].x))) {
               return { x: sx * w, y: sy * h };
          }
          if (shape.isNormalized || (shape.x !== undefined && isNormalized(shape.x))) {
               return { x: sx * w, y: sy * h };
          }
          return { x: sx, y: sy };
      };

      if (shape.tool === 'pencil' || shape.tool === 'highlighter' || shape.tool === 'eraser') {
          if (shape.points.length < 2) return;
          const p0 = getCoord(shape.points[0].x, shape.points[0].y);
          ctx.moveTo(p0.x, p0.y);
          for (let i = 1; i < shape.points.length; i++) {
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
          const dims = shape.isNormalized
              ? { w: shape.w * w, h: shape.h * h }
              : { w: shape.w, h: shape.h };

          if (!shape.isNormalized && isNormalized(shape.w) && shape.w > 0) {
             dims.w = shape.w * w;
             dims.h = shape.h * h;
          }

          if (shape.tool === 'rect') {
              ctx.strokeRect(p.x, p.y, dims.w, dims.h);
          } else if (shape.tool === 'circle') {
              ctx.ellipse(p.x + dims.w/2, p.y + dims.h/2, Math.abs(dims.w/2), Math.abs(dims.h/2), 0, 0, 2 * Math.PI);
              ctx.stroke();
          } else if (shape.tool === 'line') {
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(p.x + dims.w, p.y + dims.h);
              ctx.stroke();
          } else if (shape.tool === 'arrow') {
              const headlen = width * 3 * scaleFactor;
              const tox = p.x + dims.w;
              const toy = p.y + dims.h;
              const angle = Math.atan2(toy - p.y, tox - p.x);
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(tox, toy);
              ctx.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
              ctx.moveTo(tox, toy);
              ctx.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
              ctx.stroke();
          } else if (shape.tool === 'text') {
               ctx.font = `${(width * 3) * scaleFactor}px sans-serif`;
               ctx.fillText(shape.text || 'Text', p.x, p.y);
          } else if (shape.tool === 'bubble') {
              // Speech bubble
              const r = 10 * scaleFactor;
              const x = p.x;
              const y = p.y;
              const w_ = dims.w;
              const h_ = dims.h;

              ctx.beginPath();
              ctx.moveTo(x + r, y);
              ctx.lineTo(x + w_ - r, y);
              ctx.quadraticCurveTo(x + w_, y, x + w_, y + r);
              ctx.lineTo(x + w_, y + h_ - r);
              ctx.quadraticCurveTo(x + w_, y + h_, x + w_ - r, y + h_);

              // Tail
              // If width is negative, we are drawing leftwards.
              // Normalize for drawing logic
              const tailX = x + w_ * 0.2;
              const tailY = y + h_;

              ctx.lineTo(tailX + 10 * scaleFactor, y + h_);
              ctx.lineTo(tailX, y + h_ + 20 * scaleFactor);
              ctx.lineTo(tailX - 10 * scaleFactor, y + h_);

              ctx.lineTo(x + r, y + h_);
              ctx.quadraticCurveTo(x, y + h_, x, y + h_ - r);
              ctx.lineTo(x, y + r);
              ctx.quadraticCurveTo(x, y, x + r, y);
              ctx.stroke();

          } else if (shape.tool === 'curve') {
              // Quadratic curve from Start to End
              const startX = p.x;
              const startY = p.y;
              const endX = p.x + dims.w;
              const endY = p.y + dims.h;

              // Control point (offset perpendicular to line)
              const midX = (startX + endX) / 2;
              const midY = (startY + endY) / 2;

              // Simulating a curve by offsetting control point
              // For a simple interaction, dragging gives end point.
              // We'll just curve "up" relative to the line.
              const cpX = midX;
              const cpY = midY - Math.abs(dims.w) * 0.5; // Simple heuristic

              ctx.moveTo(startX, startY);
              ctx.quadraticCurveTo(cpX, cpY, endX, endY);
              ctx.stroke();

              // Arrow head at end
              const angle = Math.atan2(endY - cpY, endX - cpX);
              const headlen = width * 3 * scaleFactor;
              ctx.lineTo(endX - headlen * Math.cos(angle - Math.PI / 6), endY - headlen * Math.sin(angle - Math.PI / 6));
              ctx.moveTo(endX, endY);
              ctx.lineTo(endX - headlen * Math.cos(angle + Math.PI / 6), endY - headlen * Math.sin(angle + Math.PI / 6));
              ctx.stroke();
          }
      }

      ctx.globalAlpha = 1.0;
      ctx.globalCompositeOperation = 'source-over';
  }, []);

  // Stable redraw function
  const performRedraw = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const currentAnnos = annotationsRef.current || [];
      const activeAnno = currentAnnotationRef.current;

      [...currentAnnos, activeAnno].filter(Boolean).forEach(shape => drawShape(ctx, shape));
  }, [drawShape]);

  const updateCanvasLayout = useCallback(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    const canvas = canvasRef.current;

    if (!video || !container || !canvas) return;

    // Get video intrinsic dimensions
    const vw = video.videoWidth;
    const vh = video.videoHeight;

    if (!vw || !vh) return;

    // Get container dimensions
    const cw = container.clientWidth;
    const ch = container.clientHeight;

    // Calculate the displayed size of the video (simulating object-contain)
    const scale = Math.min(cw / vw, ch / vh);
    const displayedWidth = vw * scale;
    const displayedHeight = vh * scale;

    // Position centered
    const left = (cw - displayedWidth) / 2;
    const top = (ch - displayedHeight) / 2;

    // Check if update is needed to avoid loops
    if (canvas.width !== vw || canvas.height !== vh ||
        canvas.style.width !== `${displayedWidth}px` ||
        canvas.style.height !== `${displayedHeight}px` ||
        canvas.style.left !== `${left}px` ||
        canvas.style.top !== `${top}px`) {

        // Set canvas internal resolution to match video source
        if (canvas.width !== vw || canvas.height !== vh) {
            canvas.width = vw;
            canvas.height = vh;
        }

        // Set canvas CSS to match displayed video size
        canvas.style.width = `${displayedWidth}px`;
        canvas.style.height = `${displayedHeight}px`;
        canvas.style.left = `${left}px`;
        canvas.style.top = `${top}px`;

        // Redraw after layout update
        performRedraw();
    }
  }, [performRedraw]);

  // Handle trigger from parent (Annotate Button in Sidebar)
  useEffect(() => {
    if (isDrawingModeTrigger && !isReadOnly) {
        enterDrawingMode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDrawingModeTrigger, isReadOnly]);

  // Handle Viewing Annotation
  useEffect(() => {
      if (viewingAnnotation) {
          setAnnotations(viewingAnnotation);
      } else if (!isDrawingMode && isPlaying) {
          // If playing and no viewing annotation, clear.
          setAnnotations((prev) => prev.length === 0 ? prev : []);
      } else if (!isDrawingMode && !viewingAnnotation) {
          setAnnotations((prev) => prev.length === 0 ? prev : []);
      }
  }, [viewingAnnotation, isDrawingMode, isPlaying]);

  // Ensure annotations are cleared if playing starts (redundancy safety)
  useEffect(() => {
      if (isPlaying && !isDrawingMode && !viewingAnnotation) {
           setAnnotations([]);
      }
  }, [isPlaying, isDrawingMode, viewingAnnotation]);

  // Re-draw whenever annotations state changes
  useEffect(() => {
     performRedraw();
  }, [annotations, currentAnnotation, performRedraw]);

  // Handle resizing canvas
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
        // Wrap in RAF to avoid "ResizeObserver loop limit exceeded" and potential sync loops
        requestAnimationFrame(() => {
            updateCanvasLayout();
        });
    });

    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, [updateCanvasLayout]);

  const togglePlay = useCallback(() => {
    if (isDrawingMode) return;
    if (!videoRef.current) return;

    if (videoRef.current.paused) {
      videoRef.current.play();
      if (compareVideoRef.current) compareVideoRef.current.play().catch(e => console.log(e));
      setIsPlaying(true);
      if (onUserPlay) onUserPlay();
      if (onPlayStateChange) onPlayStateChange(true);
    } else {
      videoRef.current.pause();
      if (compareVideoRef.current) compareVideoRef.current.pause();
      setIsPlaying(false);
      if (onPlayStateChange) onPlayStateChange(false);
    }
  }, [isDrawingMode, onUserPlay, onPlayStateChange]);

  // Handle Spacebar to Toggle Play and Arrow Keys for seeking
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (e.code === 'Space') {
        e.preventDefault(); // Prevent scrolling
        togglePlay();
      } else if (e.code === 'ArrowRight') {
          e.preventDefault();
          if (videoRef.current) {
              videoRef.current.currentTime = Math.min(videoRef.current.duration, videoRef.current.currentTime + (1 / frameRate));
          }
      } else if (e.code === 'ArrowLeft') {
          e.preventDefault();
          if (videoRef.current) {
              videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - (1 / frameRate));
          }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, frameRate]);

  const handleTimeUpdate = () => {
    const time = videoRef.current.currentTime;
    setCurrentTime(time);
    if (onTimeUpdate) onTimeUpdate(time);

    // Strict sync for compare video
    if (compareVideoRef.current) {
        // Use a tighter threshold (e.g., ~1 frame at 24fps is 0.041s)
        if (Math.abs(compareVideoRef.current.currentTime - time) > 0.05) {
            compareVideoRef.current.currentTime = time;
        }
    }
  };

  const onLoadedMetadata = () => {
      const d = videoRef.current.duration;
      if (Number.isFinite(d)) {
          setDuration(d);
          if (onDurationChange) onDurationChange(d);
      }
      updateCanvasLayout();
  };

  const onVideoError = (e) => {
      console.error("Video Error Event:", e);
      if (videoRef.current && videoRef.current.error) {
          console.error("Video Error Details:", videoRef.current.error);
          setVideoError(videoRef.current.error.message);
      }
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Drawing Handlers
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
      // Prevent scrolling while drawing on touch devices
      if (e.touches) e.preventDefault();

      setIsDrawing(true);
      const pos = getPos(e);
      setStartPos(pos.norm);

      if (tool === 'pencil' || tool === 'highlighter' || tool === 'eraser') {
          setCurrentAnnotation({
              tool,
              color,
              strokeWidth,
              points: [pos.norm],
              isNormalized: true
          });
      } else if (tool === 'text') {
          const text = prompt("Enter text:");
          if (text) {
              setAnnotations([...annotations, {
                  tool,
                  color,
                  strokeWidth,
                  x: pos.norm.x,
                  y: pos.norm.y,
                  text,
                  isNormalized: true
              }]);
          }
          setIsDrawing(false);
      } else {
          setCurrentAnnotation({
              tool,
              color,
              strokeWidth,
              x: pos.norm.x,
              y: pos.norm.y,
              w: 0,
              h: 0,
              isNormalized: true
          });
      }
  };

  const draw = (e) => {
      if (!isDrawing || !isDrawingMode) return;
      const pos = getPos(e);

      if (tool === 'pencil' || tool === 'highlighter' || tool === 'eraser') {
          setCurrentAnnotation(prev => ({
              ...prev,
              points: [...prev.points, pos.norm]
          }));
      } else {
          setCurrentAnnotation(prev => ({
              ...prev,
              w: pos.norm.x - startPos.x,
              h: pos.norm.y - startPos.y
          }));
      }
  };

  const stopDrawing = () => {
      if (!isDrawing) return;
      setIsDrawing(false);
      if (currentAnnotation) {
          setAnnotations([...annotations, currentAnnotation]);
          setCurrentAnnotation(null);
      }
  };

  const enterDrawingMode = () => {
      setIsDrawingMode(true);
      videoRef.current.pause();
      setIsPlaying(false);
      updateCanvasLayout();
      setAnnotations([]);
  };

  const clearAnnotations = () => {
      setAnnotations([]);
  };

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden group bg-black w-full h-full">
      <div ref={containerRef} className="relative flex-1 flex justify-center items-center w-full min-h-0">
        {compareSrc ? (
            <div className="grid grid-cols-2 w-full h-full gap-1">
                <div className="relative w-full h-full flex items-center justify-center bg-black">
                     <video
                        ref={videoRef}
                        src={src}
                        className="max-h-full max-w-full object-contain"
                        onTimeUpdate={handleTimeUpdate}
                        onLoadedMetadata={onLoadedMetadata}
                        onError={onVideoError}
                        onPlay={handleVideoPlay}
                        onPause={handleVideoPause}
                        onEnded={handleVideoPause}
                        playsInline
                        webkit-playsinline="true"
                    />
                    <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded pointer-events-none">V1 (Current)</div>
                </div>
                <div className="relative w-full h-full flex items-center justify-center bg-black">
                     <video
                        ref={compareVideoRef}
                        src={compareSrc}
                        className="max-h-full max-w-full object-contain"
                        playsInline
                        webkit-playsinline="true"
                        muted={!compareAudioEnabled}
                    />
                    <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded pointer-events-none">V2 (Compare)</div>
                </div>
            </div>
        ) : (
            <video
                ref={videoRef}
                src={src}
                className={`max-h-full max-w-full object-contain ${videoError ? 'opacity-20' : ''}`}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={onLoadedMetadata}
                onError={onVideoError}
                onPlay={handleVideoPlay}
                onPause={handleVideoPause}
                onEnded={handleVideoPause}
                playsInline
                webkit-playsinline="true"
            />
        )}

        {videoError && (
            <div className="absolute inset-0 flex items-center justify-center text-red-500 bg-black/50 p-4 rounded z-20 pointer-events-none">
                <div>
                    Error loading video: {videoError}
                    <br/>
                    Source: {src}
                </div>
            </div>
        )}
        {/* Canvas Overlay */}
        <canvas
            ref={canvasRef}
            className={`absolute z-10 touch-none ${isDrawingMode ? 'cursor-crosshair' : 'pointer-events-none'} ${compareSrc ? 'pointer-events-none opacity-0' : ''}`} // Disable drawing in compare mode
            style={{ width: '0px', height: '0px' }} // Initial state
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
        />
      </div>

      {showFullscreenMessage && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded pointer-events-none transition-opacity duration-500 z-30">
              Press Esc to exit full screen
          </div>
      )}
      {/* Drawing Toolbar - Static Bottom */}
      {isDrawingMode && !isReadOnly && (
          <div className="w-full bg-black/90 p-1 border-t border-white/10 flex items-center justify-center gap-1 z-20 overflow-x-auto whitespace-nowrap shrink-0">
              <ToolButton icon={MousePointer} active={tool === 'pointer'} onClick={() => setTool('pointer')} />
              <div className="w-px h-4 bg-white/20 mx-1" />
              <ToolButton icon={Pencil} active={tool === 'pencil'} onClick={() => setTool('pencil')} />
              <ToolButton icon={Square} active={tool === 'rect'} onClick={() => setTool('rect')} />
              <ToolButton icon={Circle} active={tool === 'circle'} onClick={() => setTool('circle')} />
              <ToolButton icon={MoveRight} active={tool === 'arrow'} onClick={() => setTool('arrow')} />
              <ToolButton icon={CornerUpRight} active={tool === 'curve'} onClick={() => setTool('curve')} />
              <ToolButton icon={Minus} active={tool === 'line'} onClick={() => setTool('line')} />
              <ToolButton icon={Type} active={tool === 'text'} onClick={() => setTool('text')} />
              <ToolButton icon={Highlighter} active={tool === 'highlighter'} onClick={() => setTool('highlighter')} />
              <ToolButton icon={Eraser} active={tool === 'eraser'} onClick={() => setTool('eraser')} />
              <div className="w-px h-4 bg-white/20 mx-1" />
              <div className="flex items-center gap-1 px-1">
                  <button onClick={() => setStrokeWidth(5)} className={`w-3 h-3 rounded-full bg-white/50 hover:bg-white ${strokeWidth === 5 ? 'ring-2 ring-primary' : ''}`} title="Thin" />
                  <button onClick={() => setStrokeWidth(10)} className={`w-4 h-4 rounded-full bg-white/50 hover:bg-white ${strokeWidth === 10 ? 'ring-2 ring-primary' : ''}`} title="Medium" />
                  <button onClick={() => setStrokeWidth(20)} className={`w-5 h-5 rounded-full bg-white/50 hover:bg-white ${strokeWidth === 20 ? 'ring-2 ring-primary' : ''}`} title="Thick" />
              </div>
              <div className="w-px h-4 bg-white/20 mx-1" />
              <input
                 type="color"
                 value={color}
                 onChange={e => setColor(e.target.value)}
                 className="w-6 h-6 rounded cursor-pointer border-none bg-transparent p-0"
              />
              <div className="w-px h-4 bg-white/20 mx-1" />
              <button onClick={clearAnnotations} className="text-white hover:text-red-400 px-2 text-[10px] uppercase font-bold">Clear</button>
              <button onClick={() => { setIsDrawingMode(false); setAnnotations([]); }} className="text-white hover:text-red-400 p-1"><X size={16} /></button>
          </div>
      )}
    </div>
  );
});

const ToolButton = ({ icon: Icon, active, onClick }) => (
    <button
        onClick={onClick}
        className={`p-2 md:p-1.5 rounded hover:bg-white/20 transition-colors ${active ? 'bg-primary text-white' : 'text-white/70'}`}
    >
        <Icon size={16} className="w-4 h-4 md:w-[16px] md:h-[16px]" />
    </button>
);

export default VideoPlayer;
