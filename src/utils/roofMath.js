/**
 * Advanced Roof Geometry & Calculation Engine
 * Supports Gable, Hip, Shed (Mono-pitch), Gambrel, and Arbitrary Polygon Roofs (Cross, L-Shape, T-Shape)
 * Preserves & extends the core calculations from David Akinbode
 * Supports Asymmetric Per-Side Overhangs & Custom Multi-Segment Sketched Walls
 */

import { buildRoofSkeleton } from './roofSkeleton.js';

export const ROOF_TYPES = [
  { id: 'hip', name: 'Hip Roof', desc: 'Slopes down on all four sides with hips and ridge' },
  { id: 'gable', name: 'Gable Roof', desc: 'Classic two-pitch slope with triangular end walls' },
  { id: 'shed', name: 'Shed / Mono-Pitch', desc: 'Single sloping plane, ideal for modern homes & extensions' },
  { id: 'flat', name: 'Flat Roof', desc: 'Modern low-slope flat roof deck (concealed or slab finish)' },
];

export const PITCH_PRESETS = [
  { label: 'Low Pitch (3:12 / 14°)', ratio: '3:12', degrees: 14.04, risePerRun: 3 / 12 },
  { label: 'Standard Pitch (4:12 / 18.4°)', ratio: '4:12', degrees: 18.43, risePerRun: 4 / 12 },
  { label: 'Moderate Pitch (6:12 / 26.6°)', ratio: '6:12', degrees: 26.57, risePerRun: 6 / 12 },
  { label: 'Steep Pitch (8:12 / 33.7°)', ratio: '8:12', degrees: 33.69, risePerRun: 8 / 12 },
  { label: 'Very Steep (10:12 / 39.8°)', ratio: '10:12', degrees: 39.81, risePerRun: 10 / 12 },
  { label: '45° Pitch (12:12 / 45°)', ratio: '12:12', degrees: 45.0, risePerRun: 12 / 12 },
];

export const OVERHANG_PRESETS = [
  { id: 'standard', name: 'Uniform Eaves (0.4m)', values: { front: 0.4, back: 0.4, left: 0.4, right: 0.4 } },
  { id: 'porch_front', name: 'Front Porch / Verandah (+1.8m Front)', values: { front: 1.8, back: 0.4, left: 0.5, right: 0.5 } },
  { id: 'verandah_wrap', name: 'L-Wrap Verandah (+1.5m Front & Right)', values: { front: 1.5, back: 0.4, left: 0.4, right: 1.5 } },
  { id: 'carport_side', name: 'Carport / Awning (+2.2m Left)', values: { front: 0.4, back: 0.4, left: 2.2, right: 0.4 } },
  { id: 'wide_craftsman', name: 'Wide Craftsman Eaves (0.8m all round)', values: { front: 0.8, back: 0.8, left: 0.8, right: 0.8 } },
];

/**
 * Pre-defined polygon footprints including the Cross shape from the user video!
 */
export const SHAPE_PRESETS = [
  {
    id: 'cross',
    name: '➕ Cross Shape',
    desc: 'Cruciform floor plan with 4 intersecting wings and valley gutters',
    vertices: [
      { x: 4, y: 0 },
      { x: 8, y: 0 },
      { x: 8, y: 4 },
      { x: 12, y: 4 },
      { x: 12, y: 8 },
      { x: 8, y: 8 },
      { x: 8, y: 12 },
      { x: 4, y: 12 },
      { x: 4, y: 8 },
      { x: 0, y: 8 },
      { x: 0, y: 4 },
      { x: 4, y: 4 },
    ],
  },
  {
    id: 'l_shape',
    name: '📐 L-Shape House',
    desc: 'Classic residential L-shaped layout with corner courtyard',
    vertices: [
      { x: 0, y: 0 },
      { x: 14, y: 0 },
      { x: 14, y: 6 },
      { x: 7, y: 6 },
      { x: 7, y: 11 },
      { x: 0, y: 11 },
    ],
  },
  {
    id: 't_shape',
    name: '🏛️ T-Shape Villa',
    desc: 'Front entrance wing with central transverse wing',
    vertices: [
      { x: 4, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 14, y: 5 },
      { x: 14, y: 10 },
      { x: 0, y: 10 },
      { x: 0, y: 5 },
      { x: 4, y: 5 },
    ],
  },
];

/**
 * Normalizes overhang input into { front, back, left, right }
 */
export function normalizeOverhang(overhang) {
  if (typeof overhang === 'object' && overhang !== null) {
    return {
      front: Math.max(0, Number(overhang.front) || 0),
      back: Math.max(0, Number(overhang.back) || 0),
      left: Math.max(0, Number(overhang.left) || 0),
      right: Math.max(0, Number(overhang.right) || 0),
    };
  }
  const val = Math.max(0, Number(overhang) || 0);
  return { front: val, back: val, left: val, right: val };
}

/**
 * Computes Shoelace Area, Perimeter, and Bounding Box of any polygon
 */
export function calculatePolygonMetrics(vertices = []) {
  if (!vertices || vertices.length < 3) {
    return { area: 0, perimeter: 0, minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0, edges: [] };
  }

  const n = vertices.length;
  let areaSum = 0;
  let perimeter = 0;
  const edges = [];

  let minX = vertices[0].x;
  let maxX = vertices[0].x;
  let minY = vertices[0].y;
  let maxY = vertices[0].y;

  for (let i = 0; i < n; i++) {
    const p1 = vertices[i];
    const p2 = vertices[(i + 1) % n];

    // Bounding Box
    if (p1.x < minX) minX = p1.x;
    if (p1.x > maxX) maxX = p1.x;
    if (p1.y < minY) minY = p1.y;
    if (p1.y > maxY) maxY = p1.y;

    // Shoelace area
    areaSum += (p1.x * p2.y) - (p2.x * p1.y);

    // Edge Length
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    perimeter += len;

    edges.push({
      p1,
      p2,
      length: round(len, 2),
      isOrthogonal: Math.abs(dx) < 0.05 || Math.abs(dy) < 0.05,
      isVertical: Math.abs(dx) < 0.05,
      isHorizontal: Math.abs(dy) < 0.05,
    });
  }

  const area = Math.abs(areaSum) / 2;
  const width = maxX - minX;
  const height = maxY - minY;

  return {
    area: round(area, 2),
    perimeter: round(perimeter, 2),
    minX: round(minX, 2),
    maxX: round(maxX, 2),
    minY: round(minY, 2),
    maxY: round(maxY, 2),
    width: round(width, 2),
    height: round(height, 2),
    edges,
  };
}

/**
 * Estimates characteristic wing span W (in meters) for arbitrary rectilinear/polygon footprints
 * (Exact for rectangles, squares, L-shapes, T-shapes, and Cross-shapes of wing width W)
 */
export function getEffectivePolygonSpan(polygonVertices = null) {
  if (!polygonVertices || polygonVertices.length < 3) return null;
  const metrics = calculatePolygonMetrics(polygonVertices);
  const A = metrics.area;
  const P = metrics.perimeter;
  const minBound = Math.max(0.5, Math.min(metrics.width, metrics.height));
  if (A <= 0 || P <= 0) return minBound;

  const halfP = P / 2;
  const disc = halfP * halfP - 4 * A;
  if (disc >= 0) {
    const w = (halfP - Math.sqrt(disc)) / 2;
    if (w > 0.4) {
      return round(Math.min(minBound, Math.max(1.0, w)), 2);
    }
  }
  return round(Math.min(minBound, Math.max(1.0, (4 * A) / P)), 2);
}

/**
 * Offsets a simple polygon outward by `offsetDist` (in meters) for 2D eave boundary visualization
 */
export function offsetPolygonVertices(vertices = [], offsetDist = 0.45) {
  if (!vertices || vertices.length < 3 || Math.abs(offsetDist) <= 0.001) return vertices || [];
  const n = vertices.length;

  // Determine winding order (signed area in screen/meter space)
  let signedArea2 = 0;
  for (let i = 0; i < n; i++) {
    const p1 = vertices[i];
    const p2 = vertices[(i + 1) % n];
    signedArea2 += p1.x * p2.y - p2.x * p1.y;
  }
  const sign = signedArea2 >= 0 ? 1 : -1;

  const result = [];
  for (let i = 0; i < n; i++) {
    const prev = vertices[(i - 1 + n) % n];
    const curr = vertices[i];
    const next = vertices[(i + 1) % n];

    const e1x = curr.x - prev.x;
    const e1y = curr.y - prev.y;
    const len1 = Math.hypot(e1x, e1y) || 1;
    // Outward unit normal for edge prev->curr
    const n1x = sign * (e1y / len1);
    const n1y = sign * (-e1x / len1);

    const e2x = next.x - curr.x;
    const e2y = next.y - curr.y;
    const len2 = Math.hypot(e2x, e2y) || 1;
    // Outward unit normal for edge curr->next
    const n2x = sign * (e2y / len2);
    const n2y = sign * (-e2x / len2);

    let bx = n1x + n2x;
    let by = n1y + n2y;
    const bLen = Math.hypot(bx, by);
    if (bLen < 1e-4) {
      result.push({ x: curr.x + n1x * offsetDist, y: curr.y + n1y * offsetDist });
    } else {
      bx /= bLen;
      by /= bLen;
      const cosHalf = Math.max(0.35, bx * n1x + by * n1y);
      const signOff = offsetDist >= 0 ? 1 : -1;
      const absOff = Math.abs(offsetDist);
      const miter = signOff * Math.min(absOff * 2.2, absOff / cosHalf);
      result.push({
        x: round(curr.x + bx * miter, 3),
        y: round(curr.y + by * miter, 3),
      });
    }
  }
  // Guard against inward offsets collapsing tiny polygons
  if (offsetDist < 0) {
    let newSignedArea2 = 0;
    for (let i = 0; i < result.length; i++) {
      const p1 = result[i];
      const p2 = result[(i + 1) % result.length];
      newSignedArea2 += p1.x * p2.y - p2.x * p1.y;
    }
    if (Math.abs(newSignedArea2) < 0.25 || Math.sign(newSignedArea2) !== Math.sign(signedArea2)) {
      return vertices;
    }
  }
  return result;
}

/**
 * Effective horizontal slope run from ridge to outer eave (in meters)
 */
export function getEffectiveSlopeRun(breadth, overhang = 0.4, roofType = 'hip', polygonVertices = null) {
  const polySpan = polygonVertices && polygonVertices.length >= 3 ? getEffectivePolygonSpan(polygonVertices) : null;
  const b = Math.max(0.1, polySpan !== null ? polySpan : Number(breadth) || 0.1);
  const ov = normalizeOverhang(overhang);
  const effB = polySpan !== null
    ? b + (ov.front + ov.back + ov.left + ov.right) / 2
    : b + ov.front + ov.back;
  return roofType === 'shed' || roofType === 'flat' ? effB : effB / 2;
}

/**
 * Calculate Slanting Height (H) & Pitch Angle from vertical Kingpost Height (KP)
 */
export function calculateSlantingHeightFromKingpost(
  kingpostH,
  breadth,
  overhang = 0.4,
  roofType = 'hip',
  polygonVertices = null
) {
  const run = getEffectiveSlopeRun(breadth, overhang, roofType, polygonVertices);
  if (roofType === 'flat') {
    return {
      slantingHeight: round(run, 2),
      kingpostHeight: 0,
      pitchDegrees: 2.0,
      run: round(run, 2),
    };
  }
  const kp = Math.max(0.05, Number(kingpostH) || 0.05);

  let slantingH = Math.hypot(run, kp);
  let pitchDegrees = (Math.atan(kp / run) * 180) / Math.PI;

  if (roofType === 'gambrel') {
    const s1 = Math.hypot(run * 0.55, kp * 0.65);
    const s2 = Math.hypot(run * 0.45, kp * 0.35);
    slantingH = s1 + s2;
    pitchDegrees = (Math.atan((kp * 0.65) / (run * 0.55)) * 180) / Math.PI;
  }

  return {
    slantingHeight: round(slantingH, 2),
    kingpostHeight: round(kp, 2),
    pitchDegrees: round(pitchDegrees, 1),
    run: round(run, 2),
  };
}

/**
 * Calculate preset Slanting Height (H) from pitch angle (degrees), breadth, and overhang
 * H = effRun / cos(angle)
 */
export function calculateSlantingHeightFromAngle(
  angleDeg,
  breadth,
  overhang = 0.4,
  roofType = 'hip',
  polygonVertices = null
) {
  const run = getEffectiveSlopeRun(breadth, overhang, roofType, polygonVertices);
  const deg = Math.max(1, Math.min(80, Number(angleDeg) || 26.57));
  const rad = (deg * Math.PI) / 180;
  const vRise = run * Math.tan(rad);

  if (roofType === 'gambrel') {
    const s1 = Math.hypot(run * 0.55, vRise * 0.65);
    const s2 = Math.hypot(run * 0.45, vRise * 0.35);
    return round(s1 + s2, 2);
  }
  return round(run / Math.cos(rad), 2);
}

/**
 * Convert measured on-site Slanting Height (H) into vertical apex (Kingpost) rise & implied pitch angle
 */
export function calculateVerticalRiseFromSlantingHeight(
  slantingH,
  breadth,
  overhang = 0.4,
  roofType = 'hip',
  polygonVertices = null
) {
  const run = getEffectiveSlopeRun(breadth, overhang, roofType, polygonVertices);
  const sH = Number(slantingH) || 0;
  const isValid = sH > run + 0.01;

  if (!isValid) {
    return {
      isValid: false,
      minSlantingHeight: round(run + 0.05, 2),
      run: round(run, 2),
      verticalRise: 0,
      kingpostHeight: 0,
      pitchDegrees: 0,
    };
  }

  let verticalRise = Math.sqrt(Math.max(0.0001, sH * sH - run * run));
  if (roofType === 'gambrel') {
    let lo = 0.01;
    let hi = sH * 2;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      const tot = Math.hypot(run * 0.55, mid * 0.65) + Math.hypot(run * 0.45, mid * 0.35);
      if (tot < sH) lo = mid;
      else hi = mid;
    }
    verticalRise = (lo + hi) / 2;
  }

  const pitchDegrees = (Math.atan(verticalRise / run) * 180) / Math.PI;
  return {
    isValid: true,
    minSlantingHeight: round(run + 0.05, 2),
    run: round(run, 2),
    verticalRise,
    kingpostHeight: round(verticalRise, 2),
    pitchDegrees: round(pitchDegrees, 1),
  };
}

/**
 * Convert pitch mode and value to actual roof vertical rise / Kingpost Height (in meters)
 * Puts into full consideration the added eave overhang or parapet lap so slope runs cleanly from eave/parapet to apex.
 * Under standard 45° (12:12 ratio), Kingpost Height equals the effective slope run: KP = (Breadth / 2) + Overhang
 */
export function calculateRoofHeight(
  pitchMode,
  pitchValue,
  breadth,
  roofType = 'gable',
  overhang = 0.4,
  polygonVertices = null
) {
  // Slope run puts into consideration the added overhang / parapet drip lap
  const run = getEffectiveSlopeRun(breadth, overhang, roofType, polygonVertices);
  if (roofType === 'flat') {
    return 0.15;
  }

  if (pitchMode === 'height') {
    return Math.max(0, Number(pitchValue) || 0);
  }
  if (pitchMode === 'ratio') {
    const rise = Number(pitchValue) || 12;
    // Standard 12:12 (45°) gives KP = Run = (Breadth / 2) + Overhang
    return run * (rise / 12);
  }
  if (pitchMode === 'angle') {
    const deg = Math.max(1, Math.min(80, Number(pitchValue) || 45.0));
    const rad = (deg * Math.PI) / 180;
    return run * Math.tan(rad);
  }
  return run; // Default 45° (Rise = Run): Kingpost = Effective Run
}

/**
 * Main calculation function for roof geometries with asymmetric overhangs & arbitrary polygons
 */
export function calculateRoofGeometry({
  length = 10,
  breadth = 6,
  height = 2,
  overhang = 0.4,
  roofType = 'hip',
  wastePercentage = 10,
  extensions = [],
  polygonVertices = null,
}) {
  const ov = normalizeOverhang(overhang);
  const avgOv = (ov.front + ov.back + ov.left + ov.right) / 4;
  const waste = Math.max(0, Number(wastePercentage) || 0);

  // If the user has sketched or selected an arbitrary polygon (e.g. Cross, L-shape, T-shape)
  if (polygonVertices && polygonVertices.length >= 3) {
    const metrics = calculatePolygonMetrics(polygonVertices);
    const L = metrics.width;
    const B = metrics.height;
    let H = Math.max(0.05, Number(height) || 2.0);

    const slopeInfo = calculateSlantingHeightFromKingpost(H, B, ov, roofType, polygonVertices);
    const pitchDegrees = slopeInfo.pitchDegrees;
    const rafterLength = slopeInfo.slantingHeight;
    const effRun = slopeInfo.run;

    // Build intelligent multi-wing roof skeleton with independent Kingpost calculations per section
    const skeleton = buildRoofSkeleton(polygonVertices, ov, pitchDegrees, roofType);

    const baseArea = skeleton.totalRoofArea > 0
      ? skeleton.totalRoofArea
      : (metrics.area + metrics.perimeter * avgOv) / Math.max(0.2, Math.cos((pitchDegrees * Math.PI) / 180));
    const wasteMultiplier = 1 + waste / 100;
    const areaWithWaste = baseArea * wasteMultiplier;

    return {
      isCustomPolygon: true,
      polygonVertices,
      polygonEdges: metrics.edges,
      skeleton,
      sections: skeleton.sections || [],
      baseArea: round(baseArea, 2),
      totalArea: round(areaWithWaste, 2),
      wastePercentage: waste,
      wasteArea: round(areaWithWaste - baseArea, 2),
      totalRidge: round(skeleton.totalRidgeLength + skeleton.totalHipLength, 2),
      ridgeLengthOnly: round(skeleton.totalRidgeLength, 2),
      topRidgeLength: round(skeleton.totalRidgeLength, 2),
      hipRafterLength: round(skeleton.totalHipLength > 0 ? skeleton.totalHipLength / Math.max(1, skeleton.hips?.length || 1) : 0, 2),
      totalGutter: round(skeleton.totalValleyLength, 2),
      totalRake: 0,
      rafterLength: round(rafterLength, 2),
      slantingHeight: round(rafterLength, 2),
      kingpostHeight: round(skeleton.maxKingpost ?? H, 2),
      pitchDegrees: round(pitchDegrees, 1),
      roofHeight: round(skeleton.maxKingpost ?? H, 2),
      buildingDimensions: {
        length: L,
        breadth: B,
        height: round(skeleton.maxKingpost ?? H, 2),
        overhang: ov,
        effectiveLength: round(L + ov.left + ov.right, 2),
        effectiveBreadth: round(B + ov.front + ov.back, 2),
        perimeter: round(metrics.perimeter, 2),
        eavePerimeter: round(metrics.perimeter + 8 * avgOv, 2),
        isPorchOverhang: ov.front >= 1.2 || ov.back >= 1.2 || ov.left >= 1.2 || ov.right >= 1.2,
      },
      roofType,
      extensionDetails: [],
      extAreaTotal: 0,
      extRidgeTotal: 0,
      extGutterTotal: 0,
    };
  }

  // Fallback / Standard Parametric Roof Calculation
  const L = Math.max(0.5, Number(length) || 10);
  const B = Math.max(0.5, Number(breadth) || 6);
  let H = Math.max(0.01, Number(height) || 1.5);

  const effL = L + ov.left + ov.right;
  const effB = B + ov.front + ov.back;

  let totalArea = 0;
  let totalRidge = 0;
  let totalGutter = 0; // Simple roofs shed water freely over eaves — no valley gutter needed!
  let totalRake = 0;
  let rafterLength = 0;
  let topRidgeLength = 0;
  let hipRafterLength = 0;
  let pitchDegrees = 0;

  const perimeter = 2 * (L + B);

  if (roofType === 'gable') {
    const halfB = B / 2;
    const runFront = halfB + ov.front;
    const runBack = halfB + ov.back;

    const sFront = Math.sqrt(Math.pow(runFront, 2) + Math.pow(H, 2));
    const sBack = Math.sqrt(Math.pow(runBack, 2) + Math.pow(H, 2));
    rafterLength = (sFront + sBack) / 2;

    pitchDegrees = (Math.atan(H / ((runFront + runBack) / 2)) * 180) / Math.PI;

    topRidgeLength = effL;
    totalRidge = topRidgeLength;
    totalArea = effL * (sFront + sBack);
    totalGutter = 0; // No valley gutter
    totalRake = 2 * (sFront + sBack);

  } else if (roofType === 'hip') {
    const halfB = effB / 2;

    const sFront = Math.sqrt(Math.pow(B / 2 + ov.front, 2) + Math.pow(H, 2));
    const sBack = Math.sqrt(Math.pow(B / 2 + ov.back, 2) + Math.pow(H, 2));
    const sSide = Math.sqrt(Math.pow(halfB, 2) + Math.pow(H, 2));

    rafterLength = (sFront + sBack + 2 * sSide) / 4;
    pitchDegrees = (Math.atan(H / halfB) * 180) / Math.PI;

    topRidgeLength = Math.max(0, effL - effB);

    hipRafterLength = Math.sqrt(Math.pow(halfB, 2) + Math.pow(rafterLength, 2));
    const fourHips = 4 * hipRafterLength;

    totalRidge = topRidgeLength + fourHips;
    totalArea = 2 * effL * rafterLength;
    totalGutter = 0; // Normal hip roof sheds water freely off all 4 eaves (no valley gutter)
    totalRake = 0;

  } else if (roofType === 'shed') {
    const run = B + ov.front + ov.back;
    rafterLength = Math.sqrt(Math.pow(run, 2) + Math.pow(H, 2));
    pitchDegrees = (Math.atan(H / run) * 180) / Math.PI;

    topRidgeLength = effL;
    totalRidge = effL;
    totalArea = effL * rafterLength;
    totalGutter = 0;
    totalRake = 2 * rafterLength;

  } else if (roofType === 'flat') {
    H = 0;
    rafterLength = effB;
    pitchDegrees = 2.0;
    topRidgeLength = 0;
    totalRidge = 0;
    totalArea = effL * effB;
    totalGutter = 0;
    totalRake = 0;

  } else if (roofType === 'gambrel') {
    const halfB = effB / 2;
    const breakPointX = halfB * 0.55;
    const lowerH = H * 0.65;
    const upperH = H * 0.35;

    const lowerSlope = Math.sqrt(Math.pow(breakPointX, 2) + Math.pow(lowerH, 2));
    const upperSlope = Math.sqrt(Math.pow(halfB - breakPointX, 2) + Math.pow(upperH, 2));
    rafterLength = lowerSlope + upperSlope;
    pitchDegrees = (Math.atan(lowerH / breakPointX) * 180) / Math.PI;

    topRidgeLength = effL;
    totalRidge = topRidgeLength + 2 * effL;
    totalArea = 2 * effL * (lowerSlope + upperSlope);
    totalGutter = 0;
    totalRake = 4 * (lowerSlope + upperSlope);
  }

  // Extensions / Wings calculations
  let extensionDetails = [];
  let extAreaTotal = 0;
  let extRidgeTotal = 0;
  let extGutterTotal = 0;

  if (extensions && extensions.length > 0) {
    extensions.forEach((ext, index) => {
      const lExt = Math.max(0, Number(ext.length) || 0);
      const bExt = Math.max(0, Number(ext.breadth) || 0);
      const qExt = Math.max(1, Number(ext.quantity) || 1);

      if (lExt > 0 && bExt > 0) {
        const rExt = Math.sqrt(Math.pow(lExt, 2) + Math.pow(bExt, 2)) / 2;
        const areaAdd = 2 * (rExt * bExt) * qExt;
        const ridgeAdd = (qExt * rExt + bExt);
        const gutterAdd = 2 * qExt * rExt;

        extAreaTotal += areaAdd;
        extRidgeTotal += ridgeAdd;
        extGutterTotal += gutterAdd;

        extensionDetails.push({
          index: index + 1,
          length: lExt,
          breadth: bExt,
          quantity: qExt,
          valleyRafter: round(rExt, 2),
          addedArea: round(areaAdd, 2),
          addedRidge: round(ridgeAdd, 2),
          addedGutter: round(gutterAdd, 2),
        });
      }
    });

    totalArea += extAreaTotal;
    totalRidge += extRidgeTotal;
    totalGutter += extGutterTotal;
  }

  const baseArea = totalArea;
  const wasteMultiplier = 1 + waste / 100;
  const areaWithWaste = totalArea * wasteMultiplier;

  return {
    isCustomPolygon: false,
    baseArea: round(baseArea, 2),
    totalArea: round(areaWithWaste, 2),
    wastePercentage: waste,
    wasteArea: round(areaWithWaste - baseArea, 2),
    totalRidge: round(totalRidge, 2),
    topRidgeLength: round(topRidgeLength, 2),
    hipRafterLength: round(hipRafterLength, 2),
    totalGutter: round(totalGutter, 2),
    totalRake: round(totalRake, 2),
    rafterLength: round(rafterLength, 2),
    slantingHeight: round(rafterLength, 2),
    kingpostHeight: round(H, 2),
    pitchDegrees: round(pitchDegrees, 1),
    roofHeight: round(H, 2),
    buildingDimensions: {
      length: L,
      breadth: B,
      height: H,
      overhang: ov,
      effectiveLength: round(effL, 2),
      effectiveBreadth: round(effB, 2),
      perimeter: round(perimeter, 2),
      eavePerimeter: round(2 * (effL + effB), 2),
      isPorchOverhang: ov.front >= 1.2 || ov.back >= 1.2 || ov.left >= 1.2 || ov.right >= 1.2,
    },
    roofType,
    extensionDetails,
    extAreaTotal: round(extAreaTotal, 2),
    extRidgeTotal: round(extRidgeTotal, 2),
    extGutterTotal: round(extGutterTotal, 2),
  };
}

function round(value, decimals = 2) {
  const factor = Math.pow(10, decimals);
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}
