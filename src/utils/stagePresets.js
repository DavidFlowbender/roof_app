/**
 * Stage Presets Engine for On-Site Estimators
 * Tailored for field roof sellers and carpenters.
 * 
 * 3 Stages:
 * 1. Foundation: Ground footprint only. Automatic standard presets (Hip, 6:12 pitch, 0.45m eaves).
 * 2. Parapet: Walls & parapet up. Parapet height, trough gutters, flashing, coping.
 * 3. Woodwork: Timber skeleton up. Exact measured king post/rafter, purlin spacing, full timber carcass BOQ.
 */

export const BUILDING_STAGES = [
  {
    id: 'foundation',
    name: 'Foundation Level',
    shortName: 'Foundation',
    badge: '🏗️ Foundation Level',
    tagline: 'Ground / DPC Level',
    summary: 'Only footprint known. Standard presets auto-applied for fast 30-second estimate.',
    iconName: 'Home',
    color: '#10b981', // emerald
    bgLight: 'rgba(16, 185, 129, 0.1)',
    borderLight: 'rgba(16, 185, 129, 0.3)',
    demandedFields: ['length', 'breadth'],
    presetNotice: 'Standard residential roof (Kingpost = half breadth, 45° / 12:12 pitch, 0.45m eaves) applied.',
    defaults: {
      roofType: 'hip',
      pitchMode: 'ratio',
      pitchRatio: 12, // 12:12 (45°), Kingpost Height = Breadth / 2
      pitchAngle: 45.0,
      heightVal: 2.0,
      overhang: { front: 0.45, back: 0.45, left: 0.45, right: 0.45 },
      isUniformOverhang: true,
      wastePercentage: 10,
      parapet: {
        enabled: false,
        height: 0.9,
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
    badge: '🧱 Concrete Parapet',
    tagline: 'Outward Parapet Fascia',
    summary: 'Cast concrete parapet extends outward from the wall top; the roof lays cleanly on top with zero hidden area. Only added to roof dimensions when your sketch does not already include it.',
    iconName: 'Layers',
    color: '#06b6d4', // cyan/sky
    bgLight: 'rgba(6, 182, 212, 0.1)',
    borderLight: 'rgba(6, 182, 212, 0.3)',
    demandedFields: ['length', 'breadth', 'parapetStyle'],
    presetNotice: 'Outward concrete parapet preset applied: +0.45m outward projection added to wall footprint (set to 0m if sketch already includes parapet).',
    defaults: {
      roofType: 'hip',
      pitchMode: 'ratio',
      pitchRatio: 12, // Standard full-visibility 45° (12:12) pitch laying directly on parapet
      pitchAngle: 45.0,
      heightVal: 2.0,
      overhang: { front: 0.45, back: 0.45, left: 0.45, right: 0.45 },
      isUniformOverhang: true,
      wastePercentage: 10,
      parapet: {
        enabled: true,
        height: 0.42, // Stepped concrete parapet fascia height (0.42m cornice at wall top)
        projection: 0.45, // Horizontal outward extension beyond wall
        wallThickness: 0.225, // 9" block
        style: 'fascia_overhang', // Always outward-extending; roof sits on top, never hidden
        includedInSketch: false, // false = Foundation/wall sketch without parapet yet
        troughWidth: 0.4,
        includeCoping: true,
      },
      woodwork: {
        includeTimberBOQ: false,
        trussSpacing: 1.2,
        purlinSpacing: 0.6,
      },
    },
  },
  {
    id: 'woodwork',
    name: 'Woodwork Level',
    shortName: 'Woodwork',
    badge: '🪵 Woodwork Level',
    tagline: 'Carcass & Trusses Erected',
    summary: 'Woodwork is framed on site. Enter your measured Slanting Height (H) if available, or use the angle-based preset + full timber BOQ.',
    iconName: 'Sliders',
    color: '#f59e0b', // amber
    bgLight: 'rgba(245, 158, 11, 0.1)',
    borderLight: 'rgba(245, 158, 11, 0.3)',
    demandedFields: ['length', 'breadth', 'slantingHeight', 'measuredOverhang'],
    presetNotice: 'Asks for measured Slanting Height (H), or auto-applies angle-dependent preset H.',
    defaults: {
      roofType: 'hip',
      pitchMode: 'angle',
      pitchRatio: 12,
      pitchAngle: 45.0,
      heightVal: 2.5,
      overhang: { front: 0.5, back: 0.5, left: 0.5, right: 0.5 },
      isUniformOverhang: true,
      wastePercentage: 10,
      parapet: {
        enabled: false,
        height: 0.9,
        wallThickness: 0.225,
        style: 'eaves',
        includeCoping: false,
      },
      woodwork: {
        includeTimberBOQ: true,
        rafterSize: '2x4',
        tieBeamSize: '2x6',
        purlinSize: '2x3',
        kingPostSize: '2x4',
        wallPlateSize: '2x4',
        trussSpacing: 1.2, // meters
        purlinSpacing: 0.6, // meters
        timberLengthStandard: 3.6, // 12-foot length in meters
        includeTreatment: true, // solignum / anti-termite
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
  return BUILDING_STAGES.find((s) => s.id === stageId) || BUILDING_STAGES[0];
}
