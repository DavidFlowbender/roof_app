/**
 * Hybrid Paper Sketch-to-2D Roof Geometry Analyzer
 * Tier 1: Gemini Vision AI (Multimodal structured extraction of hand-drawn shapes & handwritten labels)
 * Tier 2: Offline Browser Canvas Stroke/Shape Scanner + Native OCR / Natural-Language Label Parser
 */

import { SHAPE_PRESETS } from './roofMath.js';

const GEMINI_KEY_STORAGE = 'roofcalc_gemini_api_key';

export function getStoredGeminiApiKey() {
  const envKey =
    typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_GEMINI_API_KEY
      : '';
  if (envKey && String(envKey).trim().length > 10) {
    return String(envKey).trim();
  }
  try {
    return localStorage.getItem(GEMINI_KEY_STORAGE) || '';
  } catch {
    return '';
  }
}

export function setStoredGeminiApiKey(key) {
  try {
    if (!key || !key.trim()) {
      localStorage.removeItem(GEMINI_KEY_STORAGE);
    } else {
      localStorage.setItem(GEMINI_KEY_STORAGE, key.trim());
    }
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

export function hasEnvGeminiApiKey() {
  const envKey =
    typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_GEMINI_API_KEY
      : '';
  return Boolean(envKey && String(envKey).trim().length > 10);
}

/**
 * Sample hand-drawn paper sketches so users can test the workflow in 1 click
 */
export const SAMPLE_PAPER_SKETCHES = [
  {
    id: 'sample_woodwork_hip',
    title: 'Hip Woodwork Sketch (H = 5.2m)',
    stage: 'woodwork',
    subtitle: '14m × 9m Hip Roof • H = 5.2m',
    defaultNotes: 'Hip roof, L = 14m, B = 9m, H = 5.2m, Overhang = 0.5m',
  },
  {
    id: 'sample_foundation_lshape',
    title: 'L-Shape Foundation Plan',
    stage: 'foundation',
    subtitle: '14m × 11m L-Wing Footprint',
    defaultNotes: 'L-shape, L = 14m, B = 11m, Hip roof',
  },
  {
    id: 'sample_parapet_duplex',
    title: 'Parapet Duplex (KP = 1.9m)',
    stage: 'parapet',
    subtitle: '16m × 10m • Parapet 0.9m • KP = 1.9m',
    defaultNotes: 'Hip roof, L = 16m, B = 10m, Parapet = 0.9m, KP = 1.9m',
  },
];

/**
 * Renders a realistic hand-drawn paper sketch onto a data URL for 1-click testing
 */
export function generateSampleSketchDataUrl(sampleId) {
  const canvas = document.createElement('canvas');
  canvas.width = 760;
  canvas.height = 520;
  const ctx = canvas.getContext('2d');

  // Warm paper background + notebook ruling
  ctx.fillStyle = '#f8f6f0';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(148, 180, 218, 0.32)';
  ctx.lineWidth = 1;
  for (let y = 36; y < canvas.height; y += 28) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  // Red margin line
  ctx.strokeStyle = 'rgba(225, 95, 95, 0.35)';
  ctx.beginPath();
  ctx.moveTo(64, 0);
  ctx.lineTo(64, canvas.height);
  ctx.stroke();

  // Helper to draw slightly organic "hand-drawn" pen lines
  const sketchLine = (x1, y1, x2, y2, color = '#1e293b', width = 2.4, dashed = false) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    if (dashed) ctx.setLineDash([7, 5]);
    const midX = (x1 + x2) / 2 + (Math.sin(x1 * 0.1 + y2 * 0.1) * 1.8);
    const midY = (y1 + y2) / 2 + (Math.cos(y1 * 0.1 + x2 * 0.1) * 1.8);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(midX, midY, x2, y2);
    ctx.stroke();
    ctx.restore();
  };

  const sketchArrow = (x1, y1, x2, y2, color = '#0f4c81') => {
    sketchLine(x1, y1, x2, y2, color, 1.8);
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const head = 9;
    ctx.fillStyle = color;
    for (const [px, py, a] of [
      [x2, y2, ang],
      [x1, y1, ang + Math.PI],
    ]) {
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - head * Math.cos(a - 0.45), py - head * Math.sin(a - 0.45));
      ctx.lineTo(px - head * Math.cos(a + 0.45), py - head * Math.sin(a + 0.45));
      ctx.closePath();
      ctx.fill();
    }
  };

  ctx.fillStyle = '#1e293b';
  ctx.font = 'italic 600 20px Georgia, serif';

  if (sampleId === 'sample_foundation_lshape') {
    ctx.fillText('Site Sketch — Foundation Trench (L-Shape)', 95, 52);
    // L-shape vertices
    const pts = [
      [150, 105],
      [570, 105],
      [570, 265],
      [360, 265],
      [360, 415],
      [150, 415],
    ];
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % pts.length];
      sketchLine(x1, y1, x2, y2, '#1e293b', 3.0);
    }
    ctx.font = 'bold 21px monospace';
    ctx.fillStyle = '#0f4c81';
    ctx.fillText('14m', 340, 92);
    ctx.fillText('6m', 584, 192);
    ctx.fillText('7m', 452, 292);
    ctx.fillText('5m', 374, 350);
    ctx.fillText('7m', 240, 442);
    ctx.fillText('11m', 96, 268);
  } else if (sampleId === 'sample_parapet_duplex') {
    ctx.fillText('Duplex Parapet Roof Plan (Hidden Trough)', 95, 52);
    sketchLine(145, 110, 605, 110, '#1e293b', 3.2);
    sketchLine(605, 110, 605, 390, '#1e293b', 3.2);
    sketchLine(605, 390, 145, 390, '#1e293b', 3.2);
    sketchLine(145, 390, 145, 110, '#1e293b', 3.2);
    // Inner parapet wall
    sketchLine(162, 127, 588, 127, '#475569', 1.5, true);
    sketchLine(588, 127, 588, 373, '#475569', 1.5, true);
    sketchLine(588, 373, 162, 373, '#475569', 1.5, true);
    sketchLine(162, 373, 162, 127, '#475569', 1.5, true);
    // Hip lines
    sketchLine(285, 250, 465, 250, '#1e293b', 2.4);
    sketchLine(285, 250, 162, 127, '#1e293b', 2.0);
    sketchLine(285, 250, 162, 373, '#1e293b', 2.0);
    sketchLine(465, 250, 588, 127, '#1e293b', 2.0);
    sketchLine(465, 250, 588, 373, '#1e293b', 2.0);

    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = '#0f4c81';
    ctx.fillText('L = 16m', 330, 96);
    ctx.fillText('B = 10m', 618, 256);
    ctx.fillStyle = '#b45309';
    ctx.fillText('Parapet = 0.9m  |  Kingpost KP = 1.9m', 155, 448);
  } else {
    // Default: Woodwork Hip Roof with H = Slanting Height arrows (matching user's hand sketch!)
    ctx.fillText('Woodwork Level — Hip Roof Measurement', 95, 52);
    const left = 150, top = 105, right = 590, bottom = 395;
    const midY = (top + bottom) / 2;
    const r1X = 295, r2X = 445;

    sketchLine(left, top, right, top, '#1e293b', 3.0);
    sketchLine(right, top, right, bottom, '#1e293b', 3.0);
    sketchLine(right, bottom, left, bottom, '#1e293b', 3.0);
    sketchLine(left, bottom, left, top, '#1e293b', 3.0);

    // Ridge & 4 hips
    sketchLine(r1X, midY, r2X, midY, '#1e293b', 2.8);
    sketchLine(r1X, midY, left, top, '#1e293b', 2.2);
    sketchLine(r1X, midY, left, bottom, '#1e293b', 2.2);
    sketchLine(r2X, midY, right, top, '#1e293b', 2.2);
    sketchLine(r2X, midY, right, bottom, '#1e293b', 2.2);

    // Purlin lines on upper trapezoid
    for (let i = 1; i <= 3; i++) {
      const t = i / 4;
      const py = midY + (top - midY) * t;
      const px1 = r1X + (left - r1X) * t;
      const px2 = r2X + (right - r2X) * t;
      sketchLine(px1, py, px2, py, '#64748b', 1.3);
    }

    // Double-headed H arrows on main slope & hip end
    sketchArrow(370, midY + 8, 370, bottom - 8, '#047857');
    sketchArrow(left + 10, midY, r1X - 10, midY, '#047857');

    ctx.font = 'bold 21px monospace';
    ctx.fillStyle = '#047857';
    ctx.fillText('H = 5.2m', 382, 332);
    ctx.fillText('H', 214, midY - 10);

    ctx.fillStyle = '#0f4c81';
    ctx.fillText('L = 14m', 330, 90);
    ctx.fillText('B = 9m', 604, midY + 6);
    ctx.font = 'italic 17px Georgia, serif';
    ctx.fillStyle = '#334155';
    ctx.fillText('Overhang = 0.5m   (H = Slanting Height)', 155, 445);
  }

  return canvas.toDataURL('image/png');
}

/**
 * Generates an enhanced high-contrast blueprint scan from a raw camera photo
 */
export async function createBlueprintPreview(imageDataUrl) {
  const img = await loadImageElement(imageDataUrl);
  const maxDim = 720;
  const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
  const w = Math.max(64, Math.round(img.width * scale));
  const h = Math.max(64, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);

  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  const gray = new Float32Array(w * h);

  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    gray[i] = 0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2];
  }

  // Integral image for fast local adaptive background estimation (removes uneven shadows!)
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 1; y <= h; y++) {
    let rowSum = 0;
    for (let x = 1; x <= w; x++) {
      rowSum += gray[(y - 1) * w + (x - 1)];
      integral[y * (w + 1) + x] = integral[(y - 1) * (w + 1) + x] + rowSum;
    }
  }

  const r = Math.max(8, Math.round(Math.min(w, h) / 24));
  const inkMask = new Uint8Array(w * h);

  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w, x + r + 1);
      const count = (x1 - x0) * (y1 - y0);
      const localSum =
        integral[y1 * (w + 1) + x1] -
        integral[y0 * (w + 1) + x1] -
        integral[y1 * (w + 1) + x0] +
        integral[y0 * (w + 1) + x0];
      const localMean = localSum / count;
      const g = gray[y * w + x];
      const isInk = g < localMean - 16 && g < 205;
      inkMask[y * w + x] = isInk ? 1 : 0;

      const pIdx = (y * w + x) * 4;
      if (isInk) {
        // Crisp cyan-emerald blueprint stroke
        d[pIdx] = 56;
        d[pIdx + 1] = 215;
        d[pIdx + 2] = 248;
        d[pIdx + 3] = 255;
      } else {
        // Deep architectural blueprint navy background
        d[pIdx] = 13;
        d[pIdx + 1] = 22;
        d[pIdx + 2] = 40;
        d[pIdx + 3] = 255;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return {
    blueprintDataUrl: canvas.toDataURL('image/png'),
    inkMask,
    width: w,
    height: h,
  };
}

/**
 * Parses natural-language or OCR text labels from paper sketches
 * Supports: "14m x 9m", "L=14, B=9", "H = 5.2m", "KP = 2.4m", "Parapet 0.9m", "40ft x 28ft", etc.
 */
export function parsePaperLabelNotes(rawText = '', fallbackUnit = 'metric') {
  const text = String(rawText || '').trim();
  const detectedLabels = [];
  if (!text) {
    return {
      hasParsedValues: false,
      detectedLabels,
    };
  }

  const toMeters = (valStr, unitStr) => {
    const num = parseFloat(valStr);
    if (!Number.isFinite(num) || num <= 0) return null;
    const u = (unitStr || '').toLowerCase().trim();
    if (u === 'ft' || u === 'feet' || u === 'foot' || u === "'") {
      return round2(num * 0.3048);
    }
    if (u === 'cm') return round2(num / 100);
    if (u === 'mm') return round2(num / 1000);
    if (!u && fallbackUnit === 'imperial') {
      return round2(num * 0.3048);
    }
    return round2(num);
  };

  let length = null;
  let breadth = null;
  let slantingHeight = null;
  let kingpostHeight = null;
  let pitchAngle = null;
  let overhang = null;
  let parapetHeight = null;
  let roofType = null;
  let shapeType = null;
  const edgeDimensions = { top: null, right: null, bottom: null, left: null };

  const lower = text.toLowerCase();
  if (/\bl[-\s]?shape\b/.test(lower)) shapeType = 'l_shape';
  else if (/\bt[-\s]?shape\b/.test(lower)) shapeType = 't_shape';
  else if (/\bcross\b|\bcruciform\b/.test(lower)) shapeType = 'cross_shape';
  else if (/\bu[-\s]?shape\b/.test(lower)) shapeType = 'u_shape';

  if (/\bgable\b/.test(lower)) roofType = 'gable';
  else if (/\bshed\b|\bmono\b/.test(lower)) roofType = 'shed';
  else if (/\bgambrel\b|\bbarn\b/.test(lower)) roofType = 'gambrel';
  else if (/\bhip\b/.test(lower)) roofType = 'hip';

  // 1. Shorthand pair: e.g. "14m x 9m" or "45ft by 30ft"
  const pairMatch = text.match(
    /(\d+(?:\.\d+)?)\s*(m|ft|feet|'|cm|mm)?\s*(?:x|×|by|\*)\s*(\d+(?:\.\d+)?)\s*(m|ft|feet|'|cm|mm)?/i
  );
  if (pairMatch) {
    const u1 = pairMatch[2] || pairMatch[4] || '';
    const u2 = pairMatch[4] || pairMatch[2] || '';
    const v1 = toMeters(pairMatch[1], u1);
    const v2 = toMeters(pairMatch[3], u2);
    if (v1 && v2) {
      length = v1;
      breadth = v2;
      detectedLabels.push(
        { label: 'Width / Length', valueText: `${pairMatch[1]}${u1 || (fallbackUnit === 'imperial' ? 'ft' : 'm')}`, meters: length },
        { label: 'Height / Breadth', valueText: `${pairMatch[3]}${u2 || (fallbackUnit === 'imperial' ? 'ft' : 'm')}`, meters: breadth }
      );
    }
  }

  // 2. Explicit Length L
  const lenMatch = text.match(/(?:\blength\b|\bL\b)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(m|ft|feet|'|cm|mm)?/i);
  if (lenMatch) {
    const m = toMeters(lenMatch[1], lenMatch[2]);
    if (m) {
      length = m;
      detectedLabels.push({ label: 'Length (L)', valueText: lenMatch[0].trim(), meters: m });
    }
  }

  // 3. Explicit Breadth / Width B
  const brdMatch = text.match(/(?:\bbreadth\b|\bwidth\b|\bspan\b|\bB\b|\bW\b)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(m|ft|feet|'|cm|mm)?/i);
  if (brdMatch) {
    const m = toMeters(brdMatch[1], brdMatch[2]);
    if (m) {
      breadth = m;
      detectedLabels.push({ label: 'Breadth (B)', valueText: brdMatch[0].trim(), meters: m });
    }
  }

  // 3b. Directional edge dimensions (top, right, bottom, left / front, back)
  for (const [dirKey, rx] of [
    ['top', /\b(?:top|back|rear)\b\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(m|ft|feet|'|cm|mm)?/i],
    ['right', /\b(?:right)\b\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(m|ft|feet|'|cm|mm)?/i],
    ['bottom', /\b(?:bottom|front)\b\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(m|ft|feet|'|cm|mm)?/i],
    ['left', /\b(?:left)\b\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(m|ft|feet|'|cm|mm)?/i],
  ]) {
    const mDir = text.match(rx);
    if (mDir) {
      const m = toMeters(mDir[1], mDir[2]);
      if (m) {
        edgeDimensions[dirKey] = m;
        detectedLabels.push({ label: `${dirKey.toUpperCase()} Wall`, valueText: mDir[0].trim(), meters: m });
      }
    }
  }
  const hasDirDims = Object.values(edgeDimensions).some((v) => v !== null);
  if (hasDirDims) {
    const horiz = Math.max(edgeDimensions.top || 0, edgeDimensions.bottom || 0);
    const vert = Math.max(edgeDimensions.left || 0, edgeDimensions.right || 0);
    if (horiz > 0 && length === null) length = horiz;
    if (vert > 0 && breadth === null) breadth = vert;
  }

  // 3c. Plain comma/space-separated numbers (e.g. "2.5, 4.7, 3.5, 4.6" for top, right, bottom, left)
  let plainNumbers = [];
  if (length === null && breadth === null && !hasDirDims) {
    const numTokens = [...text.matchAll(/(?:^|[\s,;(/])(\d+(?:\.\d+)?)\s*(m|ft|feet|'|cm|mm)?(?=$|[\s,;)/])/gi)];
    plainNumbers = numTokens
      .map((m) => toMeters(m[1], m[2]))
      .filter((v) => v !== null && v >= 0.4 && v <= 120);
    if (plainNumbers.length === 4) {
      // Interpret clockwise from top: top, right, bottom, left
      edgeDimensions.top = plainNumbers[0];
      edgeDimensions.right = plainNumbers[1];
      edgeDimensions.bottom = plainNumbers[2];
      edgeDimensions.left = plainNumbers[3];
      length = round2(Math.max(plainNumbers[0], plainNumbers[2]));
      breadth = round2(Math.max(plainNumbers[1], plainNumbers[3]));
      detectedLabels.push({
        label: 'Walls (T/R/B/L)',
        valueText: `${plainNumbers[0]}, ${plainNumbers[1]}, ${plainNumbers[2]}, ${plainNumbers[3]}m`,
        meters: length,
      });
    } else if (plainNumbers.length === 2) {
      length = plainNumbers[0];
      breadth = plainNumbers[1];
      detectedLabels.push(
        { label: 'Span 1', valueText: `${plainNumbers[0]}m`, meters: length },
        { label: 'Span 2', valueText: `${plainNumbers[1]}m`, meters: breadth }
      );
    }
  }

  // 4. Explicit Kingpost Height (KP / Kingpost / Apex / Vertical Rise)
  const kpMatch = text.match(
    /(?:\bking\s*post\b|\bkingpost\b|\bKP\b|\bapex\b|\brise\b)\s*(?:height|h)?\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(m|ft|feet|'|cm|mm)?/i
  );
  if (kpMatch) {
    const m = toMeters(kpMatch[1], kpMatch[2]);
    if (m) {
      kingpostHeight = m;
      detectedLabels.push({ label: 'Kingpost Height (KP)', valueText: kpMatch[0].trim(), meters: m });
    }
  }

  // 5. Explicit Slanting Height (H / Slanting / Rafter / Slope)
  const slantMatch = text.match(
    /(?:\bslant(?:ing)?\s*(?:height|h|length)?\b|\brafter(?:\s*length)?\b|\bH\b)\s*[:=]\s*(\d+(?:\.\d+)?)\s*(m|ft|feet|'|cm|mm)?/i
  ) || text.match(/(?:\bslant(?:ing)?\b|\brafter\b)\s*(\d+(?:\.\d+)?)\s*(m|ft|feet|'|cm|mm)?/i);
  if (slantMatch) {
    const m = toMeters(slantMatch[1], slantMatch[2]);
    if (m) {
      slantingHeight = m;
      detectedLabels.push({ label: 'Slanting Height (H)', valueText: slantMatch[0].trim(), meters: m });
    }
  }

  // 6. Pitch Angle (degrees)
  const angMatch = text.match(/(?:angle|pitch|slope)?\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:°|deg(?:rees)?)\b/i);
  if (angMatch) {
    const deg = parseFloat(angMatch[1]);
    if (deg >= 5 && deg <= 75) {
      pitchAngle = round2(deg);
      detectedLabels.push({ label: 'Pitch Angle', valueText: `${deg}°`, meters: null });
    }
  }

  // 7. Overhang / Eave
  const ovMatch = text.match(/(?:\boverhang\b|\beaves?\b|\bfascia\b)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(m|ft|feet|'|cm|mm)?/i);
  if (ovMatch) {
    const m = toMeters(ovMatch[1], ovMatch[2]);
    if (m !== null && m >= 0 && m <= 4) {
      overhang = m;
      detectedLabels.push({ label: 'Overhang', valueText: ovMatch[0].trim(), meters: m });
    }
  }

  // 8. Parapet Height
  const parMatch = text.match(/(?:\bparapet\b)\s*(?:height|wall)?\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(m|ft|feet|'|cm|mm)?/i);
  if (parMatch) {
    const m = toMeters(parMatch[1], parMatch[2]);
    if (m && m >= 0.2 && m <= 3.5) {
      parapetHeight = m;
      detectedLabels.push({ label: 'Parapet Height', valueText: parMatch[0].trim(), meters: m });
    }
  }

  // Deduplicate labels by label name
  const uniqueMap = new Map();
  for (const item of detectedLabels) {
    uniqueMap.set(item.label, item);
  }

  return {
    hasParsedValues:
      length !== null ||
      breadth !== null ||
      slantingHeight !== null ||
      kingpostHeight !== null ||
      pitchAngle !== null ||
      overhang !== null ||
      parapetHeight !== null ||
      roofType !== null ||
      shapeType !== null,
    length,
    breadth,
    slantingHeight,
    kingpostHeight,
    pitchAngle,
    overhang,
    parapetHeight,
    roofType,
    shapeType,
    edgeDimensions,
    detectedLabels: Array.from(uniqueMap.values()),
  };
}

/**
 * Proportionally scales any extracted or custom polygon to exact target outer width & height (in meters),
 * shifting origin to (0, 0). Preserves exact notch orientation and wing proportions.
 */
export function scalePolygonToBounds(vertices, targetWidth, targetHeight) {
  if (!Array.isArray(vertices) || vertices.length < 3) return null;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const v of vertices) {
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
  }
  const srcW = Math.max(0.1, maxX - minX);
  const srcH = Math.max(0.1, maxY - minY);
  const tgtW = Math.max(0.5, Number(targetWidth) || srcW);
  const tgtH = Math.max(0.5, Number(targetHeight) || srcH);
  const sx = tgtW / srcW;
  const sy = tgtH / srcH;

  return vertices.map((v) => ({
    x: round2((v.x - minX) * sx),
    y: round2((v.y - minY) * sy),
  }));
}

/**
 * Adjusts L-shape horizontal/vertical wing proportion if explicit directional top/bottom/left/right
 * wall sizes are known without inverting or distorting the extracted corner topology.
 */
function applyDirectionalLAdjustments(normalizedVerts, edgeDims, targetW, targetH) {
  if (!normalizedVerts || normalizedVerts.length !== 6 || !edgeDims) return normalizedVerts;
  const topW = edgeDims.top;
  const bottomW = edgeDims.bottom;
  if (!(topW > 0 && bottomW > 0 && topW < bottomW && Math.abs(bottomW - targetW) < 0.05)) {
    return normalizedVerts;
  }
  // Check if top horizontal edge is shorter than full width (L-wing at top-left or top-right)
  let topEdge = null;
  for (let i = 0; i < 6; i++) {
    const a = normalizedVerts[i];
    const b = normalizedVerts[(i + 1) % 6];
    if (Math.abs(a.y - b.y) < 0.05 && a.y < targetH * 0.2 && Math.abs(b.x - a.x) < targetW * 0.9) {
      topEdge = [i, (i + 1) % 6];
      break;
    }
  }
  if (!topEdge) return normalizedVerts;
  const [iA, iB] = topEdge;
  const xMin = Math.min(normalizedVerts[iA].x, normalizedVerts[iB].x);
  const xMax = Math.max(normalizedVerts[iA].x, normalizedVerts[iB].x);
  const newInnerX = xMin < 0.1 ? round2(topW) : round2(targetW - topW);
  const oldInnerX = xMin < 0.1 ? xMax : xMin;
  return normalizedVerts.map((v) =>
    Math.abs(v.x - oldInnerX) < 0.08 ? { ...v, x: newInnerX } : { ...v }
  );
}

/**
 * Builds scaled polygon vertices for L-Shape, T-Shape, Cross-Shape, or U-Shape
 */
export function buildScaledShapeVertices(shapeType, targetLength = 14, targetBreadth = 10) {
  if (!shapeType || shapeType === 'rectangle') return null;

  if (shapeType === 'u_shape') {
    const L = Math.max(1.5, targetLength);
    const B = Math.max(1.5, targetBreadth);
    const wingW = round2(Math.max(0.5, L * 0.28));
    const baseD = round2(Math.max(0.5, B * 0.42));
    return [
      { x: 0, y: 0 },
      { x: L, y: 0 },
      { x: L, y: B },
      { x: round2(L - wingW), y: B },
      { x: round2(L - wingW), y: baseD },
      { x: wingW, y: baseD },
      { x: wingW, y: B },
      { x: 0, y: B },
    ];
  }

  const presetId =
    shapeType === 'l_shape'
      ? 'l_shape'
      : shapeType === 't_shape'
      ? 't_shape'
      : shapeType === 'cross_shape'
      ? 'cross'
      : null;

  const preset = SHAPE_PRESETS.find((p) => p.id === presetId);
  if (!preset) return null;

  return scalePolygonToBounds(preset.vertices, Math.max(1.5, targetLength), Math.max(1.5, targetBreadth));
}

const VISION_CACHE_STORAGE = 'roofcalc_vision_cache_v2';
const memoryVisionCache = new Map();

function computeImageCacheKey(imageDataUrl, unitSystem) {
  const s = String(imageDataUrl || '');
  const len = s.length;
  // Sample 8 evenly spaced 24-char slices across the base64 payload for fast deterministic key
  let sig = `${unitSystem}:${len}:`;
  if (len <= 192) {
    sig += s;
  } else {
    const step = Math.floor(len / 8);
    for (let i = 0; i < 8; i++) {
      const idx = Math.min(len - 24, i * step);
      sig += s.slice(idx, idx + 24);
    }
  }
  return sig;
}

function getCachedVisionResult(cacheKey) {
  if (memoryVisionCache.has(cacheKey)) {
    return memoryVisionCache.get(cacheKey);
  }
  try {
    const raw = sessionStorage.getItem(VISION_CACHE_STORAGE);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (obj && obj[cacheKey]) {
      memoryVisionCache.set(cacheKey, obj[cacheKey]);
      return obj[cacheKey];
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

function setCachedVisionResult(cacheKey, result) {
  if (memoryVisionCache.size >= 25) {
    const firstKey = memoryVisionCache.keys().next().value;
    if (firstKey) memoryVisionCache.delete(firstKey);
  }
  memoryVisionCache.set(cacheKey, result);
  try {
    const raw = sessionStorage.getItem(VISION_CACHE_STORAGE);
    const obj = raw ? JSON.parse(raw) : {};
    const keys = Object.keys(obj);
    if (keys.length >= 12) {
      delete obj[keys[0]];
    }
    obj[cacheKey] = result;
    sessionStorage.setItem(VISION_CACHE_STORAGE, JSON.stringify(obj));
  } catch {
    // Ignore sessionStorage quota overflow on large sessions
  }
}

/**
 * Downscales large camera photos (<= 896px max dimension) and encodes as crisp JPEG
 * to dramatically cut Vision token & bandwidth consumption without losing handwriting legibility.
 */
async function compressImageForVision(imageDataUrl) {
  try {
    if (typeof document === 'undefined') return null;
    const img = await loadImageElement(imageDataUrl);
    const maxDim = 1280;
    const srcW = img.width || 1;
    const srcH = img.height || 1;
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

    const compressed = canvas.toDataURL('image/jpeg', 0.86);
    const commaIdx = compressed.indexOf(',');
    if (commaIdx > -1) {
      return {
        mimeType: 'image/jpeg',
        base64Data: compressed.slice(commaIdx + 1),
      };
    }
  } catch {
    // Fall back to original image bytes if canvas decode unavailable
  }
  return null;
}

/**
 * Tier 1: Gemini Vision AI Multimodal Paper Sketch Extraction (Token-Optimized)
 */
async function analyzeWithGeminiVision({
  imageDataUrl,
  stageId,
  unitSystem,
  manualNotesText,
  apiKey,
  offlineExtracted,
}) {
  const compressed = await compressImageForVision(imageDataUrl);
  let mimeType = compressed?.mimeType;
  let base64Data = compressed?.base64Data;
  if (!base64Data) {
    const commaIdx = imageDataUrl.indexOf(',');
    const header = commaIdx > -1 ? imageDataUrl.slice(0, commaIdx) : '';
    base64Data = commaIdx > -1 ? imageDataUrl.slice(commaIdx + 1) : imageDataUrl;
    const mimeMatch = header.match(/data:(.*?);base64/);
    mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  }

  const aspectHint =
    offlineExtracted && Number(offlineExtracted.aspect) > 0
      ? ` Visual contour aspect ratio W:H is ~${Number(offlineExtracted.aspect).toFixed(2)}.`
      : '';

  const systemInstruction = `Extract hand-drawn building/roof sketch geometry and measurements into compact JSON (meters; convert ft -> m with 1 ft = 0.3048 m; assume ${
    unitSystem === 'imperial' ? 'feet' : 'meters'
  } when unlabeled).${aspectHint}
Rules:
1. Read ALL handwritten/printed dimension numbers in ANY orientation (upright, upside-down 180°, vertical 90°/270°, including decimals like 1.4, 2.5, 3.0) and list each one in detectedLabels with its position label (e.g. top, left, bottom, right_upper, step_1).
2. ALWAYS output clockwise orthogonal (90-degree) outer perimeter corners polygonVertices [{x, y}] in meters starting from top-leftmost wall corner (0, 0) with x right and y down (do NOT repeat (0,0) at the end).
   - Trace EVERY horizontal jog and vertical step cleanly so segment lengths match the numbers written beside each wall. Do NOT simplify multi-stepped walls (e.g. 2+ steps along one side) into a 4-wall rectangle or 6-wall L-shape; use "custom_polygon" with all corners (8, 10, etc.).
   - If an outer wall has no written label, compute its exact length geometrically from parallel walls so opposite spans balance cleanly (sum of right edges == sum of left edges; sum of top edges == sum of bottom edges).
   - For a simple 4-wall rectangle, output its 4 corners [(0,0), (L,0), (L,B), (0,B)].
3. ALWAYS set overall bounding lengthMeters = (max x - min x) and breadthMeters = (max y - min y) from polygonVertices, plus edgeDimensions {top, right, bottom, left} for clear outer edge spans.
4. Also extract roofType, slantingHeightMeters (H), kingpostHeightMeters (KP), pitchAngleDegrees, overhangMeters, parapetHeightMeters if shown. Active stage: "${stageId}". Keep "notes" <= 15 words.${
    manualNotesText ? ` User note hint: "${manualNotesText}".` : ''
  }`;

  const responseSchema = {
    type: 'OBJECT',
    properties: {
      shapeType: {
        type: 'STRING',
        enum: ['rectangle', 'l_shape', 't_shape', 'u_shape', 'cross_shape', 'custom_polygon'],
      },
      roofType: {
        type: 'STRING',
        enum: ['hip', 'gable', 'shed', 'gambrel', 'unspecified'],
      },
      lengthMeters: { type: 'NUMBER', nullable: true },
      breadthMeters: { type: 'NUMBER', nullable: true },
      edgeDimensions: {
        type: 'OBJECT',
        properties: {
          top: { type: 'NUMBER', nullable: true },
          right: { type: 'NUMBER', nullable: true },
          bottom: { type: 'NUMBER', nullable: true },
          left: { type: 'NUMBER', nullable: true },
        },
      },
      slantingHeightMeters: { type: 'NUMBER', nullable: true },
      kingpostHeightMeters: { type: 'NUMBER', nullable: true },
      pitchAngleDegrees: { type: 'NUMBER', nullable: true },
      overhangMeters: { type: 'NUMBER', nullable: true },
      parapetHeightMeters: { type: 'NUMBER', nullable: true },
      polygonVertices: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            x: { type: 'NUMBER' },
            y: { type: 'NUMBER' },
          },
          required: ['x', 'y'],
        },
      },
      extensions: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            length: { type: 'NUMBER' },
            breadth: { type: 'NUMBER' },
            quantity: { type: 'NUMBER' },
          },
          required: ['length', 'breadth'],
        },
      },
      detectedLabels: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            label: { type: 'STRING' },
            valueText: { type: 'STRING' },
            meters: { type: 'NUMBER', nullable: true },
          },
          required: ['label', 'valueText'],
        },
      },
      confidence: {
        type: 'STRING',
        enum: ['high', 'medium', 'low'],
      },
      notes: { type: 'STRING' },
    },
    required: ['shapeType', 'roofType', 'polygonVertices', 'detectedLabels', 'confidence', 'notes'],
  };

  const modelsToTry = [
    'gemini-3-flash-preview',
    'gemini-3.8-flash',
    'gemini-3.5-flash-lite',
    'gemini-flash-lite-latest',
  ];
  let lastError = null;

  for (const modelName of modelsToTry) {
    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(
          apiKey
        )}`,
        {
          method: 'POST',
          signal: AbortSignal.timeout(28000),
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  { text: systemInstruction },
                  {
                    inlineData: {
                      mimeType,
                      data: base64Data,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 4096,
              ...(modelName.startsWith('gemini-3') ? { thinkingConfig: { thinkingLevel: 'low' } } : {}),
              responseMimeType: 'application/json',
              responseSchema,
            },
          }),
        }
      );

      if (!resp.ok) {
        const errBody = await resp.text();
        lastError = new Error(`Gemini API (${modelName}) HTTP ${resp.status}: ${errBody.slice(0, 180)}`);
        continue;
      }

      const json = await resp.json();
      const rawContent = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawContent) {
        lastError = new Error('Empty response from Gemini Vision');
        continue;
      }

      const parsed = JSON.parse(rawContent);
      return normalizeGeminiParsedPayload(parsed, modelName);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Gemini Vision analysis failed');
}

/**
 * Normalizes AI-returned perimeter polygon vertices (removes duplicate closing point,
 * shifts bounding box origin to (0,0), and measures exact metric bounds).
 */
function normalizeMetricPolygon(rawVertices) {
  if (!Array.isArray(rawVertices) || rawVertices.length < 3) return null;
  const pts = [];
  for (const v of rawVertices) {
    const x = Number(v?.x);
    const y = Number(v?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const prev = pts[pts.length - 1];
    if (prev && Math.hypot(x - prev.x, y - prev.y) < 0.04) continue;
    pts.push({ x, y });
  }
  if (pts.length >= 4 && Math.hypot(pts[pts.length - 1].x - pts[0].x, pts[pts.length - 1].y - pts[0].y) < 0.04) {
    pts.pop();
  }
  if (pts.length < 3) return null;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const width = round2(maxX - minX);
  const height = round2(maxY - minY);
  const shifted = pts.map((p) => ({
    x: round2(p.x - minX),
    y: round2(p.y - minY),
  }));

  const isRectangle =
    shifted.length === 4 &&
    shifted.every((p) => (p.x < 0.05 || Math.abs(p.x - width) < 0.05) && (p.y < 0.05 || Math.abs(p.y - height) < 0.05));

  return { vertices: shifted, width, height, isRectangle };
}

/**
 * Shared normalizer for structured Gemini Vision JSON (used by both /api/analyze-sketch and local BYOK).
 */
function normalizeGeminiParsedPayload(parsed = {}, modelName = 'gemini-3-flash-preview') {
  const parsedEdges = parsed.edgeDimensions || {};
  const edgeDims = {
    top: positiveOrNull(parsedEdges.top),
    right: positiveOrNull(parsedEdges.right),
    bottom: positiveOrNull(parsedEdges.bottom),
    left: positiveOrNull(parsedEdges.left),
  };
  const edgeHoriz = Math.max(edgeDims.top || 0, edgeDims.bottom || 0);
  const edgeVert = Math.max(edgeDims.left || 0, edgeDims.right || 0);

  const normPoly = normalizeMetricPolygon(parsed.polygonVertices);
  let shapeType = parsed.shapeType || 'rectangle';
  let polygonVertices = null;

  if (normPoly && !normPoly.isRectangle && normPoly.vertices.length >= 5) {
    polygonVertices = normPoly.vertices;
    if (shapeType === 'rectangle') {
      shapeType = normPoly.vertices.length === 6 ? 'l_shape' : 'custom_polygon';
    } else if (shapeType === 'l_shape' && normPoly.vertices.length > 6) {
      shapeType = 'custom_polygon';
    }
  } else if (normPoly?.isRectangle) {
    shapeType = 'rectangle';
  }

  const length =
    (normPoly && normPoly.width > 0.4 ? normPoly.width : null) ||
    positiveOrNull(parsed.lengthMeters) ||
    (edgeHoriz > 0 ? round2(edgeHoriz) : null);
  const breadth =
    (normPoly && normPoly.height > 0.4 ? normPoly.height : null) ||
    positiveOrNull(parsed.breadthMeters) ||
    (edgeVert > 0 ? round2(edgeVert) : null);

  return {
    engine: 'gemini-vision',
    model: modelName,
    shapeType,
    roofType: parsed.roofType && parsed.roofType !== 'unspecified' ? parsed.roofType : null,
    length,
    breadth,
    edgeDimensions: edgeDims,
    slantingHeight: positiveOrNull(parsed.slantingHeightMeters),
    kingpostHeight: positiveOrNull(parsed.kingpostHeightMeters),
    pitchAngle: positiveOrNull(parsed.pitchAngleDegrees),
    overhang: parsed.overhangMeters !== null && parsed.overhangMeters >= 0 ? round2(parsed.overhangMeters) : null,
    parapetHeight: positiveOrNull(parsed.parapetHeightMeters),
    polygonVertices,
    extensions: Array.isArray(parsed.extensions) ? parsed.extensions : [],
    detectedLabels: Array.isArray(parsed.detectedLabels) ? parsed.detectedLabels : [],
    confidence: parsed.confidence || 'high',
    notes: parsed.notes || 'Extracted labels via Pro AI Vision.',
  };
}

/**
 * Pro Server Proxy: Calls Vercel Function /api/analyze-sketch with compressed image + auth token.
 * Keeps GEMINI_API_KEY strictly on the server and enforces per-user monthly quota.
 */
async function analyzeWithProBackend({
  imageDataUrl,
  stageId,
  unitSystem,
  manualNotesText,
  offlineExtracted,
  accessToken,
}) {
  const compressed = await compressImageForVision(imageDataUrl);
  let mimeType = compressed?.mimeType;
  let base64Data = compressed?.base64Data;
  if (!base64Data) {
    const commaIdx = imageDataUrl.indexOf(',');
    const header = commaIdx > -1 ? imageDataUrl.slice(0, commaIdx) : '';
    base64Data = commaIdx > -1 ? imageDataUrl.slice(commaIdx + 1) : imageDataUrl;
    const mimeMatch = header.match(/data:(.*?);base64/);
    mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  }

  const headers = { 'Content-Type': 'application/json' };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const resp = await fetch('/api/analyze-sketch', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      mimeType,
      base64Data,
      stageId,
      unitSystem,
      manualNotesText,
      offlineExtracted: offlineExtracted
        ? {
            shapeType: offlineExtracted.shapeType,
            aspect: offlineExtracted.aspect,
            verticesPx: offlineExtracted.verticesPx,
          }
        : null,
    }),
  });

  const payload = await resp.json().catch(() => ({}));
  if (!resp.ok || !payload?.parsed) {
    const err = new Error(payload?.error || `Pro AI proxy unavailable (HTTP ${resp.status})`);
    err.code = payload?.code || 'PROXY_ERROR';
    throw err;
  }

  const normalized = normalizeGeminiParsedPayload(payload.parsed, 'Pro AI Scan');
  return {
    ...normalized,
    engine: 'pro-ai-proxy',
    serverCached: Boolean(payload.cached),
    quota: payload.quota || null,
  };
}

/**
 * Turns any backend/network/Gemini error into a short, calm notice for users.
 * Never exposes raw HTTP codes, Gemini model IDs, or JSON stack details.
 */
function formatFriendlyVisionWarning(err) {
  const code = String(err?.code || '').toUpperCase();
  const msg = String(err?.message || '');

  if (code === 'QUOTA_EXCEEDED') {
    return 'All AI scan credits have been used — used standard scan instead. Buy a Scan Pack anytime to re-enable AI reading.';
  }
  if (code === 'PRO_REQUIRED') {
    return 'AI sketch reading requires an active Pro plan — used standard scan instead.';
  }
  if (code === 'AUTH_REQUIRED' || code === 'AUTH_INVALID') {
    return 'Please sign in again to use AI reading — used standard scan instead (no scan credit used).';
  }
  if (
    code === 'AI_BUSY' ||
    /503|429|high demand|overloaded|timeout|abort/i.test(msg)
  ) {
    return 'AI scanner is busy right now — used standard scan instead (no scan credit used).';
  }
  return 'AI scanner is temporarily unavailable — used standard scan instead (no scan credit used).';
}

/**
 * Morphological square-window dilation on a binary byte mask
 */
function dilateBinaryMask(src, w, h, rad) {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - rad);
    const y1 = Math.min(h - 1, y + rad);
    for (let x = 0; x < w; x++) {
      if (!src[y * w + x]) continue;
      const x0 = Math.max(0, x - rad);
      const x1 = Math.min(w - 1, x + rad);
      for (let ny = y0; ny <= y1; ny++) {
        const row = ny * w;
        for (let nx = x0; nx <= x1; nx++) {
          out[row + nx] = 1;
        }
      }
    }
  }
  return out;
}

/**
 * Morphological square-window erosion on a binary byte mask
 */
function erodeBinaryMask(src, w, h, rad) {
  const out = new Uint8Array(w * h);
  for (let y = rad; y < h - rad; y++) {
    for (let x = rad; x < w - rad; x++) {
      let ok = true;
      for (let ny = y - rad; ny <= y + rad; ny++) {
        const row = ny * w;
        for (let nx = x - rad; nx <= x + rad; nx++) {
          if (!src[row + nx]) {
            ok = false;
            break;
          }
        }
        if (!ok) break;
      }
      if (ok) out[y * w + x] = 1;
    }
  }
  return out;
}

/**
 * Flood-fills exterior `0` pixels from (0, 0) on a padded binary mask and returns solid interior `0/1`
 */
function floodFillInteriorMask(grid, pw, ph) {
  const out = new Uint8Array(pw * ph);
  const qx = new Int32Array(pw * ph);
  const qy = new Int32Array(pw * ph);
  let head = 0;
  let tail = 0;
  out[0] = 1;
  qx[tail] = 0;
  qy[tail] = 0;
  tail++;

  while (head < tail) {
    const cx = qx[head];
    const cy = qy[head];
    head++;
    if (cx + 1 < pw) {
      const ni = cy * pw + (cx + 1);
      if (!out[ni] && !grid[ni]) { out[ni] = 1; qx[tail] = cx + 1; qy[tail] = cy; tail++; }
    }
    if (cx - 1 >= 0) {
      const ni = cy * pw + (cx - 1);
      if (!out[ni] && !grid[ni]) { out[ni] = 1; qx[tail] = cx - 1; qy[tail] = cy; tail++; }
    }
    if (cy + 1 < ph) {
      const ni = (cy + 1) * pw + cx;
      if (!out[ni] && !grid[ni]) { out[ni] = 1; qx[tail] = cx; qy[tail] = cy + 1; tail++; }
    }
    if (cy - 1 >= 0) {
      const ni = (cy - 1) * pw + cx;
      if (!out[ni] && !grid[ni]) { out[ni] = 1; qx[tail] = cx; qy[tail] = cy - 1; tail++; }
    }
  }

  const solid = new Uint8Array(pw * ph);
  let solidCount = 0;
  for (let i = 0; i < pw * ph; i++) {
    if (!out[i]) {
      solid[i] = 1;
      solidCount++;
    }
  }
  return { solid, solidCount };
}

/**
 * Finds 8-connected components inside a cleaned binary mask, rejecting thin edge border frames
 */
function findInteriorComponents(mask, w, h) {
  const visited = new Uint8Array(w * h);
  const qx = new Int32Array(w * h);
  const qy = new Int32Array(w * h);
  const comps = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const startIdx = y * w + x;
      if (!mask[startIdx] || visited[startIdx]) continue;
      visited[startIdx] = 1;
      let head = 0;
      let tail = 0;
      qx[tail] = x;
      qy[tail] = y;
      tail++;
      let minX = x, maxX = x, minY = y, maxY = y;

      while (head < tail) {
        const cx = qx[head];
        const cy = qy[head];
        head++;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        for (let dy = -1; dy <= 1; dy++) {
          const ny = cy + dy;
          if (ny < 0 || ny >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx;
            if (nx < 0 || nx >= w) continue;
            const ni = ny * w + nx;
            if (mask[ni] && !visited[ni]) {
              visited[ni] = 1;
              qx[tail] = nx;
              qy[tail] = ny;
              tail++;
            }
          }
        }
      }

      const bw = maxX - minX + 1;
      const bh = maxY - minY + 1;
      const touchesEdge = minX <= 3 || maxX >= w - 4 || minY <= 3 || maxY >= h - 4;
      const isThinFrameBar =
        touchesEdge &&
        ((Math.min(bw, bh) < 0.08 * Math.min(w, h) && Math.max(bw, bh) > 0.4 * Math.min(w, h)) ||
          (bw > w * 0.9 && bh > h * 0.9));

      if (!isThinFrameBar && bw >= Math.max(24, w * 0.08) && bh >= Math.max(24, h * 0.08) && tail >= 40) {
        const coordsX = qx.slice(0, tail);
        const coordsY = qy.slice(0, tail);
        comps.push({ count: tail, minX, maxX, minY, maxY, bw, bh, coordsX, coordsY });
      }
    }
  }

  comps.sort((a, b) => b.bw * b.bh - a.bw * a.bh);
  return comps;
}

/**
 * Moore-Neighbor clockwise outer contour tracing on a single solid 4-connected blob
 */
function traceOuterBoundaryMoore(mask, pw, ph) {
  let sx = -1;
  let sy = -1;
  for (let y = 0; y < ph && sx === -1; y++) {
    for (let x = 0; x < pw; x++) {
      if (mask[y * pw + x]) {
        sx = x;
        sy = y;
        break;
      }
    }
  }
  if (sx === -1) return [];

  const dirs = [
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
  ];
  const dirIndex = (dx, dy) => {
    for (let i = 0; i < 8; i++) {
      if (dirs[i][0] === dx && dirs[i][1] === dy) return i;
    }
    return 0;
  };

  const contour = [{ x: sx, y: sy }];
  let cx = sx;
  let cy = sy;
  let bx = sx - 1;
  let by = sy;
  const maxSteps = pw * ph;

  for (let step = 0; step < maxSteps; step++) {
    const startDi = dirIndex(bx - cx, by - cy);
    let prevX = bx;
    let prevY = by;
    let moved = false;

    for (let k = 1; k <= 8; k++) {
      const di = (startDi + k) % 8;
      const nx = cx + dirs[di][0];
      const ny = cy + dirs[di][1];
      if (nx >= 0 && nx < pw && ny >= 0 && ny < ph && mask[ny * pw + nx]) {
        cx = nx;
        cy = ny;
        bx = prevX;
        by = prevY;
        moved = true;
        break;
      }
      prevX = nx;
      prevY = ny;
    }

    if (!moved || (cx === sx && cy === sy)) break;
    contour.push({ x: cx, y: cy });
  }

  return contour;
}

function perpendicularDistance(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-9) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function rdpOpenChain(pts, eps) {
  if (pts.length <= 2) return pts.slice();
  let dmax = 0;
  let idx = 0;
  const first = pts[0];
  const last = pts[pts.length - 1];
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpendicularDistance(pts[i], first, last);
    if (d > dmax) {
      dmax = d;
      idx = i;
    }
  }
  if (dmax > eps) {
    const left = rdpOpenChain(pts.slice(0, idx + 1), eps);
    const right = rdpOpenChain(pts.slice(idx), eps);
    return left.slice(0, -1).concat(right);
  }
  return [first, last];
}

function rdpClosedPolygon(pts, eps) {
  const n = pts.length;
  if (n < 4) return pts.slice();
  const step = Math.max(1, Math.floor(n / 40));
  let bestDist2 = -1;
  let i0 = 0;
  let i1 = Math.floor(n / 2);
  for (let i = 0; i < n; i += step) {
    for (let j = i + step; j < n; j += step) {
      const dx = pts[i].x - pts[j].x;
      const dy = pts[i].y - pts[j].y;
      const d2 = dx * dx + dy * dy;
      if (d2 > bestDist2) {
        bestDist2 = d2;
        i0 = i;
        i1 = j;
      }
    }
  }
  if (i0 > i1) {
    const tmp = i0;
    i0 = i1;
    i1 = tmp;
  }

  const c1 = rdpOpenChain(pts.slice(i0, i1 + 1), eps);
  const c2 = rdpOpenChain(pts.slice(i1).concat(pts.slice(0, i0 + 1)), eps);
  const res = c1.slice(0, -1).concat(c2.slice(0, -1));

  let changed = true;
  while (changed && res.length > 3) {
    changed = false;
    for (let i = 0; i < res.length; i++) {
      const a = res[(i - 1 + res.length) % res.length];
      const b = res[i];
      const c = res[(i + 1) % res.length];
      if (perpendicularDistance(b, a, c) < eps * 0.75) {
        res.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return res;
}

/**
 * Rectifies a simplified nearly-orthogonal polygon into exact 90-degree H/V architectural walls
 * and collapses small hand-tremor or attached-label bumps (< 14% of min dimension).
 */
function rectifyAndSimplifyOrthogonal(poly) {
  const n = poly.length;
  if (n < 4) return poly;

  // Check if at least 72% of perimeter length is near Horizontal or Vertical (within 22 deg)
  let totalLen = 0;
  let orthoLen = 0;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const dx = Math.abs(b.x - a.x);
    const dy = Math.abs(b.y - a.y);
    const len = Math.hypot(dx, dy);
    totalLen += len;
    if (Math.min(dx, dy) <= 0.4 * Math.max(dx, dy)) {
      orthoLen += len;
    }
  }
  if (totalLen < 1e-3 || orthoLen / totalLen < 0.72) {
    return poly;
  }

  // Classify edges H / V and merge consecutive same-orientation edges
  const merged = [];
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const ori = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? 'H' : 'V';
    if (merged.length && merged[merged.length - 1].ori === ori) {
      merged[merged.length - 1].b = b;
      merged[merged.length - 1].pts.push(b);
    } else {
      merged.push({ ori, a, b, pts: [a, b] });
    }
  }
  if (merged.length > 1 && merged[0].ori === merged[merged.length - 1].ori) {
    const tail = merged.pop();
    merged[0].a = tail.a;
    merged[0].pts = tail.pts.slice(0, -1).concat(merged[0].pts);
  }
  if (merged.length < 4 || merged.length % 2 !== 0) {
    return poly;
  }

  // Average coordinate weighted by segment span along each H/V run
  const coords = merged.map((seg) => {
    if (seg.ori === 'H') {
      const yMid = (seg.a.y + seg.b.y) / 2;
      return { ori: 'H', coord: yMid };
    }
    const xMid = (seg.a.x + seg.b.x) / 2;
    return { ori: 'V', coord: xMid };
  });

  let pts = coords.map((curr, i) => {
    const prev = coords[(i - 1 + coords.length) % coords.length];
    return {
      x: prev.ori === 'V' ? prev.coord : curr.coord,
      y: prev.ori === 'H' ? prev.coord : curr.coord,
    };
  });

  // Collapse tiny step bumps / digit spurs (< 14% of smaller bbox dimension)
  for (let iter = 0; iter < 12; iter++) {
    const m = pts.length;
    if (m <= 4) break;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const minDim = Math.min(maxX - minX, maxY - minY);
    const thresh = minDim * 0.14;
    const lens = pts.map((p, i) => {
      const q = pts[(i + 1) % m];
      return Math.hypot(q.x - p.x, q.y - p.y);
    });
    let minIdx = 0;
    for (let i = 1; i < m; i++) {
      if (lens[i] < lens[minIdx]) minIdx = i;
    }
    if (lens[minIdx] >= thresh) break;

    const i0 = minIdx;
    const i1 = (i0 + 1) % m;
    const prevI = (i0 - 1 + m) % m;
    const nextI = (i1 + 1) % m;
    const isHoriz = Math.abs(pts[i1].x - pts[i0].x) >= Math.abs(pts[i1].y - pts[i0].y);
    const targetCoord = lens[prevI] >= lens[i1] ? (isHoriz ? pts[i0].x : pts[i0].y) : (isHoriz ? pts[i1].x : pts[i1].y);

    if (isHoriz) {
      pts[prevI].x = targetCoord;
      pts[i0].x = targetCoord;
      pts[i1].x = targetCoord;
      pts[nextI].x = targetCoord;
    } else {
      pts[prevI].y = targetCoord;
      pts[i0].y = targetCoord;
      pts[i1].y = targetCoord;
      pts[nextI].y = targetCoord;
    }

    // Remove duplicate & collinear vertices
    let cleaned = pts;
    for (let pass = 0; pass < 2; pass++) {
      const next = [];
      for (let k = 0; k < cleaned.length; k++) {
        const pPrev = cleaned[(k - 1 + cleaned.length) % cleaned.length];
        const pCurr = cleaned[k];
        const pNext = cleaned[(k + 1) % cleaned.length];
        if (Math.hypot(pCurr.x - pPrev.x, pCurr.y - pPrev.y) < 1e-3) continue;
        const cross =
          (pCurr.x - pPrev.x) * (pNext.y - pCurr.y) - (pCurr.y - pPrev.y) * (pNext.x - pCurr.x);
        const dot =
          (pCurr.x - pPrev.x) * (pNext.x - pCurr.x) + (pCurr.y - pPrev.y) * (pNext.y - pCurr.y);
        if (Math.abs(cross) < 1e-2 && dot >= -1e-2) continue;
        next.push(pCurr);
      }
      cleaned = next;
    }
    pts = cleaned;
  }

  return pts;
}

/**
 * Classifies an extracted polygon into shapeType ('rectangle', 'l_shape', 't_shape', 'u_shape', 'cross_shape', 'custom_polygon')
 */
function classifyExtractedPolygon(pts) {
  const n = pts.length;
  if (n <= 4) return 'rectangle';
  if (n === 6) return 'l_shape';

  // Count reflex (concave) corners via signed cross product (screen coords: clockwise polygon has area > 0)
  let signed2 = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    signed2 += a.x * b.y - b.x * a.y;
  }
  const orientSign = signed2 >= 0 ? 1 : -1;
  let reflexCount = 0;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const cross = (p1.x - p0.x) * (p2.y - p1.y) - (p1.y - p0.y) * (p2.x - p1.x);
    if (cross * orientSign < -1e-2) reflexCount++;
  }

  if (n === 8 && reflexCount === 2) {
    // T-shape has two notches on adjacent corners vs U-shape with single courtyard notch; either uses exact traced vertices
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const reflexPts = [];
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];
      const cross = (p1.x - p0.x) * (p2.y - p1.y) - (p1.y - p0.y) * (p2.x - p1.x);
      if (cross * orientSign < -1e-2) reflexPts.push(p1);
    }
    const sameSideX =
      reflexPts.length === 2 &&
      ((reflexPts[0].x < cx && reflexPts[1].x < cx) || (reflexPts[0].x > cx && reflexPts[1].x > cx));
    const sameSideY =
      reflexPts.length === 2 &&
      ((reflexPts[0].y < cy && reflexPts[1].y < cy) || (reflexPts[0].y > cy && reflexPts[1].y > cy));
    if (sameSideX || sameSideY) {
      // Check whether inner span connects toward center (U) vs separates two wings (T)
      return Math.abs(reflexPts[0].x - reflexPts[1].x) < 1e-2 || Math.abs(reflexPts[0].y - reflexPts[1].y) < 1e-2
        ? 'u_shape'
        : 't_shape';
    }
    return 't_shape';
  }

  if (n === 12 && reflexCount === 4) return 'cross_shape';
  return 'custom_polygon';
}

/**
 * Extracts and rectifies a single interior component blob into an orthogonal building contour.
 */
function extractContourFromComponent(comp, rad) {
  const pad = rad + 12;
  const pw = comp.bw + 2 * pad;
  const ph = comp.bh + 2 * pad;
  const grid = new Uint8Array(pw * ph);
  for (let i = 0; i < comp.count; i++) {
    const gx = comp.coordsX[i] - comp.minX + pad;
    const gy = comp.coordsY[i] - comp.minY + pad;
    grid[gy * pw + gx] = 1;
  }

  const { solid, solidCount } = floodFillInteriorMask(grid, pw, ph);
  const fillRatio = solidCount / Math.max(1, comp.bw * comp.bh);
  if (fillRatio < 0.25 && rad < 5) return null;

  // Erode closing dilation, then open gently (r=4) to shave any tiny attached spurs/digits
  const eroded = erodeBinaryMask(solid, pw, ph, rad);
  const rOpen = Math.min(5, Math.max(2, Math.floor(Math.min(comp.bw, comp.bh) * 0.025)));
  const opened = dilateBinaryMask(erodeBinaryMask(eroded, pw, ph, rOpen), pw, ph, rOpen);

  // Keep largest 4-connected blob in opened mask
  const visited = new Uint8Array(pw * ph);
  const qx = new Int32Array(pw * ph);
  const qy = new Int32Array(pw * ph);
  let bestTail = 0;
  let bestBlob = null;
  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      const si = y * pw + x;
      if (!opened[si] || visited[si]) continue;
      visited[si] = 1;
      let head = 0;
      let tail = 0;
      qx[tail] = x;
      qy[tail] = y;
      tail++;
      while (head < tail) {
        const cx = qx[head];
        const cy = qy[head];
        head++;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx >= 0 && nx < pw && ny >= 0 && ny < ph) {
            const ni = ny * pw + nx;
            if (opened[ni] && !visited[ni]) {
              visited[ni] = 1;
              qx[tail] = nx;
              qy[tail] = ny;
              tail++;
            }
          }
        }
      }
      if (tail > bestTail) {
        bestTail = tail;
        bestBlob = { xs: qx.slice(0, tail), ys: qy.slice(0, tail) };
      }
    }
  }
  if (!bestBlob || bestTail < 100) return null;

  const blobMask = new Uint8Array(pw * ph);
  for (let i = 0; i < bestTail; i++) {
    blobMask[bestBlob.ys[i] * pw + bestBlob.xs[i]] = 1;
  }

  const rawContour = traceOuterBoundaryMoore(blobMask, pw, ph);
  if (rawContour.length < 12) return null;

  // Measure fine contour tilt and de-rotate slight camera slant (within +-15 deg)
  const epsFine = Math.max(2.0, 0.015 * Math.min(comp.bw, comp.bh));
  const finePoly = rdpClosedPolygon(rawContour, epsFine);
  let sinSum = 0;
  let cosSum = 0;
  for (let i = 0; i < finePoly.length; i++) {
    const a = finePoly[i];
    const b = finePoly[(i + 1) % finePoly.length];
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    sinSum += len * Math.sin(4 * ang);
    cosSum += len * Math.cos(4 * ang);
  }
  let tilt = 0.25 * Math.atan2(sinSum, cosSum);
  if (tilt > Math.PI / 4) tilt -= Math.PI / 2;
  if (tilt < -Math.PI / 4) tilt += Math.PI / 2;

  let alignedContour = rawContour;
  if (Math.abs(tilt) > (1.5 * Math.PI) / 180 && Math.abs(tilt) <= (15 * Math.PI) / 180) {
    const cosT = Math.cos(-tilt);
    const sinT = Math.sin(-tilt);
    const midX = pw / 2;
    const midY = ph / 2;
    alignedContour = rawContour.map((p) => ({
      x: (p.x - midX) * cosT - (p.y - midY) * sinT + midX,
      y: (p.x - midX) * sinT + (p.y - midY) * cosT + midY,
    }));
  }

  const eps = Math.max(4.5, 0.045 * Math.min(comp.bw, comp.bh));
  const simplified = rdpClosedPolygon(alignedContour, eps);
  const rectified = rectifyAndSimplifyOrthogonal(simplified);
  if (rectified.length < 4) return null;

  let pMinX = Infinity, pMaxX = -Infinity, pMinY = Infinity, pMaxY = -Infinity;
  const imageSpacePoly = rectified.map((p) => {
    const ix = p.x - pad + comp.minX;
    const iy = p.y - pad + comp.minY;
    if (ix < pMinX) pMinX = ix;
    if (ix > pMaxX) pMaxX = ix;
    if (iy < pMinY) pMinY = iy;
    if (iy > pMaxY) pMaxY = iy;
    return { x: ix, y: iy };
  });

  const boxW = Math.max(10, pMaxX - pMinX);
  const boxH = Math.max(10, pMaxY - pMinY);
  const shapeType = classifyExtractedPolygon(imageSpacePoly);

  return {
    shapeType,
    verticesPx: imageSpacePoly,
    bboxPx: { minX: pMinX, minY: pMinY, maxX: pMaxX, maxY: pMaxY, width: boxW, height: boxH },
    aspect: boxW / boxH,
    closingRadius: rad,
  };
}

/**
 * Extracts exact closed building polygon contour directly from a binary Blueprint Scan `inkMask`.
 * Returns normalized polygon vertices in pixel coordinates relative to component bbox + classified shapeType + aspect ratio.
 */
export function extractBuildingContourFromMask(inkMask, w, h) {
  if (!inkMask || w < 32 || h < 32) return null;

  const mx = Math.max(3, Math.round(w * 0.03));
  const my = Math.max(3, Math.round(h * 0.03));
  const clean = new Uint8Array(w * h);
  for (let y = my; y < h - my; y++) {
    const row = y * w;
    for (let x = mx; x < w - mx; x++) {
      clean[row + x] = inkMask[row + x] ? 1 : 0;
    }
  }

  let bestRectFallback = null;

  // Try progressive closing radii (2 -> 3 -> 4 -> 5) to weld tiny pencil gaps without pulling in text
  for (const rad of [2, 3, 4, 5]) {
    const dilated = dilateBinaryMask(clean, w, h, rad);
    const comps = findInteriorComponents(dilated, w, h);
    if (!comps.length) continue;

    const candidates = [];
    for (const comp of comps.slice(0, 5)) {
      if (comps.length > 1 && comp.bw > w * 0.85 && comp.bh > h * 0.85) {
        continue;
      }
      const res = extractContourFromComponent(comp, rad);
      if (res) candidates.push(res);
    }

    const nonRect = candidates.find((c) => c.shapeType !== 'rectangle');
    if (nonRect) {
      return nonRect;
    }
    if (candidates.length > 0 && !bestRectFallback) {
      bestRectFallback = candidates.reduce((best, cur) =>
        cur.bboxPx.width * cur.bboxPx.height > best.bboxPx.width * best.bboxPx.height ? cur : best
      );
    }
  }

  return bestRectFallback;
}

/**
 * Runs native Browser TextDetector (when present, e.g. Android Chrome) across 0/90/180/270 deg rotations
 * on a high-contrast black-on-white canvas so upside-down or vertical handwritten measurements are detected.
 */
async function detectOcrBlocksMultiAngle(blueprintInfo) {
  if (typeof window === 'undefined' || !('TextDetector' in window) || typeof document === 'undefined') {
    return { ocrStrings: [], edgeHits: {} };
  }

  const results = [];
  const { inkMask, width: w, height: h } = blueprintInfo;

  try {
    const detector = new window.TextDetector();

    // Build crisp black-ink on white paper canvas
    const baseCanvas = document.createElement('canvas');
    baseCanvas.width = w;
    baseCanvas.height = h;
    const bCtx = baseCanvas.getContext('2d');
    const imgData = bCtx.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const p = i * 4;
      const val = inkMask[i] ? 10 : 255;
      imgData.data[p] = val;
      imgData.data[p + 1] = val;
      imgData.data[p + 2] = val;
      imgData.data[p + 3] = 255;
    }
    bCtx.putImageData(imgData, 0, 0);

    for (const angle of [0, 90, 180, 270]) {
      const rotCanvas = document.createElement('canvas');
      rotCanvas.width = angle === 90 || angle === 270 ? h : w;
      rotCanvas.height = angle === 90 || angle === 270 ? w : h;
      const rCtx = rotCanvas.getContext('2d');
      rCtx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
      rCtx.rotate((angle * Math.PI) / 180);
      rCtx.drawImage(baseCanvas, -w / 2, -h / 2);

      const blocks = await detector.detect(rotCanvas);
      for (const blk of blocks) {
        if (!blk.rawValue || !blk.boundingBox) continue;
        const rcx = blk.boundingBox.x + blk.boundingBox.width / 2 - rotCanvas.width / 2;
        const rcy = blk.boundingBox.y + blk.boundingBox.height / 2 - rotCanvas.height / 2;
        const invRad = (-angle * Math.PI) / 180;
        const origX = rcx * Math.cos(invRad) - rcy * Math.sin(invRad) + w / 2;
        const origY = rcx * Math.sin(invRad) + rcy * Math.cos(invRad) + h / 2;
        results.push({ text: blk.rawValue.trim(), cx: origX, cy: origY });
      }
    }
  } catch {
    // Ignore if TextDetector fails on platform
  }

  const seen = new Set();
  const uniqueStrings = [];
  const edgeHits = { top: null, right: null, bottom: null, left: null };

  for (const item of results) {
    if (!seen.has(item.text)) {
      seen.add(item.text);
      uniqueStrings.push(item.text);
    }
    const numMatch = item.text.match(/(\d+(?:\.\d+)?)/);
    if (numMatch && Number.isFinite(item.cx) && Number.isFinite(item.cy)) {
      const num = parseFloat(numMatch[1]);
      if (num >= 0.5 && num <= 120) {
        // Assign by quadrant relative to image center if near edges
        const nx = (item.cx - w / 2) / (w / 2);
        const ny = (item.cy - h / 2) / (h / 2);
        if (Math.abs(ny) >= Math.abs(nx)) {
          if (ny < 0 && !edgeHits.top) edgeHits.top = num;
          else if (ny >= 0 && !edgeHits.bottom) edgeHits.bottom = num;
        } else {
          if (nx < 0 && !edgeHits.left) edgeHits.left = num;
          else if (nx >= 0 && !edgeHits.right) edgeHits.right = num;
        }
      }
    }
  }

  return { ocrStrings: uniqueStrings, edgeHits };
}

/**
 * Tier 2: Offline Canvas Contour Extractor + Multi-Angle TextDetector OCR + Notes Parser
 */
async function analyzeWithOfflineScanner({
  blueprintInfo,
  unitSystem,
  manualNotesText,
  preExtracted = null,
}) {
  const { inkMask, width: w, height: h } = blueprintInfo;

  // 1. Multi-angle native OCR when available
  const { ocrStrings, edgeHits } = await detectOcrBlocksMultiAngle(blueprintInfo);

  const combinedText = [ocrStrings.join('  '), manualNotesText || ''].filter(Boolean).join('  ');
  const parsedNotes = parsePaperLabelNotes(combinedText, unitSystem);

  // Merge spatially matched OCR wall dimensions if manual notes didn't specify them
  const mergedEdgeDims = {
    top: parsedNotes.edgeDimensions?.top || edgeHits.top || null,
    right: parsedNotes.edgeDimensions?.right || edgeHits.right || null,
    bottom: parsedNotes.edgeDimensions?.bottom || edgeHits.bottom || null,
    left: parsedNotes.edgeDimensions?.left || edgeHits.left || null,
  };

  // 2. Reuse or extract exact contour polygon directly from Blueprint Scan inkMask
  const extracted = preExtracted || extractBuildingContourFromMask(inkMask, w, h);

  let aspect = extracted ? extracted.aspect : 1.35;
  let inferredShape = parsedNotes.shapeType || (extracted ? extracted.shapeType : 'rectangle');
  const inferredRoofType = parsedNotes.roofType || 'hip';

  // Determine metric outer width (horizontal) & outer breadth/height (vertical)
  // Respect portrait orientation (width < height) from the scanned contour!
  let targetW = null;
  let targetH = null;

  const horizFromEdges = Math.max(mergedEdgeDims.top || 0, mergedEdgeDims.bottom || 0);
  const vertFromEdges = Math.max(mergedEdgeDims.left || 0, mergedEdgeDims.right || 0);
  if (horizFromEdges > 0) targetW = round2(horizFromEdges);
  if (vertFromEdges > 0) targetH = round2(vertFromEdges);

  if (targetW === null && parsedNotes.length) targetW = parsedNotes.length;
  if (targetH === null && parsedNotes.breadth) targetH = parsedNotes.breadth;

  // If user typed shorthand "a x b" on a portrait drawing, orient major/minor axis to match scanned aspect
  if (
    parsedNotes.length &&
    parsedNotes.breadth &&
    !hasExplicitAxis(manualNotesText) &&
    extracted
  ) {
    const minor = Math.min(parsedNotes.length, parsedNotes.breadth);
    const major = Math.max(parsedNotes.length, parsedNotes.breadth);
    if (aspect < 0.94) {
      targetW = minor;
      targetH = major;
    } else if (aspect > 1.06) {
      targetW = major;
      targetH = minor;
    }
  }

  if (targetW !== null && targetH === null) {
    targetH = round2(Math.max(1.0, targetW / Math.max(0.25, aspect)));
  } else if (targetH !== null && targetW === null) {
    targetW = round2(Math.max(1.0, targetH * aspect));
  } else if (targetW === null && targetH === null) {
    // Default clean architectural scale preserving exact scanned width:height ratio
    if (aspect >= 1) {
      targetW = 10.0;
      targetH = round2(10.0 / Math.min(3.0, Math.max(0.35, aspect)));
    } else {
      targetH = 10.0;
      targetW = round2(10.0 * Math.max(0.35, aspect));
    }
  }

  let polygonVertices = null;
  if (inferredShape !== 'rectangle') {
    if (
      extracted &&
      extracted.verticesPx.length >= 5 &&
      (!parsedNotes.shapeType || parsedNotes.shapeType === extracted.shapeType)
    ) {
      // Scale exact traced contour polygon from Blueprint Scan
      const scaled = scalePolygonToBounds(extracted.verticesPx, targetW, targetH);
      polygonVertices = applyDirectionalLAdjustments(scaled, mergedEdgeDims, targetW, targetH);
    } else {
      polygonVertices = buildScaledShapeVertices(inferredShape, targetW, targetH);
    }
  }

  const detectedLabels = [...parsedNotes.detectedLabels];
  if (extracted && !parsedNotes.length && !parsedNotes.breadth && horizFromEdges === 0 && vertFromEdges === 0) {
    detectedLabels.push({
      label: 'Scanned Footprint',
      valueText: `${inferredShape.replace('_', ' ')} (${targetW}m × ${targetH}m proportion)`,
      meters: Math.max(targetW, targetH),
    });
  }

  return {
    engine: 'offline-scanner',
    model: ocrStrings.length > 0 ? 'Standard Scan + OCR' : 'Standard Scan',
    shapeType: inferredShape,
    roofType: inferredRoofType,
    length: targetW,
    breadth: targetH,
    slantingHeight: parsedNotes.slantingHeight || null,
    kingpostHeight: parsedNotes.kingpostHeight || null,
    pitchAngle: parsedNotes.pitchAngle || null,
    overhang: parsedNotes.overhang !== null ? parsedNotes.overhang : null,
    parapetHeight: parsedNotes.parapetHeight || null,
    polygonVertices,
    extensions: [],
    detectedLabels,
    confidence: parsedNotes.hasParsedValues || ocrStrings.length > 0 ? 'high' : 'medium',
    notes: parsedNotes.hasParsedValues
      ? 'Extracted exact footprint contour and applied measurement labels.'
      : 'Extracted exact shape contour from Blueprint Scan. Click any wall dimension on the 2D plan to set exact real-world scale, or type sizes below.',
  };
}

function hasExplicitAxis(text = '') {
  return /\b(?:length|breadth|width|span|top|bottom|left|right|L|B|W)\b/i.test(text || '');
}

/**
 * Main entry point: Hybrid Paper Sketch -> 2D Roof Geometry
 * Optimizes token consumption via:
 *  - Local offline contour tracing first (Gemini skips redundant polygon generation)
 *  - Image downscale + JPEG compression (<= 896px) before Vision API upload
 *  - In-memory & sessionStorage cache + 0-token manual note overrides on Re-Scan
 */
export async function analyzePaperSketch({
  imageDataUrl,
  stageId = 'foundation',
  unitSystem = 'metric',
  manualNotesText = '',
  apiKey = '',
  preferCached = true,
  isPro = false,
  accessToken = '',
}) {
  const blueprintInfo = await createBlueprintPreview(imageDataUrl);
  const offlineExtracted = extractBuildingContourFromMask(
    blueprintInfo.inkMask,
    blueprintInfo.width,
    blueprintInfo.height
  );
  const effectiveKey = (apiKey || getStoredGeminiApiKey() || '').trim();
  const useProProxy = Boolean(isPro && (accessToken || !effectiveKey));
  const manualParsed = parsePaperLabelNotes(manualNotesText, unitSystem);

  if (useProProxy || effectiveKey) {
    try {
      const cacheKey = computeImageCacheKey(imageDataUrl, unitSystem);
      let visionResult = preferCached ? getCachedVisionResult(cacheKey) : null;
      const fromCache = Boolean(visionResult);

      if (!visionResult) {
        if (useProProxy) {
          visionResult = await analyzeWithProBackend({
            imageDataUrl,
            stageId,
            unitSystem,
            manualNotesText,
            offlineExtracted,
            accessToken,
          });
        } else {
          visionResult = await analyzeWithGeminiVision({
            imageDataUrl,
            stageId,
            unitSystem,
            manualNotesText,
            apiKey: effectiveKey,
            offlineExtracted,
          });
        }
        setCachedVisionResult(cacheKey, visionResult);
      }

      const finalShape = manualParsed.shapeType || visionResult.shapeType || offlineExtracted?.shapeType || 'rectangle';
      const mergedEdges = {
        top: manualParsed.edgeDimensions?.top || visionResult.edgeDimensions?.top || null,
        right: manualParsed.edgeDimensions?.right || visionResult.edgeDimensions?.right || null,
        bottom: manualParsed.edgeDimensions?.bottom || visionResult.edgeDimensions?.bottom || null,
        left: manualParsed.edgeDimensions?.left || visionResult.edgeDimensions?.left || null,
      };
      let finalLength = manualParsed.length || visionResult.length || 12;
      let finalBreadth = manualParsed.breadth || visionResult.breadth || 8;

      if (
        manualParsed.length &&
        manualParsed.breadth &&
        !hasExplicitAxis(manualNotesText) &&
        offlineExtracted
      ) {
        const minor = Math.min(manualParsed.length, manualParsed.breadth);
        const major = Math.max(manualParsed.length, manualParsed.breadth);
        if (offlineExtracted.aspect < 0.94) {
          finalLength = minor;
          finalBreadth = major;
        } else if (offlineExtracted.aspect > 1.06) {
          finalLength = major;
          finalBreadth = minor;
        }
      }

      const hasAiMetricPoly =
        Array.isArray(visionResult.polygonVertices) &&
        visionResult.polygonVertices.length >= 4 &&
        !manualParsed.shapeType;

      let finalPoly = hasAiMetricPoly ? visionResult.polygonVertices : null;
      if (finalShape !== 'rectangle') {
        if (hasAiMetricPoly) {
          finalPoly =
            manualParsed.length || manualParsed.breadth
              ? scalePolygonToBounds(finalPoly, finalLength, finalBreadth)
              : finalPoly;
        } else if (
          offlineExtracted &&
          offlineExtracted.verticesPx?.length >= 5 &&
          (!finalPoly || finalPoly.length < 4 || offlineExtracted.shapeType === finalShape)
        ) {
          finalPoly = applyDirectionalLAdjustments(
            scalePolygonToBounds(offlineExtracted.verticesPx, finalLength, finalBreadth),
            mergedEdges,
            finalLength,
            finalBreadth
          );
        } else if (!finalPoly || finalPoly.length < 3 || manualParsed.length || manualParsed.breadth) {
          finalPoly =
            finalPoly && finalPoly.length >= 4
              ? scalePolygonToBounds(finalPoly, finalLength, finalBreadth)
              : buildScaledShapeVertices(finalShape, finalLength, finalBreadth);
        }
      } else {
        finalPoly = null;
      }

      const mergedLabels = [
        ...(visionResult.detectedLabels || []),
        ...(manualParsed.detectedLabels || []),
      ];

      return {
        ...visionResult,
        model: fromCache ? `${visionResult.model} (Cached)` : visionResult.model,
        shapeType: finalShape,
        roofType: manualParsed.roofType || visionResult.roofType,
        length: finalLength,
        breadth: finalBreadth,
        slantingHeight: manualParsed.slantingHeight || visionResult.slantingHeight,
        kingpostHeight: manualParsed.kingpostHeight || visionResult.kingpostHeight,
        pitchAngle: manualParsed.pitchAngle || visionResult.pitchAngle,
        overhang: manualParsed.overhang !== null ? manualParsed.overhang : visionResult.overhang,
        parapetHeight: manualParsed.parapetHeight || visionResult.parapetHeight,
        polygonVertices: finalPoly,
        detectedLabels: mergedLabels,
        blueprintDataUrl: blueprintInfo.blueprintDataUrl,
      };
    } catch (visionErr) {
      const fallback = await analyzeWithOfflineScanner({
        blueprintInfo,
        imageDataUrl,
        unitSystem,
        manualNotesText,
        preExtracted: offlineExtracted,
      });
      return {
        ...fallback,
        visionWarning: formatFriendlyVisionWarning(visionErr),
        visionCode: visionErr?.code || 'AI_BUSY',
        creditCharged: false,
        blueprintDataUrl: blueprintInfo.blueprintDataUrl,
      };
    }
  }

  const offlineResult = await analyzeWithOfflineScanner({
    blueprintInfo,
    imageDataUrl,
    unitSystem,
    manualNotesText,
    preExtracted: offlineExtracted,
  });
  return {
    ...offlineResult,
    blueprintDataUrl: blueprintInfo.blueprintDataUrl,
  };
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode uploaded sketch image.'));
    img.src = src;
  });
}

function positiveOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? round2(n) : null;
}

function round2(v) {
  return Math.round((Number(v) + Number.EPSILON) * 100) / 100;
}

