/**
 * Bill of Quantities (BOQ) and Material Estimator
 */

export const CURRENCIES = [
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira (NGN)', rate: 1 },
  { code: 'USD', symbol: '$', name: 'US Dollar (USD)', rate: 0.00067 },
  { code: 'GBP', symbol: '£', name: 'British Pound (GBP)', rate: 0.00053 },
  { code: 'EUR', symbol: '€', name: 'Euro (EUR)', rate: 0.00062 },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar (CAD)', rate: 0.00091 },
];

export const MATERIAL_PROFILES = [
  {
    id: 'stone_coated',
    name: 'Stone-Coated Steel Tiles',
    desc: 'Premium embossed metal tiles (~2 sheets/m², priced per m²)',
    unit: 'm²',
    coveragePerUnitM2: 1.0,
    sheetsPerM2: 2,
    defaultPrices: { NGN: 9500, USD: 6.4, GBP: 5.0, EUR: 5.8 },
  },
  {
    id: 'longspan_aluminum',
    name: 'Longspan Aluminum / Aluzinc Sheets',
    desc: 'Continuous corrugated or step-tile sheets (~2 sheets/m², priced per m²)',
    unit: 'm²',
    coveragePerUnitM2: 1.0,
    sheetsPerM2: 2,
    defaultPrices: { NGN: 6500, USD: 4.5, GBP: 3.5, EUR: 4.0 },
  },
  {
    id: 'asphalt_shingles',
    name: 'Asphalt Architectural Shingles',
    desc: 'Dual-layer dimensional shingles (3 bundles per 100 sq ft / 3.1 m² per bundle)',
    unit: 'bundles',
    coveragePerUnitM2: 3.1, // 1 bundle covers ~3.1 m²
    defaultPrices: { NGN: 18000, USD: 35.0, GBP: 28.0, EUR: 32.0 },
  },
  {
    id: 'clay_concrete_tiles',
    name: 'Clay / Concrete Roof Tiles',
    desc: 'Traditional interlocking clay or extruded concrete tiles (~10 tiles/m²)',
    unit: 'tiles',
    coveragePerUnitM2: 0.1, // 10 tiles per m²
    defaultPrices: { NGN: 1200, USD: 1.5, GBP: 1.2, EUR: 1.35 },
  },
  {
    id: 'standing_seam',
    name: 'Standing Seam Metal Panels',
    desc: 'Architectural concealed-fastener modern metal roofing',
    unit: 'm²',
    coveragePerUnitM2: 1.0,
    defaultPrices: { NGN: 9500, USD: 7.5, GBP: 5.8, EUR: 6.8 },
  },
];

export const ACCESSORY_DEFAULTS = {
  ridgeCapLengthM: 1.0, // effective cover per cap
  gutterSectionLengthM: 3.0, // standard 3m section
  underlaymentRollM2: 50.0, // 50m² per roll
  screwsPerM2: 12,
  screwsPerBox: 250,
  downspoutIntervalM: 10.0, // 1 downspout per 10m gutter
};

export function estimateMaterials(
  geometry,
  selectedProfileId = 'stone_coated',
  currencyCode = 'NGN',
  customPrices = {},
  options = {}
) {
  const profile = MATERIAL_PROFILES.find((p) => p.id === selectedProfileId) || MATERIAL_PROFILES[0];
  const area = geometry.totalArea || 0;
  const ridge = geometry.totalRidge || 0;
  const gutter = geometry.totalGutter || 0;
  const hasGutters = typeof gutter === 'number' && gutter > 0;

  const {
    buildingStage = 'foundation',
    parapetConfig = null,
    woodworkConfig = null,
    includeZeroItems = false,
  } = options;

  // 1. Primary Covering Quantity
  let primaryQuantity = 0;
  if (profile.unit === 'm²') {
    primaryQuantity = Math.ceil(area);
  } else {
    primaryQuantity = Math.ceil(area / profile.coveragePerUnitM2);
  }

  // 2. Ridge Caps / Hip Liners
  const ridgeCapQty = Math.ceil(ridge / ACCESSORY_DEFAULTS.ridgeCapLengthM);

  // 3. Gutters & Downspouts
  const gutterSections = hasGutters ? Math.ceil(gutter / ACCESSORY_DEFAULTS.gutterSectionLengthM) : 0;
  const downspouts = hasGutters ? Math.max(1, Math.ceil(gutter / ACCESSORY_DEFAULTS.downspoutIntervalM)) : 0;

  // 4. Underlayment Rolls (roof felt / breathable membrane)
  const underlaymentRolls = Math.ceil(area / ACCESSORY_DEFAULTS.underlaymentRollM2);

  // 5. Fasteners / Screws
  const totalScrews = Math.ceil(area * ACCESSORY_DEFAULTS.screwsPerM2);
  const screwBoxes = Math.ceil(totalScrews / ACCESSORY_DEFAULTS.screwsPerBox);

  // Helper for pricing lookups
  const getPrice = (key, defaultFallback) => {
    if (customPrices[key] !== undefined && customPrices[key] !== '') {
      return Number(customPrices[key]);
    }
    return defaultFallback[currencyCode] || defaultFallback['NGN'] || 0;
  };

  const primaryUnitPrice = getPrice('primary', profile.defaultPrices);

  const ridgeCapPrice = getPrice('ridgeCap', {
    NGN: 2500,
    USD: 4.5,
    GBP: 3.5,
    EUR: 4.0,
  });

  const gutterPrice = getPrice('gutter', {
    NGN: 8500, // per 3m section
    USD: 16.0,
    GBP: 12.5,
    EUR: 14.5,
  });

  const downspoutPrice = getPrice('downspout', {
    NGN: 6000,
    USD: 12.0,
    GBP: 9.5,
    EUR: 11.0,
  });

  const underlaymentPrice = getPrice('underlayment', {
    NGN: 22000, // per 50m² roll
    USD: 45.0,
    GBP: 36.0,
    EUR: 40.0,
  });

  const screwBoxPrice = getPrice('screws', {
    NGN: 4500,
    USD: 12.0,
    GBP: 9.0,
    EUR: 10.5,
  });

  const laborCostPerM2 = getPrice('laborPerM2', {
    NGN: 1500,
    USD: 3.5,
    GBP: 2.8,
    EUR: 3.2,
  });

  const transportFee = getPrice('transport', {
    NGN: 25000,
    USD: 50,
    GBP: 40,
    EUR: 45,
  });

  const perimeter =
    geometry?.buildingDimensions?.perimeter ||
    2 * ((geometry?.buildingDimensions?.length || 12) + (geometry?.buildingDimensions?.breadth || 8));
  const hasParapet = buildingStage === 'parapet' || Boolean(parapetConfig?.enabled);

  // Missing Roofing Accessories Pricing (Sealants, Nails, Thunder Arrester, Fascia Board, Sun Breaker)
  const sealantPrice = getPrice('sealants', { NGN: 3500, USD: 6.0, GBP: 4.8, EUR: 5.5 });
  const sealantQty = Math.max(2, Math.ceil(ridge / 8));

  const roofNailsPrice = getPrice('roofNails', { NGN: 4000, USD: 7.0, GBP: 5.5, EUR: 6.5 });
  const roofNailsQty = Math.max(1, Math.ceil(area / 20));

  const thunderArresterPrice = getPrice('thunderArrester', { NGN: 45000, USD: 45, GBP: 35, EUR: 40 });
  const thunderArresterQty = 1;

  const fasciaBoardPrice = getPrice('fasciaBoard', { NGN: 5500, USD: 10, GBP: 8, EUR: 9 });
  const fasciaBoardQty = Math.max(1, Math.ceil(perimeter / 3.6));

  const sunBreakerPrice = getPrice('sunBreaker', { NGN: 18000, USD: 25, GBP: 20, EUR: 22 });
  const sunBreakerQty = Math.max(1, Math.ceil((geometry?.buildingDimensions?.length || 12) / 4));

  // Sheet estimate note (~2 roofing sheets per m² in Nigeria, priced per m²)
  const estimatedSheets = profile.sheetsPerM2 ? Math.ceil(area * profile.sheetsPerM2) : null;
  const primarySpec = estimatedSheets
    ? `~${estimatedSheets.toLocaleString()} sheets (2 sheets/m²) • Covers ${area} m² (incl. ${geometry.wastePercentage}% waste)`
    : `Covers ${area} m² (incl. ${geometry.wastePercentage}% waste)`;

  // Calculate Subtotals for Covering
  const primaryCost = primaryQuantity * primaryUnitPrice;
  const ridgeCapCost = ridgeCapQty * ridgeCapPrice;
  const gutterCost = gutterSections * gutterPrice + downspouts * downspoutPrice;
  const underlaymentCost = underlaymentRolls * underlaymentPrice;
  const screwsCost = screwBoxes * screwBoxPrice;

  const baseItems = [
    {
      id: 'primary',
      category: 'Main Covering',
      name: `${profile.name}`,
      spec: primarySpec,
      quantity: primaryQuantity,
      unit: profile.unit,
      unitPrice: primaryUnitPrice,
      total: primaryCost,
    },
    {
      id: 'ridgeCap',
      category: 'Flashing & Trims',
      name: 'Ridge Caps & Hip Covering',
      spec: `${ridge} m linear length (${ACCESSORY_DEFAULTS.ridgeCapLengthM}m per piece)`,
      quantity: ridgeCapQty,
      unit: 'pcs',
      unitPrice: ridgeCapPrice,
      total: ridgeCapCost,
    },
    {
      id: 'sealants',
      category: 'Flashing & Trims',
      name: 'Roofing Sealants & Flashing Silicone',
      spec: `Waterproof joint & flashing sealant tubes`,
      quantity: sealantQty,
      unit: 'tubes',
      unitPrice: sealantPrice,
      total: sealantQty * sealantPrice,
    },
    ...(hasGutters
      ? [
          {
            id: 'gutter',
            category: 'Drainage & Eaves',
            name: 'Gutter Profiles (3m sections)',
            spec: `${gutter} m eave run + fascia brackets`,
            quantity: gutterSections,
            unit: 'sections',
            unitPrice: gutterPrice,
            total: gutterSections * gutterPrice,
          },
          {
            id: 'downspout',
            category: 'Drainage & Eaves',
            name: 'Downspout Pipes & Elbows',
            spec: `Complete with discharge shoes`,
            quantity: downspouts,
            unit: 'sets',
            unitPrice: downspoutPrice,
            total: downspouts * downspoutPrice,
          },
        ]
      : []),
    ...(!hasParapet
      ? [
          {
            id: 'fasciaBoard',
            category: 'Eaves & Trims',
            name: 'Fascia Board (No Parapet)',
            spec: `${perimeter}m eave perimeter (~3.6m per length)`,
            quantity: fasciaBoardQty,
            unit: 'lengths',
            unitPrice: fasciaBoardPrice,
            total: fasciaBoardQty * fasciaBoardPrice,
          },
        ]
      : []),
    {
      id: 'underlayment',
      category: 'Moisture Barrier',
      name: 'Breathable Membrane / Underlayment',
      spec: `${ACCESSORY_DEFAULTS.underlaymentRollM2} m² coverage per roll`,
      quantity: underlaymentRolls,
      unit: 'rolls',
      unitPrice: underlaymentPrice,
      total: underlaymentCost,
    },
    {
      id: 'screws',
      category: 'Fasteners',
      name: 'Self-Drilling Roofing Screws with EPDM Washers',
      spec: `Box of ${ACCESSORY_DEFAULTS.screwsPerBox} pcs (~${totalScrews} screws)`,
      quantity: screwBoxes,
      unit: 'boxes',
      unitPrice: screwBoxPrice,
      total: screwsCost,
    },
    {
      id: 'roofNails',
      category: 'Fasteners',
      name: 'Roofing Nails / Cap Nails',
      spec: `Corrosion-resistant fastening packs`,
      quantity: roofNailsQty,
      unit: 'packs',
      unitPrice: roofNailsPrice,
      total: roofNailsQty * roofNailsPrice,
    },
    {
      id: 'thunderArrester',
      category: 'Safety & Accessories',
      name: 'Thunder / Lightning Arrester Kit',
      spec: `Copper air terminal, down conductor & earth rod`,
      quantity: thunderArresterQty,
      unit: 'set',
      unitPrice: thunderArresterPrice,
      total: thunderArresterQty * thunderArresterPrice,
    },
    {
      id: 'sunBreaker',
      category: 'Architectural Trims',
      name: 'Sun Breaker / Exterior Shading Fins',
      spec: `Allowance for facade/window shading fins`,
      quantity: sunBreakerQty,
      unit: 'sets',
      unitPrice: sunBreakerPrice,
      total: sunBreakerQty * sunBreakerPrice,
    },
  ];

  // ==========================================
  // PARAPET LEVEL ITEMS
  // ==========================================
  const parapetItems = [];

  if (hasParapet) {
    // 1. Concrete Parapet / Roof Junction Flashing & Sealant
    const flashingPrice = getPrice('parapetFlashing', { NGN: 2400, USD: 3.5, GBP: 2.8, EUR: 3.2 });
    const flashingQty = Math.ceil(perimeter);
    parapetItems.push({
      id: 'parapetFlashing',
      category: 'Parapet Sealing',
      name: 'Parapet Roof-Edge Flashing & Sealant',
      spec: `Protective eave/drip flashing along ${perimeter}m outward concrete parapet edge`,
      quantity: flashingQty,
      unit: 'm',
      unitPrice: flashingPrice,
      total: flashingQty * flashingPrice,
    });

    // 2. Concrete Parapet Edge Trim / Capping
    if (parapetConfig?.includeCoping !== false) {
      const copingPrice = getPrice('parapetCoping', { NGN: 3500, USD: 5.0, GBP: 4.0, EUR: 4.6 });
      const copingQty = Math.ceil(perimeter);
      parapetItems.push({
        id: 'parapetCoping',
        category: 'Parapet Trims',
        name: 'Concrete Parapet Fascia Drip Edge & Trim',
        spec: `Metal drip trim along ${perimeter}m outward concrete parapet ledge`,
        quantity: copingQty,
        unit: 'm',
        unitPrice: copingPrice,
        total: copingQty * copingPrice,
      });
    }
  }

  // ==========================================
  // WOODWORK / TIMBER CARCASS BOQ ITEMS
  // ==========================================
  const timberItems = [];
  if (buildingStage === 'woodwork' || woodworkConfig?.includeTimberBOQ) {
    const L = geometry?.buildingDimensions?.length || 12;
    const B = geometry?.buildingDimensions?.breadth || 8;
    const H = Math.max(0.5, geometry?.roofHeight || 2.0);
    const RafterLen = geometry?.rafterLength || Math.sqrt(Math.pow(B / 2, 2) + Math.pow(H, 2));
    const HipLen = geometry?.hipRafterLength || Math.sqrt(Math.pow(B / 2, 2) + Math.pow(RafterLen, 2));

    const boardLenM = woodworkConfig?.timberLengthStandard || 3.6; // 12-ft board
    const trussSpacing = Math.max(0.6, woodworkConfig?.trussSpacing || 1.2);
    const purlinSpacing = Math.max(0.2, woodworkConfig?.purlinSpacing || 0.6);

    const numTrusses = Math.ceil(L / trussSpacing) + 1;

    // 1. Wall Plates (2x4)
    const wallPlatePerimeter = perimeter * 1.1; // 10% overlap
    const wallPlateBoards = Math.ceil(wallPlatePerimeter / boardLenM);
    const price2x4 = getPrice('timber2x4', { NGN: 2800, USD: 4.0, GBP: 3.2, EUR: 3.7 });
    timberItems.push({
      id: 'timberWallPlates',
      category: 'Timber Skeleton',
      name: 'Wall Plates — 2" × 4" (12ft lengths)',
      spec: `${wallPlateBoards} pcs for ${Math.round(wallPlatePerimeter)}m perimeter wall bearing`,
      quantity: wallPlateBoards,
      unit: 'pcs',
      unitPrice: price2x4,
      total: wallPlateBoards * price2x4,
    });

    // 2. Tie Beams (2x6)
    const tieBeamMeters = numTrusses * (B + 0.6);
    const tieBeamBoards = Math.ceil(tieBeamMeters / boardLenM);
    const price2x6 = getPrice('timber2x6', { NGN: 4200, USD: 6.0, GBP: 4.8, EUR: 5.5 });
    timberItems.push({
      id: 'timberTieBeams',
      category: 'Timber Skeleton',
      name: 'Tie Beams — 2" × 6" (12ft lengths)',
      spec: `${tieBeamBoards} pcs across ${numTrusses} truss positions (span ${B}m)`,
      quantity: tieBeamBoards,
      unit: 'pcs',
      unitPrice: price2x6,
      total: tieBeamBoards * price2x6,
    });

    // 3. Common Rafters & Hip Rafters (2x4)
    const totalRafterMeters = (numTrusses * 2 * RafterLen * 1.1) + (4 * HipLen);
    const rafterBoards = Math.ceil(totalRafterMeters / boardLenM);
    timberItems.push({
      id: 'timberRafters',
      category: 'Timber Skeleton',
      name: 'Common & Hip Rafters — 2" × 4" (12ft lengths)',
      spec: `${rafterBoards} pcs (incl. 4 hip rafters @ ${HipLen.toFixed(1)}m)`,
      quantity: rafterBoards,
      unit: 'pcs',
      unitPrice: price2x4,
      total: rafterBoards * price2x4,
    });

    // 4. King Posts & Struts (2x4)
    const kingPostMeters = numTrusses * (H + 1.2);
    const kingPostBoards = Math.ceil(kingPostMeters / boardLenM);
    timberItems.push({
      id: 'timberKingPosts',
      category: 'Timber Skeleton',
      name: 'King Posts & Bracing Struts — 2" × 4" (12ft lengths)',
      spec: `${kingPostBoards} pcs for ${numTrusses} trusses (apex height ${H.toFixed(2)}m)`,
      quantity: kingPostBoards,
      unit: 'pcs',
      unitPrice: price2x4,
      total: kingPostBoards * price2x4,
    });

    // 5. Purlins / Battens (2x3)
    const totalPurlinMeters = Math.ceil(area / purlinSpacing) * 1.1;
    const purlinBoards = Math.ceil(totalPurlinMeters / boardLenM);
    const price2x3 = getPrice('timber2x3', { NGN: 2100, USD: 3.0, GBP: 2.4, EUR: 2.8 });
    timberItems.push({
      id: 'timberPurlins',
      category: 'Timber Skeleton',
      name: `Roof Purlins — 2" × 3" (${purlinSpacing * 1000}mm spacing)`,
      spec: `${purlinBoards} pcs (12ft) for ${area}m² roof covering support`,
      quantity: purlinBoards,
      unit: 'pcs',
      unitPrice: price2x3,
      total: purlinBoards * price2x3,
    });

    // 6. Timber Nails (3" & 4" Wire Nails)
    const nailBags = Math.max(1, Math.ceil(area / 80));
    const nailPrice = getPrice('timberNails', { NGN: 16000, USD: 22.0, GBP: 18.0, EUR: 20.0 });
    timberItems.push({
      id: 'timberNails',
      category: 'Timber Fasteners',
      name: 'Timber Framing Nails (3" & 4" Wire Nails)',
      spec: `${nailBags} bags (25kg each) for timber carcass assembly`,
      quantity: nailBags,
      unit: 'bags',
      unitPrice: nailPrice,
      total: nailBags * nailPrice,
    });

    // 7. Wood Preservative / Anti-Termite Chemical (Optional)
    if (woodworkConfig?.includeTreatment !== false) {
      const treatmentGallons = Math.max(1, Math.ceil(area / 60));
      const treatmentPrice = getPrice('timberTreatment', { NGN: 9000, USD: 13.0, GBP: 10.5, EUR: 12.0 });
      timberItems.push({
        id: 'timberTreatment',
        category: 'Timber Protection',
        name: 'Anti-Termite Wood Preservative (Solignum / Chemical)',
        spec: `${treatmentGallons} gallons (4L each) for timber soaking`,
        quantity: treatmentGallons,
        unit: 'gallons',
        unitPrice: treatmentPrice,
        total: treatmentGallons * treatmentPrice,
      });
    }
  }

  // User-added custom material rows (stored in customPrices.__extraItems, auto-persisted in localStorage)
  const rawExtraItems = Array.isArray(customPrices?.__extraItems) ? customPrices.__extraItems : [];
  const customRoofItems = rawExtraItems
    .filter((ci) => ci && (ci.scope || 'roof') === 'roof' && String(ci.name || '').trim())
    .map((ci) => {
      const qty = Math.max(0, Number(ci.quantity) || 0);
      const overrideVal = customPrices?.[ci.id];
      const unitPrice =
        overrideVal !== undefined && overrideVal !== '' && Number.isFinite(Number(overrideVal))
          ? Math.max(0, Number(overrideVal))
          : Math.max(0, Number(ci.unitPrice) || 0);
      return {
        id: ci.id,
        category: 'Custom Material',
        name: String(ci.name).trim(),
        spec: ci.spec ? String(ci.spec) : 'Custom added material',
        quantity: qty,
        unit: String(ci.unit || 'pcs').trim() || 'pcs',
        unitPrice,
        total: qty * unitPrice,
        isCustom: true,
        scope: 'roof',
      };
    });

  const customWoodItems =
    buildingStage === 'woodwork' || woodworkConfig?.includeTimberBOQ || includeZeroItems
      ? rawExtraItems
          .filter((ci) => ci && ci.scope === 'wood' && String(ci.name || '').trim())
          .map((ci) => {
            const qty = Math.max(0, Number(ci.quantity) || 0);
            const overrideVal = customPrices?.[ci.id];
            const unitPrice =
              overrideVal !== undefined && overrideVal !== '' && Number.isFinite(Number(overrideVal))
                ? Math.max(0, Number(overrideVal))
                : Math.max(0, Number(ci.unitPrice) || 0);
            return {
              id: ci.id,
              category: 'Timber Custom',
              name: String(ci.name).trim(),
              spec: ci.spec ? String(ci.spec) : 'Custom added timber material',
              quantity: qty,
              unit: String(ci.unit || 'pcs').trim() || 'pcs',
              unitPrice,
              total: qty * unitPrice,
              isCustom: true,
              scope: 'wood',
            };
          })
      : [];

  // Combine all items & hide any zero-amount or zero-quantity rows from the BOQ
  const rawItems = [...baseItems, ...parapetItems, ...customRoofItems, ...timberItems, ...customWoodItems];
  const allItems = includeZeroItems
    ? rawItems.filter((it) => Number(it.quantity) > 0 || it.isCustom)
    : rawItems.filter((it) => Number(it.quantity) > 0 && Number(it.total) > 0);

  // Calculate Materials Subtotal
  const materialsSubtotal = allItems.reduce((acc, it) => acc + it.total, 0);

  // Labor, Transport & Grand Total
  const laborMultiplier = buildingStage === 'woodwork' ? 1.4 : 1.0;
  const laborTotal = Math.max(0, Math.round(area * laborCostPerM2 * laborMultiplier));
  const transportTotal = Math.max(0, Math.round(transportFee));
  const grandTotal = materialsSubtotal + laborTotal + transportTotal;

  return {
    profile,
    currencyCode,
    buildingStage,
    items: allItems,
    summary: {
      materialsSubtotal,
      laborTotal,
      transportTotal,
      grandTotal,
      costPerM2: area > 0 ? Math.round(grandTotal / area) : 0,
    },
  };
}

export function formatCurrency(amount, currencyCode = 'NGN') {
  const curr = CURRENCIES.find((c) => c.code === currencyCode) || CURRENCIES[0];
  const num = Number(amount) || 0;
  return `${curr.symbol} ${num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
