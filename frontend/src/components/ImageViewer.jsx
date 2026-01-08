import React, { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Pencil, Square, Circle, MoveRight, Type, Eraser, Highlighter, MousePointer, Minus, MessageSquare, CornerUpRight, X, ArrowLeft, ArrowRight } from 'lucide-react';

const ImageViewer = forwardRef(({ src, onNext, onPrev, hasPrev, hasNext, annotations, onAnnotationSave, viewingAnnotation, isDrawingModeTrigger, isReadOnly, activeImageIndex, totalImages, onImageChange }, ref) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const imageRef = useRef(null);

  // Drawing State (similar to VideoPlayer)
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [tool, setTool] = useState('pencil');
  const [color, setColor] = useState('#ef4444');
  const [strokeWidth, setStrokeWidth] = useState(10);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentAnnotation, setCurrentAnnotation] = useState(null);
  const [localAnnotations, setLocalAnnotations] = useState([]); // Annotations for current session/image

  // Refs for callbacks
  const annotationsRef = useRef(localAnnotations);
  const currentAnnotationRef = useRef(currentAnnotation);

  useEffect(() => {
      annotationsRef.current = localAnnotations;
  }, [localAnnotations]);

  useEffect(() => {
      currentAnnotationRef.current = currentAnnotation;
  }, [currentAnnotation]);

  // Expose methods
  useImperativeHandle(ref, () => ({
      getAnnotations: () => {
          if (isDrawing && currentAnnotation) {
              return [...localAnnotations, currentAnnotation];
          }
          return localAnnotations;
      },
      clearAnnotations: () => {
          setLocalAnnotations([]);
          setIsDrawingMode(false);
          setCurrentAnnotation(null);
          setIsDrawing(false);
      },
      // Methods to match VideoPlayer interface for compatibility
      seek: () => {},
      pause: () => {},
      togglePlay: () => {},
      toggleFullscreen: () => {
           if (!document.fullscreenElement) {
              containerRef.current?.requestFullscreen();
          } else {
              document.exitFullscreen();
          }
      }
  }));

  // Coordinate Normalization Helpers (Identical to VideoPlayer)
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
          // Other shapes (rect, circle, etc - simplified reuse)
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
          } else if (shape.tool === 'curve') {
              const startX = p.x;
              const startY = p.y;
              const endX = p.x + dims.w;
              const endY = p.y + dims.h;
              const cpX = (startX + endX) / 2;
              const cpY = (startY + endY) / 2 - Math.abs(dims.w) * 0.5;
              ctx.moveTo(startX, startY);
              ctx.quadraticCurveTo(cpX, cpY, endX, endY);
              ctx.stroke();
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

  const performRedraw = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const currentAnnos = annotationsRef.current || [];
      const activeAnno = currentAnnotationRef.current;

      [...currentAnnos, activeAnno].filter(Boolean).forEach(shape => drawShape(ctx, shape));
  }, [drawShape]);

  // Handle Layout
  const updateCanvasLayout = useCallback(() => {
      const img = imageRef.current;
      const canvas = canvasRef.current;

      if (!img || !canvas) return;

      const naturalWidth = img.naturalWidth;
      const naturalHeight = img.naturalHeight;

      if (!naturalWidth || !naturalHeight) return;

      // Update Canvas Resolution (internal pixels)
      if (canvas.width !== naturalWidth || canvas.height !== naturalHeight) {
          canvas.width = naturalWidth;
          canvas.height = naturalHeight;
      }

      // Use the actual rendered dimensions of the image element
      // This ensures the canvas matches the visual image exactly
      const width = img.width;
      const height = img.height;
      const left = img.offsetLeft;
      const top = img.offsetTop;

      // Update Canvas Display Size (CSS)
      // Only update if changed to avoid thrashing
      if (canvas.style.width !== `${width}px` ||
          canvas.style.height !== `${height}px` ||
          canvas.style.left !== `${left}px` ||
          canvas.style.top !== `${top}px`) {

          canvas.style.width = `${width}px`;
          canvas.style.height = `${height}px`;
          canvas.style.left = `${left}px`;
          canvas.style.top = `${top}px`;

          performRedraw();
      }
  }, [performRedraw]);

  // Resize Observer
  useEffect(() => {
      const img = imageRef.current;
      const container = containerRef.current;
      if (!img || !container) return;

      const handleResize = () => {
        requestAnimationFrame(updateCanvasLayout);
      };

      const resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(img);
      resizeObserver.observe(container); // Also observe container for centering changes

      // Initial call
      updateCanvasLayout();

      return () => resizeObserver.disconnect();
  }, [updateCanvasLayout, src]);

  // Handle Image Load
  const onImageLoad = () => {
      updateCanvasLayout();
  };

  // Sync annotations from props (Viewing saved annotations)
  useEffect(() => {
      if (viewingAnnotation) {
          setLocalAnnotations(viewingAnnotation);
      } else if (!isDrawingMode) {
          // If not viewing specific annotation and not drawing, clear or reset?
          // For images, we might want to keep them visible if they are "active".
          // But usually we clear when switching images.
          setLocalAnnotations([]);
      }
  }, [viewingAnnotation, isDrawingMode, src]); // Clear on src change

  // Redraw on changes
  useEffect(() => {
      performRedraw();
  }, [localAnnotations, currentAnnotation, performRedraw]);

  // Trigger Drawing Mode
  useEffect(() => {
      if (isDrawingModeTrigger && !isReadOnly) {
          setIsDrawingMode(true);
          setLocalAnnotations([]); // Clear previous for new drawing
      }
  }, [isDrawingModeTrigger, isReadOnly]);


  // Drawing Handlers
  const getPos = (e) => {
      const rect = canvasRef.current.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      // Clamp coordinates to stay within the canvas
      const clampedX = Math.max(0, Math.min(x, rect.width));
      const clampedY = Math.max(0, Math.min(y, rect.height));

      return {
          pixel: { x: clampedX, y: clampedY },
          norm: { x: clampedX / rect.width, y: clampedY / rect.height }
      };
  };

  const startDrawing = (e) => {
      if (!isDrawingMode) return;
      if (e.touches) e.preventDefault();
      setIsDrawing(true);
      const pos = getPos(e);
      setStartPos(pos.norm);

      if (tool === 'pencil' || tool === 'highlighter' || tool === 'eraser') {
          setCurrentAnnotation({
              tool, color, strokeWidth, points: [pos.norm], isNormalized: true
          });
      } else if (tool === 'text') {
          const text = prompt("Enter text:");
          if (text) {
              setLocalAnnotations([...localAnnotations, {
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
              tool, color, strokeWidth, x: pos.norm.x, y: pos.norm.y, w: 0, h: 0, isNormalized: true
          });
      }
  };

  const draw = (e) => {
      if (!isDrawing || !isDrawingMode) return;
      const pos = getPos(e);
      if (tool === 'pencil' || tool === 'highlighter' || tool === 'eraser') {
          setCurrentAnnotation(prev => ({
              ...prev, points: [...prev.points, pos.norm]
          }));
      } else {
          setCurrentAnnotation(prev => ({
              ...prev, w: pos.norm.x - startPos.x, h: pos.norm.y - startPos.y
          }));
      }
  };

  const stopDrawing = () => {
      if (!isDrawing) return;
      setIsDrawing(false);
      if (currentAnnotation) {
          setLocalAnnotations([...localAnnotations, currentAnnotation]);
          setCurrentAnnotation(null);
      }
  };

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden group bg-black w-full h-full">
        {/* Navigation Overlays */}
        {hasPrev && !isDrawingMode && (
            <button
                onClick={onPrev}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-black/50 hover:bg-black/80 text-white p-3 rounded-full transition-colors"
            >
                <ArrowLeft size={24} />
            </button>
        )}
        {hasNext && !isDrawingMode && (
            <button
                onClick={onNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-black/50 hover:bg-black/80 text-white p-3 rounded-full transition-colors"
            >
                <ArrowRight size={24} />
            </button>
        )}

        <div ref={containerRef} className="relative flex-1 flex justify-center items-center w-full min-h-0">
            <img
                ref={imageRef}
                src={src}
                className="max-h-full max-w-full object-contain select-none"
                onLoad={onImageLoad}
                alt="Review Asset"
            />

            <canvas
                ref={canvasRef}
                className={`absolute z-10 touch-none ${isDrawingMode ? 'cursor-crosshair' : 'pointer-events-none'}`}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
            />
        </div>

        {/* Image Counter */}
        <div className="absolute top-4 right-4 bg-black/60 text-white px-3 py-1 rounded-full text-sm pointer-events-none">
            {activeImageIndex + 1} / {totalImages}
        </div>

        {/* Drawing Toolbar (Static Bottom) */}
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
                <input
                    type="color"
                    value={color}
                    onChange={e => setColor(e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer border-none bg-transparent p-0"
                />
                 <div className="w-px h-4 bg-white/20 mx-1" />
                <button onClick={() => { setLocalAnnotations([]); setIsDrawingMode(false); }} className="text-white hover:text-red-400 p-1"><X size={16} /></button>
            </div>
        )}
    </div>
  );
});

const ToolButton = ({ icon: Icon, active, onClick }) => (
    <button
        onClick={onClick}
        className={`p-1.5 rounded hover:bg-white/20 transition-colors ${active ? 'bg-primary text-white' : 'text-white/70'}`}
    >
        <Icon size={18} />
    </button>
);

export default ImageViewer;
