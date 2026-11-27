import { getRoofCalcLaunchUrl } from './domainRouting';

/**
 * Sijitek Solutions Product & Field Tools Catalog.
 * Add each new engineering or construction tool here to publish it under Products on sijiteksolutions.com.
 */
export function getSijitekProducts() {
  const roofCalcUrl = getRoofCalcLaunchUrl();
  const roofCalcShareUrl = 'https://roofcalc.sijiteksolutions.com';

  return [
    {
      id: 'roofcalc-pro',
      code: 'PRD-01',
      name: 'RoofCalc Pro',
      status: 'live',
      statusLabel: 'Available Now',
      category: 'Roof Geometry, Quantities & Quotation',
      audience: 'For Homeowners, Quantity Surveyors, Building Contractors & Engineers',
      description:
        'Turn any floor plan or hand-drawn site sketch into an accurate 3D roof model and a clear material schedule. Whether you are a homeowner verifying a quote, a surveyor preparing a Bill of Quantities, or a contractor measuring on site, RoofCalc Pro removes guesswork from roof estimation.',
      launchUrl: roofCalcUrl,
      shareUrl: roofCalcShareUrl,
      videoGuideUrl: 'https://youtu.be/lLL4IdY3rcc',
      specs: [
        {
          label: 'Site Sketch & 2D Plan',
          detail: 'Draw custom shapes (L, T, Cross, or any layout) or scan a paper sketch with AI dimensioning.',
        },
        {
          label: 'Live 3D Verification',
          detail: 'Inspect Hip, Gable, and Shed / Mono-Pitch (including low-slope concealed/flat) roofs alongside timber framing and rainwater drops.',
        },
        {
          label: 'Itemized Schedules (BOQ)',
          detail: 'Separate, clean quantities for Roof Covering, Woodwork & Timber Carcass, and Water Collector systems.',
        },
        {
          label: 'Client-Ready PDF Quotes',
          detail: 'Export official quotations with editable material names, custom company logo, and saved Pro rates.',
        },
      ],
      devices: [
        {
          id: 'desktop',
          label: 'Desktop & Laptop',
          sublabel: 'Windows · macOS · Linux — Runs directly in browser',
          actionLabel: 'Open Web App',
          mode: 'direct',
          url: roofCalcUrl,
        },
        {
          id: 'android',
          label: 'Android Phone & Tablet',
          sublabel: 'Install full-screen app via Chrome (no app store needed)',
          actionLabel: 'Install on Android',
          mode: 'android_guide',
          url: roofCalcUrl,
          steps: [
            'Open RoofCalc Pro in Google Chrome on your Android phone or tablet.',
            'Tap the "Install" prompt at the bottom of the screen (or open the ☰ menu and tap "Install App").',
            'The Sijitek RoofCalc Pro icon is added to your home screen and opens full-screen like a native app.',
          ],
        },
        {
          id: 'ios',
          label: 'iPhone & iPad (iOS)',
          sublabel: 'Add to Home Screen via Safari for full-screen site use',
          actionLabel: 'Install on iOS',
          mode: 'ios_guide',
          url: roofCalcUrl,
          steps: [
            'Open RoofCalc Pro in Safari on your iPhone or iPad.',
            'Tap the Share icon at the bottom bar of Safari.',
            'Scroll down, tap "Add to Home Screen", and tap "Add".',
          ],
        },
      ],
    },
  ];
}

export const AUDIENCE_GROUPS = [
  {
    index: '01',
    role: 'Homeowners & Project Owners',
    title: 'Know what your building truly needs.',
    body: 'Check roof areas, understand material counts before purchasing, and compare contractor quotations with clarity — without needing technical CAD software.',
  },
  {
    index: '02',
    role: 'Quantity Surveyors',
    title: 'From floor plan to BOQ in minutes.',
    body: 'Calculate roof covering, timber rafters, purlins, tie beams, and rainwater collector fittings with live waste allowances and clean itemized schedules.',
  },
  {
    index: '03',
    role: 'Building Contractors & Roofers',
    title: 'Measure on site. Quote on the spot.',
    body: 'Account for foundation-level parapet allowances or exact parapet measurements, show clients a live 3D preview, and send branded PDF quotes right from your phone.',
  },
  {
    index: '04',
    role: 'Architects & Site Engineers',
    title: 'Check geometry before timber goes up.',
    body: 'Verify kingpost heights, pitch angles, valley lengths, and multi-wing intersections across Hip, Gable, and Shed / Mono-Pitch roof layouts.',
  },
];

export const ENGINEERING_PILLARS = [
  {
    code: '01',
    title: 'Grounded in Site Reality',
    body: 'Built around how buildings are actually measured and constructed on site — from foundation parapet allowances to standard 12ft timber lengths and rainwater corner angles.',
  },
  {
    code: '02',
    title: 'Accessible to Everyone',
    body: 'Engineered with the precision professionals expect, yet straightforward enough for a homeowner budgeting a single project.',
  },
  {
    code: '03',
    title: 'Office to Site Continuity',
    body: 'Start a calculation on a laptop in the office or draw a plan with your finger on site — your Pro rates, material names, and company branding follow your account.',
  },
];
