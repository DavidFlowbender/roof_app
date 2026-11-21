import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Camera,
  Upload,
  Sparkles,
  Crown,
  Loader2,
  Check,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  calculateRoofHeight,
  calculateRoofGeometry,
  calculateSlantingHeightFromKingpost,
} from '../utils/roofMath';
import { getStageConfig } from '../utils/stagePresets';
import { formatLength } from '../utils/units';
import {
  analyzePaperSketch,
  buildScaledShapeVertices,
} from '../utils/sketchAnalyzer';
import Roof2DDiagram from './Roof2DDiagram';

const SKETCH_MODAL_STORAGE_KEY = 'roofcalc_active_sketch_modal_v1';

function readStoredSketchModalState() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SKETCH_MODAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function downscaleImageFileToDataUrl(file, maxDim = 1280) {
  if (typeof document !== 'undefined' && typeof URL !== 'undefined' && URL.createObjectURL) {
    const objUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Image decode failed'));
        el.src = objUrl;
      });
      const srcW = img.naturalWidth || img.width || 1;
      const srcH = img.naturalHeight || img.height || 1;
      const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
      const w = Math.max(64, Math.round(srcW * scale));
      const h = Math.max(64, Math.round(srcH * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      return canvas.toDataURL('image/jpeg', 0.88);
    } catch {
      // Fall through to FileReader if canvas downscale fails
    } finally {
      URL.revokeObjectURL(objUrl);
    }
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === 'string') {
        resolve(ev.target.result);
      } else {
        reject(new Error('Could not read selected image file.'));
      }
    };
    reader.onerror = () => reject(new Error('Could not read selected image file.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Focused upload-and-apply modal for paper sketches.
 * Users upload/snap a drawing, preview the extracted 2D plan, blueprint, or original photo,
 * and apply it cleanly to the 2D workspace where all editing takes place.
 */
export default function PaperSketchModal({
  isOpen,
  onClose,
  initialStage = 'foundation',
  unitSystem = 'metric',
  isPremium = false,
  proAccessToken = '',
  proQuota = null,
  onQuotaUpdate = null,
  onOpenUpgrade = null,
  onApplyConvertedSketch,
}) {
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [rawImageUrl, setRawImageUrl] = useState(() => readStoredSketchModalState()?.rawImageUrl || null);
  const [blueprintUrl, setBlueprintUrl] = useState(() => readStoredSketchModalState()?.blueprintUrl || null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(() => readStoredSketchModalState()?.analysisResult || null);
  const [analysisError, setAnalysisError] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [activePreviewTab, setActivePreviewTab] = useState('2d'); // '2d' | 'blueprint' | 'photo'
  const [imgZoom, setImgZoom] = useState(1.0);
  const [imgPan, setImgPan] = useState({ x: 0, y: 0 });
  const imgGestureRef = useRef(null);
  const imgLastTapRef = useRef({ time: 0, x: 0, y: 0 });

  const resetImgView = () => {
    setImgZoom(1.0);
    setImgPan({ x: 0, y: 0 });
    imgGestureRef.current = null;
  };

  const handleImgTouchStart = (e) => {
    if (e.touches.length === 2) {
      const t1 = e.touches[0], t2 = e.touches[1];
      imgGestureRef.current = {
        type: 'pinch',
        startDist: Math.max(10, Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)),
        startZoom: imgZoom,
        startPan: { ...imgPan },
        startMid: { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 },
      };
      return;
    }
    if (e.touches.length === 1) {
      const t = e.touches[0];
      const now = Date.now();
      const prev = imgLastTapRef.current;
      if (now - prev.time < 280 && Math.hypot(t.clientX - prev.x, t.clientY - prev.y) < 28) {
        imgLastTapRef.current = { time: 0, x: 0, y: 0 };
        if (imgZoom > 1.15) {
          resetImgView();
        } else {
          setImgZoom(2.2);
        }
        return;
      }
      imgLastTapRef.current = { time: now, x: t.clientX, y: t.clientY };
      imgGestureRef.current = {
        type: 'pan',
        startPt: { x: t.clientX, y: t.clientY },
        startPan: { ...imgPan },
      };
    }
  };

  const handleImgTouchMove = (e) => {
    const g = imgGestureRef.current;
    if (!g) return;
    if (e.touches.length === 2 && g.type === 'pinch') {
      const t1 = e.touches[0], t2 = e.touches[1];
      const dist = Math.max(10, Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY));
      const mid = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
      const nextZoom = Math.min(4.0, Math.max(0.8, Math.round(g.startZoom * (dist / g.startDist) * 100) / 100));
      setImgZoom(nextZoom);
      setImgPan({
        x: g.startPan.x + (mid.x - g.startMid.x),
        y: g.startPan.y + (mid.y - g.startMid.y),
      });
    } else if (e.touches.length === 1 && g.type === 'pan') {
      const t = e.touches[0];
      setImgPan({
        x: g.startPan.x + (t.clientX - g.startPt.x),
        y: g.startPan.y + (t.clientY - g.startPt.y),
      });
    }
  };

  const handleImgTouchEnd = (e) => {
    if (!e.touches || e.touches.length === 0) imgGestureRef.current = null;
  };

  // Extracted geometry (stored in meters)
  const [shapeType, setShapeType] = useState(() => readStoredSketchModalState()?.shapeType || 'rectangle');
  const [roofType, setRoofType] = useState(() => readStoredSketchModalState()?.roofType || 'hip');
  const [lengthM, setLengthM] = useState(() => Number(readStoredSketchModalState()?.lengthM) || 12.0);
  const [breadthM, setBreadthM] = useState(() => Number(readStoredSketchModalState()?.breadthM) || 8.0);
  const [polygonVertices, setPolygonVertices] = useState(() => readStoredSketchModalState()?.polygonVertices || null);
  const [overhangM, setOverhangM] = useState(() => {
    const ov = readStoredSketchModalState()?.overhangM;
    return ov !== undefined && ov !== null && Number.isFinite(Number(ov)) ? Number(ov) : 0.45;
  });
  const [parapetHeightM, setParapetHeightM] = useState(() => Number(readStoredSketchModalState()?.parapetHeightM) || 0.42);
  const [kingpostM, setKingpostM] = useState(() => Number(readStoredSketchModalState()?.kingpostM) || 2.25);
  const [extensions, setExtensions] = useState(() => {
    const ext = readStoredSketchModalState()?.extensions;
    return Array.isArray(ext) ? ext : [];
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !rawImageUrl) return;
    const snapshot = {
      rawImageUrl,
      blueprintUrl,
      analysisResult,
      shapeType,
      roofType,
      lengthM,
      breadthM,
      polygonVertices,
      overhangM,
      parapetHeightM,
      kingpostM,
      extensions,
    };
    try {
      window.sessionStorage.setItem(SKETCH_MODAL_STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      try {
        window.sessionStorage.setItem(
          SKETCH_MODAL_STORAGE_KEY,
          JSON.stringify({ ...snapshot, blueprintUrl: null })
        );
      } catch {
        // Ignore sessionStorage quota overflow
      }
    }
  }, [
    rawImageUrl,
    blueprintUrl,
    analysisResult,
    shapeType,
    roofType,
    lengthM,
    breadthM,
    polygonVertices,
    overhangM,
    parapetHeightM,
    kingpostM,
    extensions,
  ]);

  const activeStage = getStageConfig(initialStage);

  const runSketchAnalysis = async (imgUrl) => {
    setIsAnalyzing(true);
    setAnalysisError('');
    try {
      const result = await analyzePaperSketch({
        imageDataUrl: imgUrl,
        stageId: initialStage,
        unitSystem,
        manualNotesText: '',
        isPro: isPremium,
        accessToken: proAccessToken,
      });

      setBlueprintUrl(result.blueprintDataUrl || null);
      setAnalysisResult(result);
      if (result.quota && onQuotaUpdate) {
        onQuotaUpdate(result.quota);
      }

      const nextShape = result.shapeType || 'rectangle';
      const nextRoof = result.roofType || 'hip';
      const nextL = Math.max(1.0, Number(result.length) || 10.0);
      const nextB = Math.max(1.0, Number(result.breadth) || 7.0);
      const nextOv =
        result.overhang !== null && result.overhang !== undefined
          ? Math.max(0, Number(result.overhang))
          : activeStage.defaultOverhang;

      let nextPoly = null;
      if (nextShape !== 'rectangle') {
        nextPoly =
          Array.isArray(result.polygonVertices) && result.polygonVertices.length >= 3
            ? result.polygonVertices
            : buildScaledShapeVertices(nextShape, nextL, nextB);
      }

      const defaultAngle = activeStage.defaultPitchDegrees || 32;
      const nextKp =
        result.kingpostHeight && result.kingpostHeight > 0.2
          ? Number(result.kingpostHeight)
          : Number(
              calculateRoofHeight(
                'angle',
                result.pitchAngle || defaultAngle,
                nextB,
                nextRoof,
                nextOv,
                nextPoly
              ).toFixed(2)
            );

      const finalPoly = nextShape === 'rectangle' ? null : nextPoly;
      const finalKp = Math.max(0.25, nextKp);
      const finalParapetH = result.parapetHeight || 0.42;
      const finalExtensions = Array.isArray(result.extensions) ? result.extensions : [];

      setShapeType(nextShape);
      setRoofType(nextRoof);
      setLengthM(nextL);
      setBreadthM(nextB);
      setOverhangM(nextOv);
      setPolygonVertices(finalPoly);
      setKingpostM(finalKp);
      setParapetHeightM(finalParapetH);
      setExtensions(finalExtensions);
      setActivePreviewTab('2d');

      if (onApplyConvertedSketch) {
        const overhangObj = { front: nextOv, back: nextOv, left: nextOv, right: nextOv };
        const computedSlope = calculateSlantingHeightFromKingpost(
          finalKp,
          nextB,
          overhangObj,
          nextRoof,
          finalPoly
        );
        onApplyConvertedSketch(
          {
            stageId: initialStage,
            roofType: nextRoof,
            length: Number(nextL) || 10,
            breadth: Number(nextB) || 7,
            overhang: overhangObj,
            polygonVertices: finalPoly,
            kingpostHeight: Number(finalKp) || 2.2,
            slantingHeight: Number(computedSlope?.slantingHeight) || 4.0,
            pitchDegrees: Number(computedSlope?.pitchDegrees) || 30,
            parapetHeight: finalParapetH,
            extensions: finalExtensions,
            sketchUnderlayImage: null,
          },
          { silent: true }
        );
      }
    } catch (err) {
      setAnalysisError(err?.message || 'Could not scan sketch image.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleImageSelected = async (fileOrDataUrl) => {
    if (!fileOrDataUrl) return;
    setAnalysisError('');
    setAnalysisResult(null);
    setBlueprintUrl(null);
    setIsAnalyzing(true);
    try {
      const dataUrl =
        typeof fileOrDataUrl === 'string'
          ? fileOrDataUrl
          : await downscaleImageFileToDataUrl(fileOrDataUrl, 1280);
      if (!dataUrl) {
        setIsAnalyzing(false);
        return;
      }
      setRawImageUrl(dataUrl);
      await runSketchAnalysis(dataUrl);
    } catch (err) {
      setAnalysisError(err?.message || 'Could not load selected image.');
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const onPaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            handleImageSelected(blob);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialStage, unitSystem, isPremium, proAccessToken]);

  const activePoly = shapeType === 'rectangle' ? null : polygonVertices;

  const slopeInfo = useMemo(() => {
    const overhangObj = { front: overhangM, back: overhangM, left: overhangM, right: overhangM };
    return calculateSlantingHeightFromKingpost(kingpostM, breadthM, overhangObj, roofType, activePoly);
  }, [kingpostM, breadthM, overhangM, roofType, activePoly]);

  const previewGeometry = useMemo(() => {
    return calculateRoofGeometry({
      length: lengthM,
      breadth: breadthM,
      height: kingpostM,
      overhang: { front: overhangM, back: overhangM, left: overhangM, right: overhangM },
      roofType,
      wastePercentage: 10,
      polygonVertices: activePoly,
    });
  }, [lengthM, breadthM, kingpostM, overhangM, roofType, activePoly]);

  const resetUpload = () => {
    setRawImageUrl(null);
    setBlueprintUrl(null);
    setAnalysisResult(null);
    setAnalysisError('');
    setActivePreviewTab('2d');
    resetImgView();
    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(SKETCH_MODAL_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  };

  const handleApply = () => {
    if (!onApplyConvertedSketch) return;
    onApplyConvertedSketch({
      stageId: initialStage,
      roofType,
      length: Number(lengthM) || 10,
      breadth: Number(breadthM) || 7,
      overhang: { front: overhangM, back: overhangM, left: overhangM, right: overhangM },
      polygonVertices: activePoly,
      kingpostHeight: Number(kingpostM) || 2.2,
      slantingHeight: Number(slopeInfo.slantingHeight) || 4.0,
      pitchDegrees: Number(slopeInfo.pitchDegrees) || 30,
      parapetHeight: parapetHeightM,
      extensions,
      sketchUnderlayImage: null,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content paper-sketch-modal-card"
        style={{ maxWidth: '640px', width: '94vw', padding: '1.25rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Clean Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Sparkles size={19} style={{ color: '#0ea5e9' }} />
            <h3 style={{ margin: 0, fontSize: '1.08rem', color: 'var(--text-primary)' }}>
              Upload Paper Sketch
            </h3>
          </div>
          <button type="button" className="btn-close-modal" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files?.[0]) handleImageSelected(e.target.files[0]);
            e.target.value = '';
          }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files?.[0]) handleImageSelected(e.target.files[0]);
            e.target.value = '';
          }}
        />

        {!rawImageUrl ? (
          /* Step 1: Simple Upload View */
          <div>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingOver(true);
              }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingOver(false);
                if (e.dataTransfer.files?.[0]) handleImageSelected(e.dataTransfer.files[0]);
              }}
              style={{
                border: `2px dashed ${isDraggingOver ? '#0ea5e9' : 'var(--border-color)'}`,
                background: isDraggingOver ? 'rgba(14, 165, 233, 0.08)' : 'rgba(15, 23, 42, 0.35)',
                borderRadius: '14px',
                padding: '2.25rem 1.25rem',
                textAlign: 'center',
                transition: 'border-color 0.2s, background 0.2s',
              }}
            >
              <Upload size={34} style={{ color: '#38bdf8', marginBottom: '0.75rem' }} />
              <div style={{ fontSize: '1.02rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Drop or paste a sketch photo
              </div>
              <p
                style={{
                  margin: '0.35rem auto 1.25rem',
                  fontSize: '0.84rem',
                  color: 'var(--text-muted)',
                  maxWidth: '380px',
                }}
              >
                Upload a hand-drawn floor plan. Once converted, edit walls, corners, and building level in 2D space.
              </p>

              <div style={{ display: 'flex', gap: '0.7rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-primary-action"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
                >
                  <Upload size={16} />
                  Choose Sketch Image
                </button>
                <button
                  type="button"
                  className="btn-secondary-action"
                  onClick={() => cameraInputRef.current?.click()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
                >
                  <Camera size={16} />
                  Snap Photo
                </button>
              </div>
            </div>

            {/* Clean Tier Status Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '0.85rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid var(--border-color)',
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
              }}
            >
              {isPremium ? (
                <>
                  <span style={{ color: '#fbbf24', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Crown size={13} />
                    Pro AI Auto-Dimension Active
                  </span>
                  <span>{proQuota ? `${proQuota.remaining} scans left` : 'Ready'}</span>
                </>
              ) : (
                <>
                  <span>Offline Contour Scanner (Free)</span>
                  {onOpenUpgrade && (
                    <button
                      type="button"
                      onClick={onOpenUpgrade}
                      style={{
                        background: 'rgba(245, 158, 11, 0.16)',
                        border: '1px solid rgba(245, 158, 11, 0.45)',
                        color: '#fbbf24',
                        borderRadius: '999px',
                        padding: '0.18rem 0.6rem',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Unlock Pro AI
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          /* Step 2: Clean Preview & Apply View */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {/* Top Preview Tabs + Engine Pill */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {[
                  { id: '2d', label: '📐 Converted 2D Plan' },
                  { id: 'blueprint', label: '🔍 Blueprint Scan' },
                  { id: 'photo', label: '📷 Paper Photo' },
                ].map((tab) => {
                  const active = activePreviewTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setActivePreviewTab(tab.id);
                        resetImgView();
                      }}
                      style={{
                        padding: '0.4rem 0.75rem',
                        borderRadius: '8px',
                        border: `1px solid ${active ? '#10b981' : 'var(--border-color)'}`,
                        background: active ? 'rgba(16, 185, 129, 0.18)' : 'rgba(15, 23, 42, 0.45)',
                        color: active ? '#34d399' : 'var(--text-secondary)',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <span
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  padding: '0.25rem 0.6rem',
                  borderRadius: '999px',
                  background: 'rgba(14, 165, 233, 0.14)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  color: '#38bdf8',
                }}
              >
                {isAnalyzing ? 'Scanning...' : analysisResult?.model || 'Converted'}
              </span>
            </div>

            {analysisError && (
              <div
                style={{
                  padding: '0.55rem 0.75rem',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  color: '#fca5a5',
                  fontSize: '0.8rem',
                }}
              >
                {analysisError}
              </div>
            )}

            {/* Clean Preview Frame */}
            <div
              style={{
                position: 'relative',
                height: 'clamp(320px, 50vh, 430px)',
                borderRadius: '12px',
                overflow: 'hidden',
                border: '1px solid var(--border-color)',
                background: '#060c1a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {activePreviewTab === '2d' && isAnalyzing && !analysisResult ? (
                <img
                  src={rawImageUrl}
                  alt="Scanning sketch"
                  draggable={false}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    opacity: 0.45,
                    userSelect: 'none',
                  }}
                />
              ) : activePreviewTab === '2d' ? (
                <div style={{ width: '100%', height: '100%' }}>
                  <Roof2DDiagram
                    geometry={previewGeometry}
                    roofType={roofType}
                    unitSystem={unitSystem}
                    polygonVertices={activePoly}
                    isSplitView={false}
                    buildingStage={initialStage}
                    sketchUnderlayImage={null}
                    compactPreview={true}
                    readOnlyMobile={true}
                  />
                </div>
              ) : null}

              {(activePreviewTab === 'blueprint' || activePreviewTab === 'photo') && (
                <div
                  onTouchStart={handleImgTouchStart}
                  onTouchMove={handleImgTouchMove}
                  onTouchEnd={handleImgTouchEnd}
                  onTouchCancel={handleImgTouchEnd}
                  onWheel={(e) => {
                    e.preventDefault();
                    const factor = e.deltaY < 0 ? 1.12 : 0.89;
                    setImgZoom((z) => Math.min(4.0, Math.max(0.8, Math.round(z * factor * 100) / 100)));
                  }}
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    touchAction: 'none',
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  <img
                    src={activePreviewTab === 'blueprint' ? (blueprintUrl || rawImageUrl) : rawImageUrl}
                    alt={activePreviewTab === 'blueprint' ? 'Blueprint edge scan' : 'Uploaded paper sketch'}
                    draggable={false}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                      transform: `translate(${imgPan.x}px, ${imgPan.y}px) scale(${imgZoom})`,
                      transformOrigin: 'center center',
                      transition: 'transform 0.04s linear',
                      userSelect: 'none',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '12px',
                      right: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      background: 'rgba(15, 23, 42, 0.92)',
                      backdropFilter: 'blur(8px)',
                      padding: '4px 8px',
                      borderRadius: '8px',
                      border: '1px solid rgba(71, 85, 105, 0.7)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setImgZoom((z) => Math.min(4.0, Math.round((z + 0.25) * 100) / 100))}
                      style={{ background: 'transparent', color: '#38bdf8', border: 'none', cursor: 'pointer', padding: '2px' }}
                      title="Zoom In"
                    >
                      <ZoomIn size={15} />
                    </button>
                    <span style={{ fontSize: '10.5px', fontFamily: 'monospace', color: '#cbd5e1', minWidth: '34px', textAlign: 'center' }}>
                      {Math.round(imgZoom * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setImgZoom((z) => Math.max(0.8, Math.round((z - 0.25) * 100) / 100))}
                      style={{ background: 'transparent', color: '#38bdf8', border: 'none', cursor: 'pointer', padding: '2px' }}
                      title="Zoom Out"
                    >
                      <ZoomOut size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={resetImgView}
                      style={{ background: 'transparent', color: '#38bdf8', border: 'none', cursor: 'pointer', padding: '2px', marginLeft: '3px' }}
                      title="Reset Zoom"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                </div>
              )}

              {isAnalyzing && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(2, 6, 23, 0.75)',
                    backdropFilter: 'blur(3px)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.6rem',
                    color: '#e2e8f0',
                  }}
                >
                  <Loader2 size={28} className="animate-spin" style={{ color: '#38bdf8' }} />
                  <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                    Scanning sketch & extracting 2D footprint...
                  </span>
                </div>
              )}
            </div>

            {/* Subtle 1-line summary */}
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              Footprint: <strong style={{ color: 'var(--text-primary)' }}>{formatLength(lengthM, unitSystem)} × {formatLength(breadthM, unitSystem)}</strong>
              {' '}— Edit walls, corners & building level in 2D space after applying.
            </div>

            {analysisResult?.visionWarning && (
              <div
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  color: '#fde68a',
                  fontSize: '0.76rem',
                }}
              >
                {analysisResult.visionWarning}
              </div>
            )}

            {!isPremium && !isAnalyzing && onOpenUpgrade && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.6rem',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '9px',
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontSize: '0.76rem', color: '#fef3c7' }}>
                  <Crown size={13} style={{ color: '#fbbf24', verticalAlign: '-2px', marginRight: '5px' }} />
                  Pro AI auto-reads handwritten numbers so you skip manual dimension editing.
                </span>
                <button
                  type="button"
                  onClick={onOpenUpgrade}
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    color: '#0f172a',
                    border: 'none',
                    borderRadius: '7px',
                    padding: '0.32rem 0.7rem',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Unlock Pro AI
                </button>
              </div>
            )}

            {/* Clean Footer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.6rem',
                paddingTop: '0.5rem',
                borderTop: '1px solid var(--border-color)',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                className="btn-secondary-action"
                onClick={resetUpload}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <RotateCcw size={15} />
                Upload Another
              </button>

              <div style={{ display: 'flex', gap: '0.55rem' }}>
                <button type="button" className="btn-secondary-action" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary-action"
                  disabled={isAnalyzing}
                  onClick={handleApply}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Check size={16} />
                  Apply to 2D Plan
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
