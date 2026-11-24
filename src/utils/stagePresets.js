/**
 * Stage Presets Engine for On-Site Estimators
 * Tailored for field roof sellers and carpenters.
 *
 * 2 Site Measurement Levels:
 * 1. Foundation: Measured at wall/foundation level before parapet is cast. Automatically adds
 *    editable +0.5m per side to account for the parapet/eaves that will be installed later.
 * 2. Parapet: Measured at parapet or woodwork outer edge (projection already built).
 *    Drawn/scanned base dimensions remain exact (+0m added).
 */

export const BUILDING_STAGES = [
  {
    id: 'foundation',
    name: 'Foundation Level',
    shortName: 'Foundation',
    badge: '🏗️ Foundation Level',
    tagline: 'Wall / Foundation Footprint (+0.5m Parapet Allowance)',
    summary: 'Sketch measured before parapet is built. Automatically adds editable +0.5m per side for future parapet/eaves.',
    iconName: 'Home',
    color: '#10b981', // emerald
    bgLight: 'rgba(16, 185, 129, 0.1)',
    borderLight: 'rgba(16, 185, 129, 0.3)',
    demandedFields: ['length', 'breadth'],
    presetNotice: 'Foundation level: +0.5m per side added automatically (editable) for the parapet/eaves to be installed later.',
    defaults: {
      roofType: 'hip',
      pitchMode: 'ratio',
      pitchRatio: 12, // 12:12 (45°), Kingpost Height = Breadth / 2
      pitchAngle: 45.0,
      heightVal: 2.0,
      overhang: { front: 0.5, back: 0.5, left: 0.5, right: 0.5 },
      isUniformOverhang: true,
      wastePercentage: 10,
      parapet: {
        enabled: false,
        height: 0.42,
        wallThickness: 0.225, // 9" standard block
        style: 'eaves',
        includeCoping: false,
      },
      woodwork: {
        includeTimberBOQ: false,
        trussSpacing: 1.2,
        purlinSpacing: 0.6,
      },
    },
  },
  {
    id: 'parapet',
    name: 'Parapet Level',
    shortName: 'Parapet',
    badge: '🧱 Parapet Level',
    tagline: 'Parapet / Woodwork Already Built (+0m Exact)',
    summary: 'Sketch already measured at the parapet/woodwork edge — base dimensions stay exact (+0m added).',
    iconName: 'Layers',
    color: '#06b6d4', // cyan/sky
    bgLight: 'rgba(6, 182, 212, 0.1)',
    borderLight: 'rgba(6, 182, 212, 0.3)',
    demandedFields: ['length', 'breadth', 'parapetStyle'],
    presetNotice: 'Parapet level active: measured at parapet/woodwork edge — dimensions stay exact (+0m added).',
    defaults: {
      roofType: 'hip',
      pitchMode: 'ratio',
      pitchRatio: 12, // Standard full-visibility 45° (12:12) pitch laying directly on parapet
      pitchAngle: 45.0,
      heightVal: 2.0,
      overhang: { front: 0, back: 0, left: 0, right: 0 },
      isUniformOverhang: true,
      wastePercentage: 10,
      parapet: {
        enabled: true,
        height: 0.42, // Stepped concrete parapet fascia height (0.42m cornice at wall top)
        projection: 0.45, // Visual parapet cornice depth
        wallThickness: 0.225, // 9" block
        style: 'fascia_overhang', // Always outward-extending; roof sits on top, never hidden
        includedInSketch: true, // Drawn dimensions already measure parapet-to-parapet
        troughWidth: 0.4,
        includeCoping: false,
      },
      woodwork: {
        includeTimberBOQ: false,
        trussSpacing: 1.2,
        purlinSpacing: 0.6,
      },
    },
  },
];

export const WOODWORK_ANGLE_PRESETS = [
  { label: '14.0° — Low Pitch (3:12)', degrees: 14.0 },
  { label: '18.4° — Gentle Pitch (4:12)', degrees: 18.4 },
  { label: '26.6° — Standard Residential (6:12)', degrees: 26.6 },
  { label: '33.7° — Steep Bungalow Pitch (8:12)', degrees: 33.7 },
  { label: '39.8° — High Architectural Pitch (10:12)', degrees: 39.8 },
  { label: '45.0° — Very Steep / Classic Peak (12:12)', degrees: 45.0 },
];

export const PARAPET_STYLES = [
  {
    id: 'fascia_overhang',
    name: 'Outward Concrete Parapet (Roof On Top)',
    desc: 'Stepped concrete cornice extends outward from the wall top; roof lays cleanly on top with nothing hidden.',
  },
];

export const TIMBER_SIZES = [
  { id: '2x4', name: '2" × 4" (50mm × 100mm)', desc: 'Standard rafters & wall plates' },
  { id: '2x6', name: '2" × 6" (50mm × 150mm)', desc: 'Heavy-duty tie beams & valley rafters' },
  { id: '2x3', name: '2" × 3" (50mm × 75mm)', desc: 'Standard purlins / battens' },
  { id: '2x2', name: '2" × 2" (50mm × 50mm)', desc: 'Light battens for tiles' },
];

export const PURLIN_SPACING_PRESETS = [
  { label: '370mm (14.5") — Stone-Coated Metal Tiles', value: 0.37 },
  { label: '600mm (24") — Light Longspan / Step-Tiles', value: 0.60 },
  { label: '900mm (36") — Heavy Longspan Aluminum Sheets', value: 0.90 },
  { label: '400mm (16") — Concrete / Clay Interlocking Tiles', value: 0.40 },
];

/**
 * Get stage metadata by ID
 */
export function getStageConfig(stageId) {
  if (stageId === 'woodwork') {
    return BUILDING_STAGES.find((s) => s.id === 'parapet') || BUILDING_STAGES[0];
  }
  return BUILDING_STAGES.find((s) => s.id === stageId) || BUILDING_STAGES[0];
}
