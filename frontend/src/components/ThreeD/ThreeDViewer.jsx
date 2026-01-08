import React, { useRef, useState, useEffect, useImperativeHandle, forwardRef, Suspense, useCallback } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, useFBX, Environment, Grid, Html } from '@react-three/drei';
import { useLoader } from '@react-three/fiber';
import { USDLoader } from 'three/examples/jsm/loaders/USDLoader';
import * as THREE from 'three';
import { Box, Eye, Grid3X3, Layers, Maximize, MousePointer, RotateCw, Pencil, Square, Circle, MoveRight, Type, Eraser, Highlighter, MessageSquare, CornerUpRight, Minus, X } from 'lucide-react';

const FBXModel = ({ url, materialMode }) => {
    const scene = useFBX(url);
    return <BaseModel scene={scene} materialMode={materialMode} />;
};

const USDModel = ({ url, materialMode }) => {
    const scene = useLoader(USDLoader, url);
    return <BaseModel scene={scene} materialMode={materialMode} />;
};

const GLBModel = ({ url, materialMode }) => {
    const gltf = useGLTF(url);
    return <BaseModel scene={gltf.scene} materialMode={materialMode} />;
};

const BaseModel = ({ scene, materialMode }) => {
    const ref = useRef();
    const clonedScene = React.useMemo(() => scene.clone(), [scene]);

    useEffect(() => {
        clonedScene.traverse((child) => {
            if (child.isMesh) {
                if (!child.userData.originalMaterial) {
                    child.userData.originalMaterial = child.material;
                }

                if (materialMode === 'wireframe') {
                    child.material = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
                } else if (materialMode === 'matcap') {
                    child.material = new THREE.MeshNormalMaterial();
                } else {
                    child.material = child.userData.originalMaterial;
                }
            }
        });
    }, [materialMode, clonedScene]);

    return <primitive object={clonedScene} ref={ref} />;
};

const Model = ({ url, materialMode }) => {
  const ext = url.split('?')[0].split('.').pop().toLowerCase();

  if (ext === 'fbx') {
      return <FBXModel url={url} materialMode={materialMode} />;
  } else if (['usd', 'usdz', 'usda', 'usdc'].includes(ext)) {
      return <USDModel url={url} materialMode={materialMode} />;
  } else {
      return <GLBModel url={url} materialMode={materialMode} />;
  }
};

const CameraController = ({ cameraState, onCameraChange, onInteractionStart }) => {
  const { camera } = useThree();
  const controlsRef = useRef();

  // Restore camera state
  useEffect(() => {
    if (cameraState) {
        try {
            const state = typeof cameraState === 'string' ? JSON.parse(cameraState) : cameraState;
            if (state.position) {
                camera.position.set(state.position.x, state.position.y, state.position.z);
            }
            if (state.target && controlsRef.current) {
                controlsRef.current.target.set(state.target.x, state.target.y, state.target.z);
            }
            camera.updateProjectionMatrix();
            if (controlsRef.current) controlsRef.current.update();
        } catch(e) {
            console.error("Failed to restore camera state", e);
        }
    }
  }, [cameraState, camera]);

  return <OrbitControls
            ref={controlsRef}
            makeDefault
            onStart={() => {
                if (onInteractionStart) onInteractionStart();
            }}
            onEnd={() => {
                if (onCameraChange && controlsRef.current) {
                    onCameraChange({
                        position: camera.position,
                        target: controlsRef.current.target
                    });
                }
            }}
         />;
};

const ThreeDViewer = forwardRef(({ src, onAnnotationSave, viewingAnnotation, isDrawingModeTrigger, onCameraChange, onCameraInteractionStart }, ref) => {
  const [materialMode, setMaterialMode] = useState('standard'); // standard, wireframe, matcap
  const [showGrid, setShowGrid] = useState(true);
  const [cameraState, setCameraState] = useState(null);

  // Annotation State (2D Overlay)
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [annotations, setAnnotations] = useState([]);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const glRef = useRef(null);

  // Drawing Tools State (Matching VideoPlayer)
  const [tool, setTool] = useState('pencil');
  const [color, setColor] = useState('#ef4444');
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentAnnotation, setCurrentAnnotation] = useState(null);

  const currentCameraState = useRef(null);

  useImperativeHandle(ref, () => ({
      getAnnotations: () => annotations,
      getCameraState: () => currentCameraState.current,
      getScreenshot: () => {
          if (glRef.current && glRef.current.domElement) {
              return glRef.current.domElement.toDataURL('image/jpeg', 0.8);
          }
          return null;
      },
      clearAnnotations: () => {
          setAnnotations([]);
          setIsDrawingMode(false);
          setCurrentAnnotation(null);
          setIsDrawing(false);
      },
      setCameraState: (state) => setCameraState(state),
      seek: () => {}, // No-op for 3D but needed for interface compatibility
      resetView: () => {
          setCameraState(null);
      }
  }));

  const handleCameraChange = (state) => {
      currentCameraState.current = state;
      if (onCameraChange) onCameraChange(state);
  };

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

  // Canvas Drawing Logic
  const drawShape = useCallback((ctx, shape) => {
      ctx.beginPath();
      ctx.strokeStyle = shape.color;

      const canvas = ctx.canvas;
      const scaleFactor = Math.max(canvas.width / 1920, 0.5);
      const width = shape.strokeWidth || 5;
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
          return { x: sx, y: sy };
      };

      if (shape.tool === 'pencil' || shape.tool === 'highlighter' || shape.tool === 'eraser') {
          if (!shape.points || shape.points.length < 2) return;
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
          const dims = { w: shape.w * w, h: shape.h * h };

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
              const tailX = x + w_ * 0.2;
              ctx.lineTo(tailX + 10 * scaleFactor, y + h_);
              ctx.lineTo(tailX, y + h_ + 20 * scaleFactor);
              ctx.lineTo(tailX - 10 * scaleFactor, y + h_);
              ctx.lineTo(x + r, y + h_);
              ctx.quadraticCurveTo(x, y + h_, x, y + h_ - r);
              ctx.lineTo(x, y + r);
              ctx.quadraticCurveTo(x, y, x + r, y);
              ctx.stroke();
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

      const all = viewingAnnotation ? viewingAnnotation : [...annotations, currentAnnotation].filter(Boolean);
      all.forEach(shape => drawShape(ctx, shape));

  }, [annotations, currentAnnotation, viewingAnnotation, isDrawingMode, drawShape]);

  // Handle Trigger
  useEffect(() => {
      if (isDrawingModeTrigger) {
          setIsDrawingMode(true);
          setAnnotations([]);
      }
  }, [isDrawingModeTrigger]);

  return (
    <div className="w-full h-full relative bg-gray-900 group flex flex-col items-center justify-center" ref={containerRef}>
      <div className="flex-1 min-h-0 w-full flex items-center justify-center relative">
        <div className="aspect-video w-full max-h-full max-w-full relative bg-black touch-none">
            <Canvas
                shadows
                gl={{ preserveDrawingBuffer: true }}
                camera={{ position: [5, 5, 5], fov: 50 }}
                onCreated={({ gl }) => {
                    glRef.current = gl;
                }}
            >
                <ambientLight intensity={0.5} />
                <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
                <pointLight position={[-10, -10, -10]} />
                <Suspense fallback={<Html center>Loading 3D...</Html>}>
                    <Model url={src} materialMode={materialMode} />
                </Suspense>
                {showGrid && <Grid infiniteGrid fadeDistance={50} sectionColor="#4f4f4f" cellColor="#3f3f3f" />}
                <Environment preset="city" />
                <CameraController cameraState={cameraState} onCameraChange={handleCameraChange} onInteractionStart={onCameraInteractionStart} />
            </Canvas>

            {/* View Controls */}
            <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
                <div className="bg-black/50 backdrop-blur p-2 rounded flex flex-col gap-2">
                    <button title="Standard" onClick={() => setMaterialMode('standard')} className={`p-1 rounded ${materialMode==='standard'?'bg-white/20':''}`}><Box size={20} color="white"/></button>
                    <button title="Wireframe" onClick={() => setMaterialMode('wireframe')} className={`p-1 rounded ${materialMode==='wireframe'?'bg-white/20':''}`}><Grid3X3 size={20} color="white"/></button>
                    <button title="MatCap" onClick={() => setMaterialMode('matcap')} className={`p-1 rounded ${materialMode==='matcap'?'bg-white/20':''}`}><Layers size={20} color="white"/></button>
                    <hr className="border-white/20" />
                    <button title="Toggle Grid" onClick={() => setShowGrid(!showGrid)} className={`p-1 rounded ${showGrid?'bg-white/20':''}`}><Maximize size={20} color="white"/></button>
                </div>
            </div>

            {/* 2D Overlay */}
            <canvas
                ref={canvasRef}
                className={`absolute top-0 left-0 w-full h-full z-20 touch-none ${isDrawingMode ? 'cursor-crosshair' : 'pointer-events-none'}`}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
            />

        </div>
      </div>
      {/* Drawing Toolbar - Static Bottom */}
      {isDrawingMode && (
          <div className="w-full bg-black/90 p-1 border-t border-white/10 flex items-center justify-center gap-1 z-30 overflow-x-auto whitespace-nowrap shrink-0 pointer-events-auto">
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
              <button onClick={() => setAnnotations([])} className="text-white hover:text-red-400 px-2 text-[10px] uppercase font-bold">Clear</button>
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

export default ThreeDViewer;
