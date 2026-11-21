/**
 * Unit Conversion & Formatting Engine for Roofing
 */

export const UNIT_SYSTEMS = {
  METRIC: 'metric',
  IMPERIAL: 'imperial',
};

// 1 meter = 3.28084 feet
export const M_TO_FT = 3.28084;
// 1 m² = 10.7639 sq ft
export const M2_TO_SQFT = 10.7639;
// 1 roofing square = 100 sq ft = 9.2903 m²
export const SQUARE_TO_M2 = 9.290304;

export function metersToFeet(m) {
  return (Number(m) || 0) * M_TO_FT;
}

export function feetToMeters(ft) {
  return (Number(ft) || 0) / M_TO_FT;
}

export function m2ToSqft(m2) {
  return (Number(m2) || 0) * M2_TO_SQFT;
}

export function sqftToM2(sqft) {
  return (Number(sqft) || 0) / M2_TO_SQFT;
}

export function m2ToSquares(m2) {
  return (Number(m2) || 0) / SQUARE_TO_M2;
}

export function squaresToM2(squares) {
  return (Number(squares) || 0) * SQUARE_TO_M2;
}

export function formatLength(meters, unit = UNIT_SYSTEMS.METRIC, decimals = 2) {
  const val = Number(meters) || 0;
  if (unit === UNIT_SYSTEMS.IMPERIAL) {
    const ft = val * M_TO_FT;
    return `${ft.toFixed(decimals)} ft`;
  }
  return `${val.toFixed(decimals)} m`;
}

export function formatArea(m2, unit = UNIT_SYSTEMS.METRIC, decimals = 2) {
  const val = Number(m2) || 0;
  if (unit === UNIT_SYSTEMS.IMPERIAL) {
    const sqft = val * M2_TO_SQFT;
    const squares = val / SQUARE_TO_M2;
    return `${sqft.toFixed(decimals)} sq ft (${squares.toFixed(1)} sq)`;
  }
  return `${val.toFixed(decimals)} m²`;
}
