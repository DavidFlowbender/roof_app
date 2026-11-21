import React, { useState, useRef, useEffect } from 'react';
import {
  Ruler,
  Move,
  Check,
  Undo2,
  Redo2,
  Trash2,
  Camera,
  Image as ImageIcon,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  Eye,
  EyeOff,
  Pause,
  Play,
  ChevronDown,
  LayoutTemplate,
} from 'lucide-react';
import { formatLength, UNIT_SYSTEMS, metersToFeet, feetToMeters } from '../utils/units';
import { normalizeOverhang, SHAPE_PRESETS, calculatePolygonMetrics, offsetPolygonVertices } from '../utils/roofMath';
import { buildRoofSkeleton } from '../utils/roofSkeleton';
import { BUILDING_STAGES } from '../utils/stagePresets';

const INPROGRESS_SKETCH_KEY = 'roofcalc_inprogress_sketch_v1';

function readInProgressSketch(allowRestore, polygonVertices) {
  if (!allowRestore || (Array.isArray(polygonVertices) && polygonVertices.length >= 3)) {
    return null;
  }
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(INPROGRESS_SKETCH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.sketchPts) && parsed.sketchPts.length > 0 && parsed.isDrawing) {
      return parsed;
    }
  } catch {
    // Ignore storage read errors
  }
  return null;
}

export default function Roof2DDiagram({
  geometry,
  roofType = 'hip',
  unitSystem = 'metric',
  onDimensionsChange,
  onPolygonChange,
  polygonVertices = null,
  hasActiveDesign = true,
  onResetToBlank = null,
  onActivateRectangle = null,
  isSplitView = false,
  buildingStage = 'foundation',
  onStageChange = null,
  parapetConfig = null,
  woodworkConfig = null,
  sketchUnderlayImage = null,
  onClearUnderlay = null,
  onOpenPaperUpload = null,
  compactPreview = false,
  readOnlyMobile = false,
  mobileInteractive = false,
}) {
  const svgRef = useRef(null);
  const pointerDownPxRef = useRef(null);
  const mousePanRef = useRef(null);
  const touchDrawRef = useRef(null);
  const suppressNextClickRef = useRef(false);
  const examplesMenuRef = useRef(null);
  const [examplesOpen, setExamplesOpen] = useState(false);

  useEffect(() => {
    if (!examplesOpen) return;
    const onOutside = (e) => {
      if (examplesMenuRef.current && !examplesMenuRef.current.contains(e.target)) {
        setExamplesOpen(false);
      }
    };
    window.addEventListener('mousedown', onOutside);
    window.addEventListener('touchstart', onOutside);
    return () => {
      window.removeEventListener('mousedown', onOutside);
      window.removeEventListener('touchstart', onOutside);
    };
  }, [examplesOpen]);

  // Fallback rectangular dimensions
  const L = geometry?.buildingDimensions?.length || 12;
  const B = geometry?.buildingDimensions?.breadth || 8;
  const ov = normalizeOverhang(geometry?.buildingDimensions?.overhang || 0.4);

  const allowInProgressPersistence = !compactPreview && !readOnlyMobile;

  // Interaction Modes:
  // 'line_sketch': Click-by-click polygon sketching with 90° ortho & vertex snap (as shown in WhatsApp video!)
  // 'manipulate': Drag vertices & corners
  // 'overhang': Drag eaves & porches
  const [mode, setMode] = useState(() => {
    if (polygonVertices && polygonVertices.length >= 3) return 'manipulate';
    if (readInProgressSketch(allowInProgressPersistence, polygonVertices)) return 'line_sketch';
    return 'line_sketch';
  });

  // Snapping toggles
  const [orthoSnap, setOrthoSnap] = useState(true); // 90° horizontal/vertical snap
  const [gridSnap, setGridSnap] = useState(true);   // 0.5m grid snap

  // Active in-progress sketch points (in meter space)
  const [sketchPts, setSketchPts] = useState(() => {
    if (polygonVertices && polygonVertices.length > 0) return polygonVertices;
    const saved = readInProgressSketch(allowInProgressPersistence, polygonVertices);
    return saved?.sketchPts || [];
  });
  const [isDrawing, setIsDrawing] = useState(() => {
    if (polygonVertices && polygonVertices.length >= 3) return false;
    const saved = readInProgressSketch(allowInProgressPersistence, polygonVertices);
    return Boolean(saved?.isDrawing && saved?.sketchPts?.length > 0);
  });
  const [isSketchPaused, setIsSketchPaused] = useState(() => {
    if (polygonVertices && polygonVertices.length >= 3) return false;
    const saved = readInProgressSketch(allowInProgressPersistence, polygonVertices);
    return Boolean(saved?.isDrawing && saved?.sketchPts?.length > 0);
  });
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 }); // snapped meter coordinates
  const [snapInfo, setSnapInfo] = useState(null); // { isCloseSnap: bool, isOrthoSnap: bool, axis: 'h'|'v', distM: number }

  // Dragging vertex state (when in manipulate mode)
  const [draggedVertexIdx, setDraggedVertexIdx] = useState(null);

  // Whole-sketch marquee selection & highlight state (for drag-select + Delete)
  const [isSketchSelected, setIsSketchSelected] = useState(false);
  const [selectionBox, setSelectionBox] = useState(null);

  // Undo / Redo history stacks for sketch drawing & corner edits (Ctrl+Z / Ctrl+Y)
  const [history, setHistory] = useState({ past: [], future: [] });
  const dragPreSnapRef = useRef(null);
  const lastEmittedPolyRef = useRef(polygonVertices);

  const clonePts = (arr) => (Array.isArray(arr) ? arr.map((p) => ({ x: p.x, y: p.y })) : []);
  const makeSnap = (pts = sketchPts, draw = isDrawing, m = mode) => ({
    pts: clonePts(pts),
    isDrawing: Boolean(draw),
    mode: m,
  });
  const pushHistory = (prevSnap) => {
    setHistory((h) => ({
      past: [...h.past.slice(-60), prevSnap],
      future: [],
    }));
  };
  const emitPolygonChange = (pts) => {
    lastEmittedPolyRef.current = pts;
    if (onPolygonChange) onPolygonChange(pts);
  };

  // Persist in-progress sketch across tab switches (e.g. BOQ, WC, 3D view) while paused or sketching
  useEffect(() => {
    if (!allowInProgressPersistence || typeof window === 'undefined') return;
    try {
      if (mode === 'line_sketch' && isDrawing && sketchPts.length > 0) {
        window.sessionStorage.setItem(
          INPROGRESS_SKETCH_KEY,
          JSON.stringify({ sketchPts, isDrawing: true, isSketchPaused, mode })
        );
      } else {
        window.sessionStorage.removeItem(INPROGRESS_SKETCH_KEY);
      }
    } catch {
      // Ignore storage quota errors
    }
  }, [allowInProgressPersistence, mode, isDrawing, isSketchPaused, sketchPts]);

  // Sync external polygonVertices changes into sketchPts if not triggered by this component
  useEffect(() => {
    if (polygonVertices === lastEmittedPolyRef.current) return;
    lastEmittedPolyRef.current = polygonVertices;
    if (polygonVertices && polygonVertices.length >= 3) {
      setSketchPts(polygonVertices);
      setIsDrawing(false);
      setIsSketchPaused(false);
      setMode('manipulate');
    } else if (!polygonVertices && !isDrawing) {
      setSketchPts([]);
      setIsSketchPaused(false);
    }
  }, [polygonVertices, isDrawing]);

  // Inline dimension editing: null | { kind: 'rectL' | 'rectB' | 'polyEdge', idx?: number }
  const [editingDim, setEditingDim] = useState(null);
  const [tempDimVal, setTempDimVal] = useState('');

  // Paper sketch underlay controls
  const [showUnderlay, setShowUnderlay] = useState(true);
  const [underlayOpacity, setUnderlayOpacity] = useState(0.38);

  useEffect(() => {
    if (sketchUnderlayImage) {
      setShowUnderlay(true);
    }
  }, [sketchUnderlayImage]);

  // Viewport & Clutter Controls
  const [isExpanded, setIsExpanded] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [showDimensions, setShowDimensions] = useState(true);
  const touchGestureRef = useRef(null);
  const lastTapRef = useRef({ time: 0, x: 0, y: 0 });

  // SVG canvas bounds: generous drafting area on desktop, compact 420x420 viewBox on mobile/preview so plans & labels stay large
  const isCompactViewport = Boolean(mobileInteractive || readOnlyMobile || compactPreview);
  const svgWidth = isCompactViewport ? 420 : (isExpanded ? 1100 : (isSplitView ? 760 : 1000));
  const svgHeight = isCompactViewport ? 420 : (isExpanded ? 700 : (isSplitView ? 540 : 580));
  const margin = isCompactViewport ? 22 : 70;

  // Coordinate System Transformation (Meters to SVG Canvas Pixels)
  // Freeze bounds while actively sketching or dragging a corner so the canvas never jumps under the cursor
  const lockedBoundsRef = useRef(null);
  let bounds = { minX: -L / 2, maxX: L / 2, minY: -B / 2, maxY: B / 2 };
  if ((isDrawing || draggedVertexIdx !== null) && lockedBoundsRef.current) {
    bounds = lockedBoundsRef.current;
  } else {
    if (sketchPts && sketchPts.length >= 2) {
      let minX = sketchPts[0].x, maxX = sketchPts[0].x, minY = sketchPts[0].y, maxY = sketchPts[0].y;
      sketchPts.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      });
      bounds = { minX, maxX, minY, maxY };
    }
    lockedBoundsRef.current = bounds;
  }

  const spanX = Math.max(bounds.maxX - bounds.minX, isCompactViewport ? 2.5 : 8) + ov.left + ov.right + (isCompactViewport ? 1.4 : 3.5);
  const spanY = Math.max(bounds.maxY - bounds.minY, isCompactViewport ? 2.5 : 6) + ov.front + ov.back + (isCompactViewport ? 1.4 : 3.5);
  const baseScale = Math.min((svgWidth - 2 * margin) / spanX, (svgHeight - 2 * margin) / spanY);
  const scale = baseScale * zoomLevel;

  const centerX = svgWidth / 2;
  const centerY = svgHeight / 2;
  const centerMeterX = (bounds.minX + bounds.maxX) / 2;
  const centerMeterY = (bounds.minY + bounds.maxY) / 2;

  // Convert Meter coords to SVG pixel coords
  const meterToPx = (mX, mY) => {
    return {
      x: centerX + panOffset.x + (mX - centerMeterX) * scale,
      y: centerY + panOffset.y + (mY - centerMeterY) * scale,
    };
  };

  // Convert SVG pixel coords to Meter coords
  const pxToMeter = (pX, pY) => {
    return {
      x: centerMeterX + (pX - centerX - panOffset.x) / scale,
      y: centerMeterY + (pY - centerY - panOffset.y) / scale,
    };
  };

  const clientToSvgPoint = (clientX, clientY) => {
    if (!svgRef.current) return { x: centerX, y: centerY };
    const rect = svgRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: centerX, y: centerY };
    return {
      x: ((clientX - rect.left) / rect.width) * svgWidth,
      y: ((clientY - rect.top) / rect.height) * svgHeight,
    };
  };

  const canSingleFingerPan = Boolean(
    readOnlyMobile || compactPreview || (mobileInteractive && mode !== 'line_sketch' && draggedVertexIdx === null && zoomLevel > 1.02)
  );

  const handleTouchStartZoomPan = (e) => {
    if (e.touches.length === 2) {
      // Two-finger pinch-to-zoom + pan (prevents accidental drawing/vertex drag)
      if (touchDrawRef.current) {
        if (touchDrawRef.current.startedFresh && touchDrawRef.current.activePts.length <= 1) {
          setSketchPts([]);
          setIsDrawing(false);
          setSnapInfo(null);
        }
        touchDrawRef.current = null;
      }
      pointerDownPxRef.current = null;
      suppressNextClickRef.current = true;
      setSelectionBox(null);
      setDraggedVertexIdx(null);

      const p1 = clientToSvgPoint(e.touches[0].clientX, e.touches[0].clientY);
      const p2 = clientToSvgPoint(e.touches[1].clientX, e.touches[1].clientY);
      const dist = Math.max(10, Math.hypot(p2.x - p1.x, p2.y - p1.y));
      const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

      touchGestureRef.current = {
        type: 'pinch',
        startDist: dist,
        startZoom: zoomLevel,
        startPan: { ...panOffset },
        startMid: mid,
      };
      return;
    }

    if (e.touches.length === 1 && canSingleFingerPan) {
      const t = e.touches[0];
      if (readOnlyMobile || compactPreview) {
        const now = Date.now();
        const prevTap = lastTapRef.current;
        if (now - prevTap.time < 280 && Math.hypot(t.clientX - prevTap.x, t.clientY - prevTap.y) < 28) {
          // Double-tap toggles 2x / Reset 1x
          lastTapRef.current = { time: 0, x: 0, y: 0 };
          if (zoomLevel > 1.15) {
            setZoomLevel(1.0);
            setPanOffset({ x: 0, y: 0 });
          } else {
            const tapSvg = clientToSvgPoint(t.clientX, t.clientY);
            const nextZoom = 2.0;
            const ratio = nextZoom / zoomLevel;
            setZoomLevel(nextZoom);
            setPanOffset({
              x: (tapSvg.x - centerX) - (tapSvg.x - centerX - panOffset.x) * ratio,
              y: (tapSvg.y - centerY) - (tapSvg.y - centerY - panOffset.y) * ratio,
            });
          }
          touchGestureRef.current = null;
          return;
        }
        lastTapRef.current = { time: now, x: t.clientX, y: t.clientY };
      }

      const p = clientToSvgPoint(t.clientX, t.clientY);
      touchGestureRef.current = {
        type: 'pan',
        startPt: p,
        startPan: { ...panOffset },
      };
    }
  };

  const handleTouchMoveZoomPan = (e) => {
    const g = touchGestureRef.current;
    if (!g) return;

    if (draggedVertexIdx !== null) {
      touchGestureRef.current = null;
      return;
    }

    if (e.touches.length === 2 && g.type === 'pinch') {
      const p1 = clientToSvgPoint(e.touches[0].clientX, e.touches[0].clientY);
      const p2 = clientToSvgPoint(e.touches[1].clientX, e.touches[1].clientY);
      const dist = Math.max(10, Math.hypot(p2.x - p1.x, p2.y - p1.y));
      const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

      const nextZoom = Math.min(4.0, Math.max(0.6, Math.round(g.startZoom * (dist / g.startDist) * 100) / 100));
      const actualRatio = nextZoom / g.startZoom;

      setZoomLevel(nextZoom);
      setPanOffset({
        x: (mid.x - centerX) - (g.startMid.x - centerX - g.startPan.x) * actualRatio,
        y: (mid.y - centerY) - (g.startMid.y - centerY - g.startPan.y) * actualRatio,
      });
      return;
    }

    if (e.touches.length === 1 && g.type === 'pan' && canSingleFingerPan) {
      const p = clientToSvgPoint(e.touches[0].clientX, e.touches[0].clientY);
      setPanOffset({
        x: g.startPan.x + (p.x - g.startPt.x),
        y: g.startPan.y + (p.y - g.startPt.y),
      });
    }
  };

  const handleTouchEndZoomPan = (e) => {
    if (!e.touches || e.touches.length === 0 || draggedVertexIdx !== null) {
      touchGestureRef.current = null;
    } else if (e.touches.length === 1 && touchGestureRef.current?.type === 'pinch') {
      // Transition smoothly if 1 finger stays down in view/preview/zoomed mode
      if (canSingleFingerPan) {
        const p = clientToSvgPoint(e.touches[0].clientX, e.touches[0].clientY);
        touchGestureRef.current = { type: 'pan', startPt: p, startPan: { ...panOffset } };
      } else {
        touchGestureRef.current = null;
      }
    }
  };

  const handleWheelZoom = (e) => {
    if (!compactPreview && !e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    const nextZoom = Math.min(4.0, Math.max(0.6, Math.round(zoomLevel * factor * 100) / 100));
    if (nextZoom === zoomLevel) return;
    const focal = clientToSvgPoint(e.clientX, e.clientY);
    const ratio = nextZoom / zoomLevel;
    setZoomLevel(nextZoom);
    setPanOffset({
      x: (focal.x - centerX) - (focal.x - centerX - panOffset.x) * ratio,
      y: (focal.y - centerY) - (focal.y - centerY - panOffset.y) * ratio,
    });
  };

  const getSvgCoordinates = (e) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svgRef.current.getScreenCTM().inverse());
    return { x: svgP.x, y: svgP.y };
  };

  // Helper to snap a point based on rules
  const computeSnappedPoint = (rawM, lastPoint, startPoint, ptsCount = sketchPts.length, preferredAxis = null) => {
    let snapM = { x: rawM.x, y: rawM.y };
    let info = { isCloseSnap: false, isOrthoSnap: false, axis: null, isAlignedWithStart: false, distM: 0 };

    // 1. Check Close Loop Snap (if cursor is near the first point)
    if (startPoint && ptsCount >= 3) {
      const dxStart = rawM.x - startPoint.x;
      const dyStart = rawM.y - startPoint.y;
      const distToStartPx = Math.sqrt(dxStart * dxStart + dyStart * dyStart) * scale;

      if (distToStartPx < 28) { // 28px snap radius
        return {
          pt: { x: startPoint.x, y: startPoint.y },
          info: { isCloseSnap: true, isOrthoSnap: false, axis: null, isAlignedWithStart: true, distM: 0 },
        };
      }
    }

    // 2. Check Orthogonal 90° Snap (Horizontal or Vertical lock from last point)
    if (orthoSnap && lastPoint) {
      const dx = rawM.x - lastPoint.x;
      const dy = rawM.y - lastPoint.y;
      const useHorizontal = preferredAxis ? preferredAxis === 'horizontal' : Math.abs(dx) >= Math.abs(dy);

      if (useHorizontal) {
        // Horizontal Lock: freeze Y strictly to lastPoint.y
        snapM.y = lastPoint.y;
        snapM.x = rawM.x;
        info.isOrthoSnap = true;
        info.axis = 'horizontal';
      } else {
        // Vertical Lock: freeze X strictly to lastPoint.x
        snapM.x = lastPoint.x;
        snapM.y = rawM.y;
        info.isOrthoSnap = true;
        info.axis = 'vertical';
      }
    }

    // 3. Check Grid Snap (0.5m)
    if (gridSnap) {
      if (!orthoSnap || info.axis !== 'vertical') {
        snapM.x = Math.round(snapM.x * 2) / 2;
      }
      if (!orthoSnap || info.axis !== 'horizontal') {
        snapM.y = Math.round(snapM.y * 2) / 2;
      }
    } else {
      if (!orthoSnap || info.axis !== 'vertical') {
        snapM.x = Math.round(snapM.x * 10) / 10;
      }
      if (!orthoSnap || info.axis !== 'horizontal') {
        snapM.y = Math.round(snapM.y * 10) / 10;
      }
    }

    // Enforce pure 90° lock strictly
    if (orthoSnap && lastPoint) {
      if (info.axis === 'horizontal') snapM.y = lastPoint.y;
      if (info.axis === 'vertical') snapM.x = lastPoint.x;
    }

    // 4. Smart Alignment with Starting Point (Inference guide snap)
    if (startPoint && lastPoint && ptsCount >= 3) {
      if (info.axis === 'horizontal' && Math.abs(snapM.x - startPoint.x) < 0.4) {
        snapM.x = startPoint.x;
        info.isAlignedWithStart = true;
      } else if (info.axis === 'vertical' && Math.abs(snapM.y - startPoint.y) < 0.4) {
        snapM.y = startPoint.y;
        info.isAlignedWithStart = true;
      }
    }

    if (lastPoint) {
      const dX = snapM.x - lastPoint.x;
      const dY = snapM.y - lastPoint.y;
      info.distM = Math.round(Math.sqrt(dX * dX + dY * dY) * 100) / 100;
    }

    return { pt: snapM, info };
  };

  // Mouse / Touch Move on Canvas
  const handleCanvasMouseMove = (e) => {
    const pxCoords = getSvgCoordinates(e);
    if (mousePanRef.current) {
      const dx = pxCoords.x - mousePanRef.current.startPx.x;
      const dy = pxCoords.y - mousePanRef.current.startPx.y;
      if (Math.hypot(dx, dy) > 4) {
        mousePanRef.current.moved = true;
        suppressNextClickRef.current = true;
      }
      if (mousePanRef.current.moved) {
        setPanOffset({
          x: mousePanRef.current.startPan.x + dx,
          y: mousePanRef.current.startPan.y + dy,
        });
      }
      return;
    }
    if (selectionBox) {
      setSelectionBox((prev) => (prev ? { ...prev, currX: pxCoords.x, currY: pxCoords.y } : null));
      return;
    }
    const rawM = pxToMeter(pxCoords.x, pxCoords.y);

    // Continuous single-finger touch sketching: automatically drops 90° corners as finger changes direction without lifting!
    if (
      e.pointerType === 'touch' &&
      touchDrawRef.current &&
      touchDrawRef.current.pointerId === e.pointerId &&
      mode === 'line_sketch' &&
      !isSketchPaused &&
      !touchGestureRef.current
    ) {
      const st = touchDrawRef.current;
      const snapCoord = (v) => (gridSnap ? Math.round(v * 2) / 2 : Math.round(v * 10) / 10);
      let pts = st.activePts;
      let lastPt = pts[pts.length - 1];
      const startPt = pts[0];

      const dxM = rawM.x - lastPt.x;
      const dyM = rawM.y - lastPt.y;
      const absDxPx = Math.abs(dxM) * scale;
      const absDyPx = Math.abs(dyM) * scale;
      const nearStartForClose =
        pts.length >= 3 && Math.hypot(rawM.x - startPt.x, rawM.y - startPt.y) * scale < 28;

      if (!st.activeAxis && !nearStartForClose && Math.max(absDxPx, absDyPx) >= 16) {
        st.activeAxis = absDxPx >= absDyPx ? 'horizontal' : 'vertical';
        st.lastCleanCoord = st.activeAxis === 'horizontal' ? snapCoord(rawM.x) : snapCoord(rawM.y);
        suppressNextClickRef.current = true;
      }

      if (!nearStartForClose && st.activeAxis === 'horizontal') {
        const alongPx = absDxPx;
        const perpPx = absDyPx;
        if (perpPx < 16) {
          st.lastCleanCoord = snapCoord(rawM.x);
        }
        // Detect sharp 90° turn onto vertical axis without lifting finger
        if (alongPx >= 24 && perpPx >= 26) {
          let cornerX = st.lastCleanCoord !== null ? st.lastCleanCoord : snapCoord(rawM.x);
          if (pts.length >= 2 && Math.abs(cornerX - startPt.x) < 0.45) {
            cornerX = startPt.x;
          }
          const cornerPt = { x: cornerX, y: lastPt.y };
          if (Math.hypot(cornerPt.x - lastPt.x, cornerPt.y - lastPt.y) >= 0.25) {
            pushHistory(makeSnap(pts, true, 'line_sketch'));
            pts = [...pts, cornerPt];
            st.activePts = pts;
            st.activeAxis = 'vertical';
            st.lastCleanCoord = snapCoord(rawM.y);
            st.didCommitTurn = true;
            suppressNextClickRef.current = true;
            setSketchPts(pts);
            lastPt = cornerPt;
          }
        }
      } else if (!nearStartForClose && st.activeAxis === 'vertical') {
        const alongPx = absDyPx;
        const perpPx = absDxPx;
        if (perpPx < 16) {
          st.lastCleanCoord = snapCoord(rawM.y);
        }
        // Detect sharp 90° turn onto horizontal axis without lifting finger
        if (alongPx >= 24 && perpPx >= 26) {
          let cornerY = st.lastCleanCoord !== null ? st.lastCleanCoord : snapCoord(rawM.y);
          if (pts.length >= 2 && Math.abs(cornerY - startPt.y) < 0.45) {
            cornerY = startPt.y;
          }
          const cornerPt = { x: lastPt.x, y: cornerY };
          if (Math.hypot(cornerPt.x - lastPt.x, cornerPt.y - lastPt.y) >= 0.25) {
            pushHistory(makeSnap(pts, true, 'line_sketch'));
            pts = [...pts, cornerPt];
            st.activePts = pts;
            st.activeAxis = 'horizontal';
            st.lastCleanCoord = snapCoord(rawM.x);
            st.didCommitTurn = true;
            suppressNextClickRef.current = true;
            setSketchPts(pts);
            lastPt = cornerPt;
          }
        }
      }

      const { pt, info } = computeSnappedPoint(rawM, lastPt, startPt, pts.length, st.activeAxis);
      setCursorPos(pt);
      setSnapInfo(info);
      return;
    }

    if (mode === 'line_sketch' && isDrawing && !isSketchPaused) {
      const lastPt = sketchPts[sketchPts.length - 1];
      const startPt = sketchPts[0];
      const { pt, info } = computeSnappedPoint(rawM, lastPt, startPt);
      setCursorPos(pt);
      setSnapInfo(info);
      return;
    }

    if (mode === 'manipulate' && draggedVertexIdx !== null) {
      let snapX = gridSnap ? Math.round(rawM.x * 2) / 2 : Math.round(rawM.x * 10) / 10;
      let snapY = gridSnap ? Math.round(rawM.y * 2) / 2 : Math.round(rawM.y * 10) / 10;

      const newPts = [...sketchPts];
      newPts[draggedVertexIdx] = { x: snapX, y: snapY };
      setSketchPts(newPts);
      emitPolygonChange(newPts);
    }
  };

  // Click on Canvas to place line segment
  const handleCanvasClick = (e) => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    if (readOnlyMobile || mode !== 'line_sketch') return;
    const pxCoords = getSvgCoordinates(e);
    const rawM = pxToMeter(pxCoords.x, pxCoords.y);

    // If sketching is paused: clicking near the last vertex resumes sketching;
    // clicking near the start point closes the polygon; clicking empty space does NOT add accidental points.
    if (isDrawing && sketchPts.length > 0 && isSketchPaused) {
      const lastPt = sketchPts[sketchPts.length - 1];
      const startPt = sketchPts[0];
      const lastPx = meterToPx(lastPt.x, lastPt.y);
      const distToLastPx = Math.hypot(pxCoords.x - lastPx.x, pxCoords.y - lastPx.y);
      if (distToLastPx <= 22) {
        setIsSketchPaused(false);
        return;
      }
      const { info } = computeSnappedPoint(rawM, lastPt, startPt);
      if (info.isCloseSnap && sketchPts.length >= 3) {
        handleCloseLoop();
      }
      return;
    }

    // If starting a fresh sketch
    if (!isDrawing || sketchPts.length === 0) {
      pushHistory(makeSnap());
      let initialPt = gridSnap
        ? { x: Math.round(rawM.x * 2) / 2, y: Math.round(rawM.y * 2) / 2 }
        : rawM;
      setSketchPts([initialPt]);
      setIsDrawing(true);
      setIsSketchPaused(false);
      setCursorPos(initialPt);
      return;
    }

    // We are in the middle of drawing: check snap
    const lastPt = sketchPts[sketchPts.length - 1];
    const startPt = sketchPts[0];
    const { pt, info } = computeSnappedPoint(rawM, lastPt, startPt);

    // If cursor clicked on Start Point to Close Loop:
    if (info.isCloseSnap && sketchPts.length >= 3) {
      pushHistory(makeSnap());
      // Completed closed loop!
      setIsDrawing(false);
      setIsSketchPaused(false);
      setSnapInfo(null);
      setMode('manipulate');
      emitPolygonChange(sketchPts);
      return;
    }

    // Don't add redundant duplicate point
    if (pt.x === lastPt.x && pt.y === lastPt.y) return;

    // Add new snapped vertex
    pushHistory(makeSnap());
    const newPts = [...sketchPts, pt];
    setSketchPts(newPts);
  };

  // Close loop manually button
  const handleCloseLoop = () => {
    if (sketchPts.length >= 3) {
      pushHistory(makeSnap());
      setIsDrawing(false);
      setIsSketchPaused(false);
      setSnapInfo(null);
      setMode('manipulate');
      emitPolygonChange(sketchPts);
    }
  };

  const applySnapshot = (snap) => {
    if (!snap) return;
    const nextPts = clonePts(snap.pts);
    const nextDraw = Boolean(snap.isDrawing);
    const nextClosed = !nextDraw && nextPts.length >= 3;
    setSketchPts(nextPts);
    setIsDrawing(nextDraw);
    setIsSketchPaused(false);
    setSnapInfo(null);
    setMode(snap.mode || (nextClosed ? 'manipulate' : 'line_sketch'));
    emitPolygonChange(nextClosed ? nextPts : null);
  };

  // Undo (Ctrl+Z)
  const handleUndoPoint = () => {
    if (history.past.length > 0) {
      const prevSnap = history.past[history.past.length - 1];
      const currSnap = makeSnap();
      setHistory((h) => ({
        past: h.past.slice(0, -1),
        future: [currSnap, ...h.future.slice(0, 60)],
      }));
      applySnapshot(prevSnap);
      return;
    }
    if (sketchPts.length > 1) {
      const popped = sketchPts.slice(0, sketchPts.length - 1);
      setHistory((h) => ({ ...h, future: [makeSnap(), ...h.future.slice(0, 60)] }));
      setSketchPts(popped);
    } else if (sketchPts.length > 0) {
      setHistory((h) => ({ ...h, future: [makeSnap(), ...h.future.slice(0, 60)] }));
      setSketchPts([]);
      setIsDrawing(false);
      setIsSketchPaused(false);
    }
  };

  // Redo (Ctrl+Y / Ctrl+Shift+Z)
  const handleRedoPoint = () => {
    if (history.future.length === 0) return;
    const nextSnap = history.future[0];
    const currSnap = makeSnap();
    setHistory((h) => ({
      past: [...h.past.slice(-60), currSnap],
      future: h.future.slice(1),
    }));
    applySnapshot(nextSnap);
  };

  // Keyboard shortcuts: Ctrl+Z (Undo), Ctrl+Y / Ctrl+Shift+Z (Redo), Ctrl+A (Select All), Delete/Backspace, Esc (Pause/Resume Sketch)
  useEffect(() => {
    if (compactPreview) return;
    const onKeyDown = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) {
        return;
      }
      const key = (e.key || '').toLowerCase();

      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        if (key === 'z' && !e.shiftKey) {
          e.preventDefault();
          setIsSketchSelected(false);
          handleUndoPoint();
        } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
          e.preventDefault();
          setIsSketchSelected(false);
          handleRedoPoint();
        } else if (key === 'a' && sketchPts.length > 0 && !isDrawing) {
          e.preventDefault();
          setIsSketchSelected(true);
        }
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && isSketchSelected && sketchPts.length > 0) {
        e.preventDefault();
        handleClearSketch();
      } else if (e.key === 'Escape') {
        if (mode === 'line_sketch' && isDrawing && sketchPts.length > 0) {
          e.preventDefault();
          setIsSketchPaused((prev) => !prev);
          setSnapInfo(null);
          setIsSketchSelected(false);
          setSelectionBox(null);
        } else if (isSketchSelected || selectionBox) {
          e.preventDefault();
          setIsSketchSelected(false);
          setSelectionBox(null);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  // Reset / Clear sketch
  const handleClearSketch = () => {
    if (sketchPts.length > 0) pushHistory(makeSnap());
    setSketchPts([]);
    setIsDrawing(false);
    setIsSketchPaused(false);
    setSnapInfo(null);
    setIsSketchSelected(false);
    setSelectionBox(null);
    setMode('line_sketch');
    setExamplesOpen(false);
    emitPolygonChange(null);
    if (onResetToBlank) onResetToBlank();
  };

  // Apply a Polygon Preset (Example)
  const handleApplyPreset = (preset) => {
    pushHistory(makeSnap());
    setIsSketchSelected(false);
    setSelectionBox(null);
    setSketchPts(preset.vertices);
    setIsDrawing(false);
    setIsSketchPaused(false);
    setSnapInfo(null);
    setExamplesOpen(false);
    setMode('manipulate');
    emitPolygonChange(preset.vertices);
  };

  // Switch to standard rectangular roof example
  const handleSwitchToRectangle = () => {
    if (sketchPts.length > 0) pushHistory(makeSnap());
    setSketchPts([]);
    setIsDrawing(false);
    setIsSketchPaused(false);
    setExamplesOpen(false);
    setMode('manipulate');
    emitPolygonChange(null);
    if (onActivateRectangle) onActivateRectangle();
  };

  const renderExamplesDropdown = (compact = false) => (
    <div ref={examplesMenuRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={() => setExamplesOpen((v) => !v)}
        className="sketch-preset-pill"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: compact ? '5px 8px' : '4px 10px',
          fontSize: compact ? '11px' : '11.5px',
          fontWeight: 700,
          background: examplesOpen ? 'rgba(56, 189, 248, 0.18)' : 'rgba(30, 41, 59, 0.85)',
          borderColor: examplesOpen ? '#38bdf8' : '#334155',
          color: '#e2e8f0',
          cursor: 'pointer',
        }}
        title="Load an example floor plan"
      >
        <LayoutTemplate className="w-3.5 h-3.5 text-sky-400" />
        <span>Examples</span>
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </button>

      {examplesOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            minWidth: '196px',
            zIndex: 80,
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '10px',
            padding: '6px',
            boxShadow: '0 14px 32px rgba(2, 6, 23, 0.78)',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
          }}
        >
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', padding: '3px 8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Sample Roof Plans
          </div>
          <button
            type="button"
            onClick={handleSwitchToRectangle}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '7px 9px',
              borderRadius: '7px',
              border: 'none',
              background: 'transparent',
              color: '#e2e8f0',
              fontSize: '12px',
              fontWeight: 600,
              textAlign: 'left',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#1e293b'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span>Standard Rectangle</span>
            <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>12×8m</span>
          </button>
          {SHAPE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleApplyPreset(p)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '7px 9px',
                borderRadius: '7px',
                border: 'none',
                background: 'transparent',
                color: '#e2e8f0',
                fontSize: '12px',
                fontWeight: 600,
                textAlign: 'left',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#1e293b'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span>{p.name}</span>
              <span style={{ fontSize: '10px', color: '#38bdf8' }}>Example</span>
            </button>
          ))}
          {(hasActiveDesign || sketchPts.length > 0) && (
            <div style={{ borderTop: '1px solid #1e293b', marginTop: '3px', paddingTop: '3px' }}>
              <button
                type="button"
                onClick={handleClearSketch}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  width: '100%',
                  padding: '7px 9px',
                  borderRadius: '7px',
                  border: 'none',
                  background: 'transparent',
                  color: '#fca5a5',
                  fontSize: '12px',
                  fontWeight: 700,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.14)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear to Blank Canvas</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Computed display points for polygon
  const isClosed = !isDrawing && sketchPts.length >= 3;
  const polyMetrics = isClosed ? calculatePolygonMetrics(sketchPts) : null;
  const unitLabel = unitSystem === UNIT_SYSTEMS.IMPERIAL ? 'ft' : 'm';

  const toDisplayLen = (meters) =>
    unitSystem === UNIT_SYSTEMS.IMPERIAL ? Number(metersToFeet(meters).toFixed(2)) : Number(Number(meters).toFixed(2));
  const fromDisplayLen = (val) => {
    const n = Number(val);
    if (!Number.isFinite(n) || n <= 0) return null;
    return unitSystem === UNIT_SYSTEMS.IMPERIAL ? feetToMeters(n) : n;
  };

  const openDimEdit = (kind, currentMeters, idx = 0) => {
    setEditingDim({ kind, idx, origMeters: currentMeters });
    setTempDimVal(String(toDisplayLen(currentMeters)));
  };

  const applyDimEdit = (scaleWholePlan = false) => {
    if (!editingDim) return;
    const newM = fromDisplayLen(tempDimVal);
    if (!newM || newM < 0.3) {
      setEditingDim(null);
      return;
    }

    if (editingDim.kind === 'rectL' && onDimensionsChange) {
      onDimensionsChange({ length: Math.round(newM * 100) / 100, breadth: B });
    } else if (editingDim.kind === 'rectB' && onDimensionsChange) {
      onDimensionsChange({ length: L, breadth: Math.round(newM * 100) / 100 });
    } else if (editingDim.kind === 'polyEdge' && isClosed) {
      const idx = editingDim.idx;
      const p1 = sketchPts[idx];
      const p2 = sketchPts[(idx + 1) % sketchPts.length];
      const curLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (curLen > 0.05) {
        if (scaleWholePlan) {
          pushHistory(makeSnap());
          const factor = newM / curLen;
          const scaled = sketchPts.map((pt) => ({
            x: Math.round(pt.x * factor * 100) / 100,
            y: Math.round(pt.y * factor * 100) / 100,
          }));
          setSketchPts(scaled);
          emitPolygonChange(scaled);
        } else {
          pushHistory(makeSnap());
          const ux = (p2.x - p1.x) / curLen;
          const uy = (p2.y - p1.y) / curLen;
          const deltaX = ux * (newM - curLen);
          const deltaY = uy * (newM - curLen);
          const updated = sketchPts.map((pt, i) =>
            i === (idx + 1) % sketchPts.length
              ? {
                  x: Math.round((pt.x + deltaX) * 100) / 100,
                  y: Math.round((pt.y + deltaY) * 100) / 100,
                }
              : pt
          );
          setSketchPts(updated);
          emitPolygonChange(updated);
        }
      }
    }
    setEditingDim(null);
  };

  const canUndo = history.past.length > 0 || (mode === 'line_sketch' && isDrawing && sketchPts.length > 0);
  const canRedo = history.future.length > 0;

  return (
    <div className="sketch-studio-panel" style={mobileInteractive ? { height: '100%', minHeight: 0, borderRadius: '12px' } : compactPreview ? { height: '100%', minHeight: 0, border: 'none', borderRadius: 0 } : readOnlyMobile ? { height: '320px', borderRadius: '14px' } : undefined}>
      {mobileInteractive && !readOnlyMobile && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '6px',
            padding: '7px 8px',
            background: '#0f172a',
            borderBottom: '1px solid #1e293b',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              onClick={() => {
                if (sketchPts.length >= 3 && !isDrawing) {
                  pushHistory(makeSnap());
                  setSketchPts([]);
                  setIsDrawing(false);
                  emitPolygonChange(null);
                }
                setIsSketchPaused(false);
                setMode('line_sketch');
              }}
              className={`sketch-btn ${mode === 'line_sketch' ? 'active-sketch' : ''}`}
              style={{ padding: '5px 9px', fontSize: '11.5px' }}
            >
              <span>{isDrawing && isSketchPaused ? 'Resume' : 'Draw'}</span>
            </button>
            <button
              type="button"
              disabled={sketchPts.length < 3}
              onClick={() => {
                setIsDrawing(false);
                setIsSketchPaused(false);
                setMode('manipulate');
                if (sketchPts.length >= 3) emitPolygonChange(sketchPts);
              }}
              className={`sketch-btn ${mode === 'manipulate' ? 'active-manipulate' : ''}`}
              style={{ padding: '5px 9px', fontSize: '11.5px', opacity: sketchPts.length < 3 ? 0.45 : 1 }}
            >
              <Move className="w-3 h-3" />
              <span>Edit</span>
            </button>
            {renderExamplesDropdown(true)}
            {mode === 'line_sketch' && isDrawing && sketchPts.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setIsSketchPaused((prev) => !prev);
                  setSnapInfo(null);
                }}
                className="sketch-btn"
                style={{
                  padding: '5px 8px',
                  fontSize: '11px',
                  background: isSketchPaused ? 'rgba(16, 185, 129, 0.18)' : 'rgba(245, 158, 11, 0.14)',
                  color: isSketchPaused ? '#34d399' : '#fbbf24',
                  border: `1px solid ${isSketchPaused ? 'rgba(16, 185, 129, 0.5)' : 'rgba(245, 158, 11, 0.4)'}`,
                }}
              >
                {isSketchPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                <span>{isSketchPaused ? 'Resume' : 'Pause'}</span>
              </button>
            )}
            {mode === 'line_sketch' && isDrawing && sketchPts.length >= 3 && (
              <button
                type="button"
                onClick={handleCloseLoop}
                className="sketch-btn-finish"
                style={{ padding: '5px 8px', fontSize: '11px' }}
              >
                <Check className="w-3 h-3" />
                <span>Finish</span>
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              disabled={!canUndo}
              onClick={handleUndoPoint}
              className="sketch-btn-undo"
              style={{ padding: '5px 8px', fontSize: '11px', opacity: canUndo ? 1 : 0.35 }}
              title="Undo"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>
            <button
              type="button"
              disabled={!canRedo}
              onClick={handleRedoPoint}
              className="sketch-btn-undo"
              style={{ padding: '5px 8px', fontSize: '11px', opacity: canRedo ? 1 : 0.35 }}
              title="Redo"
            >
              <Redo2 className="w-3.5 h-3.5" />
              <span>Redo</span>
            </button>
            {(sketchPts.length > 0 || hasActiveDesign) && (
              <button
                type="button"
                onClick={handleClearSketch}
                className="sketch-btn-trash"
                style={{ padding: '5px 7px' }}
                title="Clear to Blank Canvas"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {!readOnlyMobile && !mobileInteractive && (
      <>
      {/* 1. Header Toolbar */}
      <div className="sketch-toolbar">
        <div className="sketch-title">
          <Ruler className="w-4 h-4 text-amber-400" />
          <span>{compactPreview ? 'Converted 2D Plan' : '2D Floor Plan'}</span>
        </div>

        {/* Action Modes & Snapping Controls */}
        <div className="sketch-tool-group">
          {!compactPreview && onOpenPaperUpload && (
            <button
              type="button"
              onClick={onOpenPaperUpload}
              className="sketch-btn"
              style={{
                background: 'rgba(245, 158, 11, 0.14)',
                color: '#fbbf24',
                border: '1px solid rgba(245, 158, 11, 0.4)',
              }}
              title="Upload photo of a hand-drawn paper sketch & convert to 2D"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Paper Sketch</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (isClosed) {
                pushHistory(makeSnap());
                setSketchPts([]);
                setIsDrawing(false);
                emitPolygonChange(null);
              }
              setIsSketchPaused(false);
              setMode('line_sketch');
            }}
            className={`sketch-btn ${mode === 'line_sketch' ? 'active-sketch' : ''}`}
            title={isDrawing && isSketchPaused ? 'Resume wall sketching from your last point' : 'Click to draw walls around your building footprint'}
          >
            {/* Clean architectural line with endpoint vertices */}
            <svg
              viewBox="0 0 16 16"
              className="w-3.5 h-3.5 text-sky-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="2.5" y1="13.5" x2="13.5" y2="2.5" />
              <circle cx="2.5" cy="13.5" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="13.5" cy="2.5" r="1.5" fill="currentColor" stroke="none" />
            </svg>
            <span>{isDrawing && isSketchPaused ? 'Resume Draw' : 'Draw Walls'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsSketchPaused(false);
              setMode('manipulate');
            }}
            className={`sketch-btn ${mode === 'manipulate' ? 'active-nudge' : ''}`}
            title="Drag corners or click wall numbers to resize"
          >
            <Move className="w-3.5 h-3.5 text-amber-400" />
            <span>Edit Corners</span>
          </button>

          {/* Snapping & Viewport Toggles */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderLeft: '1px solid rgba(51, 65, 85, 0.6)', paddingLeft: '6px' }}>
            <button
              type="button"
              onClick={() => setOrthoSnap(!orthoSnap)}
              title="Lock walls to straight 90° angles"
              className={`sketch-toggle-btn ${orthoSnap ? 'active-ortho' : ''}`}
            >
              90° Snap
            </button>
            <button
              type="button"
              onClick={() => setGridSnap(!gridSnap)}
              title="Snap corners to 0.5m grid"
              className={`sketch-toggle-btn ${gridSnap ? 'active-grid' : ''}`}
            >
              Grid
            </button>
            <button
              type="button"
              onClick={() => setShowDimensions(!showDimensions)}
              title={showDimensions ? "Hide wall sizes to declutter view" : "Show wall sizes"}
              className={`sketch-toggle-btn ${showDimensions ? 'active-grid' : ''}`}
            >
              {showDimensions ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>Sizes</span>
            </button>
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? "Back to split view" : "Make 2D plan larger"}
              className={`sketch-toggle-btn ${isExpanded ? 'active-ortho' : ''}`}
            >
              {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span>{isExpanded ? 'Smaller' : 'Larger'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Examples & Level Bar */}
      <div className="sketch-presets-bar">
        <div className="sketch-presets-list">
          {renderExamplesDropdown(false)}

          {!readOnlyMobile && !mobileInteractive && !compactPreview && onStageChange && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                marginLeft: '8px',
                paddingLeft: '8px',
                borderLeft: '1px solid var(--border-color)',
              }}
            >
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Level:</span>
              {BUILDING_STAGES.map((stg) => {
                const active = buildingStage === stg.id;
                return (
                  <button
                    key={stg.id}
                    type="button"
                    onClick={() => onStageChange(stg.id)}
                    className="sketch-preset-pill"
                    title={stg.summary}
                    style={{
                      background: active ? stg.bgLight : 'transparent',
                      borderColor: active ? stg.color : 'var(--border-color)',
                      color: active ? stg.color : 'var(--text-secondary)',
                      fontWeight: active ? 700 : 500,
                    }}
                  >
                    {stg.shortName}
                  </button>
                );
              })}
            </div>
          )}

          {sketchUnderlayImage && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '2px 8px',
                borderRadius: '6px',
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                marginLeft: '4px',
              }}
            >
              <button
                type="button"
                onClick={() => setShowUnderlay(!showUnderlay)}
                style={{
                  background: 'transparent',
                  color: showUnderlay ? '#38bdf8' : '#94a3b8',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                }}
              >
                <ImageIcon className="w-3 h-3" />
                <span>{showUnderlay ? 'Paper Underlay ON' : 'Paper Underlay OFF'}</span>
              </button>
              {showUnderlay && (
                <input
                  type="range"
                  min="0.15"
                  max="0.8"
                  step="0.05"
                  value={underlayOpacity}
                  onChange={(e) => setUnderlayOpacity(Number(e.target.value))}
                  style={{ width: '52px', height: '4px', accentColor: '#38bdf8', cursor: 'pointer' }}
                  title="Adjust paper sketch underlay opacity"
                />
              )}
              {onClearUnderlay && !compactPreview && (
                <button
                  type="button"
                  onClick={onClearUnderlay}
                  style={{ background: 'transparent', color: '#94a3b8', padding: '1px', cursor: 'pointer' }}
                  title="Remove paper underlay"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Sketching & History Controls */}
        <div className="sketch-action-btns">
          {(history.past.length > 0 || (mode === 'line_sketch' && isDrawing && sketchPts.length > 0)) && (
            <button
              type="button"
              onClick={handleUndoPoint}
              className="sketch-btn-undo"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-3 h-3" />
              <span>Undo</span>
            </button>
          )}
          {history.future.length > 0 && (
            <button
              type="button"
              onClick={handleRedoPoint}
              className="sketch-btn-undo"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="w-3 h-3" />
              <span>Redo</span>
            </button>
          )}
          {mode === 'line_sketch' && isDrawing && sketchPts.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setIsSketchPaused((prev) => !prev);
                setSnapInfo(null);
              }}
              className="sketch-btn"
              style={
                isSketchPaused
                  ? {
                      background: 'rgba(16, 185, 129, 0.18)',
                      color: '#34d399',
                      border: '1px solid rgba(16, 185, 129, 0.55)',
                      fontWeight: 700,
                    }
                  : {
                      background: 'rgba(245, 158, 11, 0.14)',
                      color: '#fbbf24',
                      border: '1px solid rgba(245, 158, 11, 0.4)',
                      fontWeight: 700,
                    }
              }
              title={isSketchPaused ? 'Resume wall sketching from last point (Esc)' : 'Pause wall sketching to inspect other tabs (Esc)'}
            >
              {isSketchPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
              <span>{isSketchPaused ? 'Resume Sketch (Esc)' : 'Pause (Esc)'}</span>
            </button>
          )}
          {mode === 'line_sketch' && isDrawing && sketchPts.length >= 3 && (
            <button
              type="button"
              onClick={handleCloseLoop}
              className="sketch-btn-finish"
            >
              <Check className="w-3 h-3" />
              <span>Connect &amp; Finish</span>
            </button>
          )}

          {(sketchPts.length > 0 || hasActiveDesign) && (
            <button
              type="button"
              onClick={handleClearSketch}
              className="sketch-btn-trash"
              title="Clear to Blank Canvas"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      </>
      )}

      {/* 3. SVG Drawing Surface */}
      <div
        style={{
          flex: 1,
          width: '100%',
          minHeight: mobileInteractive || compactPreview ? 0 : '380px',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          touchAction: 'none',
        }}
        className={`sketch-canvas-container ${
          mode === 'line_sketch'
            ? isSketchPaused
              ? 'cursor-grab'
              : snapInfo?.isCloseSnap
              ? 'cursor-connect-loop'
              : 'cursor-sketch'
            : draggedVertexIdx !== null
            ? 'cursor-nudge-active'
            : ''
        }`}
        onTouchStart={handleTouchStartZoomPan}
        onTouchMove={handleTouchMoveZoomPan}
        onTouchEnd={handleTouchEndZoomPan}
        onTouchCancel={handleTouchEndZoomPan}
        onWheel={handleWheelZoom}
        onPointerMove={handleCanvasMouseMove}
        onPointerCancel={() => {
          mousePanRef.current = null;
          touchDrawRef.current = null;
          pointerDownPxRef.current = null;
        }}
        onPointerUp={(e) => {
          mousePanRef.current = null;
          // Finish continuous single-finger touch stroke (supports multi-turn one-stroke drawing + tap-to-place)
          if (
            e.pointerType === 'touch' &&
            touchDrawRef.current &&
            touchDrawRef.current.pointerId === e.pointerId &&
            !readOnlyMobile &&
            mode === 'line_sketch' &&
            !isSketchPaused
          ) {
            const st = touchDrawRef.current;
            touchDrawRef.current = null;
            const upPx = getSvgCoordinates(e);
            const rawM = pxToMeter(upPx.x, upPx.y);
            const pts = st.activePts;
            const lastPt = pts[pts.length - 1];
            const startPt = pts[0];
            const lastPx = meterToPx(lastPt.x, lastPt.y);
            const distFromLastPx = Math.hypot(upPx.x - lastPx.x, upPx.y - lastPx.y);
            const dragFromDownPx = pointerDownPxRef.current
              ? Math.hypot(upPx.x - pointerDownPxRef.current.x, upPx.y - pointerDownPxRef.current.y)
              : distFromLastPx;

            if (dragFromDownPx > 14 || st.didCommitTurn) {
              suppressNextClickRef.current = true;
              const { pt, info } = computeSnappedPoint(rawM, lastPt, startPt, pts.length, st.activeAxis);
              if (info.isCloseSnap && pts.length >= 3) {
                pushHistory(makeSnap(pts, true, 'line_sketch'));
                setSketchPts(pts);
                setIsDrawing(false);
                setIsSketchPaused(false);
                setSnapInfo(null);
                setMode('manipulate');
                emitPolygonChange(pts);
              } else if (distFromLastPx > 14 && (pt.x !== lastPt.x || pt.y !== lastPt.y)) {
                pushHistory(makeSnap(pts, true, 'line_sketch'));
                const finalPts = [...pts, pt];
                setSketchPts(finalPts);
                setCursorPos(pt);
              }
            }
          }
          pointerDownPxRef.current = null;

          if (selectionBox) {
            const minBx = Math.min(selectionBox.startX, selectionBox.currX);
            const maxBx = Math.max(selectionBox.startX, selectionBox.currX);
            const minBy = Math.min(selectionBox.startY, selectionBox.currY);
            const maxBy = Math.max(selectionBox.startY, selectionBox.currY);
            const isDrag = maxBx - minBx > 6 || maxBy - minBy > 6;
            if (isDrag && sketchPts.length > 0) {
              const ptsPx = sketchPts.map((p) => meterToPx(p.x, p.y));
              const sMinX = Math.min(...ptsPx.map((p) => p.x));
              const sMaxX = Math.max(...ptsPx.map((p) => p.x));
              const sMinY = Math.min(...ptsPx.map((p) => p.y));
              const sMaxY = Math.max(...ptsPx.map((p) => p.y));
              const overlaps =
                maxBx >= sMinX && minBx <= sMaxX && maxBy >= sMinY && minBy <= sMaxY;
              setIsSketchSelected(overlaps);
            } else {
              setIsSketchSelected(false);
            }
            setSelectionBox(null);
          }
          if (draggedVertexIdx !== null && dragPreSnapRef.current) {
            const before = dragPreSnapRef.current.pts;
            const changed =
              before.length === sketchPts.length &&
              before.some((p, idx) => p.x !== sketchPts[idx].x || p.y !== sketchPts[idx].y);
            if (changed) {
              pushHistory(dragPreSnapRef.current);
            }
            dragPreSnapRef.current = null;
          }
          setDraggedVertexIdx(null);
        }}
      >
        {/* Floating Whole-Sketch Selection Action Bar */}
        {isSketchSelected && sketchPts.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '14px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 25,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'rgba(15, 23, 42, 0.94)',
              border: '1px solid rgba(244, 63, 94, 0.7)',
              borderRadius: '10px',
              padding: '6px 12px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
              backdropFilter: 'blur(6px)',
            }}
          >
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#fda4af' }}>
              Whole Sketch Selected
            </span>
            <button
              type="button"
              onClick={handleClearSketch}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: '#e11d48',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
              title="Delete entire sketch (Delete / Backspace)"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Sketch
            </button>
            <button
              type="button"
              onClick={() => setIsSketchSelected(false)}
              style={{
                background: 'transparent',
                color: '#94a3b8',
                border: 'none',
                fontSize: '12px',
                cursor: 'pointer',
                padding: '2px 4px',
              }}
              title="Deselect (Esc)"
            >
              ✕
            </button>
          </div>
        )}
        {/* Pinch / Pan Hint in Compact Scan Preview */}
        {compactPreview && zoomLevel === 1.0 && panOffset.x === 0 && panOffset.y === 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              left: '12px',
              zIndex: 20,
              pointerEvents: 'none',
              background: 'rgba(15, 23, 42, 0.84)',
              border: '1px solid rgba(71, 85, 105, 0.5)',
              color: '#94a3b8',
              fontSize: '10.5px',
              fontWeight: 600,
              padding: '3px 8px',
              borderRadius: '999px',
            }}
          >
            Pinch or double-tap to zoom
          </div>
        )}

        {/* On-Canvas Zoom & View Controls (Bottom-Right) */}
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            right: '12px',
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            background: 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(8px)',
            padding: '4px 8px',
            borderRadius: '8px',
            border: '1px solid rgba(71, 85, 105, 0.7)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
          }}
        >
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(4.0, Math.round((z + 0.25) * 100) / 100))}
            title="Zoom In (+25%)"
            style={{ background: 'transparent', color: '#38bdf8', border: 'none', cursor: 'pointer', padding: '2px' }}
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <span style={{ fontSize: '10.5px', fontFamily: 'monospace', color: '#cbd5e1', minWidth: '34px', textAlign: 'center' }}>
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(0.6, Math.round((z - 0.25) * 100) / 100))}
            title="Zoom Out (-25%)"
            style={{ background: 'transparent', color: '#38bdf8', border: 'none', cursor: 'pointer', padding: '2px' }}
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setZoomLevel(1.0);
              setPanOffset({ x: 0, y: 0 });
            }}
            title="Reset Zoom & Position (100%)"
            style={{ background: 'transparent', color: '#38bdf8', border: 'none', cursor: 'pointer', padding: '2px', marginLeft: '3px' }}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
        {/* Floating Inline Wall Dimension Popover */}
        {editingDim && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: '10px',
              right: '12px',
              zIndex: 25,
              background: 'rgba(15, 23, 42, 0.96)',
              border: '1px solid rgba(56, 189, 248, 0.55)',
              borderRadius: '10px',
              padding: '8px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 10px 24px rgba(0, 0, 0, 0.55)',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8' }}>
              {editingDim.kind === 'rectL'
                ? 'Wall L:'
                : editingDim.kind === 'rectB'
                ? 'Wall B:'
                : `Wall #${editingDim.idx + 1}:`}
            </span>
            <input
              type="number"
              min="0.5"
              step="0.1"
              autoFocus
              value={tempDimVal}
              onChange={(e) => setTempDimVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyDimEdit(false);
                if (e.key === 'Escape') setEditingDim(null);
              }}
              style={{
                width: '68px',
                padding: '4px 6px',
                fontSize: '12px',
                fontFamily: 'monospace',
                background: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #475569',
                borderRadius: '5px',
              }}
            />
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>{unitLabel}</span>
            <button
              type="button"
              onClick={() => applyDimEdit(false)}
              style={{
                padding: '4px 8px',
                fontSize: '10.5px',
                fontWeight: 700,
                background: '#10b981',
                color: '#022c22',
                borderRadius: '5px',
                cursor: 'pointer',
              }}
            >
              Set
            </button>
            {editingDim.kind === 'polyEdge' && (
              <button
                type="button"
                onClick={() => applyDimEdit(true)}
                title="Calibrate & scale all walls proportionally using this wall as reference"
                style={{
                  padding: '4px 8px',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  background: 'rgba(56, 189, 248, 0.2)',
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.45)',
                  borderRadius: '5px',
                  cursor: 'pointer',
                }}
              >
                Scale Plan
              </button>
            )}
            <button
              type="button"
              onClick={() => setEditingDim(null)}
              style={{ background: 'transparent', color: '#94a3b8', fontSize: '12px', cursor: 'pointer', padding: '0 3px' }}
            >
              ✕
            </button>
          </div>
        )}

        <svg
          ref={svgRef}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          preserveAspectRatio="xMidYMid meet"
          style={{
            width: '100%',
            height: '100%',
            maxHeight: '100%',
            display: 'block',
            touchAction: 'none',
          }}
          className={`w-full h-full ${
            mode === 'line_sketch'
              ? isSketchPaused
                ? 'cursor-grab'
                : snapInfo?.isCloseSnap
                ? 'cursor-connect-loop'
                : 'cursor-sketch'
              : ''
          }`}
          onClick={handleCanvasClick}
          onPointerDown={(e) => {
            if (readOnlyMobile) return;
            const px = getSvgCoordinates(e);
            if (mode === 'line_sketch') {
              pointerDownPxRef.current = px;
              if (isDrawing && isSketchPaused && e.pointerType !== 'touch' && e.button === 0) {
                mousePanRef.current = { startPx: px, startPan: { ...panOffset }, moved: false };
                return;
              }
              // Single-finger continuous touch sketching: start immediately on touch-down so user can draw walls & turn corners in one continuous stroke
              if (e.pointerType === 'touch' && !isSketchPaused && !touchGestureRef.current) {
                const rawM = pxToMeter(px.x, px.y);
                const snapCoord = (v) => (gridSnap ? Math.round(v * 2) / 2 : Math.round(v * 10) / 10);
                if (!isDrawing || sketchPts.length === 0) {
                  const initialPt = { x: snapCoord(rawM.x), y: snapCoord(rawM.y) };
                  pushHistory(makeSnap());
                  setSketchPts([initialPt]);
                  setIsDrawing(true);
                  setIsSketchPaused(false);
                  setCursorPos(initialPt);
                  suppressNextClickRef.current = true;
                  touchDrawRef.current = {
                    pointerId: e.pointerId,
                    activePts: [initialPt],
                    activeAxis: null,
                    lastCleanCoord: null,
                    startedFresh: true,
                    didCommitTurn: false,
                  };
                } else {
                  touchDrawRef.current = {
                    pointerId: e.pointerId,
                    activePts: [...sketchPts],
                    activeAxis: null,
                    lastCleanCoord: null,
                    startedFresh: false,
                    didCommitTurn: false,
                  };
                }
              }
              return;
            }
            if (e.button !== 0 || mode !== 'manipulate' || isDrawing || sketchPts.length === 0) return;
            setSelectionBox({ startX: px.x, startY: px.y, currX: px.x, currY: px.y });
          }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="grid-sketch" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.8" />
            </pattern>
            <pattern id="grid-major" width="100" height="100" patternUnits="userSpaceOnUse">
              <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#334155" strokeWidth="1.0" />
            </pattern>
            <marker id="slant-arrow-end" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#34d399" />
            </marker>
          </defs>

          {/* Grid Background */}
          <rect width={svgWidth} height={svgHeight} fill="url(#grid-sketch)" />
          <rect width={svgWidth} height={svgHeight} fill="url(#grid-major)" />

          {/* Optional Uploaded Paper Sketch Translucent Underlay */}
          {sketchUnderlayImage && showUnderlay && (
            <image
              href={sketchUnderlayImage}
              x={margin * 0.55}
              y={margin * 0.45}
              width={svgWidth - margin * 1.1}
              height={svgHeight - margin * 0.9}
              preserveAspectRatio="xMidYMid meet"
              opacity={underlayOpacity}
              pointerEvents="none"
            />
          )}

          {/* Blank Canvas Ready Hint (non-blocking — clicking anywhere starts sketching immediately) */}
          {!hasActiveDesign && !isDrawing && sketchPts.length === 0 && !compactPreview && !readOnlyMobile && (
            <g pointerEvents="none">
              <rect
                x={svgWidth / 2 - (isCompactViewport ? 168 : 210)}
                y={svgHeight / 2 - (isCompactViewport ? 44 : 42)}
                width={isCompactViewport ? 336 : 420}
                height={isCompactViewport ? 88 : 84}
                rx="12"
                fill="rgba(15, 23, 42, 0.88)"
                stroke="rgba(56, 189, 248, 0.35)"
                strokeWidth="1.2"
                strokeDasharray="5 4"
              />
              <text
                x={svgWidth / 2}
                y={svgHeight / 2 - 12}
                fill="#f8fafc"
                fontSize={isCompactViewport ? '14.5' : '14'}
                fontWeight="800"
                textAnchor="middle"
              >
                Ready for a New Drawing
              </text>
              <text
                x={svgWidth / 2}
                y={svgHeight / 2 + 10}
                fill="#94a3b8"
                fontSize={isCompactViewport ? '11.5' : '11.5'}
                textAnchor="middle"
              >
                {isCompactViewport
                  ? 'Tap anywhere on the grid to draw walls,'
                  : 'Click anywhere on the grid to sketch your walls,'}
              </text>
              <text
                x={svgWidth / 2}
                y={svgHeight / 2 + 27}
                fill="#38bdf8"
                fontSize={isCompactViewport ? '11.5' : '11.5'}
                fontWeight="600"
                textAnchor="middle"
              >
                {isCompactViewport
                  ? 'tap Snap above, or open Examples ▾'
                  : 'use Snap / Upload Sketch, or open Examples ▾'}
              </text>
            </g>
          )}

          {/* A. If Standard Rectangle (active rectangular design with no custom polygon) */}
          {hasActiveDesign && !isClosed && sketchPts.length === 0 && (() => {
            const wallLeft = centerX + panOffset.x - (L * scale) / 2;
            const wallTop = centerY + panOffset.y - (B * scale) / 2;
            const wallW = L * scale;
            const wallH = B * scale;

            const eaveLeft = wallLeft - ov.left * scale;
            const eaveTop = wallTop - ov.back * scale;
            const eaveW = wallW + (ov.left + ov.right) * scale;
            const eaveH = wallH + (ov.front + ov.back) * scale;
            const eaveRight = eaveLeft + eaveW;
            const eaveBottom = eaveTop + eaveH;
            const eaveMidX = (eaveLeft + eaveRight) / 2;
            const eaveMidY = (eaveTop + eaveBottom) / 2;

            const effL = L + ov.left + ov.right;
            const effB = B + ov.front + ov.back;
            const ridgePx = roofType === 'hip' ? Math.max(0, effL - effB) * scale : eaveW;
            const r1X = roofType === 'hip' ? eaveMidX - ridgePx / 2 : eaveLeft;
            const r2X = roofType === 'hip' ? eaveMidX + ridgePx / 2 : eaveRight;

            const slantHLabel = formatLength(geometry?.rafterLength || 0, unitSystem);
            const kpLabel = formatLength(geometry?.roofHeight || 0, unitSystem);
            const purlinSp = Math.max(0.25, Number(woodworkConfig?.purlinSpacing) || 0.6);
            const purlinRows = Math.min(9, Math.max(3, Math.round((geometry?.rafterLength || 4.8) / purlinSp)));
            const fillOp = sketchUnderlayImage && showUnderlay ? 0.35 : 0.72;

            const isParapet = buildingStage === 'parapet' || Boolean(parapetConfig?.enabled);
            const pInsetPx =
              isParapet && parapetConfig?.includedInSketch
                ? Math.min(wallW * 0.25, wallH * 0.25, (parapetConfig?.projection || 0.45) * scale)
                : 0;

            return (
              <g>
                {/* Outer Roof Eave / Outward Concrete Parapet Rim */}
                <rect
                  x={eaveLeft}
                  y={eaveTop}
                  width={eaveW}
                  height={eaveH}
                  fill="#0f172a"
                  fillOpacity={fillOp}
                  stroke={isParapet ? '#cbd5e1' : '#38bdf8'}
                  strokeWidth={isParapet ? '3.2' : '2.4'}
                  pointerEvents="none"
                />

                {/* Inner Dashed Wall Footprint */}
                <rect
                  x={wallLeft + pInsetPx}
                  y={wallTop + pInsetPx}
                  width={Math.max(4, wallW - 2 * pInsetPx)}
                  height={Math.max(4, wallH - 2 * pInsetPx)}
                  fill="#1e293b"
                  fillOpacity={sketchUnderlayImage && showUnderlay ? 0.18 : 0.35}
                  stroke="#64748b"
                  strokeWidth="1.4"
                  strokeDasharray="4 4"
                  pointerEvents="none"
                />

                {/* Purlin lines on upper slope in Woodwork Stage */}
                {buildingStage === 'woodwork' && (roofType === 'hip' || roofType === 'gable') && (
                  <g opacity="0.75" pointerEvents="none">
                    {Array.from({ length: purlinRows - 1 }, (_, i) => {
                      const t = (i + 1) / purlinRows;
                      const py = eaveMidY + (eaveTop - eaveMidY) * t;
                      const px1 = r1X + (eaveLeft - r1X) * t;
                      const px2 = r2X + (eaveRight - r2X) * t;
                      return (
                        <line
                          key={`purlin-2d-${i}`}
                          x1={px1}
                          y1={py}
                          x2={px2}
                          y2={py}
                          stroke="#e09f3e"
                          strokeWidth="1.1"
                          strokeDasharray="3 2"
                        />
                      );
                    })}
                  </g>
                )}

                {/* Roof Plan Ridge & Hip Geometry */}
                {roofType === 'hip' && (
                  <g stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" pointerEvents="none">
                    {ridgePx > 1 && <line x1={r1X} y1={eaveMidY} x2={r2X} y2={eaveMidY} strokeWidth="2.6" />}
                    <line x1={r1X} y1={eaveMidY} x2={eaveLeft} y2={eaveTop} />
                    <line x1={r1X} y1={eaveMidY} x2={eaveLeft} y2={eaveBottom} />
                    <line x1={r2X} y1={eaveMidY} x2={eaveRight} y2={eaveTop} />
                    <line x1={r2X} y1={eaveMidY} x2={eaveRight} y2={eaveBottom} />
                  </g>
                )}

                {roofType === 'gable' && (
                  <line x1={eaveLeft} y1={eaveMidY} x2={eaveRight} y2={eaveMidY} stroke="#f59e0b" strokeWidth="2.6" pointerEvents="none" />
                )}

                {roofType === 'shed' && (
                  <line x1={eaveLeft} y1={eaveTop} x2={eaveRight} y2={eaveTop} stroke="#f59e0b" strokeWidth="3" pointerEvents="none" />
                )}

                {roofType === 'gambrel' && (
                  <g pointerEvents="none">
                    <line x1={eaveLeft} y1={eaveMidY} x2={eaveRight} y2={eaveMidY} stroke="#f59e0b" strokeWidth="2.6" />
                    <line x1={eaveLeft} y1={eaveMidY - eaveH * 0.275} x2={eaveRight} y2={eaveMidY - eaveH * 0.275} stroke="#f59e0b" strokeWidth="1.4" strokeDasharray="5 3" />
                    <line x1={eaveLeft} y1={eaveMidY + eaveH * 0.275} x2={eaveRight} y2={eaveMidY + eaveH * 0.275} stroke="#f59e0b" strokeWidth="1.4" strokeDasharray="5 3" />
                  </g>
                )}

                {/* Kingpost Height (KP) Apex Callout Badge on Ridge */}
                {eaveH > 48 && (
                  <g pointerEvents="none">
                    <rect
                      x={eaveMidX - (isCompactViewport ? 48 : 38)}
                      y={(roofType === 'shed' ? eaveTop : eaveMidY) - (isCompactViewport ? 24 : 18)}
                      width={isCompactViewport ? 96 : 76}
                      height={isCompactViewport ? 22 : 16}
                      rx={isCompactViewport ? '5' : '4'}
                      fill="#0f172a"
                      fillOpacity={isCompactViewport ? '0.95' : '0.92'}
                      stroke="#f59e0b"
                      strokeWidth={isCompactViewport ? '1.3' : '1'}
                    />
                    <text
                      x={eaveMidX}
                      y={(roofType === 'shed' ? eaveTop : eaveMidY) - (isCompactViewport ? 9 : 7)}
                      fill="#fbbf24"
                      fontSize={isCompactViewport ? '12' : '8.8'}
                      fontWeight="bold"
                      textAnchor="middle"
                      fontFamily="monospace"
                    >
                      KP = {kpLabel}
                    </text>
                  </g>
                )}

                {/* Slanting Height (H) Double-Headed Arrow on Main Slope */}
                {(() => {
                  const yStart = roofType === 'shed' ? eaveTop + 6 : eaveMidY + 6;
                  const yEnd = eaveBottom - 6;
                  if (yEnd - yStart < 20) return null;
                  const midY = (yStart + yEnd) / 2;
                  return (
                    <g pointerEvents="none">
                      <line
                        x1={eaveMidX}
                        y1={yStart}
                        x2={eaveMidX}
                        y2={yEnd}
                        stroke="#34d399"
                        strokeWidth="1.6"
                        markerStart="url(#slant-arrow-end)"
                        markerEnd="url(#slant-arrow-end)"
                      />
                      <rect
                        x={eaveMidX - (isCompactViewport ? 49 : 38)}
                        y={midY - (isCompactViewport ? 12 : 9)}
                        width={isCompactViewport ? 98 : 76}
                        height={isCompactViewport ? 24 : 18}
                        rx={isCompactViewport ? '5' : '4'}
                        fill="#0f172a"
                        fillOpacity={isCompactViewport ? '0.95' : '0.92'}
                        stroke="#10b981"
                        strokeWidth={isCompactViewport ? '1.3' : '1'}
                      />
                      <text
                        x={eaveMidX}
                        y={midY + (isCompactViewport ? 4.5 : 3.5)}
                        fill="#34d399"
                        fontSize={isCompactViewport ? '12.5' : '9.5'}
                        fontWeight="bold"
                        textAnchor="middle"
                        fontFamily="monospace"
                      >
                        H = {slantHLabel}
                      </text>
                    </g>
                  );
                })()}

                {/* Slanting Height (H) Double-Headed Arrow on Hip End Triangle */}
                {roofType === 'hip' && r1X - eaveLeft > 34 && (() => {
                  const xStart = eaveLeft + 6;
                  const xEnd = r1X - 6;
                  const midX = (xStart + xEnd) / 2;
                  return (
                    <g pointerEvents="none">
                      <line
                        x1={xStart}
                        y1={eaveMidY}
                        x2={xEnd}
                        y2={eaveMidY}
                        stroke="#34d399"
                        strokeWidth="1.5"
                        markerStart="url(#slant-arrow-end)"
                        markerEnd="url(#slant-arrow-end)"
                      />
                      <rect
                        x={midX - 11}
                        y={eaveMidY - 9}
                        width="22"
                        height="17"
                        rx="4"
                        fill="#0f172a"
                        fillOpacity="0.92"
                        stroke="#10b981"
                        strokeWidth="1"
                      />
                      <text
                        x={midX}
                        y={eaveMidY + 3}
                        fill="#34d399"
                        fontSize="9.5"
                        fontWeight="bold"
                        textAnchor="middle"
                        fontFamily="monospace"
                      >
                        H
                      </text>
                    </g>
                  );
                })()}

                {/* Clickable Outer Footprint Dimension Labels */}
                <g
                  style={{ cursor: onDimensionsChange ? 'pointer' : 'default' }}
                  onClick={(e) => {
                    if (!onDimensionsChange) return;
                    e.stopPropagation();
                    openDimEdit('rectL', L);
                  }}
                >
                  <text
                    x={eaveMidX}
                    y={eaveBottom + (isCompactViewport ? 20 : 16)}
                    fill="#cbd5e1"
                    fontSize={isCompactViewport ? '12.5' : '10'}
                    fontWeight="600"
                    textAnchor="middle"
                    fontFamily="monospace"
                  >
                    Wall L: {formatLength(L, unitSystem)} (Eave: {formatLength(effL, unitSystem)})
                  </text>
                </g>

                <g
                  style={{ cursor: onDimensionsChange ? 'pointer' : 'default' }}
                  onClick={(e) => {
                    if (!onDimensionsChange) return;
                    e.stopPropagation();
                    openDimEdit('rectB', B);
                  }}
                >
                  <text
                    x={eaveRight + (isCompactViewport ? 16 : 12)}
                    y={eaveMidY}
                    fill="#cbd5e1"
                    fontSize={isCompactViewport ? '12.5' : '10'}
                    fontWeight="600"
                    textAnchor="middle"
                    fontFamily="monospace"
                    transform={`rotate(90, ${eaveRight + (isCompactViewport ? 16 : 12)}, ${eaveMidY})`}
                  >
                    Wall B: {formatLength(B, unitSystem)}
                  </text>
                </g>
              </g>
            );
          })()}

          {/* B. If Closed Polygon (e.g. L-Shape, T-Shape, Cross shape, or converted Paper Sketch) */}
          {isClosed && (() => {
            const avgOvM = (ov.front + ov.back + ov.left + ov.right) / 4;
            const centroidM = sketchPts.reduce(
              (acc, p) => ({ x: acc.x + p.x / sketchPts.length, y: acc.y + p.y / sketchPts.length }),
              { x: 0, y: 0 }
            );
            const centroidPx = meterToPx(centroidM.x, centroidM.y);
            const polySkeleton = geometry?.skeleton || (sketchPts && sketchPts.length >= 3 ? buildRoofSkeleton(sketchPts, avgOvM, geometry?.pitchDegrees || 45.0, roofType) : null);
            const eavePolyPts = polySkeleton?.eavePolygon || offsetPolygonVertices(sketchPts, avgOvM);
            const slantHLabel = formatLength(geometry?.rafterLength || 0, unitSystem);
            const kpLabel = formatLength(geometry?.roofHeight || 0, unitSystem);
            const fillOp = sketchUnderlayImage && showUnderlay ? 0.35 : 0.72;

            const isParapetPoly = buildingStage === 'parapet' || Boolean(parapetConfig?.enabled);
            const innerWallPolyPts =
              isParapetPoly && parapetConfig?.includedInSketch
                ? offsetPolygonVertices(sketchPts, -Math.min(parapetConfig?.projection || 0.45, 0.45))
                : sketchPts;

            return (
              <>
                {/* Outer Roof Eave / Outward Concrete Parapet Rim */}
                <path
                  d={eavePolyPts.map((p, idx) => {
                    const px = meterToPx(p.x, p.y);
                    return `${idx === 0 ? 'M' : 'L'} ${px.x} ${px.y}`;
                  }).join(' ') + ' Z'}
                  fill="#0f172a"
                  fillOpacity={fillOp}
                  stroke={isParapetPoly ? '#cbd5e1' : '#38bdf8'}
                  strokeWidth={isParapetPoly ? '3.2' : '2.6'}
                  strokeLinejoin="round"
                  pointerEvents="none"
                />

                {/* Inner Dashed Wall Boundary */}
                <path
                  d={innerWallPolyPts.map((p, idx) => {
                    const px = meterToPx(p.x, p.y);
                    return `${idx === 0 ? 'M' : 'L'} ${px.x} ${px.y}`;
                  }).join(' ') + ' Z'}
                  fill="#1e293b"
                  fillOpacity={sketchUnderlayImage && showUnderlay ? 0.18 : 0.38}
                  stroke="#94a3b8"
                  strokeWidth="1.6"
                  strokeDasharray="4 4"
                  pointerEvents="none"
                />

                {/* Sectioned Roof Skeleton: True Hips, Valleys, and Independent Ridges */}
                {polySkeleton ? (
                  <g pointerEvents="none">
                    {/* Corner Hip Rafters */}
                    {polySkeleton.hips?.map((hip, idx) => {
                      const p1 = meterToPx(hip.p1.x, hip.p1.y);
                      const p2 = meterToPx(hip.p2.x, hip.p2.y);
                      return (
                        <line
                          key={`skel-hip-${idx}`}
                          x1={p1.x}
                          y1={p1.y}
                          x2={p2.x}
                          y2={p2.y}
                          stroke="#f59e0b"
                          strokeWidth="1.8"
                          strokeOpacity="0.85"
                          strokeLinecap="round"
                        />
                      );
                    })}

                    {/* Valley Gutter Lines with cyan dashed accent */}
                    {polySkeleton.valleys?.map((val, idx) => {
                      const p1 = meterToPx(val.p1.x, val.p1.y);
                      const p2 = meterToPx(val.p2.x, val.p2.y);
                      const midX = (p1.x + p2.x) / 2;
                      const midY = (p1.y + p2.y) / 2;
                      return (
                        <g key={`skel-valley-${idx}`}>
                          <line
                            x1={p1.x}
                            y1={p1.y}
                            x2={p2.x}
                            y2={p2.y}
                            stroke="#38bdf8"
                            strokeWidth="2.8"
                            strokeDasharray="6 3"
                            strokeLinecap="round"
                          />
                          <rect
                            x={midX - (isCompactViewport ? Math.max(48, (7 + formatLength(val.length, unitSystem).length) * 3.8 + 6) : 38)}
                            y={midY - (isCompactViewport ? 11 : 9)}
                            width={isCompactViewport ? Math.max(96, (7 + formatLength(val.length, unitSystem).length) * 7.6 + 12) : 76}
                            height={isCompactViewport ? 22 : 18}
                            rx={isCompactViewport ? '5' : '4'}
                            fill="#0f172a"
                            fillOpacity="0.95"
                            stroke="#38bdf8"
                            strokeWidth={isCompactViewport ? '1.35' : '1.1'}
                          />
                          <text
                            x={midX}
                            y={midY + (isCompactViewport ? 4 : 3.5)}
                            fill="#38bdf8"
                            fontSize={isCompactViewport ? '11.5' : '8'}
                            fontWeight="bold"
                            textAnchor="middle"
                            fontFamily="monospace"
                          >
                            Valley {formatLength(val.length, unitSystem)}
                          </text>
                        </g>
                      );
                    })}

                    {/* Horizontal & Vertical Wing Ridges with independent Kingpost callouts */}
                    {polySkeleton.ridges?.map((rdg, idx) => {
                      const p1 = meterToPx(rdg.p1.x, rdg.p1.y);
                      const p2 = meterToPx(rdg.p2.x, rdg.p2.y);
                      const midX = (p1.x + p2.x) / 2;
                      const midY = (p1.y + p2.y) / 2;
                      const badgeText = isCompactViewport && rdg.label
                        ? rdg.label.replace(/\s*Ridge\s*/i, ' ').replace(/[()]/g, '').replace(/\s+/g, ' ').trim()
                        : rdg.label;
                      const badgeWidth = badgeText
                        ? (isCompactViewport ? Math.max(84, badgeText.length * 7.8 + 14) : Math.max(86, badgeText.length * 7.2))
                        : 0;
                      return (
                        <g key={`skel-ridge-${idx}`}>
                          <line
                            x1={p1.x}
                            y1={p1.y}
                            x2={p2.x}
                            y2={p2.y}
                            stroke="#f59e0b"
                            strokeWidth={rdg.isFlat === false ? '2.0' : '3.4'}
                            strokeLinecap="round"
                          />
                          {badgeText && (
                            <>
                              <rect
                                x={midX - badgeWidth / 2}
                                y={midY - (isCompactViewport ? 11.5 : 10)}
                                width={badgeWidth}
                                height={isCompactViewport ? 23 : 20}
                                rx="5"
                                fill="#0f172a"
                                fillOpacity="0.95"
                                stroke="#f59e0b"
                                strokeWidth={isCompactViewport ? '1.4' : '1.2'}
                              />
                              <text
                                x={midX}
                                y={midY + (isCompactViewport ? 4 : 3.5)}
                                fill="#fbbf24"
                                fontSize={isCompactViewport ? '12' : '8.5'}
                                fontWeight="bold"
                                textAnchor="middle"
                                fontFamily="monospace"
                              >
                                {badgeText}
                              </text>
                            </>
                          )}
                        </g>
                      );
                    })}
                  </g>
                ) : (
                  /* Fallback Centroid Lines if skeleton unavailable */
                  <g stroke="#f59e0b" strokeWidth="1.6" strokeOpacity="0.82" pointerEvents="none">
                    {eavePolyPts.map((ep, idx) => {
                      const px = meterToPx(ep.x, ep.y);
                      return (
                        <line
                          key={`poly-hip-${idx}`}
                          x1={px.x}
                          y1={px.y}
                          x2={centroidPx.x}
                          y2={centroidPx.y}
                        />
                      );
                    })}
                    <g pointerEvents="none">
                      <rect
                        x={centroidPx.x - 62}
                        y={centroidPx.y - 10}
                        width="124"
                        height="20"
                        rx="5"
                        fill="#0f172a"
                        fillOpacity="0.93"
                        stroke="#f59e0b"
                        strokeWidth="1.1"
                      />
                      <text
                        x={centroidPx.x}
                        y={centroidPx.y + 3.5}
                        fill="#fbbf24"
                        fontSize="9"
                        fontWeight="bold"
                        textAnchor="middle"
                        fontFamily="monospace"
                      >
                        KP:{kpLabel} • H:{slantHLabel}
                      </text>
                    </g>
                  </g>
                )}

                {/* Clickable Dimension Badge on every wall segment! (Can be toggled with Dims button) */}
                {showDimensions && polyMetrics?.edges.map((edge, idx) => {
                  const p1Px = meterToPx(edge.p1.x, edge.p1.y);
                  const p2Px = meterToPx(edge.p2.x, edge.p2.y);
                  const midX = (p1Px.x + p2Px.x) / 2;
                  const midY = (p1Px.y + p2Px.y) / 2;
                  const edgeLabel = formatLength(edge.length, unitSystem);

                  return (
                    <g
                      key={`edge-${idx}`}
                      style={{ cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        openDimEdit('polyEdge', edge.length, idx);
                      }}
                    >
                      <rect
                        x={midX - (isCompactViewport ? Math.max(29, (edgeLabel?.length || 5) * 4 + 7) : 22)}
                        y={midY - (isCompactViewport ? 12 : 8)}
                        width={isCompactViewport ? Math.max(58, (edgeLabel?.length || 5) * 8 + 14) : 44}
                        height={isCompactViewport ? 24 : 16}
                        rx={isCompactViewport ? '5' : '4'}
                        fill="#0f172a"
                        fillOpacity={isCompactViewport ? '0.96' : '0.9'}
                        stroke="#38bdf8"
                        strokeWidth={isCompactViewport ? '1.3' : '0.9'}
                      />
                      <text
                        x={midX}
                        y={midY + (isCompactViewport ? 4.5 : 3.2)}
                        fill="#38bdf8"
                        fontSize={isCompactViewport ? '12.5' : '8.5'}
                        fontWeight="bold"
                        textAnchor="middle"
                        fontFamily="monospace"
                      >
                        {edgeLabel}
                      </text>
                    </g>
                  );
                })}

                {/* Draggable Corner Vertex Handles (when in manipulate mode) */}
                {mode === 'manipulate' && sketchPts.map((p, idx) => {
                  const px = meterToPx(p.x, p.y);
                  return (
                    <g
                      key={`v-${idx}`}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        dragPreSnapRef.current = makeSnap();
                        setDraggedVertexIdx(idx);
                      }}
                      className={`cursor-nudge ${draggedVertexIdx === idx ? 'cursor-nudge-active' : ''}`}
                    >
                      <circle cx={px.x} cy={px.y} r="18" fill="transparent" />
                      <circle cx={px.x} cy={px.y} r="12" fill="#10b981" fillOpacity="0.2" />
                      <circle cx={px.x} cy={px.y} r="5" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
                    </g>
                  );
                })}
              </>
            );
          })()}

          {/* C. In-Progress Sketching Lines (Line-by-Line with rubber-banding) */}
          {mode === 'line_sketch' && sketchPts.length > 0 && (
            <>
              {/* Placed Segments */}
              {sketchPts.map((p, idx) => {
                if (idx === 0) return null;
                const prev = meterToPx(sketchPts[idx - 1].x, sketchPts[idx - 1].y);
                const curr = meterToPx(p.x, p.y);
                const midX = (prev.x + curr.x) / 2;
                const midY = (prev.y + curr.y) / 2;
                const dM = Math.round(Math.sqrt(Math.pow(p.x - sketchPts[idx - 1].x, 2) + Math.pow(p.y - sketchPts[idx - 1].y, 2)) * 10) / 10;

                return (
                  <g key={`placed-seg-${idx}`}>
                    <line
                      x1={prev.x}
                      y1={prev.y}
                      x2={curr.x}
                      y2={curr.y}
                      stroke="#10b981"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                    {/* Dimension on confirmed segment (slim & toggleable) */}
                    {showDimensions && (
                      <g pointerEvents="none">
                        <rect
                          x={midX - (isCompactViewport ? Math.max(24, (String(dM).length + 1) * 3.75 + 5) : 15)}
                          y={midY - (isCompactViewport ? 10 : 6.5)}
                          width={isCompactViewport ? Math.max(48, (String(dM).length + 1) * 7.5 + 10) : 30}
                          height={isCompactViewport ? 20 : 13}
                          rx={isCompactViewport ? '4' : '3'}
                          fill="#0f172a"
                          fillOpacity={isCompactViewport ? '0.94' : '0.82'}
                          stroke="#10b981"
                          strokeWidth={isCompactViewport ? '1.2' : '0.8'}
                        />
                        <text x={midX} y={midY + (isCompactViewport ? 4 : 3)} fill="#34d399" fontSize={isCompactViewport ? '11.5' : '7.8'} fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                          {dM}m
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Vertex Circles */}
              {sketchPts.map((p, idx) => {
                const px = meterToPx(p.x, p.y);
                const isFirst = idx === 0;
                const isLast = idx === sketchPts.length - 1;
                return (
                  <g
                    key={`pt-${idx}`}
                    style={isDrawing && isSketchPaused && isLast ? { cursor: 'pointer' } : undefined}
                    onClick={
                      isDrawing && isSketchPaused && isLast
                        ? (e) => {
                            e.stopPropagation();
                            setIsSketchPaused(false);
                          }
                        : undefined
                    }
                  >
                    {isDrawing && isSketchPaused && isLast && (
                      <circle
                        cx={px.x}
                        cy={px.y}
                        r="13"
                        fill="#f59e0b"
                        fillOpacity="0.25"
                        stroke="#fbbf24"
                        strokeWidth="1.5"
                        strokeDasharray="3 2"
                      />
                    )}
                    <circle
                      cx={px.x}
                      cy={px.y}
                      r={isFirst ? 8 : isLast && isSketchPaused ? 7 : 5}
                      fill={isFirst ? '#f59e0b' : isLast && isSketchPaused ? '#fbbf24' : '#10b981'}
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                  </g>
                );
              })}

              {/* Visual Paused Pill attached near the last placed vertex */}
              {isDrawing && isSketchPaused && (() => {
                const lastPt = sketchPts[sketchPts.length - 1];
                const lastPx = meterToPx(lastPt.x, lastPt.y);
                const labelW = isCompactViewport ? 176 : 228;
                const labelX = Math.max(8, Math.min(svgWidth - labelW - 8, lastPx.x - labelW / 2));
                const labelY = lastPx.y > 46 ? lastPx.y - 38 : lastPx.y + 16;
                return (
                  <g
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsSketchPaused(false);
                    }}
                  >
                    <rect
                      x={labelX}
                      y={labelY}
                      width={labelW}
                      height="24"
                      rx="6"
                      fill="#0f172a"
                      fillOpacity="0.96"
                      stroke="#f59e0b"
                      strokeWidth="1.4"
                    />
                    <text
                      x={labelX + labelW / 2}
                      y={labelY + 15.5}
                      fill="#fbbf24"
                      fontSize={isCompactViewport ? '9.5' : '10.5'}
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      ⏸ Sketch Paused — Esc / Click to Resume
                    </text>
                  </g>
                );
              })()}

              {/* Rubber-band Line to Current Cursor Position */}
              {isDrawing && !isSketchPaused && (
                <>
                  {(() => {
                    const lastPx = meterToPx(sketchPts[sketchPts.length - 1].x, sketchPts[sketchPts.length - 1].y);
                    const curPx = meterToPx(cursorPos.x, cursorPos.y);
                    const midX = (lastPx.x + curPx.x) / 2;
                    const midY = (lastPx.y + curPx.y) / 2;

                    return (
                      <g>
                        {/* Rubber line */}
                        <line
                          x1={lastPx.x}
                          y1={lastPx.y}
                          x2={curPx.x}
                          y2={curPx.y}
                          stroke={snapInfo?.isCloseSnap ? '#10b981' : '#38bdf8'}
                          strokeWidth="2.5"
                          strokeDasharray="4 4"
                        />

                        {/* Floating live distance badge on the rubber-band line */}
                        {snapInfo?.distM > 0 && !snapInfo?.isCloseSnap && (
                          <g>
                            <rect
                              x={midX - (isCompactViewport ? 39 : 28)}
                              y={midY - (isCompactViewport ? 13 : 11)}
                              width={isCompactViewport ? 78 : 56}
                              height={isCompactViewport ? 26 : 20}
                              rx="5"
                              fill="#0f172a"
                              stroke={snapInfo?.isOrthoSnap ? '#38bdf8' : '#f59e0b'}
                              strokeWidth={isCompactViewport ? '1.5' : '1.2'}
                            />
                            <text
                              x={midX}
                              y={midY + (isCompactViewport ? 4.5 : 3)}
                              fill={snapInfo?.isOrthoSnap ? '#38bdf8' : '#f59e0b'}
                              fontSize={isCompactViewport ? '13' : '10'}
                              fontWeight="bold"
                              textAnchor="middle"
                              fontFamily="monospace"
                            >
                              {snapInfo.distM}m {snapInfo.isOrthoSnap ? (snapInfo.axis === 'horizontal' ? '↔' : '↕') : ''}
                            </text>
                          </g>
                        )}
                        {/* Alignment guide line to start point */}
                        {snapInfo?.isAlignedWithStart && !snapInfo?.isCloseSnap && sketchPts.length >= 3 && (() => {
                          const startPx = meterToPx(sketchPts[0].x, sketchPts[0].y);
                          return (
                            <g>
                              <line
                                x1={curPx.x}
                                y1={curPx.y}
                                x2={startPx.x}
                                y2={startPx.y}
                                stroke="#38bdf8"
                                strokeWidth="1.5"
                                strokeDasharray="3 3"
                                strokeOpacity="0.75"
                              />
                              <circle cx={startPx.x} cy={startPx.y} r="8" fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="2 2" />
                            </g>
                          );
                        })()}
                      </g>
                    );
                  })()}
                </>
              )}

              {/* Target Indicator for Close Loop Snap (pulsating ring around point 0) */}
              {!isSketchPaused && snapInfo?.isCloseSnap && (
                <g>
                  {(() => {
                    const startPx = meterToPx(sketchPts[0].x, sketchPts[0].y);
                    return (
                      <g>
                        <circle cx={startPx.x} cy={startPx.y} r="16" fill="#10b981" fillOpacity="0.35" />
                        <circle cx={startPx.x} cy={startPx.y} r="10" fill="#10b981" stroke="#ffffff" strokeWidth="2.5" />
                        <rect x={startPx.x - 65} y={startPx.y - 34} width="130" height="22" rx="6" fill="#0f172a" stroke="#10b981" strokeWidth="1.5" />
                        <text x={startPx.x} y={startPx.y - 19} fill="#34d399" fontSize="10" fontWeight="bold" textAnchor="middle">
                          🎯 Click to Connect Loop!
                        </text>
                      </g>
                    );
                  })()}
                </g>
              )}
            </>
          )}

          {/* Whole-Sketch Highlight Overlay */}
          {isSketchSelected && sketchPts.length > 0 && (() => {
            const ptsPx = sketchPts.map((p) => meterToPx(p.x, p.y));
            const sMinX = Math.min(...ptsPx.map((p) => p.x)) - 14;
            const sMaxX = Math.max(...ptsPx.map((p) => p.x)) + 14;
            const sMinY = Math.min(...ptsPx.map((p) => p.y)) - 14;
            const sMaxY = Math.max(...ptsPx.map((p) => p.y)) + 14;
            const pointsStr = ptsPx.map((p) => `${p.x},${p.y}`).join(' ');
            return (
              <g pointerEvents="none">
                <rect
                  x={sMinX}
                  y={sMinY}
                  width={Math.max(20, sMaxX - sMinX)}
                  height={Math.max(20, sMaxY - sMinY)}
                  rx="6"
                  fill="rgba(244, 63, 94, 0.08)"
                  stroke="#f43f5e"
                  strokeWidth="1.8"
                  strokeDasharray="6 4"
                />
                {sketchPts.length >= 3 ? (
                  <polygon
                    points={pointsStr}
                    fill="rgba(244, 63, 94, 0.14)"
                    stroke="#fb7185"
                    strokeWidth="4.5"
                    strokeLinejoin="round"
                  />
                ) : (
                  <polyline
                    points={pointsStr}
                    fill="none"
                    stroke="#fb7185"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
                {ptsPx.map((p, i) => (
                  <circle key={`sel-pt-${i}`} cx={p.x} cy={p.y} r="6.5" fill="#f43f5e" stroke="#ffffff" strokeWidth="2" />
                ))}
              </g>
            );
          })()}

          {/* Drag-to-Select Marquee Box */}
          {selectionBox && (() => {
            const x = Math.min(selectionBox.startX, selectionBox.currX);
            const y = Math.min(selectionBox.startY, selectionBox.currY);
            const w = Math.abs(selectionBox.currX - selectionBox.startX);
            const h = Math.abs(selectionBox.currY - selectionBox.startY);
            if (w < 3 && h < 3) return null;
            return (
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                fill="rgba(56, 189, 248, 0.12)"
                stroke="#38bdf8"
                strokeWidth="1.5"
                strokeDasharray="5 3"
                pointerEvents="none"
              />
            );
          })()}
        </svg>
      </div>

      {/* 4. Footer Summary & Guide (Desktop only to keep mobile zero-scroll) */}
      {!mobileInteractive && !readOnlyMobile && (
      <div className="sketch-footer-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {mode === 'line_sketch' && isDrawing && isSketchPaused ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#f59e0b',
                  display: 'inline-block',
                }}
              />
              <span style={{ fontWeight: 700, color: '#fbbf24' }}>
                ⏸ Sketch Paused ({sketchPts.length} points placed) — Switch tabs freely to inspect 3D/BOQ/WC
              </span>
              <button
                type="button"
                onClick={() => setIsSketchPaused(false)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '5px',
                  border: '1px solid rgba(16, 185, 129, 0.55)',
                  background: 'rgba(16, 185, 129, 0.16)',
                  color: '#34d399',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Play className="w-3 h-3" />
                <span>Resume (Esc)</span>
              </button>
            </div>
          ) : mode === 'line_sketch' && isDrawing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: snapInfo?.isCloseSnap ? '#10b981' : '#38bdf8',
                  display: 'inline-block',
                }}
              />
              <span style={{ fontWeight: 600, color: snapInfo?.isCloseSnap ? '#34d399' : '#38bdf8' }}>
                {snapInfo?.isCloseSnap
                  ? '🎯 Close Snap: Click starting point to finish loop!'
                  : snapInfo?.isAlignedWithStart
                  ? `📐 Aligned with Start (${snapInfo.axis === 'horizontal' ? 'Horizontal' : 'Vertical'} Axis)`
                  : snapInfo?.isOrthoSnap
                  ? `📐 90° Orthogonal Lock (${snapInfo.axis === 'horizontal' ? 'Horizontal' : 'Vertical'})`
                  : 'Free Angle Mode'}
              </span>
              <span style={{ color: '#94a3b8' }}>
                • Placed {sketchPts.length} points {snapInfo?.distM ? `(${snapInfo.distM}m)` : ''} • Press Esc to pause
              </span>
            </div>
          ) : mode === 'line_sketch' ? (
            <span style={{ color: '#34d399', fontSize: '11px', fontWeight: 500 }}>
              💡 Click on the canvas to place walls. Snaps to 90° angles automatically. Connect back to the first point to close!
            </span>
          ) : isClosed ? (
            <span style={{ color: '#6ee7b7', fontSize: '11px', fontWeight: 500 }}>
              ✅ Custom Footprint Active: <strong style={{ color: '#ffffff' }}>{polyMetrics?.edges.length} walls</strong> | Floor: <strong style={{ color: '#34d399' }}>{polyMetrics?.area} m²</strong>
              {geometry?.skeleton?.sections && geometry.skeleton.sections.length > 1 && (
                <span style={{ marginLeft: '6px', color: '#fde68a' }}>
                  | 📐 Wings: {geometry.skeleton.sections.map((s, i) => (
                    <span key={i} style={{ marginLeft: i > 0 ? '6px' : '2px', background: 'rgba(245, 158, 11, 0.15)', padding: '1px 5px', borderRadius: '4px', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
                      {s.name} ({s.span}m span): <strong>KP {s.kingpostHeight}m</strong>
                    </span>
                  ))}
                </span>
              )}
            </span>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
              💡 Select "Modify" to drag vertices, or click "Boundary Line" to draw perimeter line-by-line.
            </span>
          )}
        </div>
        <div style={{ color: '#cbd5e1', fontFamily: 'monospace', fontSize: '11px' }}>
          3D Live Sync: <strong style={{ color: '#34d399' }}>ACTIVE</strong>
        </div>
      </div>
      )}
    </div>
  );
}
