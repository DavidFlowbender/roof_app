import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { buildRoofSkeleton } from '../utils/roofSkeleton';
import { offsetPolygonVertices } from '../utils/roofMath';
import { analyzeWaterCollectorDesign } from '../utils/waterCollector';

const MATERIAL_VISUALS = {
  stone_coated: {
    label: 'Stone-Coated',
    swatch: '#8f3126',
    ridgeHex: 0x6b2219,
    roughness: 0.72,
    metalness: 0.12,
    bumpScale: 0.085,
  },
  longspan_aluminum: {
    label: 'Longspan',
    swatch: '#1f588a',
    ridgeHex: 0x164269,
    roughness: 0.28,
    metalness: 0.62,
    bumpScale: 0.095,
  },
  asphalt_shingles: {
    label: 'Shingles',
    swatch: '#434b59',
    ridgeHex: 0x2f3642,
    roughness: 0.88,
    metalness: 0.04,
    bumpScale: 0.06,
  },
  clay_concrete_tiles: {
    label: 'Clay Tiles',
    swatch: '#c45a35',
    ridgeHex: 0x9c3f20,
    roughness: 0.68,
    metalness: 0.05,
    bumpScale: 0.11,
  },
  standing_seam: {
    label: 'Standing Seam',
    swatch: '#68778c',
    ridgeHex: 0x4c586b,
    roughness: 0.26,
    metalness: 0.72,
    bumpScale: 0.08,
  },
};

function createDeterministicRng(seed = 1337) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Procedurally paints matching albedo + height bump maps onto offscreen canvases
 * so each material choice (stone-coated, longspan, shingles, clay tiles, standing seam)
 * renders with recognizable architectural detail in 3D Covered mode.
 */
function createRoofTextures(materialId) {
  const size = 512;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cCtx = colorCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d');

  const rand = createDeterministicRng(materialId ? materialId.length * 7919 : 42);

  if (materialId === 'longspan_aluminum') {
    // Vertical trapezoidal ribs running from ridge to eave (aligned with V axis)
    const ribs = 8;
    const ribW = size / ribs;
    for (let x = 0; x < size; x++) {
      const t = (x % ribW) / ribW;
      let shade = 0;
      let height = 90;
      if (t < 0.22) {
        // Rising flank
        const k = t / 0.22;
        shade = -20 + k * 56;
        height = Math.round(90 + k * 145);
      } else if (t < 0.44) {
        // Crisp sunlit crown peak
        shade = 36;
        height = 235;
      } else if (t < 0.64) {
        // Shaded falling flank
        const k = (t - 0.44) / 0.2;
        shade = 36 - k * 68;
        height = Math.round(235 - k * 145);
      } else {
        // Flat sheet trough pan
        shade = -18 + Math.sin(t * Math.PI * 3) * 4;
        height = 85;
      }
      const r = Math.max(0, Math.min(255, Math.round(31 + shade * 0.72)));
      const g = Math.max(0, Math.min(255, Math.round(88 + shade * 0.85)));
      const b = Math.max(0, Math.min(255, Math.round(138 + shade)));
      cCtx.fillStyle = `rgb(${r},${g},${b})`;
      cCtx.fillRect(x, 0, 1, size);

      bCtx.fillStyle = `rgb(${height},${height},${height})`;
      bCtx.fillRect(x, 0, 1, size);
    }
    // Subtle horizontal sheet lap seam
    cCtx.fillStyle = 'rgba(8, 22, 40, 0.35)';
    cCtx.fillRect(0, Math.floor(size * 0.5), size, 3);
    bCtx.fillStyle = 'rgb(40,40,40)';
    bCtx.fillRect(0, Math.floor(size * 0.5), size, 3);
  } else if (materialId === 'asphalt_shingles') {
    // Staggered dual-layer dimensional asphalt shingles with mineral granules
    cCtx.fillStyle = '#383f4c';
    cCtx.fillRect(0, 0, size, size);
    bCtx.fillStyle = 'rgb(135,135,135)';
    bCtx.fillRect(0, 0, size, size);

    const rows = 10;
    const rowH = size / rows;
    const tones = ['#323844', '#434b59', '#4f5868', '#3c4350', '#586274'];
    for (let r = 0; r < rows; r++) {
      const y = r * rowH;
      let curX = (r % 2) * -42;
      while (curX < size) {
        const tabW = 54 + Math.floor(rand() * 48);
        const col = tones[Math.floor(rand() * tones.length)];
        const hVal = 135 + Math.floor(rand() * 55);
        cCtx.fillStyle = col;
        cCtx.fillRect(curX, y, tabW - 2, rowH);
        bCtx.fillStyle = `rgb(${hVal},${hVal},${hVal})`;
        bCtx.fillRect(curX, y, tabW - 2, rowH);

        // Dark keyway gap between tabs
        cCtx.fillStyle = '#1b1f27';
        cCtx.fillRect(curX + tabW - 3, y, 3, rowH * 0.58);
        bCtx.fillStyle = 'rgb(45,45,45)';
        bCtx.fillRect(curX + tabW - 3, y, 3, rowH * 0.58);

        curX += tabW;
      }
      // Deep shadow band beneath overlapping shingle edge
      cCtx.fillStyle = 'rgba(12, 15, 22, 0.72)';
      cCtx.fillRect(0, y + rowH - 5, size, 5);
      bCtx.fillStyle = 'rgb(35,35,35)';
      bCtx.fillRect(0, y + rowH - 5, size, 5);
    }

    // Coarse ceramic mineral speckles
    for (let i = 0; i < 6500; i++) {
      const px = Math.floor(rand() * size);
      const py = Math.floor(rand() * size);
      const bright = rand() > 0.45 ? 'rgba(203,213,225,0.22)' : 'rgba(15,23,42,0.3)';
      cCtx.fillStyle = bright;
      cCtx.fillRect(px, py, 2, 2);
      const bv = Math.floor(110 + rand() * 110);
      bCtx.fillStyle = `rgba(${bv},${bv},${bv},0.35)`;
      bCtx.fillRect(px, py, 2, 2);
    }
  } else if (materialId === 'clay_concrete_tiles') {
    // Classic warm Mediterranean S-barrel terracotta clay tiles
    const rows = 6;
    const cols = 9;
    const rowH = size / rows;
    const colW = size / cols;

    for (let r = 0; r < rows; r++) {
      const y0 = r * rowH;
      for (let x = 0; x < size; x++) {
        const phase = ((x % colW) / colW) * Math.PI * 2;
        const wave = Math.sin(phase);
        const rr = Math.max(0, Math.min(255, Math.round(194 + wave * 34)));
        const gg = Math.max(0, Math.min(255, Math.round(90 + wave * 24)));
        const bb = Math.max(0, Math.min(255, Math.round(52 + wave * 16)));
        cCtx.fillStyle = `rgb(${rr},${gg},${bb})`;
        cCtx.fillRect(x, y0, 1, rowH);

        const bh = Math.round(145 + wave * 95);
        bCtx.fillStyle = `rgb(${bh},${bh},${bh})`;
        bCtx.fillRect(x, y0, 1, rowH);
      }
      // Curved overlap shadow lip at bottom of each course
      for (let c = 0; c < cols; c++) {
        const cx = c * colW;
        cCtx.fillStyle = 'rgba(72, 22, 10, 0.72)';
        cCtx.beginPath();
        cCtx.ellipse(cx + colW * 0.5, y0 + rowH - 2, colW * 0.52, 6, 0, 0, Math.PI);
        cCtx.fill();
      }
      cCtx.fillStyle = 'rgba(65, 20, 8, 0.65)';
      cCtx.fillRect(0, y0 + rowH - 4, size, 4);
      bCtx.fillStyle = 'rgb(30,30,30)';
      bCtx.fillRect(0, y0 + rowH - 4, size, 4);
    }
  } else if (materialId === 'standing_seam') {
    // Wide flat architectural zinc/slate pans with crisp narrow raised vertical lock-seams
    const seams = 4;
    const panW = size / seams;
    for (let x = 0; x < size; x++) {
      const local = x % panW;
      const panShade = Math.sin((local / panW) * Math.PI) * 12 - 4;
      let rr = 104 + panShade;
      let gg = 119 + panShade;
      let bb = 140 + panShade;
      let bh = 95;

      if (local < 5) {
        // Dark seam shadow cheek
        rr = 42; gg = 50; bb = 64; bh = 45;
      } else if (local < 11) {
        // Crisp metallic standing seam cap & glint
        rr = 204; gg = 216; bb = 230; bh = 250;
      } else if (local < 15) {
        rr = 72; gg = 84; bb = 102; bh = 135;
      }
      cCtx.fillStyle = `rgb(${Math.round(rr)},${Math.round(gg)},${Math.round(bb)})`;
      cCtx.fillRect(x, 0, 1, size);
      bCtx.fillStyle = `rgb(${bh},${bh},${bh})`;
      bCtx.fillRect(x, 0, 1, size);
    }
    // Hairline horizontal panel end-lock
    cCtx.fillStyle = 'rgba(30, 41, 59, 0.22)';
    cCtx.fillRect(0, Math.floor(size * 0.5), size, 2);
  } else {
    // Default: 'stone_coated' — Embossed interlocking scalloped Milano/Bond stone-coated tiles
    cCtx.fillStyle = '#862d22';
    cCtx.fillRect(0, 0, size, size);
    bCtx.fillStyle = 'rgb(145,145,145)';
    bCtx.fillRect(0, 0, size, size);

    const rows = 6;
    const cols = 8;
    const rowH = size / rows;
    const colW = size / cols;

    for (let r = 0; r < rows; r++) {
      const y0 = r * rowH;
      const xOffset = (r % 2) * (colW * 0.5);

      // Subtle vertical slope gradient per course so each step stands out cleanly
      const grad = cCtx.createLinearGradient(0, y0, 0, y0 + rowH);
      grad.addColorStop(0, '#5a1912');
      grad.addColorStop(0.16, '#963529');
      grad.addColorStop(0.72, '#842b21');
      grad.addColorStop(1, '#4c140e');
      cCtx.fillStyle = grad;
      cCtx.fillRect(0, y0, size, rowH);

      const bGrad = bCtx.createLinearGradient(0, y0, 0, y0 + rowH);
      bGrad.addColorStop(0, 'rgb(55,55,55)');
      bGrad.addColorStop(0.18, 'rgb(225,225,225)');
      bGrad.addColorStop(0.85, 'rgb(150,150,150)');
      bGrad.addColorStop(1, 'rgb(40,40,40)');
      bCtx.fillStyle = bGrad;
      bCtx.fillRect(0, y0, size, rowH);

      for (let c = -1; c <= cols; c++) {
        const cx = c * colW + xOffset;
        // Scalloped arch pan highlight & vertical interlock crimp
        cCtx.strokeStyle = 'rgba(220, 120, 96, 0.35)';
        cCtx.lineWidth = 2;
        cCtx.beginPath();
        cCtx.arc(cx + colW * 0.5, y0 + rowH * 0.65, colW * 0.38, Math.PI * 1.1, Math.PI * 1.9);
        cCtx.stroke();

        // Dark vertical interlock flute between adjacent tiles
        cCtx.fillStyle = 'rgba(42, 11, 8, 0.62)';
        cCtx.fillRect(cx - 2, y0 + 2, 4, rowH - 3);
        bCtx.fillStyle = 'rgb(48,48,48)';
        bCtx.fillRect(cx - 2, y0 + 2, 4, rowH - 3);
      }

      // Bold horizontal nose step shadow
      cCtx.fillStyle = 'rgba(28, 7, 5, 0.78)';
      cCtx.fillRect(0, y0 + rowH - 5, size, 5);
      bCtx.fillStyle = 'rgb(24,24,24)';
      bCtx.fillRect(0, y0 + rowH - 5, size, 5);
    }

    // Authentic natural stone-chip granule speckle
    for (let i = 0; i < 9000; i++) {
      const px = Math.floor(rand() * size);
      const py = Math.floor(rand() * size);
      const pick = rand();
      if (pick < 0.22) {
        cCtx.fillStyle = 'rgba(241, 224, 212, 0.28)';
      } else if (pick < 0.62) {
        cCtx.fillStyle = 'rgba(182, 72, 56, 0.32)';
      } else {
        cCtx.fillStyle = 'rgba(38, 12, 10, 0.36)';
      }
      cCtx.fillRect(px, py, 2, 2);

      const bv = Math.floor(95 + rand() * 145);
      bCtx.fillStyle = `rgba(${bv},${bv},${bv},0.42)`;
      bCtx.fillRect(px, py, 2, 2);
    }
  }

  const colorMap = new THREE.CanvasTexture(colorCanvas);
  colorMap.wrapS = THREE.RepeatWrapping;
  colorMap.wrapT = THREE.RepeatWrapping;
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.anisotropy = 4;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.anisotropy = 4;

  return { colorMap, bumpMap };
}

/**
 * Computes true eave-aligned horizontal (U) and upslope (V) UV coordinates for every
 * triangle of a roof BufferGeometry so horizontal tile rows stay level and vertical
 * sheet ribs / standing seams flow straight from ridge to gutter on every roof face.
 */
function applySlopeUVs(geom, tilesPerMeter = 0.5) {
  const posAttr = geom.getAttribute('position');
  if (!posAttr) return geom;

  const count = posAttr.count;
  const uvs = new Float32Array(count * 2);
  const p0 = new THREE.Vector3();
  const p1 = new THREE.Vector3();
  const p2 = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const n = new THREE.Vector3();
  const tHoriz = new THREE.Vector3();
  const tSlope = new THREE.Vector3();

  for (let i = 0; i + 2 < count; i += 3) {
    p0.fromBufferAttribute(posAttr, i);
    p1.fromBufferAttribute(posAttr, i + 1);
    p2.fromBufferAttribute(posAttr, i + 2);

    e1.subVectors(p1, p0);
    e2.subVectors(p2, p0);
    n.crossVectors(e1, e2);
    if (n.lengthSq() < 1e-8) {
      n.set(0, 1, 0);
    } else {
      n.normalize();
      if (n.y < 0) n.negate();
    }

    // Horizontal tangent perpendicular to outward normal and world up
    tHoriz.set(-n.z, 0, n.x);
    if (tHoriz.lengthSq() < 1e-6) {
      tHoriz.set(1, 0, 0);
    } else {
      tHoriz.normalize();
    }

    // Uphill tangent lying strictly in the roof plane
    tSlope.crossVectors(n, tHoriz).normalize();
    if (tSlope.y < 0) tSlope.negate();

    const verts = [p0, p1, p2];
    for (let k = 0; k < 3; k++) {
      const idx = (i + k) * 2;
      uvs[idx] = verts[k].dot(tHoriz) * tilesPerMeter;
      uvs[idx + 1] = verts[k].dot(tSlope) * tilesPerMeter;
    }
  }

  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  return geom;
}

export default function Roof3DViewer({
  geometry,
  roofType = 'gable',
  extensions = [],
  buildingStage = 'foundation',
  parapetConfig = null,
  woodworkConfig = null,
  selectedMaterial = 'stone_coated',
  wcConfig = null,
  forcedDisplayMode = null,
  isPremium = true,
  onOpenProModal = null,
}) {
  const mountRef = useRef(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [activeViewPreset, setActiveViewPreset] = useState('3d');
  const [roofDisplayMode, setRoofDisplayMode] = useState(buildingStage === 'woodwork' ? 'framing' : 'finished');
  const sceneContextRef = useRef(null);

  const handleSelectViewPreset = (preset) => {
    setAutoRotate(false);
    setActiveViewPreset(preset);
    if (sceneContextRef.current?.setCameraOrientation) {
      sceneContextRef.current.setCameraOrientation(preset);
    }
  };

  const effectiveDisplayMode = forcedDisplayMode || (!isPremium && roofDisplayMode === 'framing' ? 'finished' : roofDisplayMode);
  const activeVisual = MATERIAL_VISUALS[selectedMaterial] || MATERIAL_VISUALS.stone_coated;

  useEffect(() => {
    if (buildingStage === 'woodwork') {
      setRoofDisplayMode('framing');
    }
  }, [buildingStage]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 500;
    const height = container.clientHeight || 380;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a); // Deep modern slate background

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    // 2. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(20, 30, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x90caf9, 0.65);
    fillLight.position.set(-18, 16, -18);
    scene.add(fillLight);

    // Ground Grid
    const gridHelper = new THREE.GridHelper(30, 30, 0x334155, 0x1e293b);
    gridHelper.position.y = -0.05;
    scene.add(gridHelper);

    // 3. Root Group for Model
    const modelGroup = new THREE.Group();
    scene.add(modelGroup);

    // 4. Mouse / Touch Orbit Controls (Native vanilla Three.js interaction)
    let isDragging = false;
    let dragDistSq = 0;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let rotationX = 0.45;
    let rotationY = -0.7;
    let targetRotation = null;
    let distance = 26;
    let lookAtY = 1.5;

    const updateCamera = () => {
      camera.position.x = distance * Math.sin(rotationY) * Math.cos(rotationX);
      camera.position.y = distance * Math.sin(rotationX) + lookAtY + 0.5;
      camera.position.z = distance * Math.cos(rotationY) * Math.cos(rotationX);
      camera.lookAt(0, lookAtY, 0);
    };
    updateCamera();

    const onMouseDown = (e) => {
      isDragging = true;
      dragDistSq = 0;
      targetRotation = null;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      dragDistSq += deltaX * deltaX + deltaY * deltaY;
      if (dragDistSq > 16) {
        setActiveViewPreset(null);
      }

      rotationY -= deltaX * 0.008;
      rotationX = Math.max(-0.2, Math.min(1.48, rotationX + deltaY * 0.008));
      updateCamera();
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (e) => {
      e.preventDefault();
      distance = Math.max(7, Math.min(75, distance + e.deltaY * 0.02));
      updateCamera();
    };

    // Touch support for mobile (1-finger orbit + 2-finger pinch-to-zoom)
    let touchStartX = 0;
    let touchStartY = 0;
    let touchDragDistSq = 0;
    let pinchStartDist = 0;
    let pinchStartCameraDist = distance;

    const getTouchDistance = (t1, t2) =>
      Math.max(10, Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY));

    const onTouchStart = (e) => {
      isDragging = true;
      targetRotation = null;
      if (e.touches.length === 2) {
        pinchStartDist = getTouchDistance(e.touches[0], e.touches[1]);
        pinchStartCameraDist = distance;
      } else if (e.touches.length === 1) {
        pinchStartDist = 0;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchDragDistSq = 0;
      }
    };
    const onTouchMove = (e) => {
      if (e.cancelable) e.preventDefault();
      if (e.touches.length === 2 && pinchStartDist > 0) {
        const curDist = getTouchDistance(e.touches[0], e.touches[1]);
        distance = Math.max(7, Math.min(75, pinchStartCameraDist * (pinchStartDist / curDist)));
        updateCamera();
        return;
      }
      if (e.touches.length === 1 && pinchStartDist === 0) {
        const deltaX = e.touches[0].clientX - touchStartX;
        const deltaY = e.touches[0].clientY - touchStartY;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;

        touchDragDistSq += deltaX * deltaX + deltaY * deltaY;
        if (touchDragDistSq > 16) {
          setActiveViewPreset(null);
        }

        rotationY -= deltaX * 0.008;
        rotationX = Math.max(-0.2, Math.min(1.48, rotationX + deltaY * 0.008));
        updateCamera();
      }
    };
    const onTouchEnd = (e) => {
      if (e.touches.length < 2) {
        pinchStartDist = 0;
      }
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      } else if (e.touches.length === 0) {
        isDragging = false;
      }
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    domEl.addEventListener('wheel', onWheel, { passive: false });
    domEl.addEventListener('touchstart', onTouchStart, { passive: true });
    domEl.addEventListener('touchmove', onTouchMove, { passive: false });
    domEl.addEventListener('touchend', onTouchEnd, { passive: true });
    domEl.addEventListener('touchcancel', onTouchEnd, { passive: true });

    // Handle Window Resize
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Animation Loop
    let animationFrameId;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (targetRotation) {
        const diffY = Math.atan2(
          Math.sin(targetRotation.y - rotationY),
          Math.cos(targetRotation.y - rotationY)
        );
        const diffX = targetRotation.x - rotationX;
        if (Math.abs(diffX) < 0.004 && Math.abs(diffY) < 0.004) {
          rotationX = targetRotation.x;
          rotationY = targetRotation.y;
          targetRotation = null;
        } else {
          rotationX += diffX * 0.22;
          rotationY += diffY * 0.22;
        }
        updateCamera();
      } else if (sceneContextRef.current?.autoRotate && !isDragging) {
        rotationY += 0.003;
        updateCamera();
      }
      renderer.render(scene, camera);
    };
    animate();

    sceneContextRef.current = {
      scene,
      camera,
      renderer,
      modelGroup,
      autoRotate,
      setTargetFraming: (floors = 1) => {
        const extraFloors = Math.max(0, floors - 1);
        lookAtY = 1.5 + extraFloors * 1.35;
        distance = 25 + extraFloors * 5.0;
        updateCamera();
      },
      setCameraOrientation: (preset) => {
        const presets = {
          front: { x: 0.16, y: 0 },
          back: { x: 0.16, y: Math.PI },
          left: { x: 0.16, y: -Math.PI / 2 },
          right: { x: 0.16, y: Math.PI / 2 },
          aerial: { x: 1.48, y: 0 },
          '3d': { x: 0.45, y: -0.7 },
        };
        targetRotation = presets[preset] || presets['3d'];
      },
      resetCamera: () => {
        targetRotation = { x: 0.45, y: -0.7 };
      },
    };

    return () => {
      cancelAnimationFrame(animationFrameId);
      domEl.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      domEl.removeEventListener('wheel', onWheel);
      domEl.removeEventListener('touchstart', onTouchStart);
      domEl.removeEventListener('touchmove', onTouchMove);
      domEl.removeEventListener('touchend', onTouchEnd);
      domEl.removeEventListener('touchcancel', onTouchEnd);
      window.removeEventListener('resize', handleResize);
      if (container.contains(domEl)) {
        container.removeChild(domEl);
      }
      renderer.dispose();
    };
  }, []);

  // Update autoRotate ref
  useEffect(() => {
    if (sceneContextRef.current) {
      sceneContextRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  // Rebuild 3D Model when geometry, roofType, selectedMaterial, or WC config changes
  useEffect(() => {
    if (!sceneContextRef.current) return;
    const { modelGroup, setTargetFraming } = sceneContextRef.current;

    // Clear previous children & dispose textures/geometries/materials
    while (modelGroup.children.length > 0) {
      const obj = modelGroup.children[0];
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => {
          if (m.map) m.map.dispose();
          if (m.bumpMap) m.bumpMap.dispose();
          m.dispose();
        });
      }
      modelGroup.remove(obj);
    }

    const L = geometry?.buildingDimensions?.length || 10;
    const B = geometry?.buildingDimensions?.breadth || 6;
    const halfL = L / 2;
    const halfB = B / 2;
    const H = Math.max(0.2, geometry?.roofHeight || 2);

    const isWcActive = Boolean(wcConfig?.enabled);
    const wcFloors = isWcActive ? Math.max(1, Math.min(10, Math.round(Number(wcConfig.floors) || 1))) : 1;
    const wallHeight = isWcActive ? wcFloors * 3.0 + 0.2 : 3.2;

    if (setTargetFraming) {
      setTargetFraming(isWcActive ? wcFloors : 1);
    }

    const isTimberActive = effectiveDisplayMode === 'framing';
    const isCoveringActive = effectiveDisplayMode !== 'framing';
    const isWoodworkActive = isTimberActive;

    const matProfile = MATERIAL_VISUALS[selectedMaterial] || MATERIAL_VISUALS.stone_coated;
    const { colorMap, bumpMap } = isCoveringActive
      ? createRoofTextures(selectedMaterial)
      : { colorMap: null, bumpMap: null };

    // Materials
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x334155, // Architectural modern slate wall
      roughness: 0.8,
      metalness: 0.1,
    });

    const gableInfillMaterial = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.8,
      metalness: 0.1,
      side: THREE.DoubleSide,
      flatShading: true,
    });

    const roofMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: colorMap,
      bumpMap: bumpMap,
      bumpScale: matProfile.bumpScale,
      roughness: matProfile.roughness,
      metalness: matProfile.metalness,
      side: THREE.DoubleSide,
    });

    // Realistic Ridge Cap flashing that matches the selected roofing material
    const ridgeCapMaterial = new THREE.MeshStandardMaterial({
      color: matProfile.ridgeHex,
      roughness: Math.max(0.22, matProfile.roughness - 0.08),
      metalness: Math.min(0.85, matProfile.metalness + 0.08),
    });

    const ridgeMaterial = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // Amber highlight for framing ridges
      roughness: 0.3,
      metalness: 0.3,
    });

    const activeCapMaterial = isCoveringActive ? ridgeCapMaterial : ridgeMaterial;

    const gutterMaterial = new THREE.MeshStandardMaterial({
      color: 0x38bdf8, // Sky blue for gutters
      roughness: 0.2,
      metalness: 0.6,
    });

    const rafterTimberMat = new THREE.MeshStandardMaterial({
      color: 0xb45309, // Treated mahogany / cedar structural framing
      roughness: 0.72,
      metalness: 0.08,
    });

    const purlinTimberMat = new THREE.MeshStandardMaterial({
      color: 0xe09f3e, // Lighter sawn pine / obeche purlins & battens
      roughness: 0.65,
      metalness: 0.05,
    });

    // Helper: orient a rectangular timber member cleanly between any two 3D points p1 -> p2
    const addTimberBeam = (p1, p2, width, depth, mat, normalHint = null) => {
      const dir = new THREE.Vector3().subVectors(p2, p1);
      const len = dir.length();
      if (len < 0.04) return;

      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      const forward = dir.clone().divideScalar(len);
      const refUp = normalHint ? normalHint.clone().normalize() : new THREE.Vector3(0, 1, 0);

      let right;
      if (Math.abs(forward.dot(refUp)) > 0.995) {
        const fallbackRef = Math.abs(forward.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
        right = new THREE.Vector3().crossVectors(fallbackRef, forward).normalize();
      } else {
        right = new THREE.Vector3().crossVectors(refUp, forward).normalize();
      }
      const up = new THREE.Vector3().crossVectors(forward, right).normalize();
      const basis = new THREE.Matrix4().makeBasis(right, up, forward);

      const geom = new THREE.BoxGeometry(width, depth, len);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.copy(mid);
      mesh.setRotationFromMatrix(basis);
      mesh.castShadow = true;
      modelGroup.add(mesh);
    };

    // Helper: compute upward-pointing unit normal of a sloped roof plane
    const getOutwardRoofNormal = (a, b, c) => {
      const ab = new THREE.Vector3().subVectors(b, a);
      const ac = new THREE.Vector3().subVectors(c, a);
      const n = new THREE.Vector3().crossVectors(ab, ac).normalize();
      if (n.y < 0) n.negate();
      return n;
    };

    const roofBaseY = wallHeight;
    const isParapetActive = buildingStage === 'parapet' || Boolean(parapetConfig?.enabled);
    const pProj = Math.max(0.25, Number(parapetConfig?.projection) || 0.45);
    const corniceH = Math.min(0.55, Math.max(0.32, Number(parapetConfig?.height) || 0.42));

    /**
     * Renders 3D Water Collector (WC) elements on the building:
     * - Multi-storey floor slab belt bands
     * - Corner angle miter collars (45° amber, 90° cyan, 135° emerald)
     * - Collector funnels, vertical downspouts, offset elbows, and discharge shoes
     */
    const renderWaterCollector3D = (
      baseY = roofBaseY,
      rectWallL = L,
      rectWallB = B,
      isPolyShape = false,
      getEaveToWallGap = null,
      polyWallData = null
    ) => {
      if (!isWcActive) return;
      const wcAnalysis = analyzeWaterCollectorDesign(geometry, roofType, geometry?.polygonVertices, wcConfig);

      const pipeMat = new THREE.MeshStandardMaterial({
        color: 0x0ea5e9,
        roughness: 0.22,
        metalness: 0.45,
      });
      const elbowMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.25,
        metalness: 0.65,
      });
      const bandMat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        roughness: 0.52,
        metalness: 0.18,
      });
      const bandLineMat = new THREE.LineBasicMaterial({ color: 0xe2e8f0 });

      const addPipeSegment = (p1, p2, radius = 0.065, mat = pipeMat) => {
        const dir = new THREE.Vector3().subVectors(p2, p1);
        const len = dir.length();
        if (len < 0.03) return;
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 10), mat);
        cyl.position.copy(p1).addScaledVector(dir, 0.5);
        cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
        cyl.castShadow = true;
        modelGroup.add(cyl);
      };

      const addElbowHub = (pt, radius = 0.092) => {
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 10), elbowMat);
        sphere.position.copy(pt);
        modelGroup.add(sphere);
      };

      // Multi-floor concrete slab belt + crisp horizontal divider line between every floor (both Rect & Custom Polygons)
      if (wcFloors > 1) {
        if (isPolyShape && polyWallData?.wallPts?.length >= 3) {
          const { wallPts, cX: pCx, cZ: pCz } = polyWallData;
          const beltLoop = offsetPolygonVertices(wallPts, 0.085);
          if (beltLoop && beltLoop.length >= 3) {
            const beltShape = new THREE.Shape();
            beltShape.moveTo(beltLoop[0].x - pCx, -(beltLoop[0].y - pCz));
            for (let i = 1; i < beltLoop.length; i++) {
              beltShape.lineTo(beltLoop[i].x - pCx, -(beltLoop[i].y - pCz));
            }
            beltShape.closePath();

            const beltLinePts = beltLoop.map((p) => new THREE.Vector3(p.x - pCx, 0, p.y - pCz));

            for (let f = 1; f < wcFloors; f++) {
              const beltY = f * 3.0;
              const beltGeom = new THREE.ExtrudeGeometry(beltShape, { depth: 0.16, bevelEnabled: false });
              const beltMesh = new THREE.Mesh(beltGeom, bandMat);
              beltMesh.rotation.x = -Math.PI / 2;
              beltMesh.position.y = beltY - 0.08;
              beltMesh.castShadow = true;
              beltMesh.receiveShadow = true;
              modelGroup.add(beltMesh);

              // Crisp horizontal divider line along outer slab edge
              const lineGeom = new THREE.BufferGeometry().setFromPoints(
                beltLinePts.map((pt) => new THREE.Vector3(pt.x, beltY + 0.005, pt.z))
              );
              modelGroup.add(new THREE.LineLoop(lineGeom, bandLineMat));
            }
          }
        } else if (!isPolyShape) {
          const bw = rectWallL + 0.18;
          const bd = rectWallB + 0.18;
          const hw = bw / 2;
          const hd = bd / 2;
          for (let f = 1; f < wcFloors; f++) {
            const beltY = f * 3.0;
            const belt = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.16, bd), bandMat);
            belt.position.set(0, beltY, 0);
            belt.castShadow = true;
            belt.receiveShadow = true;
            modelGroup.add(belt);

            const lineGeom = new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(-hw, beltY + 0.005, -hd),
              new THREE.Vector3(hw, beltY + 0.005, -hd),
              new THREE.Vector3(hw, beltY + 0.005, hd),
              new THREE.Vector3(-hw, beltY + 0.005, hd),
            ]);
            modelGroup.add(new THREE.LineLoop(lineGeom, bandLineMat));
          }
        }
      }

      // Corner Miter Markers (45° / 90° / 135°)
      wcAnalysis.cornerMarkers.forEach((cm) => {
        const colorHex = cm.angleType === 45 ? 0xf59e0b : cm.angleType === 135 ? 0x10b981 : 0x22d3ee;
        const cornerMat = new THREE.MeshStandardMaterial({
          color: colorHex,
          roughness: 0.25,
          metalness: 0.5,
          emissive: colorHex,
          emissiveIntensity: 0.28,
        });
        const node = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.18, 12), cornerMat);
        node.position.set(cm.x, baseY, cm.z);
        modelGroup.add(node);
      });

      // Downspout Drop Pipes + Funnels + Offset Elbows + Discharge Shoes
      // Always keep vertical pipes & elbows cleanly outside the wall face (even when overhang = 0 on Woodwork/Parapet).
      const wallClearance = 0.095;
      const lowerElbowDropY = isParapetActive ? Math.max(0.56, corniceH + 0.14) : 0.55;

      wcAnalysis.dropPositions.forEach((drop) => {
        const nx = drop.nx || 0;
        const nz = drop.nz || 0;
        const rawGap =
          typeof getEaveToWallGap === 'function' ? Number(getEaveToWallGap(drop)) : 0.45;
        const eaveToWallGap = Number.isFinite(rawGap) ? Math.max(0, rawGap) : 0;

        // Gutter collector outlet stands just outside the eave/gutter lip if overhang is flush with the wall
        const outletPushOut = eaveToWallGap < wallClearance ? wallClearance - eaveToWallGap : 0.02;
        const startX = drop.x + nx * outletPushOut;
        const startZ = drop.z + nz * outletPushOut;

        // Horizontal distance from gutter outlet back toward the exterior wall face (never pushes inside the wall!)
        const jogInDist = Math.max(0, eaveToWallGap + outletPushOut - wallClearance);

        // Collector Funnel Outlet beneath gutter
        const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.065, 0.16, 10), elbowMat);
        funnel.position.set(startX, baseY - 0.09, startZ);
        modelGroup.add(funnel);

        const pElbow1 = new THREE.Vector3(startX, baseY - 0.2, startZ);
        const pElbow2 = new THREE.Vector3(
          startX - nx * jogInDist,
          baseY - lowerElbowDropY,
          startZ - nz * jogInDist
        );
        const pGround = new THREE.Vector3(pElbow2.x, 0.22, pElbow2.z);
        const pShoe = new THREE.Vector3(pGround.x + nx * 0.28, 0.12, pGround.z + nz * 0.28);

        addPipeSegment(new THREE.Vector3(startX, baseY - 0.08, startZ), pElbow1, 0.065, pipeMat);
        addElbowHub(pElbow1);
        addPipeSegment(pElbow1, pElbow2, 0.065, pipeMat);
        addElbowHub(pElbow2);
        addPipeSegment(pElbow2, pGround, 0.065, pipeMat);
        addElbowHub(pGround, 0.082);
        addPipeSegment(pGround, pShoe, 0.068, elbowMat);
      });
    };

    /**
     * Renders a 3-tier stepped cast concrete parapet cornice projecting OUTWARD
     * from `innerLoop` to `outerLoop`, finishing flat at `topY` (`wallHeight`) so
     * the roof sits directly on top with zero hidden area and zero void.
     */
    const addOutwardParapetCornice = (innerLoop, outerLoop, topY, totalH, offX = 0, offZ = 0) => {
      if (!innerLoop || !outerLoop || innerLoop.length < 3 || innerLoop.length !== outerLoop.length) return;
      const nPts = innerLoop.length;
      const tierCount = 3;
      const tierH = totalH / tierCount;
      const tierColors = [0x94a3b8, 0xcbd5e1, 0xe2e8f0];
      const tierFracs = [0.36, 0.68, 1.0];

      for (let t = 0; t < tierCount; t++) {
        const yBot = topY - totalH + t * tierH;
        const frac = tierFracs[t];
        const tierMat = new THREE.MeshStandardMaterial({
          color: tierColors[t],
          roughness: 0.72,
          metalness: 0.08,
        });

        for (let i = 0; i < nPts; i++) {
          const j = (i + 1) % nPts;
          const inA = innerLoop[i];
          const inB = innerLoop[j];
          const outA = {
            x: inA.x + (outerLoop[i].x - inA.x) * frac,
            y: inA.y + (outerLoop[i].y - inA.y) * frac,
          };
          const outB = {
            x: inB.x + (outerLoop[j].x - inB.x) * frac,
            y: inB.y + (outerLoop[j].y - inB.y) * frac,
          };

          // Slightly overlap inner edge into wall to ensure zero seam/z-gap
          const nrmA = { x: inA.x - outA.x, y: inA.y - outA.y };
          const lA = Math.hypot(nrmA.x, nrmA.y) || 1;
          const nrmB = { x: inB.x - outB.x, y: inB.y - outB.y };
          const lB = Math.hypot(nrmB.x, nrmB.y) || 1;
          const lapInA = { x: inA.x + (nrmA.x / lA) * 0.03, y: inA.y + (nrmA.y / lA) * 0.03 };
          const lapInB = { x: inB.x + (nrmB.x / lB) * 0.03, y: inB.y + (nrmB.y / lB) * 0.03 };

          const segShape = new THREE.Shape();
          segShape.moveTo(lapInA.x - offX, -(lapInA.y - offZ));
          segShape.lineTo(lapInB.x - offX, -(lapInB.y - offZ));
          segShape.lineTo(outB.x - offX, -(outB.y - offZ));
          segShape.lineTo(outA.x - offX, -(outA.y - offZ));
          segShape.closePath();

          const segGeom = new THREE.ExtrudeGeometry(segShape, {
            depth: tierH,
            bevelEnabled: false,
          });
          const segMesh = new THREE.Mesh(segGeom, tierMat);
          segMesh.rotation.x = -Math.PI / 2;
          segMesh.position.y = yBot;
          segMesh.castShadow = true;
          segMesh.receiveShadow = true;
          modelGroup.add(segMesh);
        }
      }
    };

    // Check if user sketched or loaded a custom polygon (e.g. Cross shape from video)
    const isCustomPoly = geometry?.isCustomPolygon && geometry?.polygonVertices?.length >= 3;

    if (isCustomPoly) {
      const pts = geometry.polygonVertices;
      let minX = pts[0].x, maxX = pts[0].x, minY = pts[0].y, maxY = pts[0].y;
      pts.forEach((p) => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      });
      const cX = (minX + maxX) / 2;
      const cZ = (minY + maxY) / 2;

      const ovObj = geometry?.buildingDimensions?.overhang;
      const avgOvVal = typeof ovObj === 'object' && ovObj !== null
        ? ((Number(ovObj.front) || 0) + (Number(ovObj.back) || 0) + (Number(ovObj.left) || 0) + (Number(ovObj.right) || 0)) / 4
        : (Number(ovObj) || 0.45);
      const tanPitchVal = Math.tan(((geometry?.pitchDegrees || 45.0) * Math.PI) / 180);

      // Determine wall loop underneath (inset if original sketch already included outward parapet)
      const polyInnerWallPts =
        isParapetActive && parapetConfig?.includedInSketch
          ? offsetPolygonVertices(pts, -Math.min(pProj, 0.45))
          : pts;

      // 1. Extrude Custom Walls
      const wallShape = new THREE.Shape();
      wallShape.moveTo(polyInnerWallPts[0].x - cX, -(polyInnerWallPts[0].y - cZ));
      for (let i = 1; i < polyInnerWallPts.length; i++) {
        wallShape.lineTo(polyInnerWallPts[i].x - cX, -(polyInnerWallPts[i].y - cZ));
      }
      wallShape.closePath();

      const actualWallH =
        isParapetActive && parapetConfig?.includedInSketch
          ? Math.max(1.2, wallHeight - corniceH)
          : wallHeight;
      const wallGeom = new THREE.ExtrudeGeometry(wallShape, { depth: actualWallH, bevelEnabled: false });
      const wallMesh = new THREE.Mesh(wallGeom, wallMaterial);
      wallMesh.rotation.x = -Math.PI / 2;
      wallMesh.position.y = 0;
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      modelGroup.add(wallMesh);

      // Foundation Slab with subtle beveled rim
      const slabGeom = new THREE.ExtrudeGeometry(wallShape, {
        depth: 0.2,
        bevelEnabled: true,
        bevelThickness: 0.08,
        bevelSize: 0.2,
        bevelSegments: 2,
      });
      const slabMesh = new THREE.Mesh(
        slabGeom,
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 })
      );
      slabMesh.rotation.x = -Math.PI / 2;
      slabMesh.position.y = -0.15;
      slabMesh.receiveShadow = true;
      modelGroup.add(slabMesh);

      // 2. Intelligent Custom 3D Sloped Roof with Sectioned Wings, True Ridges & Valleys
      const n = pts.length;
      // When concrete parapet is active, roof rests directly on top of the parapet at wallHeight!
      const polyRoofBaseY = isParapetActive
        ? roofBaseY
        : roofBaseY - Math.min(0.55, avgOvVal * tanPitchVal);

      const polySkeleton = geometry?.skeleton || buildRoofSkeleton(
        pts,
        geometry?.buildingDimensions?.overhang || 0.45,
        geometry?.pitchDegrees || 45.0,
        roofType
      );

      // Render stepped outward concrete parapet cornice (always below/at wallHeight so no roof is hidden)
      if (isParapetActive) {
        const parapetOuterLoop = parapetConfig?.includedInSketch
          ? pts
          : polySkeleton?.eavePolygon?.length === polyInnerWallPts.length
          ? polySkeleton.eavePolygon
          : offsetPolygonVertices(polyInnerWallPts, Math.max(pProj, avgOvVal));
        addOutwardParapetCornice(polyInnerWallPts, parapetOuterLoop, roofBaseY, corniceH, cX, cZ);
      }

      // 1. Build 3D mesh facets from skeleton.triangles if covering is active
      if (isCoveringActive && polySkeleton?.triangles && polySkeleton.triangles.length > 0) {
        const roofTriangles = [];
        polySkeleton.triangles.forEach((tri) => {
          const p0 = new THREE.Vector3(tri[0].x - cX, polyRoofBaseY + (tri[0].z || 0), tri[0].y - cZ);
          const p1 = new THREE.Vector3(tri[1].x - cX, polyRoofBaseY + (tri[1].z || 0), tri[1].y - cZ);
          const p2 = new THREE.Vector3(tri[2].x - cX, polyRoofBaseY + (tri[2].z || 0), tri[2].y - cZ);

          // Ensure face normal points OUTWARD / UPWARD into the sky
          const edge1 = new THREE.Vector3().subVectors(p1, p0);
          const edge2 = new THREE.Vector3().subVectors(p2, p0);
          const normal = new THREE.Vector3().crossVectors(edge1, edge2);

          let vA = p0, vB = p1, vC = p2;
          if (normal.y < 0) {
            // Reverse winding if normal points downwards
            vB = p2;
            vC = p1;
          }

          roofTriangles.push(
            vA.x, vA.y, vA.z,
            vB.x, vB.y, vB.z,
            vC.x, vC.y, vC.z
          );
        });

        const roofGeom = new THREE.BufferGeometry();
        roofGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(roofTriangles), 3));
        applySlopeUVs(roofGeom, 0.5);
        roofGeom.computeVertexNormals();
        const roofMesh = new THREE.Mesh(roofGeom, roofMaterial);
        roofMesh.castShadow = true;
        roofMesh.receiveShadow = true;
        modelGroup.add(roofMesh);

        // Render solid infill walls (Shed raised back/side walls & Gable triangular end walls)
        if (Array.isArray(polySkeleton?.infillWalls) && polySkeleton.infillWalls.length > 0) {
          const infillVerts = [];
          polySkeleton.infillWalls.forEach((tri) => {
            const a = new THREE.Vector3(tri[0].x - cX, polyRoofBaseY + (tri[0].z || 0), tri[0].y - cZ);
            const b = new THREE.Vector3(tri[1].x - cX, polyRoofBaseY + (tri[1].z || 0), tri[1].y - cZ);
            const c = new THREE.Vector3(tri[2].x - cX, polyRoofBaseY + (tri[2].z || 0), tri[2].y - cZ);
            infillVerts.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
          });
          const infillGeom = new THREE.BufferGeometry();
          infillGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(infillVerts), 3));
          infillGeom.computeVertexNormals();
          const infillMat = gableInfillMaterial.clone();
          infillMat.side = THREE.DoubleSide;
          const infillMesh = new THREE.Mesh(infillGeom, infillMat);
          infillMesh.castShadow = true;
          infillMesh.receiveShadow = true;
          modelGroup.add(infillMesh);
        }

        // Flat roof architectural perimeter coping / fascia trim for custom polygons
        if (roofType === 'flat' && Array.isArray(polySkeleton?.eavePolygon) && polySkeleton.eavePolygon.length >= 3) {
          const ep = polySkeleton.eavePolygon;
          const copingMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.45, metalness: 0.3 });
          for (let i = 0; i < ep.length; i++) {
            const p1 = new THREE.Vector3(ep[i].x - cX, polyRoofBaseY + 0.14, ep[i].y - cZ);
            const p2 = new THREE.Vector3(ep[(i + 1) % ep.length].x - cX, polyRoofBaseY + 0.14, ep[(i + 1) % ep.length].y - cZ);
            const dir = new THREE.Vector3().subVectors(p2, p1);
            const len = dir.length();
            if (len > 0.05) {
              const trim = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, len + 0.14), copingMat);
              trim.position.copy(new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5));
              trim.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize());
              trim.castShadow = true;
              modelGroup.add(trim);
            }
          }
        }

        // Sleek Ridge Caps on top of ridges and hips (raised slightly by +0.035m so no z-fighting!)
        polySkeleton?.ridges?.forEach((r) => {
          const p1 = new THREE.Vector3(r.p1.x - cX, polyRoofBaseY + (r.p1.z || 0) + 0.035, r.p1.y - cZ);
          const p2 = new THREE.Vector3(r.p2.x - cX, polyRoofBaseY + (r.p2.z || 0) + 0.035, r.p2.y - cZ);
          const dir = new THREE.Vector3().subVectors(p2, p1);
          const len = dir.length();
          if (len > 0.02) {
            const capMesh = new THREE.Mesh(
              new THREE.CylinderGeometry(0.05, 0.05, len, 8),
              ridgeCapMaterial
            );
            capMesh.position.copy(new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5));
            capMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
            modelGroup.add(capMesh);
          }
        });

        polySkeleton?.hips?.forEach((h) => {
          const p1 = new THREE.Vector3(h.p1.x - cX, polyRoofBaseY + (h.p1.z || 0) + 0.03, h.p1.y - cZ);
          const p2 = new THREE.Vector3(h.p2.x - cX, polyRoofBaseY + (h.p2.z || 0) + 0.03, h.p2.y - cZ);
          const dir = new THREE.Vector3().subVectors(p2, p1);
          const len = dir.length();
          if (len > 0.02) {
            const capMesh = new THREE.Mesh(
              new THREE.CylinderGeometry(0.04, 0.04, len, 8),
              ridgeCapMaterial
            );
            capMesh.position.copy(new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5));
            capMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
            modelGroup.add(capMesh);
          }
        });
      }

      // 2. 3D Valley Gutters (The concave intersection where wings meet!)
      polySkeleton?.valleys?.forEach((v) => {
        const p1 = new THREE.Vector3(v.p1.x - cX, polyRoofBaseY + (v.p1.z || 0) + 0.025, v.p1.y - cZ);
        const p2 = new THREE.Vector3(v.p2.x - cX, polyRoofBaseY + (v.p2.z || 0) + 0.025, v.p2.y - cZ);
        const dir = new THREE.Vector3().subVectors(p2, p1);
        const len = dir.length();
        if (len > 0.02) {
          const valleyMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(0.05, 0.05, len, 8),
            gutterMaterial
          );
          valleyMesh.position.copy(new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5));
          valleyMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
          modelGroup.add(valleyMesh);
        }
      });

      // 3. Eave gutter perimeter trim along outer eave overhang
      const eaveBoundary = polySkeleton?.eavePolygon || pts;
      const eLenCount = eaveBoundary.length;
      for (let i = 0; i < eLenCount; i++) {
        const p1 = new THREE.Vector3(eaveBoundary[i].x - cX, polyRoofBaseY, eaveBoundary[i].y - cZ);
        const p2 = new THREE.Vector3(eaveBoundary[(i + 1) % eLenCount].x - cX, polyRoofBaseY, eaveBoundary[(i + 1) % eLenCount].y - cZ);
        const edgeVec = new THREE.Vector3().subVectors(p2, p1);
        const edgeLen = edgeVec.length();
        if (edgeLen > 0.01) {
          const gutterMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(0.04, 0.04, edgeLen, 8),
            gutterMaterial
          );
          gutterMesh.position.copy(new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5));
          gutterMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), edgeVec.clone().normalize());
          modelGroup.add(gutterMesh);
        }
      }

      // 4. Structural Timber Framing (ONLY when isTimberActive is TRUE!)
      if (isTimberActive) {
        const kingpostTimberMat = new THREE.MeshStandardMaterial({
          color: 0xf59e0b, // Warm golden cedar for kingposts, struts & main ridge
          roughness: 0.65,
          metalness: 0.08,
        });
        const tieBeamTimberMat = new THREE.MeshStandardMaterial({
          color: 0xd97706, // Rich amber structural tie beams (ceiling joists)
          roughness: 0.72,
          metalness: 0.06,
        });

        const plateY = actualWallH + 0.025;
        const wallLoopXZ = polyInnerWallPts.map((p) => ({ x: p.x - cX, z: p.y - cZ }));

        // 4a. Wall Plates seated squarely atop load-bearing masonry walls
        for (let i = 0; i < wallLoopXZ.length; i++) {
          const a = wallLoopXZ[i];
          const b = wallLoopXZ[(i + 1) % wallLoopXZ.length];
          addTimberBeam(
            new THREE.Vector3(a.x, plateY, a.z),
            new THREE.Vector3(b.x, plateY, b.z),
            0.1,
            0.055,
            rafterTimberMat
          );
        }

        // 4b. Timber Ridge Beams, Hip Rafters & Valley Rafters
        polySkeleton?.ridges?.forEach((r) => {
          const p1 = new THREE.Vector3(r.p1.x - cX, polyRoofBaseY + (r.p1.z || 0) - 0.02, r.p1.y - cZ);
          const p2 = new THREE.Vector3(r.p2.x - cX, polyRoofBaseY + (r.p2.z || 0) - 0.02, r.p2.y - cZ);
          addTimberBeam(p1, p2, 0.08, 0.16, kingpostTimberMat);
        });

        polySkeleton?.hips?.forEach((h) => {
          const p1 = new THREE.Vector3(h.p1.x - cX, polyRoofBaseY + (h.p1.z || 0) - 0.02, h.p1.y - cZ);
          const p2 = new THREE.Vector3(h.p2.x - cX, polyRoofBaseY + (h.p2.z || 0) - 0.02, h.p2.y - cZ);
          addTimberBeam(p1, p2, 0.06, 0.12, rafterTimberMat);
        });

        polySkeleton?.valleys?.forEach((v) => {
          const p1 = new THREE.Vector3(v.p1.x - cX, polyRoofBaseY + (v.p1.z || 0) - 0.02, v.p1.y - cZ);
          const p2 = new THREE.Vector3(v.p2.x - cX, polyRoofBaseY + (v.p2.z || 0) - 0.02, v.p2.y - cZ);
          addTimberBeam(p1, p2, 0.075, 0.14, rafterTimberMat);
        });

        // Helper: cast a horizontal 2D ray from (ox, oz) along unit (dx, dz) to nearest wall polygon edge
        const castRayToWallLoop = (ox, oz, dx, dz, loop) => {
          let bestT = Infinity;
          const m = loop.length;
          for (let i = 0; i < m; i++) {
            const a = loop[i];
            const b = loop[(i + 1) % m];
            const ex = b.x - a.x;
            const ez = b.z - a.z;
            const denom = dx * ez - dz * ex;
            if (Math.abs(denom) < 1e-6) continue;
            const qx = a.x - ox;
            const qz = a.z - oz;
            const t = (qx * ez - qz * ex) / denom;
            const s = (qx * dz - qz * dx) / denom;
            if (t > 0.08 && s >= -1e-3 && s <= 1 + 1e-3 && t < bestT) {
              bestT = t;
            }
          }
          return Number.isFinite(bestT) ? bestT : null;
        };

        // 4c. Real Kingpost Trusses: Horizontal Tie Beams + Vertical Kingposts + Diagonal Web Struts
        const trussSpacing = Math.max(0.8, Math.min(2.0, Number(woodworkConfig?.trussSpacing) || 1.2));
        const tieY = plateY + 0.065;
        const trussRidges =
          polySkeleton?.ridges?.length > 0
            ? polySkeleton.ridges
            : (polySkeleton?.sections || []).filter((s) => s.ridge).map((s) => s.ridge);

        trussRidges.forEach((r) => {
          const r1 = new THREE.Vector3(r.p1.x - cX, polyRoofBaseY + (r.p1.z || 0), r.p1.y - cZ);
          const r2 = new THREE.Vector3(r.p2.x - cX, polyRoofBaseY + (r.p2.z || 0), r.p2.y - cZ);
          const rdx = r2.x - r1.x;
          const rdz = r2.z - r1.z;
          const rLen = Math.hypot(rdx, rdz);

          const perpX = rLen > 0.05 ? -rdz / rLen : 1;
          const perpZ = rLen > 0.05 ? rdx / rLen : 0;

          const nBays = rLen > 0.35 ? Math.max(1, Math.round(rLen / trussSpacing)) : 0;
          const tStations = nBays === 0 ? [0.5] : Array.from({ length: nBays + 1 }, (_, idx) => idx / nBays);

          tStations.forEach((t) => {
            const rx = r1.x + rdx * t;
            const ry = r1.y + (r2.y - r1.y) * t;
            const rz = r1.z + rdz * t;
            if (ry <= tieY + 0.15) return;

            const dPos = castRayToWallLoop(rx, rz, perpX, perpZ, wallLoopXZ);
            const dNeg = castRayToWallLoop(rx, rz, -perpX, -perpZ, wallLoopXZ);
            if (!dPos || !dNeg) return;

            const wPos = new THREE.Vector3(rx + perpX * dPos, tieY, rz + perpZ * dPos);
            const wNeg = new THREE.Vector3(rx - perpX * dNeg, tieY, rz - perpZ * dNeg);
            const kpFoot = new THREE.Vector3(rx, tieY, rz);
            const kpTop = new THREE.Vector3(rx, ry - 0.04, rz);

            // Horizontal 2x6 Tie Beam spanning wall plate to wall plate
            addTimberBeam(wNeg, wPos, 0.06, 0.13, tieBeamTimberMat);

            // Vertical Kingpost seated directly on the tie beam up to the ridge
            addTimberBeam(kpFoot, kpTop, 0.085, 0.085, kingpostTimberMat);

            // Diagonal Web Struts bracing from kingpost foot up to mid-rafters on both slopes
            const kpRise = ry - tieY;
            if (kpRise > 0.45) {
              const strutStart = new THREE.Vector3(rx, tieY + 0.05, rz);
              const targetPos = new THREE.Vector3(
                rx + perpX * (dPos * 0.5),
                tieY + kpRise * 0.5,
                rz + perpZ * (dPos * 0.5)
              );
              const targetNeg = new THREE.Vector3(
                rx - perpX * (dNeg * 0.5),
                tieY + kpRise * 0.5,
                rz - perpZ * (dNeg * 0.5)
              );
              addTimberBeam(strutStart, targetPos, 0.048, 0.075, kingpostTimberMat);
              addTimberBeam(strutStart, targetNeg, 0.048, 0.075, kingpostTimberMat);
            }
          });
        });

        // Helper: intersect a 3D triangle with a scalar plane (e.g. world-aligned rafter grid or horizontal purlin elevation)
        const sliceTriangleByScalar = (verts, scalars, target) => {
          const hits = [];
          const eps = 1e-5;
          for (let i = 0; i < 3; i++) {
            const j = (i + 1) % 3;
            const a = verts[i];
            const b = verts[j];
            const sa = scalars[i] - target;
            const sb = scalars[j] - target;
            if (Math.abs(sa) <= eps && Math.abs(sb) <= eps) {
              hits.push(a.clone(), b.clone());
            } else if (Math.abs(sa) <= eps) {
              hits.push(a.clone());
            } else if ((sa < 0 && sb > 0) || (sa > 0 && sb < 0)) {
              const frac = sa / (sa - sb);
              hits.push(new THREE.Vector3().lerpVectors(a, b, frac));
            }
          }
          const unique = [];
          for (const pt of hits) {
            if (!unique.some((u) => u.distanceToSquared(pt) < 1e-5)) {
              unique.push(pt);
            }
          }
          if (unique.length < 2) return null;
          if (unique.length === 2) return [unique[0], unique[1]];
          let bestA = unique[0];
          let bestB = unique[1];
          let bestD = bestA.distanceToSquared(bestB);
          for (let i = 0; i < unique.length; i++) {
            for (let j = i + 1; j < unique.length; j++) {
              const d = unique[i].distanceToSquared(unique[j]);
              if (d > bestD) {
                bestD = d;
                bestA = unique[i];
                bestB = unique[j];
              }
            }
          }
          return [bestA, bestB];
        };

        // 4d. True Parallel Common & Jack Rafters + Dead-Level Continuous Purlins
        const rafterSpacing = Math.max(0.65, Math.min(1.5, Number(woodworkConfig?.trussSpacing) || 1.0));
        const purlinSpacing = Math.max(0.35, Math.min(1.2, Number(woodworkConfig?.purlinSpacing) || 0.6));
        const pitchRad = ((geometry?.pitchDegrees || 35) * Math.PI) / 180;
        const purlinStepY = Math.max(0.18, purlinSpacing * Math.max(0.2, Math.sin(pitchRad)));
        const firstPurlinY = polyRoofBaseY + purlinStepY * 0.35;

        polySkeleton?.triangles?.forEach((tri) => {
          const v0 = new THREE.Vector3(tri[0].x - cX, polyRoofBaseY + (tri[0].z || 0), tri[0].y - cZ);
          const v1 = new THREE.Vector3(tri[1].x - cX, polyRoofBaseY + (tri[1].z || 0), tri[1].y - cZ);
          const v2 = new THREE.Vector3(tri[2].x - cX, polyRoofBaseY + (tri[2].z || 0), tri[2].y - cZ);
          const verts = [v0, v1, v2];

          const nFacet = getOutwardRoofNormal(v0, v1, v2);
          const rafterShift = nFacet.clone().multiplyScalar(-0.075);
          const purlinShift = nFacet.clone().multiplyScalar(-0.022);

          // Parallel Rafters: slice triangle perpendicular to the eave on a canonical global grid
          const horizLen = Math.hypot(nFacet.x, nFacet.z);
          if (horizLen > 1e-4) {
            const eaveDir = new THREE.Vector3(-nFacet.z / horizLen, 0, nFacet.x / horizLen);
            if (eaveDir.x < -1e-4 || (Math.abs(eaveDir.x) <= 1e-4 && eaveDir.z < 0)) {
              eaveDir.negate();
            }
            const uVals = [v0.dot(eaveDir), v1.dot(eaveDir), v2.dot(eaveDir)];
            const uMin = Math.min(uVals[0], uVals[1], uVals[2]);
            const uMax = Math.max(uVals[0], uVals[1], uVals[2]);

            const kStart = Math.ceil((uMin + 0.08) / rafterSpacing);
            const kEnd = Math.floor((uMax - 0.08) / rafterSpacing);
            for (let k = kStart; k <= kEnd; k++) {
              const seg = sliceTriangleByScalar(verts, uVals, k * rafterSpacing);
              if (seg && seg[0].distanceTo(seg[1]) > 0.12) {
                addTimberBeam(
                  seg[0].clone().add(rafterShift),
                  seg[1].clone().add(rafterShift),
                  0.048,
                  0.085,
                  rafterTimberMat,
                  nFacet
                );
              }
            }
          }

          // Dead-Level Purlins: slice triangle on shared global horizontal elevation planes
          const yVals = [v0.y, v1.y, v2.y];
          const yMin = Math.min(yVals[0], yVals[1], yVals[2]);
          const yMax = Math.max(yVals[0], yVals[1], yVals[2]);
          const pStart = Math.max(0, Math.ceil((yMin + 0.05 - firstPurlinY) / purlinStepY));
          const pEnd = Math.floor((yMax - 0.06 - firstPurlinY) / purlinStepY);

          for (let pk = pStart; pk <= pEnd; pk++) {
            const targetY = firstPurlinY + pk * purlinStepY;
            const seg = sliceTriangleByScalar(verts, yVals, targetY);
            if (seg && seg[0].distanceTo(seg[1]) > 0.1) {
              addTimberBeam(
                seg[0].clone().add(purlinShift),
                seg[1].clone().add(purlinShift),
                0.048,
                0.036,
                purlinTimberMat,
                nFacet
              );
            }
          }
        });
      }

      const polyWallInset =
        isParapetActive && parapetConfig?.includedInSketch && polyInnerWallPts !== pts
          ? Math.min(pProj, 0.45)
          : 0;
      const polyEaveToWallGap = Math.max(0, avgOvVal) + polyWallInset;
      renderWaterCollector3D(polyRoofBaseY, L, B, true, () => polyEaveToWallGap, {
        wallPts: polyInnerWallPts,
        cX,
        cZ,
      });

      return; // Early return for custom polygon
    }

    // 1. Compute Overhang / Roof Outer Bounds First
    const ovRaw = geometry?.buildingDimensions?.overhang || 0.4;
    const ov = typeof ovRaw === 'object' && ovRaw !== null ? {
      front: Math.max(0, Number(ovRaw.front) || 0),
      back: Math.max(0, Number(ovRaw.back) || 0),
      left: Math.max(0, Number(ovRaw.left) || 0),
      right: Math.max(0, Number(ovRaw.right) || 0),
    } : {
      front: Number(ovRaw) || 0.4,
      back: Number(ovRaw) || 0.4,
      left: Number(ovRaw) || 0.4,
      right: Number(ovRaw) || 0.4,
    };

    const xMin = -halfL - ov.left;
    const xMax = halfL + ov.right;
    const zFront = halfB + ov.front;
    const zBack = -halfB - ov.back;
    const effL = xMax - xMin;
    const effB = zFront - zBack;
    const roofCenterX = (xMin + xMax) / 2;

    // House Walls Box (inset underneath outward parapet if sketch already includes parapet)
    const rectInset =
      isParapetActive && parapetConfig?.includedInSketch
        ? Math.min(pProj, L * 0.25, B * 0.25)
        : 0;
    const rectWallL = Math.max(0.5, L - 2 * rectInset);
    const rectWallB = Math.max(0.5, B - 2 * rectInset);
    const rectWallH =
      isParapetActive && parapetConfig?.includedInSketch
        ? Math.max(1.2, wallHeight - corniceH)
        : wallHeight;

    const wallGeom = new THREE.BoxGeometry(rectWallL, rectWallH, rectWallB);
    const wallMesh = new THREE.Mesh(wallGeom, wallMaterial);
    wallMesh.position.y = rectWallH / 2;
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    modelGroup.add(wallMesh);

    // Base slab
    const slabGeom = new THREE.BoxGeometry(rectWallL + 0.6, 0.2, rectWallB + 0.6);
    const slabMesh = new THREE.Mesh(slabGeom, new THREE.MeshStandardMaterial({ color: 0x1e293b }));
    slabMesh.position.y = 0.1;
    modelGroup.add(slabMesh);

    // ==========================================
    // 3D OUTWARD CONCRETE PARAPET CORNICE (STAGE 2)
    // Extends horizontally outward from the wall top; roof rests flush on top at wallHeight.
    // ==========================================
    if (isParapetActive) {
      const innerHalfL = halfL - rectInset;
      const innerHalfB = halfB - rectInset;
      const rectInnerLoop = [
        { x: -innerHalfL, y: -innerHalfB },
        { x: innerHalfL, y: -innerHalfB },
        { x: innerHalfL, y: innerHalfB },
        { x: -innerHalfL, y: innerHalfB },
      ];
      const rectOuterLoop = parapetConfig?.includedInSketch
        ? [
            { x: -halfL, y: -halfB },
            { x: halfL, y: -halfB },
            { x: halfL, y: halfB },
            { x: -halfL, y: halfB },
          ]
        : [
            { x: Math.min(xMin, -halfL - (ov.left > 0.02 ? ov.left : pProj)), y: Math.min(zBack, -halfB - (ov.back > 0.02 ? ov.back : pProj)) },
            { x: Math.max(xMax, halfL + (ov.right > 0.02 ? ov.right : pProj)), y: Math.min(zBack, -halfB - (ov.back > 0.02 ? ov.back : pProj)) },
            { x: Math.max(xMax, halfL + (ov.right > 0.02 ? ov.right : pProj)), y: Math.max(zFront, halfB + (ov.front > 0.02 ? ov.front : pProj)) },
            { x: Math.min(xMin, -halfL - (ov.left > 0.02 ? ov.left : pProj)), y: Math.max(zFront, halfB + (ov.front > 0.02 ? ov.front : pProj)) },
          ];

      addOutwardParapetCornice(rectInnerLoop, rectOuterLoop, roofBaseY, corniceH, 0, 0);
    }

    // ==========================================
    // 3D TIMBER CARCASS SKELETON (STAGE 3)
    // ==========================================
    if (isWoodworkActive) {
      const trussSpacing = Math.max(0.8, Number(woodworkConfig?.trussSpacing) || 1.2);
      const purlinSpacing = Math.max(0.25, Number(woodworkConfig?.purlinSpacing) || 0.6);
      const rafterSpacing = Math.max(0.55, trussSpacing * 0.5);

      const sheetClearance = 0.008;
      const purlinThick = 0.04;
      const purlinWidth = 0.05;
      const rafterDepth = 0.075;
      const rafterWidth = 0.045;
      const hipDepth = 0.085;
      const hipWidth = 0.055;

      const purlinOffset = sheetClearance + purlinThick / 2;
      const rafterOffset = sheetClearance + purlinThick + rafterDepth / 2;

      const minOv = Math.min(ov.front, ov.back, ov.left, ov.right);
      const plateY = minOv < 0.1 ? roofBaseY - 0.02 : roofBaseY + 0.02;

      // Perimeter 2x4 Wall Plates along top of masonry walls
      addTimberBeam(
        new THREE.Vector3(-halfL + 0.04, plateY, halfB - 0.07),
        new THREE.Vector3(halfL - 0.04, plateY, halfB - 0.07),
        0.09, 0.045, rafterTimberMat
      );
      addTimberBeam(
        new THREE.Vector3(-halfL + 0.04, plateY, -halfB + 0.07),
        new THREE.Vector3(halfL - 0.04, plateY, -halfB + 0.07),
        0.09, 0.045, rafterTimberMat
      );
      if (roofType === 'hip') {
        addTimberBeam(
          new THREE.Vector3(-halfL + 0.07, plateY, -halfB + 0.08),
          new THREE.Vector3(-halfL + 0.07, plateY, halfB - 0.08),
          0.09, 0.045, rafterTimberMat
        );
        addTimberBeam(
          new THREE.Vector3(halfL - 0.07, plateY, -halfB + 0.08),
          new THREE.Vector3(halfL - 0.07, plateY, halfB - 0.08),
          0.09, 0.045, rafterTimberMat
        );
      }

      if (roofType === 'hip' || roofType === 'gable') {
        const peakY = roofBaseY + H;
        const isHip = roofType === 'hip';
        const ridgeLen = isHip ? Math.max(0, effL - effB) : effL;
        const halfRidge = ridgeLen / 2;
        const r1X = isHip ? roofCenterX - halfRidge : xMin;
        const r2X = isHip ? roofCenterX + halfRidge : xMax;

        const C1 = new THREE.Vector3(xMin, roofBaseY, zFront);
        const C2 = new THREE.Vector3(xMax, roofBaseY, zFront);
        const C3 = new THREE.Vector3(xMax, roofBaseY, zBack);
        const C4 = new THREE.Vector3(xMin, roofBaseY, zBack);
        const R1 = new THREE.Vector3(r1X, peakY, 0);
        const R2 = new THREE.Vector3(r2X, peakY, 0);

        const nFront = getOutwardRoofNormal(C1, C2, R2);
        const nBack = getOutwardRoofNormal(C3, C4, R1);
        const shiftFrontRafter = nFront.clone().multiplyScalar(-rafterOffset);
        const shiftBackRafter = nBack.clone().multiplyScalar(-rafterOffset);
        const shiftFrontPurlin = nFront.clone().multiplyScalar(-purlinOffset);
        const shiftBackPurlin = nBack.clone().multiplyScalar(-purlinOffset);

        // 1. Ridge Board (2x6)
        if (ridgeLen > 0.08) {
          addTimberBeam(
            new THREE.Vector3(r1X + 0.03, peakY - 0.10, 0),
            new THREE.Vector3(r2X - 0.03, peakY - 0.10, 0),
            0.045, 0.11, rafterTimberMat
          );
        }

        // 2. Internal Trusses (Tie Beams, King Posts & Diagonal Web Struts)
        const tieY = roofBaseY + 0.035;
        const clearH = Math.min(H * 0.45, 0.21);
        const uTie = Math.max(0.15, 1 - clearH / H);
        const xTieMin = r1X * (1 - uTie) + xMin * uTie;
        const xTieMax = r2X * (1 - uTie) + xMax * uTie;
        const zTieFront = zFront * uTie;
        const zTieBack = zBack * uTie;

        const nTrussSpans = Math.max(2, Math.round(L / trussSpacing));
        const trussStep = L / nTrussSpans;
        for (let i = 0; i <= nTrussSpans; i++) {
          const tx = -halfL + i * trussStep;
          if (isHip && (tx <= xTieMin + 0.15 || tx >= xTieMax - 0.15)) continue;

          // Tie Beam tucked cleanly within sloped rafter heels
          addTimberBeam(
            new THREE.Vector3(tx, tieY, zTieBack),
            new THREE.Vector3(tx, tieY, zTieFront),
            0.05, 0.10, rafterTimberMat
          );

          // Centerline roof height at tx
          let apexAtTx = peakY;
          if (isHip && tx < r1X) {
            apexAtTx = roofBaseY + H * ((tx - xMin) / Math.max(0.01, r1X - xMin));
          } else if (isHip && tx > r2X) {
            apexAtTx = roofBaseY + H * ((xMax - tx) / Math.max(0.01, xMax - r2X));
          }

          // Vertical King Post
          if (apexAtTx - 0.13 > tieY + 0.08) {
            addTimberBeam(
              new THREE.Vector3(tx, tieY + 0.04, 0),
              new THREE.Vector3(tx, apexAtTx - 0.13, 0),
              0.06, 0.06, rafterTimberMat
            );
          }

          // Diagonal King-Post Truss Web Struts in full/near-full height zone
          const tMid = 0.48;
          const xLeftMid = r1X * (1 - tMid) + xMin * tMid;
          const xRightMid = r2X * (1 - tMid) + xMax * tMid;
          if (tx >= xLeftMid + 0.12 && tx <= xRightMid - 0.12 && H >= 0.9) {
            const strutTopY = peakY * (1 - tMid) + roofBaseY * tMid - 0.12;
            if (strutTopY > tieY + 0.15) {
              addTimberBeam(
                new THREE.Vector3(tx, tieY + 0.05, 0),
                new THREE.Vector3(tx, strutTopY, zFront * tMid),
                0.045, 0.065, rafterTimberMat
              );
              addTimberBeam(
                new THREE.Vector3(tx, tieY + 0.05, 0),
                new THREE.Vector3(tx, strutTopY, zBack * tMid),
                0.045, 0.065, rafterTimberMat
              );
            }
          }
        }

        // 3. Common Rafters & Hip Jack Rafters along Front & Back Slopes
        const nRafterSpans = Math.max(3, Math.round(effL / rafterSpacing));
        const rStep = effL / nRafterSpans;
        for (let i = 0; i <= nRafterSpans; i++) {
          const rx = xMin + i * rStep;
          if (isHip && (rx <= xMin + 0.18 || rx >= xMax - 0.18)) continue;
          const clampedX = Math.max(xMin + 0.04, Math.min(xMax - 0.04, rx));

          let tTop = 0;
          if (isHip && clampedX < r1X) {
            tTop = (r1X - clampedX) / Math.max(0.01, r1X - xMin);
          } else if (isHip && clampedX > r2X) {
            tTop = (clampedX - r2X) / Math.max(0.01, xMax - r2X);
          }
          if (tTop >= 0.92) continue;

          const tBot = 0.985;
          const yTop = peakY * (1 - tTop) + roofBaseY * tTop;
          const yBot = peakY * (1 - tBot) + roofBaseY * tBot;

          // Front Common / Jack Rafter
          addTimberBeam(
            new THREE.Vector3(clampedX, yTop, zFront * tTop).add(shiftFrontRafter),
            new THREE.Vector3(clampedX, yBot, zFront * tBot).add(shiftFrontRafter),
            rafterWidth, rafterDepth, rafterTimberMat, nFront
          );

          // Back Common / Jack Rafter
          addTimberBeam(
            new THREE.Vector3(clampedX, yTop, zBack * tTop).add(shiftBackRafter),
            new THREE.Vector3(clampedX, yBot, zBack * tBot).add(shiftBackRafter),
            rafterWidth, rafterDepth, rafterTimberMat, nBack
          );
        }

        // 4. Hip-Specific Framing: 4 Hip Rafters + Left/Right Crown & End Jack Rafters
        let nLeft = null;
        let nRight = null;
        if (isHip) {
          nLeft = getOutwardRoofNormal(C4, C1, R1);
          nRight = getOutwardRoofNormal(C2, C3, R2);
          const shiftLeftRafter = nLeft.clone().multiplyScalar(-rafterOffset);
          const shiftRightRafter = nRight.clone().multiplyScalar(-rafterOffset);

          // 4 Main Diagonal Hip Rafters (2x6)
          const hipPairs = [
            { apex: R1, corner: C1, nA: nFront, nB: nLeft },
            { apex: R2, corner: C2, nA: nFront, nB: nRight },
            { apex: R2, corner: C3, nA: nBack, nB: nRight },
            { apex: R1, corner: C4, nA: nBack, nB: nLeft },
          ];
          hipPairs.forEach(({ apex, corner, nA, nB }) => {
            const bisec = nA.clone().add(nB).normalize();
            const depthScale = (sheetClearance + purlinThick + hipDepth / 2) / Math.max(0.7, bisec.dot(nA));
            const hipShift = bisec.clone().multiplyScalar(-depthScale);
            addTimberBeam(
              apex.clone().add(hipShift),
              apex.clone().lerp(corner, 0.985).add(hipShift),
              hipWidth, hipDepth, rafterTimberMat, bisec
            );
          });

          // End Crown Rafter (z=0) & End Hip Jack Rafters on Left & Right Hip Triangles
          const endZCoords = [0];
          for (let z = rafterSpacing; z < zFront - 0.18; z += rafterSpacing) endZCoords.push(z);
          for (let z = -rafterSpacing; z > zBack + 0.18; z -= rafterSpacing) endZCoords.push(z);

          endZCoords.forEach((rz) => {
            const tTop = rz >= 0
              ? rz / Math.max(0.01, zFront)
              : rz / Math.min(-0.01, zBack);
            if (tTop >= 0.92) return;
            const tBot = 0.985;
            const yTop = peakY * (1 - tTop) + roofBaseY * tTop;
            const yBot = peakY * (1 - tBot) + roofBaseY * tBot;

            // Left Hip End Rafter
            const xTopL = r1X * (1 - tTop) + xMin * tTop;
            const xBotL = r1X * (1 - tBot) + xMin * tBot;
            addTimberBeam(
              new THREE.Vector3(xTopL, yTop, rz).add(shiftLeftRafter),
              new THREE.Vector3(xBotL, yBot, rz).add(shiftLeftRafter),
              rafterWidth, rafterDepth, rafterTimberMat, nLeft
            );

            // Right Hip End Rafter
            const xTopR = r2X * (1 - tTop) + xMax * tTop;
            const xBotR = r2X * (1 - tBot) + xMax * tBot;
            addTimberBeam(
              new THREE.Vector3(xTopR, yTop, rz).add(shiftRightRafter),
              new THREE.Vector3(xBotR, yBot, rz).add(shiftRightRafter),
              rafterWidth, rafterDepth, rafterTimberMat, nRight
            );
          });
        }

        // 5. Horizontal Roof Purlins / Battens (2x3) across all slopes
        const frontSlopeLen = Math.sqrt(zFront * zFront + H * H);
        const purlinRows = Math.max(2, Math.round(frontSlopeLen / purlinSpacing));
        const shiftLeftPurlin = isHip ? nLeft.clone().multiplyScalar(-purlinOffset) : null;
        const shiftRightPurlin = isHip ? nRight.clone().multiplyScalar(-purlinOffset) : null;

        for (let pr = 1; pr <= purlinRows; pr++) {
          const t = Math.min(0.95, (pr - 0.35) / purlinRows);
          const yP = peakY * (1 - t) + roofBaseY * t;
          const xL = isHip ? (r1X * (1 - t) + xMin * t) : (xMin + 0.02);
          const xR = isHip ? (r2X * (1 - t) + xMax * t) : (xMax - 0.02);
          const zF = zFront * t;
          const zB = zBack * t;

          addTimberBeam(
            new THREE.Vector3(xL, yP, zF).add(shiftFrontPurlin),
            new THREE.Vector3(xR, yP, zF).add(shiftFrontPurlin),
            purlinWidth, purlinThick, purlinTimberMat, nFront
          );
          addTimberBeam(
            new THREE.Vector3(xL, yP, zB).add(shiftBackPurlin),
            new THREE.Vector3(xR, yP, zB).add(shiftBackPurlin),
            purlinWidth, purlinThick, purlinTimberMat, nBack
          );

          if (isHip) {
            addTimberBeam(
              new THREE.Vector3(xL, yP, zB).add(shiftLeftPurlin),
              new THREE.Vector3(xL, yP, zF).add(shiftLeftPurlin),
              purlinWidth, purlinThick, purlinTimberMat, nLeft
            );
            addTimberBeam(
              new THREE.Vector3(xR, yP, zB).add(shiftRightPurlin),
              new THREE.Vector3(xR, yP, zF).add(shiftRightPurlin),
              purlinWidth, purlinThick, purlinTimberMat, nRight
            );
          }
        }

      } else if (roofType === 'shed') {
        const highY = roofBaseY + H;
        const lowY = roofBaseY;
        const nShed = getOutwardRoofNormal(
          new THREE.Vector3(xMin, lowY, zFront),
          new THREE.Vector3(xMax, lowY, zFront),
          new THREE.Vector3(xMax, highY, zBack)
        );
        const shiftRafter = nShed.clone().multiplyScalar(-rafterOffset);
        const shiftPurlin = nShed.clone().multiplyScalar(-purlinOffset);

        // High rear wall plate
        addTimberBeam(
          new THREE.Vector3(-halfL + 0.04, highY - 0.11, -halfB + 0.07),
          new THREE.Vector3(halfL - 0.04, highY - 0.11, -halfB + 0.07),
          0.09, 0.045, rafterTimberMat
        );

        // Mono-pitch trusses
        const tieY = roofBaseY + 0.035;
        const uTie = Math.max(0.2, 1 - Math.min(H * 0.45, 0.21) / H);
        const zTieFront = zBack * (1 - uTie) + zFront * uTie;
        const nTrussSpans = Math.max(2, Math.round(L / trussSpacing));
        const trussStep = L / nTrussSpans;

        for (let i = 0; i <= nTrussSpans; i++) {
          const tx = -halfL + i * trussStep;
          addTimberBeam(
            new THREE.Vector3(tx, tieY, -halfB + 0.06),
            new THREE.Vector3(tx, tieY, Math.min(halfB - 0.06, zTieFront)),
            0.05, 0.10, rafterTimberMat
          );
          const tRear = (-halfB + 0.08 - zBack) / Math.max(0.1, effB);
          const yRearTop = highY * (1 - tRear) + lowY * tRear - 0.13;
          if (yRearTop > tieY + 0.08) {
            addTimberBeam(
              new THREE.Vector3(tx, tieY + 0.04, -halfB + 0.08),
              new THREE.Vector3(tx, yRearTop, -halfB + 0.08),
              0.06, 0.06, rafterTimberMat
            );
          }
          const tMid = (0 - zBack) / Math.max(0.1, effB);
          const yMidTop = highY * (1 - tMid) + lowY * tMid - 0.13;
          if (yMidTop > tieY + 0.12) {
            addTimberBeam(
              new THREE.Vector3(tx, tieY + 0.04, 0),
              new THREE.Vector3(tx, yMidTop, 0),
              0.055, 0.055, rafterTimberMat
            );
            addTimberBeam(
              new THREE.Vector3(tx, tieY + 0.05, 0),
              new THREE.Vector3(tx, yRearTop, -halfB + 0.08),
              0.045, 0.06, rafterTimberMat
            );
          }
        }

        // Mono-pitch rafters
        const nRafterSpans = Math.max(3, Math.round(effL / rafterSpacing));
        const rStep = effL / nRafterSpans;
        for (let i = 0; i <= nRafterSpans; i++) {
          const rx = Math.max(xMin + 0.04, Math.min(xMax - 0.04, xMin + i * rStep));
          const pTop = new THREE.Vector3(rx, highY * 0.985 + lowY * 0.015, zBack * 0.985 + zFront * 0.015).add(shiftRafter);
          const pBot = new THREE.Vector3(rx, highY * 0.015 + lowY * 0.985, zBack * 0.015 + zFront * 0.985).add(shiftRafter);
          addTimberBeam(pTop, pBot, rafterWidth, rafterDepth, rafterTimberMat, nShed);
        }

        // Shed purlins
        const shedSlopeLen = Math.sqrt(effB * effB + H * H);
        const purlinRows = Math.max(2, Math.round(shedSlopeLen / purlinSpacing));
        for (let pr = 1; pr <= purlinRows; pr++) {
          const t = Math.min(0.96, (pr - 0.4) / purlinRows);
          const yP = highY * (1 - t) + lowY * t;
          const zP = zBack * (1 - t) + zFront * t;
          addTimberBeam(
            new THREE.Vector3(xMin + 0.02, yP, zP).add(shiftPurlin),
            new THREE.Vector3(xMax - 0.02, yP, zP).add(shiftPurlin),
            purlinWidth, purlinThick, purlinTimberMat, nShed
          );
        }

      } else if (roofType === 'flat') {
        // Flat Roof Timber Joists & Cross Battens
        const nJoists = Math.max(3, Math.ceil(effL / trussSpacing));
        const jStep = effL / nJoists;
        const upVec = new THREE.Vector3(0, 1, 0);
        for (let i = 0; i <= nJoists; i++) {
          const jx = xMin + i * jStep;
          addTimberBeam(
            new THREE.Vector3(jx, roofBaseY + 0.02, zBack + 0.05),
            new THREE.Vector3(jx, roofBaseY + 0.02, zFront - 0.05),
            rafterWidth, rafterDepth, rafterTimberMat, upVec
          );
        }
        const nBattens = Math.max(3, Math.round(effB / purlinSpacing));
        for (let b = 0; b <= nBattens; b++) {
          const bz = zBack + (effB * b) / nBattens;
          addTimberBeam(
            new THREE.Vector3(xMin + 0.04, roofBaseY + 0.09, bz),
            new THREE.Vector3(xMax - 0.04, roofBaseY + 0.09, bz),
            purlinWidth, purlinThick, purlinTimberMat, upVec
          );
        }

      } else if (roofType === 'gambrel') {
        const breakY = roofBaseY + H * 0.65;
        const peakY = roofBaseY + H;
        const breakZ = halfB * 0.55;

        const nLF = getOutwardRoofNormal(
          new THREE.Vector3(xMin, roofBaseY, zFront),
          new THREE.Vector3(xMax, roofBaseY, zFront),
          new THREE.Vector3(xMax, breakY, breakZ)
        );
        const nUF = getOutwardRoofNormal(
          new THREE.Vector3(xMin, breakY, breakZ),
          new THREE.Vector3(xMax, breakY, breakZ),
          new THREE.Vector3(xMax, peakY, 0)
        );
        const nUB = getOutwardRoofNormal(
          new THREE.Vector3(xMax, breakY, -breakZ),
          new THREE.Vector3(xMin, breakY, -breakZ),
          new THREE.Vector3(xMin, peakY, 0)
        );
        const nLB = getOutwardRoofNormal(
          new THREE.Vector3(xMax, roofBaseY, zBack),
          new THREE.Vector3(xMin, roofBaseY, zBack),
          new THREE.Vector3(xMin, breakY, -breakZ)
        );

        // Ridge board & knuckle purlin beams
        addTimberBeam(
          new THREE.Vector3(xMin + 0.03, peakY - 0.10, 0),
          new THREE.Vector3(xMax - 0.03, peakY - 0.10, 0),
          0.045, 0.10, rafterTimberMat
        );
        addTimberBeam(
          new THREE.Vector3(xMin + 0.03, breakY - 0.10, breakZ - 0.05),
          new THREE.Vector3(xMax - 0.03, breakY - 0.10, breakZ - 0.05),
          0.06, 0.08, rafterTimberMat
        );
        addTimberBeam(
          new THREE.Vector3(xMin + 0.03, breakY - 0.10, -breakZ + 0.05),
          new THREE.Vector3(xMax - 0.03, breakY - 0.10, -breakZ + 0.05),
          0.06, 0.08, rafterTimberMat
        );

        // Gambrel queen-post trusses
        const tieY = roofBaseY + 0.035;
        const nTrussSpans = Math.max(2, Math.round(L / trussSpacing));
        const trussStep = L / nTrussSpans;
        for (let i = 0; i <= nTrussSpans; i++) {
          const tx = -halfL + i * trussStep;
          addTimberBeam(
            new THREE.Vector3(tx, tieY, -halfB + 0.08),
            new THREE.Vector3(tx, tieY, halfB - 0.08),
            0.05, 0.10, rafterTimberMat
          );
          // Queen posts & collar tie
          const collarY = breakY - 0.12;
          if (collarY > tieY + 0.1) {
            addTimberBeam(new THREE.Vector3(tx, tieY + 0.04, breakZ - 0.06), new THREE.Vector3(tx, collarY, breakZ - 0.06), 0.055, 0.055, rafterTimberMat);
            addTimberBeam(new THREE.Vector3(tx, tieY + 0.04, -breakZ + 0.06), new THREE.Vector3(tx, collarY, -breakZ + 0.06), 0.055, 0.055, rafterTimberMat);
            addTimberBeam(new THREE.Vector3(tx, collarY, -breakZ + 0.06), new THREE.Vector3(tx, collarY, breakZ - 0.06), 0.05, 0.08, rafterTimberMat);
            if (peakY - 0.13 > collarY + 0.06) {
              addTimberBeam(new THREE.Vector3(tx, collarY + 0.03, 0), new THREE.Vector3(tx, peakY - 0.13, 0), 0.055, 0.055, rafterTimberMat);
            }
          }
        }

        // Gambrel upper & lower rafters
        const nRafterSpans = Math.max(3, Math.round(effL / rafterSpacing));
        const rStep = effL / nRafterSpans;
        for (let i = 0; i <= nRafterSpans; i++) {
          const rx = Math.max(xMin + 0.04, Math.min(xMax - 0.04, xMin + i * rStep));
          addTimberBeam(
            new THREE.Vector3(rx, peakY, 0).addScaledVector(nUF, -rafterOffset),
            new THREE.Vector3(rx, breakY, breakZ).addScaledVector(nUF, -rafterOffset),
            rafterWidth, rafterDepth, rafterTimberMat, nUF
          );
          addTimberBeam(
            new THREE.Vector3(rx, breakY, breakZ).addScaledVector(nLF, -rafterOffset),
            new THREE.Vector3(rx, roofBaseY * 0.98 + breakY * 0.02, zFront * 0.98 + breakZ * 0.02).addScaledVector(nLF, -rafterOffset),
            rafterWidth, rafterDepth, rafterTimberMat, nLF
          );
          addTimberBeam(
            new THREE.Vector3(rx, peakY, 0).addScaledVector(nUB, -rafterOffset),
            new THREE.Vector3(rx, breakY, -breakZ).addScaledVector(nUB, -rafterOffset),
            rafterWidth, rafterDepth, rafterTimberMat, nUB
          );
          addTimberBeam(
            new THREE.Vector3(rx, breakY, -breakZ).addScaledVector(nLB, -rafterOffset),
            new THREE.Vector3(rx, roofBaseY * 0.98 + breakY * 0.02, zBack * 0.98 - breakZ * 0.02).addScaledVector(nLB, -rafterOffset),
            rafterWidth, rafterDepth, rafterTimberMat, nLB
          );
        }

        // Gambrel purlins across all 4 slopes
        const addSlopePurlins = (y1, z1, y2, z2, nVec) => {
          const sLen = Math.hypot(z2 - z1, y2 - y1);
          const rows = Math.max(2, Math.round(sLen / purlinSpacing));
          for (let pr = 1; pr <= rows; pr++) {
            const t = Math.min(0.92, (pr - 0.35) / rows);
            const yP = y1 * (1 - t) + y2 * t;
            const zP = z1 * (1 - t) + z2 * t;
            addTimberBeam(
              new THREE.Vector3(xMin + 0.02, yP, zP).addScaledVector(nVec, -purlinOffset),
              new THREE.Vector3(xMax - 0.02, yP, zP).addScaledVector(nVec, -purlinOffset),
              purlinWidth, purlinThick, purlinTimberMat, nVec
            );
          }
        };
        addSlopePurlins(peakY, 0, breakY, breakZ, nUF);
        addSlopePurlins(breakY, breakZ, roofBaseY, zFront, nLF);
        addSlopePurlins(peakY, 0, breakY, -breakZ, nUB);
        addSlopePurlins(breakY, -breakZ, roofBaseY, zBack, nLB);
      }
    }

    // Render Porch Support Columns / Verandah Posts if Front Overhang >= 1.0m
    if (ov.front >= 1.0) {
      const postGeom = new THREE.CylinderGeometry(0.08, 0.08, roofBaseY, 12);
      const postMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.4, metalness: 0.2 });

      // Left porch post
      const postL = new THREE.Mesh(postGeom, postMat);
      postL.position.set(-halfL + 0.3, roofBaseY / 2, zFront - 0.2);
      postL.castShadow = true;
      modelGroup.add(postL);

      // Right porch post
      const postR = new THREE.Mesh(postGeom, postMat);
      postR.position.set(halfL - 0.3, roofBaseY / 2, zFront - 0.2);
      postR.castShadow = true;
      modelGroup.add(postR);

      // Optional center post for wide buildings
      if (L >= 12) {
        const postC = new THREE.Mesh(postGeom, postMat);
        postC.position.set(0, roofBaseY / 2, zFront - 0.2);
        postC.castShadow = true;
        modelGroup.add(postC);
      }

      // Extended porch deck floor
      const deckGeom = new THREE.BoxGeometry(L + 0.4, 0.15, ov.front);
      const deckMesh = new THREE.Mesh(deckGeom, new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 }));
      deckMesh.position.set(0, 0.08, halfB + ov.front / 2);
      deckMesh.receiveShadow = true;
      modelGroup.add(deckMesh);
    }

    // Render Carport Posts if Left Overhang >= 1.5m
    if (ov.left >= 1.5) {
      const postGeom = new THREE.CylinderGeometry(0.08, 0.08, roofBaseY, 12);
      const postMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.4 });
      const postC1 = new THREE.Mesh(postGeom, postMat);
      postC1.position.set(xMin + 0.2, roofBaseY / 2, -halfB + 0.4);
      modelGroup.add(postC1);
      const postC2 = new THREE.Mesh(postGeom, postMat);
      postC2.position.set(xMin + 0.2, roofBaseY / 2, halfB - 0.4);
      modelGroup.add(postC2);
    }

    if (roofType === 'gable') {
      // Gable Roof: 2 sloping planes + 2 triangular gable end walls
      const peakY = roofBaseY + H;

      // Front slope quad: xMin to xMax along X, roofBaseY at zFront, peaking at Y=peakY, Z=0
      const slopeGeom1 = new THREE.BufferGeometry();
      const vertices1 = new Float32Array([
        xMin, roofBaseY, zFront,
        xMax, roofBaseY, zFront,
        xMax, peakY, 0,

        xMin, roofBaseY, zFront,
        xMax, peakY, 0,
        xMin, peakY, 0,
      ]);
      slopeGeom1.setAttribute('position', new THREE.BufferAttribute(vertices1, 3));
      applySlopeUVs(slopeGeom1, 0.5);
      slopeGeom1.computeVertexNormals();
      const slopeMesh1 = new THREE.Mesh(slopeGeom1, roofMaterial);
      slopeMesh1.castShadow = true;
      slopeMesh1.receiveShadow = true;

      // Back slope quad: xMax to xMin along X, roofBaseY at zBack, peaking at Y=peakY, Z=0
      const slopeGeom2 = new THREE.BufferGeometry();
      const vertices2 = new Float32Array([
        xMax, roofBaseY, zBack,
        xMin, roofBaseY, zBack,
        xMin, peakY, 0,

        xMax, roofBaseY, zBack,
        xMin, peakY, 0,
        xMax, peakY, 0,
      ]);
      slopeGeom2.setAttribute('position', new THREE.BufferAttribute(vertices2, 3));
      applySlopeUVs(slopeGeom2, 0.5);
      slopeGeom2.computeVertexNormals();
      const slopeMesh2 = new THREE.Mesh(slopeGeom2, roofMaterial);
      slopeMesh2.castShadow = true;
      slopeMesh2.receiveShadow = true;

      if (isCoveringActive) {
        modelGroup.add(slopeMesh1);
        modelGroup.add(slopeMesh2);
      }

      // Gable triangular end walls (at x = -halfL and x = halfL)
      const gableGeomL = new THREE.BufferGeometry();
      gableGeomL.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
        -halfL, roofBaseY, -halfB,
        -halfL, roofBaseY, halfB,
        -halfL, peakY, 0,
      ]), 3));
      gableGeomL.computeVertexNormals();
      modelGroup.add(new THREE.Mesh(gableGeomL, gableInfillMaterial));

      const gableGeomR = new THREE.BufferGeometry();
      gableGeomR.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
        halfL, roofBaseY, halfB,
        halfL, roofBaseY, -halfB,
        halfL, peakY, 0,
      ]), 3));
      gableGeomR.computeVertexNormals();
      modelGroup.add(new THREE.Mesh(gableGeomR, gableInfillMaterial));

      // Ridge Beam line spanning full effective length
      const ridgeBeam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, effL, 8),
        activeCapMaterial
      );
      ridgeBeam.rotation.z = Math.PI / 2;
      ridgeBeam.position.set(roofCenterX, peakY + 0.03, 0);
      modelGroup.add(ridgeBeam);

      // Eave Gutter tubes
      const gutter1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, effL, 8), gutterMaterial);
      gutter1.rotation.z = Math.PI / 2;
      gutter1.position.set(roofCenterX, roofBaseY, zFront + 0.05);
      modelGroup.add(gutter1);

      const gutter2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, effL, 8), gutterMaterial);
      gutter2.rotation.z = Math.PI / 2;
      gutter2.position.set(roofCenterX, roofBaseY, zBack - 0.05);
      modelGroup.add(gutter2);

    } else if (roofType === 'hip') {
      // Hip Roof: 2 trapezoids + 2 triangles + central ridge
      const peakY = roofBaseY + H;
      const ridgeLen = Math.max(0, effL - effB);
      const halfRidge = ridgeLen / 2;

      // 4 Eave corners with asymmetric overhangs:
      // C1: (xMin, roofBaseY, zFront) Front-Left
      // C2: (xMax, roofBaseY, zFront) Front-Right
      // C3: (xMax, roofBaseY, zBack)  Back-Right
      // C4: (xMin, roofBaseY, zBack)  Back-Left
      // 2 Ridge endpoints:
      // R1: (roofCenterX - halfRidge, peakY, 0)
      // R2: (roofCenterX + halfRidge, peakY, 0)
      const r1X = roofCenterX - halfRidge;
      const r2X = roofCenterX + halfRidge;

      // Front Trapezoid (C1, C2, R2, R1)
      const frontGeom = new THREE.BufferGeometry();
      frontGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
        xMin, roofBaseY, zFront,
        xMax, roofBaseY, zFront,
        r2X, peakY, 0,

        xMin, roofBaseY, zFront,
        r2X, peakY, 0,
        r1X, peakY, 0,
      ]), 3));
      applySlopeUVs(frontGeom, 0.5);
      frontGeom.computeVertexNormals();

      // Back Trapezoid (C3, C4, R1, R2)
      const backGeom = new THREE.BufferGeometry();
      backGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
        xMax, roofBaseY, zBack,
        xMin, roofBaseY, zBack,
        r1X, peakY, 0,

        xMax, roofBaseY, zBack,
        r1X, peakY, 0,
        r2X, peakY, 0,
      ]), 3));
      applySlopeUVs(backGeom, 0.5);
      backGeom.computeVertexNormals();

      // Left Hip Triangle (C4, C1, R1)
      const leftGeom = new THREE.BufferGeometry();
      leftGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
        xMin, roofBaseY, zBack,
        xMin, roofBaseY, zFront,
        r1X, peakY, 0,
      ]), 3));
      applySlopeUVs(leftGeom, 0.5);
      leftGeom.computeVertexNormals();

      // Right Hip Triangle (C2, C3, R2)
      const rightGeom = new THREE.BufferGeometry();
      rightGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
        xMax, roofBaseY, zFront,
        xMax, roofBaseY, zBack,
        r2X, peakY, 0,
      ]), 3));
      applySlopeUVs(rightGeom, 0.5);
      rightGeom.computeVertexNormals();

      if (isCoveringActive) {
        [frontGeom, backGeom, leftGeom, rightGeom].forEach((fg) => {
          const fm = new THREE.Mesh(fg, roofMaterial);
          fm.castShadow = true;
          fm.receiveShadow = true;
          modelGroup.add(fm);
        });
      }

      // Central Ridge Cap & 4 Hip Ridge Caps
      if (ridgeLen > 0.05) {
        const ridgeBeam = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.06, ridgeLen, 8),
          activeCapMaterial
        );
        ridgeBeam.rotation.z = Math.PI / 2;
        ridgeBeam.position.set(roofCenterX, peakY + 0.03, 0);
        modelGroup.add(ridgeBeam);
      }

      const hipCapEdges = [
        [new THREE.Vector3(r1X, peakY + 0.02, 0), new THREE.Vector3(xMin, roofBaseY + 0.02, zFront)],
        [new THREE.Vector3(r2X, peakY + 0.02, 0), new THREE.Vector3(xMax, roofBaseY + 0.02, zFront)],
        [new THREE.Vector3(r2X, peakY + 0.02, 0), new THREE.Vector3(xMax, roofBaseY + 0.02, zBack)],
        [new THREE.Vector3(r1X, peakY + 0.02, 0), new THREE.Vector3(xMin, roofBaseY + 0.02, zBack)],
      ];
      hipCapEdges.forEach(([hStart, hEnd]) => {
        const hVec = new THREE.Vector3().subVectors(hEnd, hStart);
        const hLen = hVec.length();
        if (hLen > 0.05) {
          const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, hLen, 8), activeCapMaterial);
          cap.position.copy(hStart).addScaledVector(hVec, 0.5);
          cap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), hVec.clone().normalize());
          modelGroup.add(cap);
        }
      });

      // Perimeter Gutters
      const gutterPoints = [
        new THREE.Vector3(xMin, roofBaseY, zFront),
        new THREE.Vector3(xMax, roofBaseY, zFront),
        new THREE.Vector3(xMax, roofBaseY, zBack),
        new THREE.Vector3(xMin, roofBaseY, zBack),
        new THREE.Vector3(xMin, roofBaseY, zFront),
      ];
      const gutterGeom = new THREE.BufferGeometry().setFromPoints(gutterPoints);
      const gutterLine = new THREE.Line(gutterGeom, new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 }));
      modelGroup.add(gutterLine);

    } else if (roofType === 'shed') {
      // Shed / Mono-Pitch Roof (high at back zBack, low at front zFront)
      const highY = roofBaseY + H;
      const lowY = roofBaseY;

      // Sloping surface
      const shedGeom = new THREE.BufferGeometry();
      shedGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
        xMin, lowY, zFront,
        xMax, lowY, zFront,
        xMax, highY, zBack,

        xMin, lowY, zFront,
        xMax, highY, zBack,
        xMin, highY, zBack,
      ]), 3));
      applySlopeUVs(shedGeom, 0.5);
      shedGeom.computeVertexNormals();
      if (isCoveringActive) {
        const shedMesh = new THREE.Mesh(shedGeom, roofMaterial);
        shedMesh.castShadow = true;
        shedMesh.receiveShadow = true;
        modelGroup.add(shedMesh);
      }

      // Side triangle walls
      const leftShed = new THREE.BufferGeometry();
      leftShed.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
        -halfL, lowY, halfB,
        -halfL, highY, -halfB,
        -halfL, lowY, -halfB,
      ]), 3));
      leftShed.computeVertexNormals();
      modelGroup.add(new THREE.Mesh(leftShed, gableInfillMaterial));

      const rightShed = new THREE.BufferGeometry();
      rightShed.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
        halfL, lowY, halfB,
        halfL, lowY, -halfB,
        halfL, highY, -halfB,
      ]), 3));
      rightShed.computeVertexNormals();
      modelGroup.add(new THREE.Mesh(rightShed, gableInfillMaterial));

      // Rear high wall filling
      const backFill = new THREE.BoxGeometry(L, H, 0.1);
      const backMesh = new THREE.Mesh(backFill, gableInfillMaterial);
      backMesh.position.set(0, roofBaseY + H / 2, -halfB);
      modelGroup.add(backMesh);

      // Low eave gutter
      const lowGutter = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, effL, 8), gutterMaterial);
      lowGutter.rotation.z = Math.PI / 2;
      lowGutter.position.set(roofCenterX, lowY, zFront + 0.05);
      modelGroup.add(lowGutter);

    } else if (roofType === 'flat') {
      // Architectural Flat Roof Deck with perimeter parapet fascia coping
      const deckH = 0.14;
      if (isCoveringActive) {
        const flatDeck = new THREE.Mesh(new THREE.BoxGeometry(effL, deckH, effB), roofMaterial);
        flatDeck.position.set(roofCenterX, roofBaseY + deckH / 2, roofCenterZ);
        flatDeck.castShadow = true;
        flatDeck.receiveShadow = true;
        modelGroup.add(flatDeck);
      }
      // Raised perimeter fascia/coping rim around the flat deck
      const rimMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.45, metalness: 0.3 });
      const rimH = 0.26;
      const rimT = 0.16;
      const rimY = roofBaseY + rimH / 2;
      const frontRim = new THREE.Mesh(new THREE.BoxGeometry(effL + rimT, rimH, rimT), rimMat);
      frontRim.position.set(roofCenterX, rimY, zFront);
      const backRim = new THREE.Mesh(new THREE.BoxGeometry(effL + rimT, rimH, rimT), rimMat);
      backRim.position.set(roofCenterX, rimY, zBack);
      const leftRim = new THREE.Mesh(new THREE.BoxGeometry(rimT, rimH, effB + rimT), rimMat);
      leftRim.position.set(xMin, rimY, roofCenterZ);
      const rightRim = new THREE.Mesh(new THREE.BoxGeometry(rimT, rimH, effB + rimT), rimMat);
      rightRim.position.set(xMax, rimY, roofCenterZ);
      modelGroup.add(frontRim, backRim, leftRim, rightRim);

    } else if (roofType === 'gambrel') {
      // Gambrel (Dutch Barn) Roof
      const breakY = roofBaseY + H * 0.65;
      const peakY = roofBaseY + H;
      const breakZ = halfB * 0.55;

      const addQuad = (v1, v2, v3, v4) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
          v1[0], v1[1], v1[2],
          v2[0], v2[1], v2[2],
          v3[0], v3[1], v3[2],

          v1[0], v1[1], v1[2],
          v3[0], v3[1], v3[2],
          v4[0], v4[1], v4[2],
        ]), 3));
        applySlopeUVs(g, 0.5);
        g.computeVertexNormals();
        if (isCoveringActive) {
          const gm = new THREE.Mesh(g, roofMaterial);
          gm.castShadow = true;
          gm.receiveShadow = true;
          modelGroup.add(gm);
        }
      };

      // Lower Front
      addQuad(
        [xMin, roofBaseY, zFront],
        [xMax, roofBaseY, zFront],
        [xMax, breakY, breakZ],
        [xMin, breakY, breakZ]
      );

      // Upper Front
      addQuad(
        [xMin, breakY, breakZ],
        [xMax, breakY, breakZ],
        [xMax, peakY, 0],
        [xMin, peakY, 0]
      );

      // Upper Back
      addQuad(
        [xMax, breakY, -breakZ],
        [xMin, breakY, -breakZ],
        [xMin, peakY, 0],
        [xMax, peakY, 0]
      );

      // Lower Back
      addQuad(
        [xMax, roofBaseY, zBack],
        [xMin, roofBaseY, zBack],
        [xMin, breakY, -breakZ],
        [xMax, breakY, -breakZ]
      );

      // Gambrel End Walls (at x = -halfL and x = +halfL)
      [-halfL, halfL].forEach((gx) => {
        const endGeom = new THREE.BufferGeometry();
        endGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
          gx, roofBaseY, -halfB,
          gx, roofBaseY, halfB,
          gx, breakY, breakZ,

          gx, roofBaseY, -halfB,
          gx, breakY, breakZ,
          gx, breakY, -breakZ,

          gx, breakY, -breakZ,
          gx, breakY, breakZ,
          gx, peakY, 0,
        ]), 3));
        endGeom.computeVertexNormals();
        modelGroup.add(new THREE.Mesh(endGeom, gableInfillMaterial));
      });

      // Ridge Beam
      const ridgeBeam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, effL, 8),
        activeCapMaterial
      );
      ridgeBeam.rotation.z = Math.PI / 2;
      ridgeBeam.position.set(roofCenterX, peakY + 0.03, 0);
      modelGroup.add(ridgeBeam);
    }

    // 3. Render Extensions if any
    if (extensions && extensions.length > 0) {
      extensions.forEach((ext, idx) => {
        const lExt = Number(ext.length) || 0;
        const bExt = Number(ext.breadth) || 0;
        if (lExt > 0 && bExt > 0) {
          // Extension wall attached to front
          const extWallGeom = new THREE.BoxGeometry(bExt, wallHeight, lExt);
          const extWall = new THREE.Mesh(extWallGeom, wallMaterial);
          extWall.position.set(0, wallHeight / 2, halfB + lExt / 2);
          modelGroup.add(extWall);

          // Extension roof gable
          const extPeakY = roofBaseY + (H * (bExt / B));
          const extSlopeGeom = new THREE.BufferGeometry();
          extSlopeGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
            -bExt / 2, roofBaseY, halfB + lExt,
            bExt / 2, roofBaseY, halfB + lExt,
            0, extPeakY, halfB,
          ]), 3));
          applySlopeUVs(extSlopeGeom, 0.5);
          extSlopeGeom.computeVertexNormals();
          if (isCoveringActive) {
            modelGroup.add(new THREE.Mesh(extSlopeGeom, roofMaterial));
          }
        }
      });
    }

    renderWaterCollector3D(roofBaseY, rectWallL, rectWallB, false, (drop) => {
      const nx = drop?.nx || 0;
      const nz = drop?.nz || 0;
      const sideOv =
        nx < -0.5 ? ov.left : nx > 0.5 ? ov.right : nz > 0.5 ? ov.front : ov.back;
      return Math.max(0, sideOv) + rectInset;
    });

  }, [geometry, roofType, selectedMaterial, extensions, buildingStage, parapetConfig, woodworkConfig, effectiveDisplayMode, wcConfig]);

  return (
    <div className="viewer-3d-panel">
      {/* 3D Header Toolbar */}
      <div
        className="viewer-3d-controls-floating"
        style={{ top: '8px', left: '8px', right: '8px', gap: '6px', flexWrap: 'nowrap' }}
      >
        {/* Inline Orientation Buttons */}
        <div
          className="viewer-3d-actions"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            overflowX: 'auto',
            maxWidth: '100%',
          }}
        >
          {[
            { id: 'front', label: 'Front' },
            { id: 'back', label: 'Back' },
            { id: 'left', label: 'Left' },
            { id: 'right', label: 'Right' },
            { id: 'aerial', label: 'Aerial' },
          ].map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => handleSelectViewPreset(btn.id)}
              className={`viewer-3d-btn ${activeViewPreset === btn.id ? 'active' : ''}`}
              style={{ padding: '4px 7px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Clean Action Controls */}
        <div className="viewer-3d-actions" style={{ flexShrink: 0 }}>
          {!forcedDisplayMode && (
            <button
              type="button"
              onClick={() => {
                if (!isPremium) {
                  onOpenProModal?.();
                  return;
                }
                setRoofDisplayMode((prev) => (prev === 'framing' ? 'finished' : 'framing'));
              }}
              title={
                isPremium
                  ? 'Switch between Covered Roof and Timber Frame'
                  : 'Timber Frame 3D View requires RoofCalc Pro'
              }
              className={`viewer-3d-btn ${isPremium && roofDisplayMode === 'framing' ? 'active' : ''}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 9px',
                fontSize: '11.5px',
                fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
            >
              {!isPremium
                ? '🔒 Timber Frame (Pro)'
                : roofDisplayMode === 'framing'
                ? '🪵 Timber Frame'
                : '🏠 Covered'}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (!autoRotate) setActiveViewPreset(null);
              setAutoRotate(!autoRotate);
            }}
            title="Toggle Auto-Rotation"
            className={`viewer-3d-btn ${autoRotate ? 'active' : ''}`}
            style={{ padding: '4px 9px', fontSize: '11.5px', fontWeight: 700 }}
          >
            Spin
          </button>
        </div>
      </div>

      {/* Canvas Mount */}
      <div ref={mountRef} style={{ width: '100%', height: '100%', cursor: 'grab', touchAction: 'none' }} />

      {/* Bottom Pitch Indicator */}
      <div style={{ position: 'absolute', bottom: '12px', right: '12px', zIndex: 10, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
        <div style={{ background: 'rgba(15, 23, 42, 0.92)', backdropFilter: 'blur(8px)', padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(71, 85, 105, 0.6)', fontSize: '11px', color: '#e2e8f0', pointerEvents: 'auto' }}>
          Pitch: <span style={{ fontWeight: 700, color: '#34d399' }}>{geometry?.pitchDegrees || 0}°</span>
        </div>
      </div>
    </div>
  );
}
