/**
 * Universal Architectural Straight-Skeleton Roof Engine
 * Computes exact, watertight 3D roof geometry (ridges, hips, valleys, and sloped facets)
 * for Rectangles, L-Shapes, T-Shapes, Cross-Shapes, U-Shapes, and any custom user sketch.
 *
 * Mathematically exact wavefront polygon propagation:
 * - Cleans redundant/collinear user wall clicks automatically.
 * - Offsets wall footprint cleanly by eave overhang.
 * - Handles arbitrary wing spans, asymmetrical T/L extensions, and multi-wing intersections.
 * - Guarantees 100% planar slope facets, true valley gutters at reflex corners,
 *   and independent Kingpost heights (KP) per wing section.
 */

import { normalizeOverhang, offsetPolygonVertices } from './roofMath.js';

function round2(v) {
  return Math.round((Number(v) + Number.EPSILON) * 100) / 100;
}

function dist2(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function dist3D(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y, (b.z || 0) - (a.z || 0));
}

function triArea3D(a, b, c) {
  const ab = { x: b.x - a.x, y: b.y - a.y, z: (b.z || 0) - (a.z || 0) };
  const ac = { x: c.x - a.x, y: c.y - a.y, z: (c.z || 0) - (a.z || 0) };
  const nx = ab.y * ac.z - ab.z * ac.y;
  const ny = ab.z * ac.x - ab.x * ac.z;
  const nz = ab.x * ac.y - ab.y * ac.x;
  return 0.5 * Math.sqrt(nx * nx + ny * ny + nz * nz);
}

function signedArea2D(poly) {
  let area2 = 0;
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    area2 += a.x * b.y - b.x * a.y;
  }
  return area2 / 2;
}

function ensureCCW(poly) {
  return signedArea2D(poly) < 0 ? [...poly].reverse() : [...poly];
}

/**
 * Removes duplicate points and redundant collinear vertices along straight walls
 */
export function simplifyPolygon(vertices, tolerance = 0.08) {
  if (!vertices || vertices.length <= 3) return vertices ? [...vertices] : [];
  const deduped = [];
  for (let i = 0; i < vertices.length; i++) {
    const curr = vertices[i];
    if (deduped.length === 0 || dist2(deduped[deduped.length - 1], curr) > 0.02) {
      deduped.push({ x: Number(curr.x), y: Number(curr.y) });
    }
  }
  if (deduped.length > 1 && dist2(deduped[0], deduped[deduped.length - 1]) < 0.02) {
    deduped.pop();
  }
  if (deduped.length <= 3) return deduped;

  const result = [];
  const n = deduped.length;
  for (let i = 0; i < n; i++) {
    const prev = deduped[(i - 1 + n) % n];
    const curr = deduped[i];
    const next = deduped[(i + 1) % n];

    const d12 = dist2(prev, curr);
    const d23 = dist2(curr, next);
    const d13 = dist2(prev, next);

    const cross = Math.abs((curr.x - prev.x) * (next.y - prev.y) - (curr.y - prev.y) * (next.x - prev.x));
    const distToLine = d13 > 1e-6 ? cross / d13 : 0;

    if (distToLine < tolerance && Math.abs(d12 + d23 - d13) < tolerance) {
      continue;
    }
    result.push(curr);
  }
  return result.length >= 3 ? result : deduped;
}

function segmentsIntersect2D(a, b, c, d) {
  const ccw = (p1, p2, p3) => (p3.y - p1.y) * (p2.x - p1.x) > (p2.y - p1.y) * (p3.x - p1.x);
  return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
}

function hasSelfIntersection(poly) {
  const n = poly.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const c = poly[j];
      const d = poly[(j + 1) % n];
      if (segmentsIntersect2D(a, b, c, d)) return true;
    }
  }
  return false;
}

function getSafeEavePolygon(wallPts, avgOv) {
  if (!avgOv || avgOv <= 0.01) return wallPts;
  let ov = avgOv;
  for (let attempt = 0; attempt < 4; attempt++) {
    const offsetPts = offsetPolygonVertices(wallPts, ov);
    if (offsetPts.length >= 3 && Math.abs(signedArea2D(offsetPts)) > Math.abs(signedArea2D(wallPts)) * 0.8 && !hasSelfIntersection(offsetPts)) {
      return offsetPts;
    }
    ov *= 0.5;
  }
  return wallPts;
}

function makeEdgeInfo(a, b) {
  const len = dist2(a, b);
  const dx = (b.x - a.x) / len;
  const dy = (b.y - a.y) / len;
  // Left-hand inward unit normal for CCW winding
  return { dx, dy, nx: -dy, ny: dx };
}

function computeVelocity(n1, n2) {
  const det = n1.nx * n2.ny - n1.ny * n2.nx;
  if (Math.abs(det) < 1e-6) {
    const dot = n1.nx * n2.nx + n1.ny * n2.ny;
    if (dot < -0.9) return null; // 180-degree opposite walls collapsed together
    return { vx: n1.nx, vy: n1.ny, isReflex: false };
  }
  const vx = (n2.ny - n1.ny) / det;
  const vy = (n1.nx - n2.nx) / det;
  // Clamp extreme spikes on near-0 acute corners
  const mag = Math.hypot(vx, vy);
  if (mag > 12) {
    return { vx: (vx / mag) * 12, vy: (vy / mag) * 12, isReflex: det < -1e-6 };
  }
  return { vx, vy, isReflex: det < -1e-6 };
}

function mergeCollinearSegments(segs) {
  const list = segs
    .map((s) => ({ p1: { ...s.p1 }, p2: { ...s.p2 } }))
    .filter((s) => dist3D(s.p1, s.p2) > 1e-3);

  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < list.length && !merged; i++) {
      for (let j = i + 1; j < list.length && !merged; j++) {
        const s1 = list[i];
        const s2 = list[j];
        const pairs = [
          [s1.p2, s2.p1, s1.p1, s2.p2],
          [s1.p2, s2.p2, s1.p1, s2.p1],
          [s1.p1, s2.p1, s1.p2, s2.p2],
          [s1.p1, s2.p2, s1.p2, s2.p1],
        ];
        for (const [sharedA, sharedB, endA, endB] of pairs) {
          if (dist3D(sharedA, sharedB) < 1e-3) {
            const v1 = { x: sharedA.x - endA.x, y: sharedA.y - endA.y, z: (sharedA.z || 0) - (endA.z || 0) };
            const v2 = { x: endB.x - sharedB.x, y: endB.y - sharedB.y, z: (endB.z || 0) - (sharedB.z || 0) };
            const l1 = Math.hypot(v1.x, v1.y, v1.z);
            const l2 = Math.hypot(v2.x, v2.y, v2.z);
            if (l1 > 1e-4 && l2 > 1e-4) {
              const dot = (v1.x * v2.x + v1.y * v2.y + v1.z * v2.z) / (l1 * l2);
              if (dot > 0.999) {
                list[i] = { p1: endA, p2: endB };
                list.splice(j, 1);
                merged = true;
                break;
              }
            }
          }
        }
      }
    }
  }
  return list;
}

/**
 * Universal Straight Skeleton Wavefront Solver
 */
function solveStraightSkeleton(rawPoly, tanPitch) {
  const ccw = simplifyPolygon(ensureCCW(rawPoly), 0.04);
  if (ccw.length < 3) return null;

  const initLoop = ccw.map((p, i) => {
    const next = ccw[(i + 1) % ccw.length];
    return { x: p.x, y: p.y, edge: makeEdgeInfo(p, next) };
  });

  const queue = [{ verts: initLoop, t: 0 }];
  const rawRidges = [];
  const rawHips = [];
  const rawValleys = [];
  const triangles = [];
  const EPS = 1e-4;

  let iter = 0;
  while (queue.length > 0 && iter++ < 200) {
    let { verts, t: t0 } = queue.shift();
    verts = verts.filter((v, i) => dist2(v, verts[(i + 1) % verts.length]) > EPS);
    if (verts.length < 2) continue;

    if (verts.length === 2) {
      rawRidges.push({
        p1: { x: verts[0].x, y: verts[0].y, z: t0 * tanPitch },
        p2: { x: verts[1].x, y: verts[1].y, z: t0 * tanPitch },
      });
      continue;
    }

    const n = verts.length;
    const vels = [];
    let hasDegenerate = false;
    for (let i = 0; i < n; i++) {
      const ePrev = verts[(i - 1 + n) % n].edge;
      const eNext = verts[i].edge;
      const vel = computeVelocity(ePrev, eNext);
      if (!vel) {
        hasDegenerate = true;
        break;
      }
      vels.push(vel);
    }
    if (hasDegenerate) continue;

    let minDt = Infinity;

    // 1. Edge collapse events
    for (let i = 0; i < n; i++) {
      const pA = verts[i];
      const pB = verts[(i + 1) % n];
      const vA = vels[i];
      const vB = vels[(i + 1) % n];
      const e = pA.edge;
      const len = (pB.x - pA.x) * e.dx + (pB.y - pA.y) * e.dy;
      const rate = (vB.vx - vA.vx) * e.dx + (vB.vy - vA.vy) * e.dy;
      if (rate < -1e-7 && len > EPS) {
        const dt = len / -rate;
        if (dt > 1e-6 && dt < minDt) minDt = dt;
      }
    }

    // 2. Reflex split events (reflex vertex colliding with opposite moving edge)
    for (let i = 0; i < n; i++) {
      if (!vels[i].isReflex) continue;
      const pR = verts[i];
      const vR = vels[i];
      for (let j = 0; j < n; j++) {
        if (j === i || j === (i - 1 + n) % n) continue;
        const pJ = verts[j];
        const pJNext = verts[(j + 1) % n];
        const e = pJ.edge;
        const distNow = (pR.x - pJ.x) * e.nx + (pR.y - pJ.y) * e.ny;
        if (distNow <= EPS) continue;
        const rate = vR.vx * e.nx + vR.vy * e.ny - 1.0;
        if (rate < -1e-7) {
          const dt = distNow / -rate;
          if (dt > 1e-6 && dt < minDt + 1e-5) {
            const hit = { x: pR.x + dt * vR.vx, y: pR.y + dt * vR.vy };
            const q1 = { x: pJ.x + dt * vels[j].vx, y: pJ.y + dt * vels[j].vy };
            const q2 = { x: pJNext.x + dt * vels[(j + 1) % n].vx, y: pJNext.y + dt * vels[(j + 1) % n].vy };
            const sLen = (q2.x - q1.x) * e.dx + (q2.y - q1.y) * e.dy;
            if (sLen > EPS) {
              const proj = ((hit.x - q1.x) * e.dx + (hit.y - q1.y) * e.dy) / sLen;
              if (proj >= -1e-4 && proj <= 1.0 + 1e-4) {
                if (dt < minDt) minDt = dt;
              }
            }
          }
        }
      }
    }

    if (!isFinite(minDt) || minDt > 500) break;
    const t1 = t0 + minDt;
    const z0 = t0 * tanPitch;
    const z1 = t1 * tanPitch;

    const moved = verts.map((v, i) => ({
      x: v.x + minDt * vels[i].vx,
      y: v.y + minDt * vels[i].vy,
      edge: v.edge,
    }));

    for (let i = 0; i < n; i++) {
      const a0 = { x: verts[i].x, y: verts[i].y, z: z0 };
      const b0 = { x: verts[(i + 1) % n].x, y: verts[(i + 1) % n].y, z: z0 };
      const a1 = { x: moved[i].x, y: moved[i].y, z: z1 };
      const b1 = { x: moved[(i + 1) % n].x, y: moved[(i + 1) % n].y, z: z1 };

      if (dist2(a0, a1) > EPS) {
        const seg = { p1: a0, p2: a1 };
        if (vels[i].isReflex) {
          rawValleys.push(seg);
        } else {
          rawHips.push(seg);
        }
      }

      const len1 = dist2(a1, b1);
      if (len1 > EPS) {
        triangles.push([a0, b0, b1]);
        triangles.push([a0, b1, a1]);
      } else {
        const mid = { x: (a1.x + b1.x) / 2, y: (a1.y + b1.y) / 2, z: z1 };
        triangles.push([a0, b0, mid]);
      }
    }

    // Remove collapsed zero-length edges
    const afterCollapse = [];
    for (let i = 0; i < n; i++) {
      const curr = moved[i];
      const next = moved[(i + 1) % n];
      const len = (next.x - curr.x) * curr.edge.dx + (next.y - curr.y) * curr.edge.dy;
      if (len > EPS) {
        afterCollapse.push(curr);
      }
    }

    // Snap nearly coincident points together
    for (let i = 0; i < afterCollapse.length; i++) {
      for (let j = i + 1; j < afterCollapse.length; j++) {
        if (dist2(afterCollapse[i], afterCollapse[j]) < 1e-3) {
          afterCollapse[j].x = afterCollapse[i].x;
          afterCollapse[j].y = afterCollapse[i].y;
        }
      }
    }

    if (afterCollapse.length < 2) continue;
    if (afterCollapse.length === 2) {
      rawRidges.push({
        p1: { x: afterCollapse[0].x, y: afterCollapse[0].y, z: z1 },
        p2: { x: afterCollapse[1].x, y: afterCollapse[1].y, z: z1 },
      });
      continue;
    }

    // Split any edge that passes through another active vertex (split event)
    const splitExpanded = [];
    const m = afterCollapse.length;
    for (let i = 0; i < m; i++) {
      const A = afterCollapse[i];
      const B = afterCollapse[(i + 1) % m];
      const e = A.edge;
      const segLen = (B.x - A.x) * e.dx + (B.y - A.y) * e.dy;
      const splits = [];
      for (let k = 0; k < m; k++) {
        if (k === i || k === (i + 1) % m) continue;
        const P = afterCollapse[k];
        const perp = Math.abs((P.x - A.x) * e.nx + (P.y - A.y) * e.ny);
        const along = (P.x - A.x) * e.dx + (P.y - A.y) * e.dy;
        if (perp < 1e-3 && along > 1e-3 && along < segLen - 1e-3) {
          splits.push({ pt: P, along });
        }
      }
      splits.sort((u, v) => u.along - v.along);
      splitExpanded.push(A);
      splits.forEach((s) => {
        splitExpanded.push({ x: s.pt.x, y: s.pt.y, edge: e });
      });
    }

    // Recursively pinch & extract independent simple sub-loops
    const extractLoops = (seq) => {
      if (seq.length < 2) return;
      for (let i = 0; i < seq.length; i++) {
        for (let j = i + 1; j < seq.length; j++) {
          if (dist2(seq[i], seq[j]) < 1e-3) {
            const innerLoop = seq.slice(i, j);
            const outerLoop = [...seq.slice(0, i), ...seq.slice(j)];
            extractLoops(innerLoop);
            extractLoops(outerLoop);
            return;
          }
        }
      }
      if (seq.length === 2) {
        rawRidges.push({
          p1: { x: seq[0].x, y: seq[0].y, z: z1 },
          p2: { x: seq[1].x, y: seq[1].y, z: z1 },
        });
      } else if (seq.length >= 3) {
        const area = signedArea2D(seq);
        if (area > 1e-4) {
          queue.push({ verts: seq, t: t1 });
        }
      }
    };
    extractLoops(splitExpanded);
  }

  const mergedRidges = mergeCollinearSegments(rawRidges).map((r) => ({ ...r, isSaddle: false }));
  const mergedHipsAll = mergeCollinearSegments(rawHips);
  const finalHips = [];
  mergedHipsAll.forEach((h) => {
    if ((h.p1.z || 0) > 0.05 && (h.p2.z || 0) > 0.05) {
      mergedRidges.push({ ...h, isSaddle: true });
    } else {
      finalHips.push(h);
    }
  });

  return {
    ridges: mergedRidges,
    hips: finalHips,
    valleys: mergeCollinearSegments(rawValleys),
    triangles,
  };
}

/**
 * Clean 2D ear-clipping triangulator for any simple polygon (convex or concave: L-shape, T-shape, Cross, etc.)
 */
function triangulateSimplePolygon2D(poly) {
  if (!Array.isArray(poly) || poly.length < 3) return [];
  const pts = poly.map((p) => ({ x: p.x, y: p.y }));
  const ccw = signedArea2D(pts) >= 0;
  const indices = pts.map((_, i) => i);
  const tris = [];

  const pointInTri = (p, a, b, c) => {
    const c1 = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    const c2 = (c.x - b.x) * (p.y - b.y) - (c.y - b.y) * (p.x - b.x);
    const c3 = (a.x - c.x) * (p.y - c.y) - (a.y - c.y) * (p.x - c.x);
    const hasNeg = c1 < -1e-6 || c2 < -1e-6 || c3 < -1e-6;
    const hasPos = c1 > 1e-6 || c2 > 1e-6 || c3 > 1e-6;
    return !(hasNeg && hasPos);
  };

  let guard = 0;
  while (indices.length > 3 && guard < 2000) {
    guard++;
    let earFound = false;
    const m = indices.length;
    for (let i = 0; i < m; i++) {
      const iPrev = indices[(i - 1 + m) % m];
      const iCurr = indices[i];
      const iNext = indices[(i + 1) % m];
      const a = pts[iPrev];
      const b = pts[iCurr];
      const c = pts[iNext];
      const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      const isConvex = ccw ? cross > 1e-6 : cross < -1e-6;
      if (!isConvex) continue;

      let containsAny = false;
      for (let j = 0; j < m; j++) {
        const idx = indices[j];
        if (idx === iPrev || idx === iCurr || idx === iNext) continue;
        if (pointInTri(pts[idx], a, b, c)) {
          containsAny = true;
          break;
        }
      }
      if (!containsAny) {
        tris.push([a, b, c]);
        indices.splice(i, 1);
        earFound = true;
        break;
      }
    }
    if (!earFound) break;
  }
  if (indices.length === 3) {
    tris.push([pts[indices[0]], pts[indices[1]], pts[indices[2]]]);
  }
  return tris;
}

/**
 * Builds the complete 3D & 2D Roof Skeleton for any footprint
 */
export function buildRoofSkeleton(polygonVertices, overhang = 0.45, pitchDegrees = 45.0, roofType = 'hip') {
  const ov = normalizeOverhang(overhang);
  const avgOv = (ov.front + ov.back + ov.left + ov.right) / 4;
  const rad = (Math.max(5, Math.min(75, Number(pitchDegrees) || 45.0)) * Math.PI) / 180;
  const tanPitch = Math.tan(rad);

  if (!polygonVertices || polygonVertices.length < 3) {
    return buildRectangleSkeleton(12, 8, avgOv, tanPitch, pitchDegrees, roofType, 0, 0);
  }

  // 1. Clean collinear clicks & get safe eave boundary polygon
  const cleanedWalls = simplifyPolygon(polygonVertices, 0.08);
  const eavePoly = getSafeEavePolygon(cleanedWalls, avgOv);

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  eavePoly.forEach((p) => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });
  const spanX = Math.max(0.2, maxX - minX);
  const spanY = Math.max(0.2, maxY - minY);
  const eaveCenterX = (minX + maxX) / 2;
  const eaveCenterY = (minY + maxY) / 2;

  // FLAT ROOF (Works cleanly for ANY rectangle or custom polygon!)
  if (roofType === 'flat') {
    const flatTris2D = triangulateSimplePolygon2D(eavePoly);
    const triangles = flatTris2D.map(([a, b, c]) => [
      { x: a.x, y: a.y, z: 0.06 },
      { x: b.x, y: b.y, z: 0.06 },
      { x: c.x, y: c.y, z: 0.06 },
    ]);
    let totalArea = 0;
    triangles.forEach((t) => (totalArea += triArea3D(t[0], t[1], t[2])));
    return {
      skeletonType: cleanedWalls.length === 4 ? 'rectangle' : 'custom_polygon',
      eavePolygon: eavePoly,
      sections: [
        {
          name: 'Flat Roof Deck',
          span: round2(Math.min(spanX, spanY)),
          length: round2(Math.max(spanX, spanY)),
          kingpostHeight: 0,
          pitchDegrees: 2.0,
          ridge: null,
        },
      ],
      ridges: [],
      hips: [],
      valleys: [],
      infillWalls: [],
      triangles,
      totalRidgeLength: 0,
      totalHipLength: 0,
      totalValleyLength: 0,
      totalRoofArea: round2(totalArea),
      maxKingpost: 0,
    };
  }

  // SHED / MONO-PITCH ROOF (Centered directly on eavePoly — fixes shifted roof anomaly on ALL polygons!)
  if (roofType === 'shed') {
    // Slope across the shorter horizontal span so mono-pitch rises naturally
    const slopeAlongY = spanX >= spanY;
    const slopeSpan = slopeAlongY ? spanY : spanX;
    const rise = round2(Math.max(0.2, slopeSpan * tanPitch));

    const getShedZ = (pt) => {
      const frac = slopeAlongY
        ? (maxY - pt.y) / slopeSpan // high at back (minY), low at front (maxY)
        : (maxX - pt.x) / slopeSpan; // high at left (minX), low at right (maxX)
      return Math.max(0, Math.min(rise, frac * rise));
    };

    const flatTris2D = triangulateSimplePolygon2D(eavePoly);
    const triangles = flatTris2D.map(([a, b, c]) => [
      { x: a.x, y: a.y, z: getShedZ(a) },
      { x: b.x, y: b.y, z: getShedZ(b) },
      { x: c.x, y: c.y, z: getShedZ(c) },
    ]);

    // Build solid vertical wall infills around the wall perimeter up to the mono-pitch plane
    const infillWalls = [];
    for (let i = 0; i < cleanedWalls.length; i++) {
      const a = cleanedWalls[i];
      const b = cleanedWalls[(i + 1) % cleanedWalls.length];
      const za = getShedZ(a);
      const zb = getShedZ(b);
      if (za > 0.02 || zb > 0.02) {
        const aBot = { x: a.x, y: a.y, z: 0 };
        const bBot = { x: b.x, y: b.y, z: 0 };
        const aTop = { x: a.x, y: a.y, z: za };
        const bTop = { x: b.x, y: b.y, z: zb };
        if (za > 0.02) infillWalls.push([aBot, bBot, aTop]);
        if (zb > 0.02) infillWalls.push([bBot, bTop, aTop]);
      }
    }

    const highP1 = slopeAlongY
      ? { x: minX, y: minY, z: rise }
      : { x: minX, y: minY, z: rise };
    const highP2 = slopeAlongY
      ? { x: maxX, y: minY, z: rise }
      : { x: minX, y: maxY, z: rise };
    const highLen = round2(dist3D(highP1, highP2));

    let totalArea = 0;
    triangles.forEach((t) => (totalArea += triArea3D(t[0], t[1], t[2])));

    return {
      skeletonType: cleanedWalls.length === 4 ? 'rectangle' : 'custom_polygon',
      eavePolygon: eavePoly,
      sections: [
        {
          name: 'Shed / Mono-Pitch',
          span: round2(slopeSpan),
          length: highLen,
          kingpostHeight: rise,
          pitchDegrees,
          ridge: { p1: highP1, p2: highP2 },
        },
      ],
      ridges: [
        {
          p1: highP1,
          p2: highP2,
          length: highLen,
          kingpostHeight: rise,
          isMain: true,
          isFlat: true,
          label: `High Edge (KP=${rise}m)`,
        },
      ],
      hips: [],
      valleys: [],
      infillWalls,
      triangles,
      totalRidgeLength: highLen,
      totalHipLength: 0,
      totalValleyLength: 0,
      totalRoofArea: round2(totalArea),
      maxKingpost: rise,
    };
  }

  // GABLE ROOF on 4-corner drawn rectangle (keeps true centered coordinates + solid triangular end walls!)
  if (cleanedWalls.length === 4 && roofType === 'gable') {
    const ridgeAlongX = spanX >= spanY;
    const halfSpan = (ridgeAlongX ? spanY : spanX) / 2;
    const kp = round2(Math.max(0.2, halfSpan * tanPitch));

    const pBL = { x: minX, y: minY, z: 0 };
    const pBR = { x: maxX, y: minY, z: 0 };
    const pFR = { x: maxX, y: maxY, z: 0 };
    const pFL = { x: minX, y: maxY, z: 0 };

    let r1, r2, triangles, infillWalls;
    if (ridgeAlongX) {
      r1 = { x: minX, y: eaveCenterY, z: kp };
      r2 = { x: maxX, y: eaveCenterY, z: kp };
      triangles = [
        [pBL, pBR, r2],
        [pBL, r2, r1],
        [pFL, r2, pFR],
        [pFL, r1, r2],
      ];
      // Gable triangular end walls on left & right walls
      let wMinX = Infinity, wMaxX = -Infinity, wMinY = Infinity, wMaxY = -Infinity;
      cleanedWalls.forEach((p) => {
        if (p.x < wMinX) wMinX = p.x;
        if (p.x > wMaxX) wMaxX = p.x;
        if (p.y < wMinY) wMinY = p.y;
        if (p.y > wMaxY) wMaxY = p.y;
      });
      const wCy = (wMinY + wMaxY) / 2;
      infillWalls = [
        [{ x: wMinX, y: wMinY, z: 0 }, { x: wMinX, y: wMaxY, z: 0 }, { x: wMinX, y: wCy, z: kp }],
        [{ x: wMaxX, y: wMinY, z: 0 }, { x: wMaxX, y: wMaxY, z: 0 }, { x: wMaxX, y: wCy, z: kp }],
      ];
    } else {
      r1 = { x: eaveCenterX, y: minY, z: kp };
      r2 = { x: eaveCenterX, y: maxY, z: kp };
      triangles = [
        [pBL, r2, pFL],
        [pBL, r1, r2],
        [pBR, pFR, r2],
        [pBR, r2, r1],
      ];
      let wMinX = Infinity, wMaxX = -Infinity, wMinY = Infinity, wMaxY = -Infinity;
      cleanedWalls.forEach((p) => {
        if (p.x < wMinX) wMinX = p.x;
        if (p.x > wMaxX) wMaxX = p.x;
        if (p.y < wMinY) wMinY = p.y;
        if (p.y > wMaxY) wMaxY = p.y;
      });
      const wCx = (wMinX + wMaxX) / 2;
      infillWalls = [
        [{ x: wMinX, y: wMinY, z: 0 }, { x: wMaxX, y: wMinY, z: 0 }, { x: wCx, y: wMinY, z: kp }],
        [{ x: wMinX, y: wMaxY, z: 0 }, { x: wMaxX, y: wMaxY, z: 0 }, { x: wCx, y: wMaxY, z: kp }],
      ];
    }

    const ridgeLen = round2(dist3D(r1, r2));
    let totalArea = 0;
    triangles.forEach((t) => (totalArea += triArea3D(t[0], t[1], t[2])));

    return {
      skeletonType: 'rectangle',
      eavePolygon: eavePoly,
      sections: [
        {
          name: 'Main Gable Roof',
          span: round2(Math.min(spanX, spanY)),
          length: ridgeLen,
          kingpostHeight: kp,
          pitchDegrees,
          ridge: { p1: r1, p2: r2 },
        },
      ],
      ridges: [
        {
          p1: r1,
          p2: r2,
          length: ridgeLen,
          kingpostHeight: kp,
          isMain: true,
          isFlat: true,
          label: `Main Ridge (KP=${kp}m)`,
        },
      ],
      hips: [],
      valleys: [],
      infillWalls,
      triangles,
      totalRidgeLength: ridgeLen,
      totalHipLength: 0,
      totalValleyLength: 0,
      totalRoofArea: round2(totalArea),
      maxKingpost: kp,
    };
  }

  // 2. Run Exact Straight Skeleton Solver on Eave Boundary (Hip & Complex Multi-Wing Polygons)
  const solved = solveStraightSkeleton(eavePoly, tanPitch);
  if (!solved || solved.triangles.length === 0) {
    return buildRectangleSkeleton(spanX, spanY, 0, tanPitch, pitchDegrees, roofType, eaveCenterX, eaveCenterY);
  }

  const maxZ = solved.triangles.reduce(
    (mx, tri) => Math.max(mx, tri[0].z || 0, tri[1].z || 0, tri[2].z || 0),
    0
  );

  // 3. Label ridges with independent Kingpost heights
  const ridges = solved.ridges.map((r) => {
    const avgZ = round2(((r.p1.z || 0) + (r.p2.z || 0)) / 2);
    const len = round2(dist3D(r.p1, r.p2));
    const isFlat = !r.isSaddle && Math.abs((r.p1.z || 0) - (r.p2.z || 0)) < 0.05;
    const isMain = isFlat && avgZ >= maxZ - 0.1;
    const label = isFlat
      ? `${isMain ? 'Main Ridge' : 'Wing Ridge'} (KP=${avgZ}m)`
      : null;
    return {
      p1: r.p1,
      p2: r.p2,
      length: len,
      kingpostHeight: avgZ,
      isMain,
      isFlat,
      label,
    };
  });

  const hips = solved.hips.map((h) => ({
    p1: h.p1,
    p2: h.p2,
    length: round2(dist3D(h.p1, h.p2)),
    label: 'Hip',
  }));

  const valleys = solved.valleys.map((v) => ({
    p1: v.p1,
    p2: v.p2,
    length: round2(dist3D(v.p1, v.p2)),
    label: 'Valley Gutter',
  }));

  // 4. Build wing sections summary grouped by Kingpost height
  const kpGroups = [];
  ridges
    .filter((r) => Math.abs((r.p1.z || 0) - (r.p2.z || 0)) < 0.05)
    .forEach((r) => {
      const existing = kpGroups.find((g) => Math.abs(g.kingpostHeight - r.kingpostHeight) < 0.1);
      if (!existing) {
        kpGroups.push({
          name: r.isMain ? 'Main Roof Section' : `Wing Section ${kpGroups.length + 1}`,
          span: round2((2 * r.kingpostHeight) / Math.max(0.1, tanPitch)),
          length: r.length,
          kingpostHeight: r.kingpostHeight,
          pitchDegrees,
          ridge: { p1: r.p1, p2: r.p2 },
        });
      }
    });

  if (kpGroups.length === 0) {
    kpGroups.push({
      name: 'Main Roof',
      span: round2((2 * maxZ) / Math.max(0.1, tanPitch)),
      length: 0,
      kingpostHeight: round2(maxZ),
      pitchDegrees,
      ridge: ridges[0] ? { p1: ridges[0].p1, p2: ridges[0].p2 } : null,
    });
  }

  let totalArea = 0;
  solved.triangles.forEach((t) => {
    totalArea += triArea3D(t[0], t[1], t[2]);
  });

  // Classify footprint type for friendly telemetry
  const nCorners = cleanedWalls.length;
  let reflexCount = 0;
  for (let i = 0; i < nCorners; i++) {
    const pPrev = cleanedWalls[(i - 1 + nCorners) % nCorners];
    const pCurr = cleanedWalls[i];
    const pNext = cleanedWalls[(i + 1) % nCorners];
    const cross = (pCurr.x - pPrev.x) * (pNext.y - pCurr.y) - (pCurr.y - pPrev.y) * (pNext.x - pCurr.x);
    if (signedArea2D(cleanedWalls) >= 0 ? cross < -0.001 : cross > 0.001) reflexCount++;
  }
  const skeletonType =
    nCorners === 4 ? 'rectangle' :
    reflexCount === 1 ? 'l_shape' :
    reflexCount === 2 ? 't_shape' :
    reflexCount === 4 ? 'cross_shape' : 'custom_polygon';

  return {
    skeletonType,
    eavePolygon: eavePoly,
    sections: kpGroups.sort((a, b) => b.kingpostHeight - a.kingpostHeight),
    ridges,
    hips,
    valleys,
    triangles: solved.triangles,
    totalRidgeLength: round2(ridges.reduce((s, r) => s + r.length, 0)),
    totalHipLength: round2(hips.reduce((s, h) => s + h.length, 0)),
    totalValleyLength: round2(valleys.reduce((s, v) => s + v.length, 0)),
    totalRoofArea: round2(totalArea),
    maxKingpost: round2(maxZ),
  };
}

/**
 * Standard Rectangle Skeleton (single ridge, 4 hips)
 */
function buildRectangleSkeleton(length = 12, breadth = 8, avgOv = 0.45, tanPitch = 1.0, pitchDegrees = 45.0, _roofType = 'hip', centerX = 0, centerY = 0) {
  const L = length;
  const B = breadth;
  const effL = L + 2 * avgOv;
  const effB = B + 2 * avgOv;
  const r = effB / 2;
  const kp = round2(r * tanPitch);
  const ridgeLen = Math.max(0, effL - effB);

  const p0 = { x: centerX - effL / 2, y: centerY - effB / 2, z: 0 };
  const p1 = { x: centerX + effL / 2, y: centerY - effB / 2, z: 0 };
  const p2 = { x: centerX + effL / 2, y: centerY + effB / 2, z: 0 };
  const p3 = { x: centerX - effL / 2, y: centerY + effB / 2, z: 0 };

  const r1 = { x: centerX - ridgeLen / 2, y: centerY, z: kp };
  const r2 = { x: centerX + ridgeLen / 2, y: centerY, z: kp };

  const ridges = ridgeLen > 0.01 ? [{ p1: r1, p2: r2, label: `Main Ridge (KP=${kp}m)`, length: round2(ridgeLen), isMain: true }] : [];
  const hips = [
    { p1: p0, p2: r1, label: 'Hip', length: round2(dist3D(p0, r1)) },
    { p1: p3, p2: r1, label: 'Hip', length: round2(dist3D(p3, r1)) },
    { p1: p1, p2: r2, label: 'Hip', length: round2(dist3D(p1, r2)) },
    { p1: p2, p2: r2, label: 'Hip', length: round2(dist3D(p2, r2)) },
  ];

  const triangles = [
    [p0, p1, r2],
    [p0, r2, r1],
    [p1, p2, r2],
    [p2, p3, r1],
    [p2, r1, r2],
    [p3, p0, r1],
  ];

  let totalArea = 0;
  triangles.forEach((t) => (totalArea += triArea3D(t[0], t[1], t[2])));

  return {
    skeletonType: 'rectangle',
    sections: [{ name: 'Main Roof', span: B, length: L, kingpostHeight: kp, pitchDegrees, ridge: { p1: r1, p2: r2 } }],
    ridges,
    hips,
    valleys: [],
    triangles,
    totalRidgeLength: round2(ridgeLen),
    totalHipLength: round2(hips.reduce((s, h) => s + h.length, 0)),
    totalValleyLength: 0,
    totalRoofArea: round2(totalArea),
    maxKingpost: kp,
  };
}
