/**
 * Water Collector (WC) Geometry Analysis & Quotation Estimator
 *
 * Computes gutter corner fittings (45°, 90°, 135°) directly from the building design,
 * calculates vertical downspout lengths from floor count, and computes offset elbows
 * and extra user-added drop points.
 */

import { ACCESSORY_DEFAULTS, MATERIAL_PROFILES } from './materials.js';

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function getPolygonSignedArea(pts) {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area * 0.5;
}

function appendExtraDropPoints(dropPositions, activeEdges, extraDrops) {
  if (!extraDrops || extraDrops <= 0 || !activeEdges || activeEdges.length === 0) return;

  const candidates = [];
  activeEdges.forEach((edge) => {
    const len = Math.hypot(edge.bx - edge.ax, edge.bz - edge.az);
    if (len < 0.8) return;
    const pad = Math.min(0.45 / len, 0.28);
    const span = Math.max(0.1, 1 - 2 * pad);
    const divisions = Math.max(3, Math.min(16, Math.ceil(len / 1.1)));
    for (let s = 0; s <= divisions; s++) {
      const t = pad + (span * s) / divisions;
      candidates.push({
        x: edge.ax + (edge.bx - edge.ax) * t,
        z: edge.az + (edge.bz - edge.az) * t,
        nx: edge.nx,
        nz: edge.nz,
      });
    }
  });

  if (candidates.length === 0) return;

  for (let added = 0; added < extraDrops; added++) {
    let bestCand = null;
    let bestMinDistSq = -1;

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      let minDistSq = Infinity;
      for (let j = 0; j < dropPositions.length; j++) {
        const d = dropPositions[j];
        const distSq = (c.x - d.x) ** 2 + (c.z - d.z) ** 2;
        if (distSq < minDistSq) minDistSq = distSq;
      }
      if (minDistSq > bestMinDistSq) {
        bestMinDistSq = minDistSq;
        bestCand = c;
      }
    }

    if (bestCand) {
      dropPositions.push({ ...bestCand });
    }
  }
}

/**
 * Classifies all perimeter gutter corners of the building into 45°, 90°, or 135°
 * fittings directly from the 2D building design, and computes 3D drop pipe anchor points.
 */
export function analyzeWaterCollectorDesign(geometry, roofType = 'gable', polygonVertices = null, wcConfig = {}) {
  const L = Math.max(1, Number(geometry?.buildingDimensions?.length) || 12);
  const B = Math.max(1, Number(geometry?.buildingDimensions?.breadth) || 8);
  const floors = Math.max(1, Math.min(10, Math.round(Number(wcConfig?.floors) || 1)));
  const extraDrops = Math.max(0, Math.min(24, Math.round(Number(wcConfig?.extraDrops) || 0)));

  const rawOv = geometry?.buildingDimensions?.overhang || 0.45;
  const ov =
    typeof rawOv === 'object' && rawOv !== null
      ? {
          front: Math.max(0, Number(rawOv.front) || 0),
          back: Math.max(0, Number(rawOv.back) || 0),
          left: Math.max(0, Number(rawOv.left) || 0),
          right: Math.max(0, Number(rawOv.right) || 0),
        }
      : {
          front: Number(rawOv) || 0.45,
          back: Number(rawOv) || 0.45,
          left: Number(rawOv) || 0.45,
          right: Number(rawOv) || 0.45,
        };

  const activePoly =
    geometry?.skeleton?.eavePolygon?.length >= 3
      ? geometry.skeleton.eavePolygon
      : geometry?.isCustomPolygon && geometry?.polygonVertices?.length >= 3
      ? geometry.polygonVertices
      : polygonVertices?.length >= 3
      ? polygonVertices
      : null;

  let angle45Count = 0;
  let angle90Count = 0;
  let angle135Count = 0;
  let stopEndCount = 0;
  const cornerMarkers = []; // { x, z, angleType: 45 | 90 | 135 }
  const dropPositions = []; // { x, z, nx, nz } unit outward normal of wall face
  const activeEdges = []; // { ax, az, bx, bz, nx, nz } active guttered eave segments

  let activeGutterM = Number(geometry?.totalGutter) || 0;

  if (activePoly && activePoly.length >= 3) {
    const n = activePoly.length;
    let minX = activePoly[0].x;
    let maxX = activePoly[0].x;
    let minY = activePoly[0].y;
    let maxY = activePoly[0].y;
    activePoly.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });
    const cX = (minX + maxX) / 2;
    const cZ = (minY + maxY) / 2;
    const ccw = getPolygonSignedArea(activePoly) >= 0;

    let polyPerim = 0;
    for (let i = 0; i < n; i++) {
      const prev = activePoly[(i - 1 + n) % n];
      const curr = activePoly[i];
      const next = activePoly[(i + 1) % n];

      const inX = curr.x - prev.x;
      const inY = curr.y - prev.y;
      const outX = next.x - curr.x;
      const outY = next.y - curr.y;

      const inLen = Math.hypot(inX, inY) || 1;
      const outLen = Math.hypot(outX, outY) || 1;
      polyPerim += outLen;

      const ux = inX / inLen;
      const uy = inY / inLen;
      const vx = outX / outLen;
      const vy = outY / outLen;

      const dot = clamp(ux * vx + uy * vy, -1, 1);
      const turnDeg = (Math.acos(dot) * 180) / Math.PI; // 0 = straight, 90 = square turn
      const bendAngle = 180 - turnDeg; // interior/reflex-normalized corner angle in [0, 180]

      if (turnDeg >= 18) {
        let angleType = 90;
        if (bendAngle < 67.5) {
          angleType = 45;
          angle45Count += 1;
        } else if (bendAngle <= 112.5) {
          angleType = 90;
          angle90Count += 1;
        } else {
          angleType = 135;
          angle135Count += 1;
        }
        cornerMarkers.push({ x: curr.x - cX, z: curr.y - cZ, angleType });
      }

      // Distribute downspout locations along long straight eave edges
      // Outward 2D normal depends on winding
      const edgeNx = ccw ? outY / outLen : -outY / outLen;
      const edgeNz = ccw ? -outX / outLen : outX / outLen;
      activeEdges.push({
        ax: curr.x - cX,
        az: curr.y - cZ,
        bx: next.x - cX,
        bz: next.y - cZ,
        nx: edgeNx,
        nz: edgeNz,
      });
      if (outLen >= 4.0) {
        const dropsOnEdge = Math.max(1, Math.round(outLen / 11));
        for (let d = 1; d <= dropsOnEdge; d++) {
          const frac = dropsOnEdge === 1 ? 0.5 : (d - 0.5) / dropsOnEdge;
          // Offset drops slightly inside corner margins
          const t = 0.15 + frac * 0.7;
          dropPositions.push({
            x: curr.x + outX * t - cX,
            z: curr.y + outY * t - cZ,
            nx: edgeNx,
            nz: edgeNz,
          });
        }
      }
    }

    if (activeGutterM <= 0) {
      activeGutterM = polyPerim;
    }
    if (dropPositions.length < 2) {
      const targetDrops = Math.max(2, Math.ceil(activeGutterM / ACCESSORY_DEFAULTS.downspoutIntervalM));
      for (let i = 0; i < Math.min(n, targetDrops); i++) {
        const a = activePoly[i];
        const b = activePoly[(i + 1) % n];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const edgeNx = ccw ? dy / len : -dy / len;
        const edgeNz = ccw ? -dx / len : dx / len;
        dropPositions.push({
          x: (a.x + b.x) / 2 - cX,
          z: (a.y + b.y) / 2 - cZ,
          nx: edgeNx,
          nz: edgeNz,
        });
      }
    }
  } else {
    // Standard Rectangular Building
    const halfL = L / 2;
    const halfB = B / 2;
    const xMin = -halfL - ov.left;
    const xMax = halfL + ov.right;
    const zFront = halfB + ov.front;
    const zBack = -halfB - ov.back;
    const effL = xMax - xMin;
    const effB = zFront - zBack;

    if (roofType === 'hip' || roofType === 'mansard' || roofType === 'flat') {
      angle90Count = 4;
      cornerMarkers.push(
        { x: xMin, z: zFront, angleType: 90 },
        { x: xMax, z: zFront, angleType: 90 },
        { x: xMax, z: zBack, angleType: 90 },
        { x: xMin, z: zBack, angleType: 90 }
      );
      activeEdges.push(
        { ax: xMin, az: zFront, bx: xMax, bz: zFront, nx: 0, nz: 1 },
        { ax: xMax, az: zFront, bx: xMax, bz: zBack, nx: 1, nz: 0 },
        { ax: xMax, az: zBack, bx: xMin, bz: zBack, nx: 0, nz: -1 },
        { ax: xMin, az: zBack, bx: xMin, bz: zFront, nx: -1, nz: 0 }
      );
      if (activeGutterM <= 0) activeGutterM = 2 * (effL + effB);

      // 4 balanced corners / side drops (+ extra on long eaves)
      const longDrops = Math.max(1, Math.round(effL / 10));
      for (let i = 0; i < longDrops; i++) {
        const tx = xMin + effL * (longDrops === 1 ? 0.12 : i === 0 ? 0.1 : i === longDrops - 1 ? 0.9 : (i + 0.5) / longDrops);
        dropPositions.push({ x: tx, z: zFront, nx: 0, nz: 1 });
        dropPositions.push({ x: tx, z: zBack, nx: 0, nz: -1 });
      }
      if (dropPositions.length < 4 && effB >= 5) {
        dropPositions.push({ x: xMin, z: (zFront + zBack) / 2, nx: -1, nz: 0 });
        dropPositions.push({ x: xMax, z: (zFront + zBack) / 2, nx: 1, nz: 0 });
      }
    } else if (roofType === 'shed') {
      stopEndCount = 2;
      activeEdges.push({ ax: xMin, az: zFront, bx: xMax, bz: zFront, nx: 0, nz: 1 });
      if (activeGutterM <= 0) activeGutterM = effL;
      const drops = Math.max(1, Math.ceil(effL / 10));
      for (let i = 0; i < drops; i++) {
        const tx = drops === 1 ? xMax - 0.5 : xMin + 0.6 + ((effL - 1.2) * i) / Math.max(1, drops - 1);
        dropPositions.push({ x: tx, z: zFront, nx: 0, nz: 1 });
      }
    } else {
      // Gable / Gambrel: two long straight eave collectors (Front & Back)
      stopEndCount = 4;
      activeEdges.push(
        { ax: xMin, az: zFront, bx: xMax, bz: zFront, nx: 0, nz: 1 },
        { ax: xMax, az: zBack, bx: xMin, bz: zBack, nx: 0, nz: -1 }
      );
      if (activeGutterM <= 0) activeGutterM = 2 * effL;
      const dropsPerSide = Math.max(1, Math.ceil(effL / 10));
      for (let i = 0; i < dropsPerSide; i++) {
        const tx = dropsPerSide === 1
          ? xMin + effL * 0.15
          : xMin + 0.6 + ((effL - 1.2) * i) / Math.max(1, dropsPerSide - 1);
        dropPositions.push({ x: tx, z: zFront, nx: 0, nz: 1 });
        dropPositions.push({ x: tx, z: zBack, nx: 0, nz: -1 });
      }
    }

    // Account for front extensions if present
    const extCount = (geometry?.extensions || []).length || 0;
    if (extCount > 0) {
      angle90Count += extCount * 2;
    }
  }

  const autoDropCount = Math.max(1, dropPositions.length);
  appendExtraDropPoints(dropPositions, activeEdges, extraDrops);

  const dropCount = Math.max(1, dropPositions.length);
  const floorHeightM = 3.0;
  const dropHeightM = Number((floors * floorHeightM + 0.2).toFixed(1));
  const totalDropM = Number((dropCount * dropHeightM).toFixed(1));
  const elbowsPerDrop = 2;
  const totalElbows = dropCount * elbowsPerDrop;

  return {
    floors,
    extraDrops,
    autoDropCount,
    floorHeightM,
    dropHeightM,
    activeGutterM: Number(activeGutterM.toFixed(1)),
    dropCount,
    totalDropM,
    elbowsPerDrop,
    totalElbows,
    angle45Count,
    angle90Count,
    angle135Count,
    totalCorners: angle45Count + angle90Count + angle135Count,
    stopEndCount,
    cornerMarkers,
    dropPositions,
  };
}

/**
 * Generates the itemized Water Collector (WC) Quotation & Bill of Quantities.
 */
export function estimateWaterCollector(
  geometry,
  currencyCode = 'NGN',
  customPrices = {},
  options = {}
) {
  const {
    roofType = 'gable',
    polygonVertices = null,
    wcConfig = {},
    includeZeroItems = false,
  } = options;

  const analysis = analyzeWaterCollectorDesign(geometry, roofType, polygonVertices, wcConfig);
  const gutterSections = Math.ceil(analysis.activeGutterM / ACCESSORY_DEFAULTS.gutterSectionLengthM);
  const dropPipeSections = Math.ceil(analysis.totalDropM / ACCESSORY_DEFAULTS.gutterSectionLengthM);
  const joinerCount = Math.max(0, gutterSections - analysis.totalCorners);
  const clampBracketQty = Math.ceil(analysis.activeGutterM / 0.6) + Math.ceil(analysis.totalDropM / 1.5);
  const sealantQty = Math.max(2, Math.ceil((gutterSections + analysis.totalCorners + analysis.dropCount) / 8));

  const getPrice = (key, defaults) => {
    if (customPrices[key] !== undefined && customPrices[key] !== '') {
      return Number(customPrices[key]);
    }
    return defaults[currencyCode] || defaults.NGN || 0;
  };

  const gutterUnitPrice = getPrice('wc_gutter', { NGN: 8500, USD: 16.0, GBP: 12.5, EUR: 14.5, CAD: 21.0 });
  const corner90Price = getPrice('wc_corner_90', { NGN: 2500, USD: 5.0, GBP: 4.0, EUR: 4.5, CAD: 6.5 });
  const corner135Price = getPrice('wc_corner_135', { NGN: 2800, USD: 5.5, GBP: 4.4, EUR: 5.0, CAD: 7.2 });
  const corner45Price = getPrice('wc_corner_45', { NGN: 2800, USD: 5.5, GBP: 4.4, EUR: 5.0, CAD: 7.2 });
  const outletPrice = getPrice('wc_outlet', { NGN: 2500, USD: 5.0, GBP: 4.0, EUR: 4.5, CAD: 6.5 });
  const dropPipePrice = getPrice('wc_drop_pipe', { NGN: 5500, USD: 10.0, GBP: 8.0, EUR: 9.2, CAD: 13.5 });
  const elbowPrice = getPrice('wc_elbow', { NGN: 1500, USD: 3.0, GBP: 2.4, EUR: 2.8, CAD: 4.0 });
  const shoePrice = getPrice('wc_shoe', { NGN: 1800, USD: 3.5, GBP: 2.8, EUR: 3.2, CAD: 4.6 });
  const joinerPrice = getPrice('wc_joiner', { NGN: 1500, USD: 3.0, GBP: 2.4, EUR: 2.8, CAD: 4.0 });
  const bracketPrice = getPrice('wc_brackets', { NGN: 900, USD: 1.8, GBP: 1.4, EUR: 1.6, CAD: 2.4 });
  const sealantPrice = getPrice('wc_sealant', { NGN: 3500, USD: 6.0, GBP: 4.8, EUR: 5.5, CAD: 8.0 });

  const laborPrice = getPrice('wc_labor', { NGN: 2000, USD: 4.0, GBP: 3.2, EUR: 3.7, CAD: 5.4 });
  const transportPrice = getPrice('wc_transport', { NGN: 15000, USD: 30.0, GBP: 24.0, EUR: 28.0, CAD: 40.0 });

  const rawItems = [
    {
      id: 'wc_gutter',
      category: 'WC Collector Channels',
      name: 'Rainwater Collector Gutters (3m sections)',
      spec: `${analysis.activeGutterM} m total eave collector run`,
      quantity: gutterSections,
      unit: 'lengths',
      unitPrice: gutterUnitPrice,
      total: gutterSections * gutterUnitPrice,
    },
    ...(analysis.angle90Count > 0 || includeZeroItems
      ? [
          {
            id: 'wc_corner_90',
            category: 'WC Corner Fittings',
            name: '90° Gutter Corner Miters',
            spec: `Auto-detected ${analysis.angle90Count} square wall/eave junctions`,
            quantity: analysis.angle90Count,
            unit: 'pcs',
            unitPrice: corner90Price,
            total: analysis.angle90Count * corner90Price,
          },
        ]
      : []),
    ...(analysis.angle135Count > 0 || includeZeroItems
      ? [
          {
            id: 'wc_corner_135',
            category: 'WC Corner Fittings',
            name: '135° Obtuse Gutter Corners',
            spec: `Auto-detected ${analysis.angle135Count} chamfered / bay wall bends`,
            quantity: analysis.angle135Count,
            unit: 'pcs',
            unitPrice: corner135Price,
            total: analysis.angle135Count * corner135Price,
          },
        ]
      : []),
    ...(analysis.angle45Count > 0 || includeZeroItems
      ? [
          {
            id: 'wc_corner_45',
            category: 'WC Corner Fittings',
            name: '45° Acute Gutter Corners',
            spec: `Auto-detected ${analysis.angle45Count} sharp angled junctions`,
            quantity: analysis.angle45Count,
            unit: 'pcs',
            unitPrice: corner45Price,
            total: analysis.angle45Count * corner45Price,
          },
        ]
      : []),
    {
      id: 'wc_outlet',
      category: 'WC Drop System',
      name: 'Running Drop Outlets / Funnels',
      spec:
        analysis.extraDrops > 0
          ? `${analysis.dropCount} drop points (${analysis.autoDropCount} auto + ${analysis.extraDrops} added)`
          : `${analysis.dropCount} collector drop points around perimeter`,
      quantity: analysis.dropCount,
      unit: 'pcs',
      unitPrice: outletPrice,
      total: analysis.dropCount * outletPrice,
    },
    {
      id: 'wc_drop_pipe',
      category: 'WC Drop System',
      name: 'Vertical Downspout Drop Pipes (3m lengths)',
      spec: `${analysis.floors} ${analysis.floors === 1 ? 'floor' : 'floors'} (${analysis.dropHeightM}m/drop × ${analysis.dropCount} drops = ${analysis.totalDropM}m)`,
      quantity: dropPipeSections,
      unit: 'lengths',
      unitPrice: dropPipePrice,
      total: dropPipeSections * dropPipePrice,
    },
    {
      id: 'wc_elbow',
      category: 'WC Drop System',
      name: 'Downspout Offset Elbows (45° / 90°)',
      spec: `${analysis.elbowsPerDrop} elbows/drop (eave-to-wall swan-neck offset)`,
      quantity: analysis.totalElbows,
      unit: 'pcs',
      unitPrice: elbowPrice,
      total: analysis.totalElbows * elbowPrice,
    },
    {
      id: 'wc_shoe',
      category: 'WC Drop System',
      name: 'Downspout Discharge Shoes',
      spec: `Bottom ground discharge bends (${analysis.dropCount} drops)`,
      quantity: analysis.dropCount,
      unit: 'pcs',
      unitPrice: shoePrice,
      total: analysis.dropCount * shoePrice,
    },
    ...(joinerCount + analysis.stopEndCount > 0 || includeZeroItems
      ? [
          {
            id: 'wc_joiner',
            category: 'WC Fittings & Clips',
            name: 'Gutter Unions & Stop-End Caps',
            spec: `${joinerCount} straight couplers + ${analysis.stopEndCount} end caps`,
            quantity: joinerCount + analysis.stopEndCount,
            unit: 'pcs',
            unitPrice: joinerPrice,
            total: (joinerCount + analysis.stopEndCount) * joinerPrice,
          },
        ]
      : []),
    {
      id: 'wc_brackets',
      category: 'WC Fittings & Clips',
      name: 'Fascia Hangers & Wall Pipe Clamps',
      spec: `0.6m gutter support spacing & wall drop clips`,
      quantity: clampBracketQty,
      unit: 'pcs',
      unitPrice: bracketPrice,
      total: clampBracketQty * bracketPrice,
    },
    {
      id: 'wc_sealant',
      category: 'WC Fittings & Clips',
      name: 'Gutter Silicone Sealant & Solvent Cement',
      spec: `Waterproof joint bonding for miters & outlets`,
      quantity: sealantQty,
      unit: 'tubes',
      unitPrice: sealantPrice,
      total: sealantQty * sealantPrice,
    },
  ];

  const rawExtraItems = Array.isArray(customPrices?.__extraItems) ? customPrices.__extraItems : [];
  const customWcItems = rawExtraItems
    .filter((ci) => ci && ci.scope === 'wc' && String(ci.name || '').trim())
    .map((ci) => {
      const qty = Math.max(0, Number(ci.quantity) || 0);
      const overrideVal = customPrices?.[ci.id];
      const unitPrice =
        overrideVal !== undefined && overrideVal !== '' && Number.isFinite(Number(overrideVal))
          ? Math.max(0, Number(overrideVal))
          : Math.max(0, Number(ci.unitPrice) || 0);
      return {
        id: ci.id,
        category: 'WC Custom',
        name: String(ci.name).trim(),
        spec: ci.spec ? String(ci.spec) : 'Custom added WC material',
        quantity: qty,
        unit: String(ci.unit || 'pcs').trim() || 'pcs',
        unitPrice,
        total: qty * unitPrice,
        isCustom: true,
        scope: 'wc',
      };
    });

  const customNames =
    customPrices?.__customNames && typeof customPrices.__customNames === 'object'
      ? customPrices.__customNames
      : {};

  const combinedItems = [...rawItems, ...customWcItems].map((it) => {
    if (it.isCustom) return { ...it, defaultName: it.name };
    const override = customNames[it.id];
    const renamed = typeof override === 'string' && override.trim() ? override.trim() : it.name;
    return { ...it, defaultName: it.name, name: renamed };
  });
  const items = includeZeroItems
    ? combinedItems
    : combinedItems.filter((it) => Number(it.quantity) > 0 && Number(it.total) > 0);

  const materialsSubtotal = items.reduce((acc, it) => acc + it.total, 0);
  const laborUnits = Math.ceil(analysis.activeGutterM + analysis.totalDropM);
  const laborTotal = Math.max(0, Math.round(laborUnits * laborPrice));
  const transportTotal = Math.max(0, Math.round(transportPrice));
  const grandTotal = materialsSubtotal + laborTotal + transportTotal;

  return {
    profile: {
      id: 'wc_system',
      name: `Water Collector (WC) — ${analysis.floors} ${analysis.floors === 1 ? 'Floor' : 'Floors'}`,
    },
    currencyCode,
    buildingStage: 'wc',
    analysis,
    items,
    summary: {
      materialsSubtotal,
      laborTotal,
      transportTotal,
      grandTotal,
      laborUnitPrice: laborPrice,
      laborUnits,
      costPerM2: geometry?.totalArea > 0 ? Math.round(grandTotal / geometry.totalArea) : 0,
    },
  };
}

export const WC_PROFILE_META = MATERIAL_PROFILES;
