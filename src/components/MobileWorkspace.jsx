import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Camera,
  Box,
  Layers,
  Lock,
  Crown,
  Download,
  Share2,
  CheckCircle2,
  Ruler,
  Hammer,
  RotateCcw,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Droplets,
  Video,
  User,
  LogIn,
  LogOut,
  Plus,
  Trash2,
} from 'lucide-react';
import { MATERIAL_PROFILES, estimateMaterials, formatCurrency } from '../utils/materials';
import { estimateWaterCollector } from '../utils/waterCollector';
import { UNIT_SYSTEMS, formatLength, formatArea } from '../utils/units';
import { ROOF_TYPES, SHAPE_PRESETS } from '../utils/roofMath';
import { BUILDING_STAGES } from '../utils/stagePresets';
import { getUserInitials, getUserDisplayName } from '../utils/proSession';
import Roof2DDiagram from './Roof2DDiagram';
import Roof3DViewer from './Roof3DViewer';
import LevelInfoButton from './LevelInfoButton';
import CompanyInfoEditor from './CompanyInfoEditor';

export default function MobileWorkspace({
  geometry,
  materials,
  unitSystem,
  setUnitSystem,
  currencyCode,
  roofType,
  setRoofType,
  displayLength,
  displayBreadth,
  handleLengthChange,
  handleBreadthChange,
  polygonVertices,
  setPolygonVertices,
  hasActiveDesign = true,
  onResetToBlank = null,
  onActivateRectangle = null,
  handleTweakKingpost,
  handleTweakPitchAngle = null,
  foundationOverhangM = 0.5,
  handleFoundationOverhangChange = null,
  selectedMaterial,
  setSelectedMaterial,
  customPrices,
  setCustomPrices,
  wastePercentage = 10,
  setWastePercentage = null,
  buildingStage = 'foundation',
  handleStageSelect = null,
  parapetConfig = null,
  woodworkConfig,
  setSketchModalOpen,
  setQuoteModalOpen,
  setVideoModalOpen = null,
  handleCopySummary,
  copiedToast,
  sketchUnderlayImage,
  setSketchUnderlayImage,
  wcConfig = { floors: 1, extraDrops: 0 },
  setWcConfig,
  wcMaterials,
  setQuoteScope,
  handleCopyWcSummary,
  isPremium: externalIsPremium,
  priceSyncStatus = 'idle',
  contractorInfo = null,
  setContractorInfo = null,
  onUploadContractorLogo = null,
  logoUploadError = '',
  setLogoUploadError = null,
  onOpenProModal = null,
  onOpenAdminModal = null,
  onInstallApp = null,
  proUser = null,
  onSignOut = null,
}) {
  // Pages: 'roof' (unified 2D Plan / 3D Roof / Roof Quote) | 'wc' | 'wood' | 'prices'
  const [activePage, setActivePage] = useState('roof');
  // Collapsible left sidebar drawer
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Collapsible accordion sections inside sidebar
  const [pagesGroupOpen, setPagesGroupOpen] = useState(true);
  // Top-right profile dropdown popover
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);
  // Demo / lifted Pro unlock state
  const [localIsPremium, setLocalIsPremium] = useState(false);
  const isPremium = externalIsPremium !== undefined ? externalIsPremium : localIsPremium;
  // Toggle inside Company Info & Prices page: 'company' | 'roof' | 'wc' | 'wood'
  const [priceCategory, setPriceCategory] = useState('company');
  // Sub-page toggles: Roof ('2d' | 'view' | 'quote'), WC & Woodwork ('view' | 'quote')
  const [roofSubPage, setRoofSubPage] = useState('2d');
  const [wcSubPage, setWcSubPage] = useState('view');
  const [woodSubPage, setWoodSubPage] = useState('view');

  useEffect(() => {
    if (!profileMenuOpen) return;
    const onOutside = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setProfileMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onOutside);
    window.addEventListener('touchstart', onOutside);
    return () => {
      window.removeEventListener('mousedown', onOutside);
      window.removeEventListener('touchstart', onOutside);
    };
  }, [profileMenuOpen]);

  const [newMatName, setNewMatName] = useState('');
  const [newMatQty, setNewMatQty] = useState('1');
  const [newMatUnit, setNewMatUnit] = useState('pcs');
  const [newMatPrice, setNewMatPrice] = useState('');

  const extraItemsList = Array.isArray(customPrices?.__extraItems) ? customPrices.__extraItems : [];
  const activeExtraItems = extraItemsList.filter((ci) => (ci.scope || 'roof') === priceCategory);

  const handleAddCustomMaterial = (e) => {
    if (e) e.preventDefault();
    const cleanName = String(newMatName || '').trim();
    if (!cleanName) return;
    const qty = Math.max(1, Number(newMatQty) || 1);
    const price = Math.max(0, Number(newMatPrice) || 0);
    const unit = String(newMatUnit || 'pcs').trim() || 'pcs';
    const nextItem = {
      id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      scope: priceCategory,
      name: cleanName,
      quantity: qty,
      unit,
      unitPrice: price,
    };
    setCustomPrices({
      ...(customPrices || {}),
      __extraItems: [...extraItemsList, nextItem],
    });
    setNewMatName('');
    setNewMatQty('1');
    setNewMatPrice('');
  };

  const handleUpdateCustomMaterial = (id, patch) => {
    const nextList = extraItemsList.map((ci) => (ci.id === id ? { ...ci, ...patch } : ci));
    const nextCustom = { ...(customPrices || {}), __extraItems: nextList };
    if (patch.unitPrice !== undefined) {
      delete nextCustom[id];
    }
    setCustomPrices(nextCustom);
  };

  const handleDeleteCustomMaterial = (id) => {
    const nextList = extraItemsList.filter((ci) => ci.id !== id);
    const nextCustom = { ...(customPrices || {}), __extraItems: nextList };
    delete nextCustom[id];
    if (nextList.length === 0) delete nextCustom.__extraItems;
    setCustomPrices(nextCustom);
  };

  const unitLabel = unitSystem === UNIT_SYSTEMS.METRIC ? 'm' : 'ft';
  const isCustomShape = Boolean(polygonVertices && polygonVertices.length >= 3);

  const hasParapetStage = buildingStage === 'parapet' || Boolean(parapetConfig?.enabled);
  const mobileParapetConfig = useMemo(
    () => ({ ...(parapetConfig || {}), enabled: hasParapetStage }),
    [parapetConfig, hasParapetStage]
  );

  const activeCustomPrices = isPremium ? customPrices : {};

  // Full materials (including timber) so Roof Quote & Wood Quote always have live data
  const fullMaterials = useMemo(() => {
    return estimateMaterials(
      geometry,
      selectedMaterial,
      currencyCode,
      activeCustomPrices,
      {
        buildingStage: 'woodwork',
        parapetConfig: mobileParapetConfig,
        woodworkConfig: { ...(woodworkConfig || {}), includeTimberBOQ: true },
      }
    );
  }, [geometry, selectedMaterial, currencyCode, activeCustomPrices, woodworkConfig, mobileParapetConfig]);

  // Keep zeroed items visible inside Set Prices so users can adjust or re-enable any item
  const editableMaterials = useMemo(
    () =>
      estimateMaterials(geometry, selectedMaterial, currencyCode, activeCustomPrices, {
        buildingStage: 'woodwork',
        parapetConfig: mobileParapetConfig,
        woodworkConfig: { ...(woodworkConfig || {}), includeTimberBOQ: true },
        includeZeroItems: true,
      }),
    [geometry, selectedMaterial, currencyCode, activeCustomPrices, woodworkConfig, mobileParapetConfig]
  );

  const editableWcMaterials = useMemo(
    () =>
      estimateWaterCollector(geometry, currencyCode, activeCustomPrices, {
        roofType,
        polygonVertices,
        wcConfig,
        includeZeroItems: true,
      }),
    [geometry, currencyCode, activeCustomPrices, roofType, polygonVertices, wcConfig]
  );

  const activeWcMaterials = wcMaterials || editableWcMaterials;

  const roofItems = useMemo(
    () => (fullMaterials?.items || []).filter((it) => !it.category.includes('Timber') && Number(it.total) > 0),
    [fullMaterials]
  );
  const woodItems = useMemo(
    () => (fullMaterials?.items || []).filter((it) => it.category.includes('Timber') && Number(it.total) > 0),
    [fullMaterials]
  );

  const laborTotal = fullMaterials?.summary?.laborTotal || 0;
  const transportTotal = fullMaterials?.summary?.transportTotal || 0;

  const roofTotal = useMemo(
    () => roofItems.reduce((sum, it) => sum + (it.total || 0), 0) + laborTotal + transportTotal,
    [roofItems, laborTotal, transportTotal]
  );
  const woodTotal = useMemo(
    () => woodItems.reduce((sum, it) => sum + (it.total || 0), 0),
    [woodItems]
  );

  const navigateTo = (page) => {
    setActivePage(page);
    setSidebarOpen(false);
  };

  const navItems = [
    { id: 'roof', label: 'Roof Plan & Quote', icon: Layers },
    { id: 'wc', label: 'WC (Water Collector)', icon: Droplets, pro: true },
    { id: 'wood', label: 'Woodwork (3D & Quote)', icon: Hammer, pro: true },
    { id: 'prices', label: 'Company Info & Prices', icon: DollarSign, pro: true },
  ];

  const renderSubPageSwitcher = (subPage, setSubPage, viewLabel, quoteLabel, QuoteIcon, showQuoteCrown = false) => (
    <div
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '6px',
        background: '#111827',
        border: '1px solid #1f2937',
        borderRadius: '10px',
        padding: '4px',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', flex: 1 }}>
        <button
          type="button"
          onClick={() => setSubPage('view')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            padding: '7px 8px',
            borderRadius: '7px',
            border: 'none',
            background: subPage === 'view' ? '#0ea5e9' : 'transparent',
            color: subPage === 'view' ? '#ffffff' : '#94a3b8',
            fontSize: '11.5px',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          <Box className="w-3.5 h-3.5" />
          <span>{viewLabel}</span>
        </button>
        <button
          type="button"
          onClick={() => setSubPage('quote')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            padding: '7px 8px',
            borderRadius: '7px',
            border: 'none',
            background: subPage === 'quote' ? '#0ea5e9' : 'transparent',
            color: subPage === 'quote' ? '#ffffff' : '#94a3b8',
            fontSize: '11.5px',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          <QuoteIcon className="w-3.5 h-3.5" />
          <span>{quoteLabel}</span>
          {showQuoteCrown && <Crown className="w-3 h-3 text-amber-400" />}
        </button>
      </div>

      <button
        type="button"
        onClick={() => setSubPage((prev) => (prev === 'view' ? 'quote' : 'view'))}
        title="Toggle between 3D View and Quote"
        style={{
          flexShrink: 0,
          padding: '6px 9px',
          borderRadius: '7px',
          border: '1px solid #334155',
          background: '#1e293b',
          color: '#38bdf8',
          fontSize: '11px',
          fontWeight: 800,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {subPage === 'view' ? 'View Quote →' : '← 3D View'}
      </button>
    </div>
  );

  const renderRoofOrWoodQuote = (mode) => {
    const isRoofQuote = mode === 'roof';
    const listItems = isRoofQuote ? roofItems : woodItems;

    return (
      <>
        {/* Top Quote Header */}
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#111827',
            border: '1px solid #1f2937',
            borderRadius: '12px',
            padding: '10px 12px',
          }}
        >
          <div>
            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
              {isRoofQuote ? 'Roof + Labour & Transport' : 'Wood / Timber Quote (Pro)'}
            </div>
            <div
              style={{
                fontSize: '19px',
                fontWeight: 800,
                color: isRoofQuote ? '#34d399' : '#fbbf24',
              }}
            >
              {!isRoofQuote && !isPremium
                ? 'Pro Feature'
                : formatCurrency(isRoofQuote ? roofTotal : woodTotal, currencyCode)}
            </div>
          </div>

          {(isRoofQuote || isPremium) && setCustomPrices && (
            <button
              type="button"
              onClick={() => {
                setPriceCategory(isRoofQuote ? 'roof' : 'wood');
                setActivePage('prices');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: '#1e293b',
                color: '#cbd5e1',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '7px 10px',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Set Prices</span>
            </button>
          )}
        </div>

        {!isRoofQuote && !isPremium ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
              background: 'linear-gradient(145deg, rgba(245, 158, 11, 0.12), rgba(15, 23, 42, 0.95))',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              borderRadius: '14px',
              padding: '22px 18px',
              gap: '10px',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'rgba(245, 158, 11, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fbbf24',
              }}
            >
              <Lock className="w-6 h-6" />
            </div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#fef3c7' }}>
              Wood &amp; Timber Quotation is Pro
            </div>
            <p style={{ fontSize: '12.5px', color: '#cbd5e1', margin: 0, lineHeight: 1.5 }}>
              Unlock full timber counts for rafters, purlins, kingposts, tie beams, wall plates, nails, and wood pricing.
            </p>
            <button
              type="button"
              onClick={() => (onOpenProModal ? onOpenProModal() : setLocalIsPremium(true))}
              style={{
                marginTop: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#0f172a',
                border: 'none',
                borderRadius: '10px',
                padding: '11px 18px',
                fontSize: '13px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              <Crown className="w-4 h-4" />
              <span>Unlock Wood Quote (Preview Pro)</span>
            </button>
          </div>
        ) : (
          <>
            {isRoofQuote && setWastePercentage && (
              <div
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  padding: '6px 10px',
                  background: '#111827',
                  border: '1px solid #1f2937',
                  borderRadius: '9px',
                  fontSize: '11.5px',
                }}
              >
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>
                  Waste Allowance (cuts &amp; valleys):
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setWastePercentage(Math.max(0, (Number(wastePercentage) || 0) - 1))}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '6px',
                      background: '#1e293b',
                      color: '#f8fafc',
                      border: '1px solid #334155',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    −
                  </button>
                  <input
                    className="compact-num-input"
                    type="number"
                    min="0"
                    max="30"
                    step="1"
                    aria-label="Waste allowance percentage"
                    value={Number(wastePercentage) || 0}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(30, Math.round(Number(e.target.value) || 0)));
                      setWastePercentage(v);
                    }}
                    style={{
                      width: '40px',
                      background: '#090e1a',
                      color: '#34d399',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 800,
                      textAlign: 'center',
                    }}
                  />
                  <span style={{ color: '#34d399', fontWeight: 700 }}>%</span>
                  <button
                    type="button"
                    onClick={() => setWastePercentage(Math.min(30, (Number(wastePercentage) || 0) + 1))}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '6px',
                      background: '#1e293b',
                      color: '#f8fafc',
                      border: '1px solid #334155',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {/* Compact Fitted Quote Items */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '5px',
              }}
            >
              {listItems.map((item, idx) => (
                <div
                  key={`${item.name}-${idx}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '7px 10px',
                    background: '#111827',
                    border: '1px solid #1f2937',
                    borderRadius: '9px',
                    fontSize: '12px',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0, paddingRight: '8px' }}>
                    <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{item.name}</div>
                    <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                      {item.quantity} {item.unit} × {formatCurrency(item.unitPrice, currencyCode)}
                    </div>
                    {item.id === 'primary' && item.spec && (
                      <div style={{ fontSize: '10px', color: '#38bdf8', marginTop: '1px' }}>{item.spec}</div>
                    )}
                  </div>
                  <div style={{ fontWeight: 700, color: '#cbd5e1' }}>
                    {formatCurrency(item.total, currencyCode)}
                  </div>
                </div>
              ))}

              {isRoofQuote && laborTotal > 0 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '7px 10px',
                    background: '#111827',
                    border: '1px solid #1f2937',
                    borderRadius: '9px',
                    fontSize: '12px',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: '#e2e8f0' }}>Labour &amp; Installation</div>
                  </div>
                  <div style={{ fontWeight: 700, color: '#cbd5e1' }}>
                    {formatCurrency(laborTotal, currencyCode)}
                  </div>
                </div>
              )}

              {isRoofQuote && transportTotal > 0 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '7px 10px',
                    background: '#111827',
                    border: '1px solid #1f2937',
                    borderRadius: '9px',
                    fontSize: '12px',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: '#e2e8f0' }}>Transport &amp; Logistics</div>
                  </div>
                  <div style={{ fontWeight: 700, color: '#cbd5e1' }}>
                    {formatCurrency(transportTotal, currencyCode)}
                  </div>
                </div>
              )}
            </div>

            {/* Generic Market Price Disclaimer */}
            <div
              style={{
                flexShrink: 0,
                fontSize: '10px',
                color: '#94a3b8',
                lineHeight: 1.35,
                padding: '5px 8px',
                borderRadius: '8px',
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid #1e293b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '6px',
                flexWrap: 'wrap',
              }}
            >
              <span>
                <strong>Note:</strong> Prices shown are generic estimates and may not reflect actual market prices.
                {!isPremium && ' You can edit prices & add items at PDF export (not saved).'}
              </span>
              {!isPremium && onOpenProModal && (
                <button
                  type="button"
                  onClick={onOpenProModal}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    color: '#fbbf24',
                    fontSize: '10.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  See Pro benefits →
                </button>
              )}
            </div>

            {/* Pinned Export Actions */}
            <div style={{ flexShrink: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={handleCopySummary}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: '#1e293b',
                  color: '#e2e8f0',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  padding: '10px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {copiedToast ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
                <span>{copiedToast ? 'Copied!' : 'Copy Quote'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (setQuoteScope) setQuoteScope(isRoofQuote ? 'roof_only' : 'wood');
                  setQuoteModalOpen(true);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: '#0ea5e9',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Download className="w-4 h-4" />
                <span>Export PDF</span>
              </button>
            </div>
          </>
        )}
      </>
    );
  };

  return (
    <div
      style={{
        height: '100dvh',
        width: '100%',
        overflow: 'hidden',
        background: '#050912',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        color: '#f1f5f9',
      }}
    >
      {/* Fixed-Viewport Mobile Frame (no outer scrolling) */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '430px',
          height: '100dvh',
          background: '#090e1a',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderLeft: '1px solid #1e293b',
          borderRight: '1px solid #1e293b',
        }}
      >
        {/* 1. COMPACT TOP BAR (48px) */}
        <header
          style={{
            height: '50px',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 10px',
            background: '#111827',
            borderBottom: '1px solid #1f2937',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open pages sidebar"
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '9px',
                background: '#1e293b',
                border: '1px solid #334155',
                color: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Menu className="w-4 h-4" />
            </button>
            <div
              onClick={() => setSidebarOpen(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setSidebarOpen(true);
              }}
              title="Open menu to switch views"
              style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer' }}
            >
              <span
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '6px',
                  background: 'linear-gradient(135deg, #10b981, #0ea5e9)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '13px',
                  color: '#fff',
                  flexShrink: 0,
                }}
              >
                S
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '-0.01em' }}>RoofCalc</span>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
                {activePage === 'roof'
                  ? roofSubPage === '2d'
                    ? '• 2D Plan'
                    : roofSubPage === 'view'
                    ? '• Roof 3D'
                    : '• Roof Quote'
                  : activePage === 'wc'
                  ? wcSubPage === 'view'
                    ? '• WC 3D'
                    : '• WC Quote'
                  : activePage === 'wood'
                  ? woodSubPage === 'view'
                    ? '• Wood 3D'
                    : '• Wood Quote'
                  : '• Company & Prices'}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {setVideoModalOpen && (
              <button
                type="button"
                onClick={() => setVideoModalOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: '#1e293b',
                  color: '#38bdf8',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '6px 8px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                title="Watch Video Guide"
              >
                <Video className="w-3.5 h-3.5" />
                <span>Guide</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setSketchModalOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#0f172a',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 9px',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
              title="Upload / Snap Paper Sketch"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Snap</span>
            </button>

            {/* Mobile Top-Right Profile Initials Avatar & Login/Logout Popover */}
            <div ref={profileMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setProfileMenuOpen((v) => !v)}
                aria-label={proUser ? `Account (${getUserDisplayName(proUser)})` : 'Sign In / Profile'}
                title={proUser ? `${getUserDisplayName(proUser)} (${proUser.email || ''})` : 'Tap to Sign In / Log Out'}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: proUser
                    ? 'linear-gradient(135deg, #0ea5e9, #10b981)'
                    : '#1e293b',
                  border: proUser
                    ? isPremium
                      ? '2px solid #fbbf24'
                      : '2px solid #38bdf8'
                    : '1.5px solid #475569',
                  color: proUser ? '#ffffff' : '#cbd5e1',
                  fontSize: '12px',
                  fontWeight: 900,
                  letterSpacing: '0.02em',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                {proUser ? getUserInitials(proUser) : <User className="w-4 h-4" />}
                {proUser && (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: '-1px',
                      right: '-1px',
                      width: '9px',
                      height: '9px',
                      borderRadius: '50%',
                      background: isPremium ? '#fbbf24' : '#34d399',
                      border: '2px solid #111827',
                    }}
                  />
                )}
              </button>

              {profileMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: '240px',
                    zIndex: 300,
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    padding: '12px',
                    boxShadow: '0 18px 40px rgba(2, 6, 23, 0.8)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '9px',
                  }}
                >
                  {proUser ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', paddingBottom: '9px', borderBottom: '1px solid #1e293b' }}>
                        <div
                          style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #0ea5e9, #10b981)',
                            color: '#ffffff',
                            fontSize: '13px',
                            fontWeight: 900,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            border: isPremium ? '2px solid #fbbf24' : '1.5px solid #38bdf8',
                          }}
                        >
                          {getUserInitials(proUser)}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {getUserDisplayName(proUser)}
                          </div>
                          <div style={{ fontSize: '10.5px', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {proUser.email || ''}
                          </div>
                          <span
                            style={{
                              display: 'inline-block',
                              marginTop: '3px',
                              fontSize: '9.5px',
                              fontWeight: 800,
                              padding: '1px 6px',
                              borderRadius: '999px',
                              background: isPremium ? 'rgba(245, 158, 11, 0.18)' : 'rgba(148, 163, 184, 0.15)',
                              color: isPremium ? '#fbbf24' : '#cbd5e1',
                            }}
                          >
                            {isPremium ? 'PRO ACTIVE' : 'FREE PLAN'}
                          </span>
                        </div>
                      </div>

                      {onOpenProModal && (
                        <button
                          type="button"
                          onClick={() => {
                            setProfileMenuOpen(false);
                            onOpenProModal();
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '7px',
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            background: '#1e293b',
                            border: '1px solid #334155',
                            color: '#e2e8f0',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          <Crown className="w-3.5 h-3.5 text-amber-400" />
                          <span>Account &amp; Pro Settings</span>
                        </button>
                      )}

                      {onOpenAdminModal && (
                        <button
                          type="button"
                          onClick={() => {
                            setProfileMenuOpen(false);
                            onOpenAdminModal();
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '7px',
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            background: 'rgba(16, 185, 129, 0.14)',
                            border: '1px solid rgba(52, 211, 153, 0.42)',
                            color: '#6ee7b7',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          <Crown className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Admin Dashboard</span>
                        </button>
                      )}

                      {onSignOut && (
                        <button
                          type="button"
                          onClick={() => {
                            setProfileMenuOpen(false);
                            onSignOut();
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '7px',
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            background: 'rgba(239, 68, 68, 0.14)',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            color: '#fca5a5',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Log Out</span>
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <div style={{ paddingBottom: '8px', borderBottom: '1px solid #1e293b' }}>
                        <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#f8fafc' }}>Guest Session</div>
                        <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '2px' }}>
                          Sign in to sync your account &amp; Pro features
                        </div>
                      </div>
                      {onOpenProModal && (
                        <button
                          type="button"
                          onClick={() => {
                            setProfileMenuOpen(false);
                            onOpenProModal();
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            width: '100%',
                            padding: '9px 12px',
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, #0ea5e9, #10b981)',
                            border: 'none',
                            color: '#ffffff',
                            fontSize: '12px',
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          <LogIn className="w-3.5 h-3.5" />
                          <span>Log In / Sign Up</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* 2. MAIN ZERO-SCROLL PAGE CONTENT */}
        <main
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            padding: '8px',
            gap: '8px',
          }}
        >
          {/* UNIFIED PAGE: ROOF PLAN & QUOTE (2D PLAN | 3D VIEW | ROOF QUOTE) */}
          {activePage === 'roof' && (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {/* Unified 3-Way Roof View Ribbon + Unit Toggle */}
              <div
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: '#111827',
                  border: '1px solid #1f2937',
                  borderRadius: '10px',
                  padding: '4px',
                }}
              >
                {[
                  { id: '2d', label: '2D Plan', icon: Ruler },
                  { id: 'view', label: '3D Roof', icon: Box },
                  { id: 'quote', label: 'Quote', icon: Layers },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const active = roofSubPage === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setRoofSubPage(tab.id)}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        padding: '6px 6px',
                        borderRadius: '7px',
                        border: 'none',
                        background: active ? '#0ea5e9' : 'transparent',
                        color: active ? '#ffffff' : '#94a3b8',
                        fontSize: '11.5px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setUnitSystem(unitSystem === UNIT_SYSTEMS.METRIC ? UNIT_SYSTEMS.IMPERIAL : UNIT_SYSTEMS.METRIC)}
                  style={{
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#1e293b',
                    color: '#38bdf8',
                    border: '1px solid #334155',
                    borderRadius: '7px',
                    padding: '5px 8px',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                  title="Toggle Metric (m) / Imperial (ft)"
                >
                  {unitLabel}
                </button>
              </div>

              {/* SUB-PAGE 1: 2D PLAN & FINGER SKETCH */}
              {roofSubPage === '2d' && (
                <>
                  {handleStageSelect && (
                    <div
                      style={{
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '5px 8px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: 'rgba(15, 23, 42, 0.72)',
                      }}
                    >
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', flexShrink: 0 }}>
                        Level:
                      </span>
                      <LevelInfoButton size={18} />
                      <div style={{ display: 'flex', gap: '5px', flex: 1 }}>
                        {BUILDING_STAGES.map((stg) => {
                          const active = buildingStage === stg.id;
                          return (
                            <button
                              key={stg.id}
                              type="button"
                              onClick={() => handleStageSelect(stg.id)}
                              style={{
                                flex: 1,
                                padding: '5px 6px',
                                borderRadius: '7px',
                                border: `1px solid ${active ? stg.color : 'var(--border-color)'}`,
                                background: active ? stg.bgLight : 'rgba(2, 6, 23, 0.45)',
                                color: active ? stg.color : 'var(--text-secondary)',
                                fontSize: '11.5px',
                                fontWeight: active ? 700 : 500,
                                cursor: 'pointer',
                              }}
                            >
                              {stg.shortName}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Foundation Parapet Allowance (+0.5m per side, editable) vs Parapet Level (+0m exact) */}
                  <div
                    style={{
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      padding: '5px 10px',
                      background: 'rgba(15, 23, 42, 0.85)',
                      borderRadius: '8px',
                      border: '1px solid #1e293b',
                      fontSize: '11px',
                    }}
                  >
                    {buildingStage === 'foundation' ? (
                      <>
                        <span style={{ color: '#94a3b8', fontWeight: 600 }}>
                          Parapet allowance (+per side):
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <button
                            type="button"
                            onClick={() =>
                              handleFoundationOverhangChange &&
                              handleFoundationOverhangChange(Math.max(0, (Number(foundationOverhangM) || 0) - 0.05))
                            }
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '6px',
                              background: '#1e293b',
                              color: '#f8fafc',
                              border: '1px solid #334155',
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            −
                          </button>
                          <input
                            className="compact-num-input"
                            type="number"
                            min="0"
                            max="2"
                            step="0.05"
                            aria-label="Foundation eaves per side (m)"
                            value={foundationOverhangM}
                            onChange={(e) =>
                              handleFoundationOverhangChange && handleFoundationOverhangChange(e.target.value)
                            }
                            style={{
                              width: '50px',
                              background: '#090e1a',
                              color: '#34d399',
                              border: '1px solid #334155',
                              borderRadius: '6px',
                              padding: '2px 4px',
                              fontSize: '12px',
                              fontWeight: 800,
                              textAlign: 'center',
                            }}
                          />
                          <span style={{ color: '#34d399', fontWeight: 700 }}>m</span>
                          <button
                            type="button"
                            onClick={() =>
                              handleFoundationOverhangChange &&
                              handleFoundationOverhangChange((Number(foundationOverhangM) || 0) + 0.05)
                            }
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '6px',
                              background: '#1e293b',
                              color: '#f8fafc',
                              border: '1px solid #334155',
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            +
                          </button>
                        </div>
                      </>
                    ) : (
                      <span style={{ color: '#38bdf8', fontWeight: 700 }}>
                        Parapet Level: Measured at parapet/woodwork — dimensions stay exact (+0m)
                      </span>
                    )}
                  </div>

                  {/* Full-Height Interactive 2D Canvas */}
                  <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    <Roof2DDiagram
                      geometry={geometry}
                      roofType={roofType}
                      unitSystem={unitSystem}
                      polygonVertices={polygonVertices}
                      hasActiveDesign={hasActiveDesign}
                      onResetToBlank={onResetToBlank}
                      onActivateRectangle={onActivateRectangle}
                      onPolygonChange={(pts) => setPolygonVertices(pts)}
                      onDimensionsChange={({ length: l, breadth: b }) => {
                        handleLengthChange(l);
                        handleBreadthChange(b);
                      }}
                      isSplitView={false}
                      buildingStage={buildingStage}
                      parapetConfig={parapetConfig}
                      woodworkConfig={woodworkConfig}
                      sketchUnderlayImage={sketchUnderlayImage}
                      mobileInteractive={true}
                      wastePercentage={wastePercentage}
                      setWastePercentage={setWastePercentage}
                    />
                  </div>
                </>
              )}

              {/* SUB-PAGE 2: 3D ROOF VIEW + STYLE/MATERIAL/HEIGHT CONTROLS */}
              {roofSubPage === 'view' && (
                <>
                  <div style={{ flex: 1, minHeight: 0, borderRadius: '12px', overflow: 'hidden', border: '1px solid #1f2937' }}>
                    {hasActiveDesign ? (
                      <Roof3DViewer
                        geometry={geometry}
                        roofType={roofType}
                        buildingStage={buildingStage}
                        parapetConfig={parapetConfig}
                        woodworkConfig={woodworkConfig}
                        selectedMaterial={selectedMaterial}
                        polygonVertices={polygonVertices}
                        forcedDisplayMode="finished"
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '20px', gap: '10px', background: '#090e1a' }}>
                        <Box className="w-8 h-8 text-sky-400" />
                        <div style={{ fontSize: '15px', fontWeight: 800, color: '#f8fafc' }}>No Roof Plan Drawn Yet</div>
                        <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', lineHeight: 1.45 }}>
                          Draw your walls on 2D Plan, snap a paper sketch, or try an example to preview in 3D.
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px', marginTop: '4px' }}>
                          <button type="button" onClick={() => { setActivePage('roof'); setRoofSubPage('2d'); }} style={{ background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: '8px', padding: '7px 12px', fontSize: '11.5px', fontWeight: 800, cursor: 'pointer' }}>
                            Draw 2D Plan
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const lPreset = SHAPE_PRESETS.find((p) => p.id === 'l_shape') || SHAPE_PRESETS[0];
                              if (lPreset) setPolygonVertices(lPreset.vertices);
                            }}
                            style={{ background: '#1e293b', color: '#cbd5e1', border: '1px solid #334155', borderRadius: '8px', padding: '7px 12px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Load Example
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Roof Type, Material & Height Controls */}
                  <div
                    style={{
                      flexShrink: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      background: '#111827',
                      border: '1px solid #1f2937',
                      borderRadius: '10px',
                      padding: '7px 10px',
                      gap: '6px',
                    }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.35fr', gap: '6px', alignItems: 'center' }}>
                      <select
                        value={roofType}
                        onChange={(e) => setRoofType(e.target.value)}
                        aria-label="Roof Type"
                        style={{
                          width: '100%',
                          minWidth: 0,
                          background: '#090e1a',
                          color: '#e2e8f0',
                          border: '1px solid #334155',
                          borderRadius: '7px',
                          padding: '6px 8px',
                          fontSize: '11.5px',
                          fontWeight: 700,
                        }}
                      >
                        {ROOF_TYPES.map((rt) => (
                          <option key={rt.id} value={rt.id}>
                            {rt.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={selectedMaterial}
                        onChange={(e) => setSelectedMaterial(e.target.value)}
                        aria-label="Roof Material"
                        style={{
                          width: '100%',
                          minWidth: 0,
                          background: '#090e1a',
                          color: '#e2e8f0',
                          border: '1px solid #334155',
                          borderRadius: '7px',
                          padding: '6px 8px',
                          fontSize: '11.5px',
                          fontWeight: 700,
                        }}
                      >
                        {Object.values(MATERIAL_PROFILES).map((mat) => (
                          <option key={mat.id} value={mat.id}>
                            {mat.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '6px',
                        borderTop: '1px solid #1e293b',
                        paddingTop: '6px',
                      }}
                    >
                      {/* Kingpost Height Control */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#090e1a', border: '1px solid #1e293b', borderRadius: '8px', padding: '4px 6px', gap: '4px' }}>
                        <span style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: 700 }}>KP</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            type="button"
                            onClick={() => handleTweakKingpost(Math.max(0.2, (geometry?.roofHeight || 1) - 0.1))}
                            style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#1e293b', color: '#f8fafc', border: '1px solid #334155', fontSize: '14px', fontWeight: 800, cursor: 'pointer' }}
                            title="Lower kingpost height"
                          >
                            −
                          </button>
                          <input
                            className="compact-num-input"
                            type="number"
                            min="0.2"
                            max="8.5"
                            step="0.1"
                            aria-label="Kingpost height (m)"
                            value={Number((geometry?.roofHeight || 0).toFixed(2))}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              if (Number.isFinite(v) && v >= 0.2) handleTweakKingpost(v);
                            }}
                            style={{ width: '46px', padding: '2px 2px', background: 'transparent', border: 'none', outline: 'none', color: '#38bdf8', fontSize: '12.5px', fontWeight: 800, textAlign: 'center' }}
                          />
                          <span style={{ fontSize: '10px', color: '#94a3b8' }}>m</span>
                          <button
                            type="button"
                            onClick={() => handleTweakKingpost((geometry?.roofHeight || 1) + 0.1)}
                            style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#1e293b', color: '#f8fafc', border: '1px solid #334155', fontSize: '14px', fontWeight: 800, cursor: 'pointer' }}
                            title="Raise kingpost height"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Angle of Inclination Control */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#090e1a', border: '1px solid #1e293b', borderRadius: '8px', padding: '4px 6px', gap: '4px' }}>
                        <span style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: 700 }}>Angle</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <button
                            type="button"
                            onClick={() => handleTweakPitchAngle && handleTweakPitchAngle(Math.max(5, (geometry?.pitchDegrees || 30) - 1))}
                            style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#1e293b', color: '#f8fafc', border: '1px solid #334155', fontSize: '14px', fontWeight: 800, cursor: 'pointer' }}
                            title="Decrease pitch angle"
                          >
                            −
                          </button>
                          <input
                            className="compact-num-input"
                            type="number"
                            min="5"
                            max="68"
                            step="1"
                            aria-label="Pitch angle (degrees)"
                            value={Number(geometry?.pitchDegrees ?? 0)}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              if (Number.isFinite(v) && v >= 5 && handleTweakPitchAngle) handleTweakPitchAngle(v);
                            }}
                            style={{ width: '40px', padding: '2px 2px', background: 'transparent', border: 'none', outline: 'none', color: '#fbbf24', fontSize: '12.5px', fontWeight: 800, textAlign: 'center' }}
                          />
                          <span style={{ fontSize: '10px', color: '#fbbf24' }}>°</span>
                          <button
                            type="button"
                            onClick={() => handleTweakPitchAngle && handleTweakPitchAngle(Math.min(68, (geometry?.pitchDegrees || 30) + 1))}
                            style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#1e293b', color: '#f8fafc', border: '1px solid #334155', fontSize: '14px', fontWeight: 800, cursor: 'pointer' }}
                            title="Increase pitch angle"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10.5px', color: '#94a3b8' }}>
                      <span>
                        Area: <strong style={{ color: '#e2e8f0' }}>{formatArea(geometry?.totalArea || 0, unitSystem)}</strong>
                      </span>
                      <span>
                        Rafter: <strong style={{ color: '#e2e8f0' }}>{formatLength(geometry?.rafterLength || 0, unitSystem)}</strong>
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* SUB-PAGE 2: ROOF QUOTATION */}
              {roofSubPage === 'quote' && renderRoofOrWoodQuote('roof')}
            </div>
          )}

          {/* PAGE: WOODWORK (2 SUB-PAGES: 3D TIMBER FRAME VIEW & WOOD QUOTE) */}
          {activePage === 'wood' && (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {renderSubPageSwitcher(woodSubPage, setWoodSubPage, '3D Wood', 'Wood Quote', Hammer, !isPremium)}

              {/* SUB-PAGE 1: 3D TIMBER FRAME VIEW */}
              {woodSubPage === 'view' && (
                <>
                  <div style={{ flex: 1, minHeight: 0, borderRadius: '12px', overflow: 'hidden', border: '1px solid #1f2937' }}>
                    {hasActiveDesign ? (
                      <Roof3DViewer
                        geometry={geometry}
                        roofType={roofType}
                        buildingStage={buildingStage}
                        parapetConfig={parapetConfig}
                        woodworkConfig={woodworkConfig}
                        selectedMaterial={selectedMaterial}
                        polygonVertices={polygonVertices}
                        forcedDisplayMode="framing"
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '20px', gap: '10px', background: '#090e1a' }}>
                        <Hammer className="w-8 h-8 text-amber-400" />
                        <div style={{ fontSize: '15px', fontWeight: 800, color: '#f8fafc' }}>No Roof Plan Drawn Yet</div>
                        <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', lineHeight: 1.45 }}>
                          Draw your walls on 2D Plan, snap a paper sketch, or load an example to view 3D timber framing.
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px', marginTop: '4px' }}>
                          <button type="button" onClick={() => { setActivePage('roof'); setRoofSubPage('2d'); }} style={{ background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: '8px', padding: '7px 12px', fontSize: '11.5px', fontWeight: 800, cursor: 'pointer' }}>
                            Draw 2D Plan
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const lPreset = SHAPE_PRESETS.find((p) => p.id === 'l_shape') || SHAPE_PRESETS[0];
                              if (lPreset) setPolygonVertices(lPreset.vertices);
                            }}
                            style={{ background: '#1e293b', color: '#cbd5e1', border: '1px solid #334155', borderRadius: '8px', padding: '7px 12px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Load Example
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Timber Framing Roof Style & Pitch Height Controls */}
                  <div
                    style={{
                      flexShrink: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      background: '#111827',
                      border: '1px solid #1f2937',
                      borderRadius: '10px',
                      padding: '7px 10px',
                      gap: '6px',
                    }}
                  >
                    <select
                      value={roofType}
                      onChange={(e) => setRoofType(e.target.value)}
                      aria-label="Roof Framing Type"
                      style={{
                        width: '100%',
                        minWidth: 0,
                        background: '#090e1a',
                        color: '#e2e8f0',
                        border: '1px solid #334155',
                        borderRadius: '7px',
                        padding: '6px 8px',
                        fontSize: '11.5px',
                        fontWeight: 700,
                      }}
                    >
                      {ROOF_TYPES.map((rt) => (
                        <option key={rt.id} value={rt.id}>
                          {rt.name}
                        </option>
                      ))}
                    </select>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      {/* Kingpost Control */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#090e1a', border: '1px solid #1e293b', borderRadius: '8px', padding: '4px 6px', gap: '4px' }}>
                        <span style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: 700 }}>KP</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            type="button"
                            onClick={() => handleTweakKingpost(Math.max(0.2, (geometry?.roofHeight || 1) - 0.1))}
                            style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#1e293b', color: '#f8fafc', border: '1px solid #334155', fontSize: '14px', fontWeight: 800, cursor: 'pointer' }}
                            title="Lower kingpost height"
                          >
                            −
                          </button>
                          <input
                            className="compact-num-input"
                            type="number"
                            min="0.2"
                            max="8.5"
                            step="0.1"
                            aria-label="Woodwork kingpost height (m)"
                            value={Number((geometry?.roofHeight || 0).toFixed(2))}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              if (Number.isFinite(v) && v >= 0.2) handleTweakKingpost(v);
                            }}
                            style={{ width: '46px', padding: '2px 2px', background: 'transparent', border: 'none', outline: 'none', color: '#fbbf24', fontSize: '12.5px', fontWeight: 800, textAlign: 'center' }}
                          />
                          <span style={{ fontSize: '10px', color: '#94a3b8' }}>m</span>
                          <button
                            type="button"
                            onClick={() => handleTweakKingpost((geometry?.roofHeight || 1) + 0.1)}
                            style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#1e293b', color: '#f8fafc', border: '1px solid #334155', fontSize: '14px', fontWeight: 800, cursor: 'pointer' }}
                            title="Raise kingpost height"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Pitch Angle Control */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#090e1a', border: '1px solid #1e293b', borderRadius: '8px', padding: '4px 6px', gap: '4px' }}>
                        <span style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: 700 }}>Angle</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <button
                            type="button"
                            onClick={() => handleTweakPitchAngle && handleTweakPitchAngle(Math.max(5, (geometry?.pitchDegrees || 30) - 1))}
                            style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#1e293b', color: '#f8fafc', border: '1px solid #334155', fontSize: '14px', fontWeight: 800, cursor: 'pointer' }}
                            title="Decrease angle of inclination"
                          >
                            −
                          </button>
                          <input
                            className="compact-num-input"
                            type="number"
                            min="5"
                            max="68"
                            step="1"
                            aria-label="Woodwork angle of inclination (degrees)"
                            value={Number(geometry?.pitchDegrees ?? 0)}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              if (Number.isFinite(v) && v >= 5 && handleTweakPitchAngle) handleTweakPitchAngle(v);
                            }}
                            style={{ width: '40px', padding: '2px 2px', background: 'transparent', border: 'none', outline: 'none', color: '#38bdf8', fontSize: '12.5px', fontWeight: 800, textAlign: 'center' }}
                          />
                          <span style={{ fontSize: '10px', color: '#38bdf8' }}>°</span>
                          <button
                            type="button"
                            onClick={() => handleTweakPitchAngle && handleTweakPitchAngle(Math.min(68, (geometry?.pitchDegrees || 30) + 1))}
                            style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#1e293b', color: '#f8fafc', border: '1px solid #334155', fontSize: '14px', fontWeight: 800, cursor: 'pointer' }}
                            title="Increase angle of inclination"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderTop: '1px solid #1e293b',
                        paddingTop: '5px',
                        fontSize: '10.5px',
                        color: '#94a3b8',
                      }}
                    >
                      <span>
                        Kingpost: <strong style={{ color: '#fbbf24' }}>{formatLength(geometry?.roofHeight || 0, unitSystem)}</strong> ({geometry?.pitchDegrees ?? 0}°)
                      </span>
                      <span>
                        Rafter: <strong style={{ color: '#e2e8f0' }}>{formatLength(geometry?.rafterLength || 0, unitSystem)}</strong>
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* SUB-PAGE 2: WOOD QUOTATION */}
              {woodSubPage === 'quote' && renderRoofOrWoodQuote('wood')}
            </div>
          )}

          {/* PAGE: WC (WATER COLLECTOR — 2 SUB-PAGES: 3D VIEW & QUOTE) */}
          {activePage === 'wc' && (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {renderSubPageSwitcher(wcSubPage, setWcSubPage, '3D WC View', 'WC Quote', Droplets, !isPremium)}

              {/* SUB-PAGE 1: CLEAR 3D WC PLAN + FLOORS & DROP POINT CONTROLS */}
              {wcSubPage === 'view' && (
                <>
                  <div
                    style={{
                      flex: 1,
                      minHeight: 0,
                      borderRadius: '11px',
                      overflow: 'hidden',
                      border: '1px solid #1f2937',
                    }}
                  >
                    {hasActiveDesign ? (
                      <Roof3DViewer
                        geometry={geometry}
                        roofType={roofType}
                        buildingStage={buildingStage}
                        parapetConfig={mobileParapetConfig}
                        woodworkConfig={woodworkConfig}
                        selectedMaterial={selectedMaterial}
                        polygonVertices={polygonVertices}
                        wcConfig={{ ...(wcConfig || {}), enabled: true }}
                        forcedDisplayMode="finished"
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '20px', gap: '10px', background: '#090e1a' }}>
                        <Droplets className="w-8 h-8 text-sky-400" />
                        <div style={{ fontSize: '15px', fontWeight: 800, color: '#f8fafc' }}>No Roof Plan Drawn Yet</div>
                        <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', lineHeight: 1.45 }}>
                          Draw your walls on 2D Plan, snap a paper sketch, or load an example to preview 3D Water Collector pipes.
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px', marginTop: '4px' }}>
                          <button type="button" onClick={() => { setActivePage('roof'); setRoofSubPage('2d'); }} style={{ background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: '8px', padding: '7px 12px', fontSize: '11.5px', fontWeight: 800, cursor: 'pointer' }}>
                            Draw 2D Plan
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const lPreset = SHAPE_PRESETS.find((p) => p.id === 'l_shape') || SHAPE_PRESETS[0];
                              if (lPreset) setPolygonVertices(lPreset.vertices);
                            }}
                            style={{ background: '#1e293b', color: '#cbd5e1', border: '1px solid #334155', borderRadius: '8px', padding: '7px 12px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Load Example
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Compact Floors & Drop Points Controls */}
                  <div
                    style={{
                      flexShrink: 0,
                      background: '#111827',
                      border: '1px solid #1f2937',
                      borderRadius: '10px',
                      padding: '8px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '7px',
                    }}
                  >
                    {/* Row 1: Floors & Drop Points */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>Floors:</span>
                        <button
                          type="button"
                          onClick={() => setWcConfig && setWcConfig((p) => ({ ...p, floors: Math.max(1, (p?.floors || 1) - 1) }))}
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '6px',
                            background: '#1e293b',
                            color: '#e2e8f0',
                            border: '1px solid #334155',
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          −
                        </button>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#38bdf8', minWidth: '24px', textAlign: 'center' }}>
                          {wcConfig?.floors || 1}F
                        </span>
                        <button
                          type="button"
                          onClick={() => setWcConfig && setWcConfig((p) => ({ ...p, floors: Math.min(8, (p?.floors || 1) + 1) }))}
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '6px',
                            background: '#1e293b',
                            color: '#e2e8f0',
                            border: '1px solid #334155',
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          +
                        </button>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>Drops:</span>
                        <button
                          type="button"
                          disabled={(wcConfig?.extraDrops || 0) <= 0}
                          onClick={() =>
                            setWcConfig &&
                            setWcConfig((p) => ({ ...p, extraDrops: Math.max(0, (p?.extraDrops || 0) - 1) }))
                          }
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '6px',
                            background: '#1e293b',
                            color: (wcConfig?.extraDrops || 0) <= 0 ? '#475569' : '#e2e8f0',
                            border: '1px solid #334155',
                            fontWeight: 800,
                            cursor: (wcConfig?.extraDrops || 0) <= 0 ? 'not-allowed' : 'pointer',
                          }}
                        >
                          −
                        </button>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#38bdf8', minWidth: '20px', textAlign: 'center' }}>
                          {activeWcMaterials?.analysis?.dropCount || 0}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setWcConfig &&
                            setWcConfig((p) => ({ ...p, extraDrops: Math.min(24, (p?.extraDrops || 0) + 1) }))
                          }
                          style={{
                            padding: '4px 8px',
                            height: '26px',
                            borderRadius: '6px',
                            background: 'rgba(14, 165, 233, 0.16)',
                            color: '#38bdf8',
                            border: '1px solid rgba(56, 189, 248, 0.45)',
                            fontSize: '11px',
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          + Add Drop
                        </button>
                      </div>
                    </div>

                    {/* Row 2: Corner Summary & Live Estimate */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '8px',
                        borderTop: '1px solid #1e293b',
                        paddingTop: '6px',
                      }}
                    >
                      <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                        <span style={{ color: '#cbd5e1', fontWeight: 700 }}>Corners: </span>
                        {activeWcMaterials?.analysis?.totalCorners > 0 ? (
                          <>
                            {activeWcMaterials.analysis.angle90Count > 0 && <span style={{ color: '#22d3ee', marginRight: '4px' }}>90°×{activeWcMaterials.analysis.angle90Count}</span>}
                            {activeWcMaterials.analysis.angle135Count > 0 && <span style={{ color: '#34d399', marginRight: '4px' }}>135°×{activeWcMaterials.analysis.angle135Count}</span>}
                            {activeWcMaterials.analysis.angle45Count > 0 && <span style={{ color: '#fbbf24' }}>45°×{activeWcMaterials.analysis.angle45Count}</span>}
                          </>
                        ) : (
                          <span>Straight runs</span>
                        )}
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: isPremium ? '#38bdf8' : '#fbbf24' }}>
                        {isPremium ? formatCurrency(activeWcMaterials?.summary?.grandTotal || 0, currencyCode) : 'PRO Quote'}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* SUB-PAGE 2: CLEAR WC QUOTATION & EXPORT */}
              {wcSubPage === 'quote' && !isPremium && (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    textAlign: 'center',
                    background: 'linear-gradient(145deg, rgba(14, 165, 233, 0.14), rgba(15, 23, 42, 0.95))',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    borderRadius: '14px',
                    padding: '22px 18px',
                    gap: '10px',
                  }}
                >
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: 'rgba(245, 158, 11, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fbbf24',
                    }}
                  >
                    <Lock className="w-6 h-6" />
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#f8fafc' }}>
                    Water Collector (WC) Quote is Pro
                  </div>
                  <p style={{ fontSize: '12.5px', color: '#cbd5e1', margin: 0, lineHeight: 1.5 }}>
                    Unlock complete rain gutter runs, corner miters (90° / 135° / 45°), floor downspout lengths, elbows, and PDF export.
                  </p>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                    Detected: <strong style={{ color: '#e2e8f0' }}>{activeWcMaterials?.analysis?.floors || 1}F</strong> •{' '}
                    <strong style={{ color: '#38bdf8' }}>{activeWcMaterials?.analysis?.dropCount || 0} drops</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => (onOpenProModal ? onOpenProModal() : setLocalIsPremium(true))}
                    style={{
                      marginTop: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                      color: '#0f172a',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '11px 18px',
                      fontSize: '13px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    <Crown className="w-4 h-4" />
                    <span>Unlock WC Quote (Pro)</span>
                  </button>
                </div>
              )}

              {wcSubPage === 'quote' && isPremium && (
                <>
                  {/* WC Summary Card */}
                  <div
                    style={{
                      flexShrink: 0,
                      background: '#111827',
                      border: '1px solid #1f2937',
                      borderRadius: '10px',
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <div>
                        <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>Water Collector Total</div>
                        <div style={{ fontSize: '19px', fontWeight: 800, color: '#38bdf8' }}>
                          {formatCurrency(activeWcMaterials?.summary?.grandTotal || 0, currencyCode)}
                        </div>
                      </div>

                      {setCustomPrices && (
                        <button
                          type="button"
                          onClick={() => {
                            setPriceCategory('wc');
                            setActivePage('prices');
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            background: '#1e293b',
                            color: '#cbd5e1',
                            border: '1px solid #334155',
                            borderRadius: '8px',
                            padding: '7px 10px',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>Set Prices</span>
                        </button>
                      )}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '6px',
                        borderTop: '1px solid #1e293b',
                        paddingTop: '6px',
                        fontSize: '10.5px',
                        color: '#94a3b8',
                      }}
                    >
                      <span>
                        <strong style={{ color: '#e2e8f0' }}>{activeWcMaterials?.analysis?.floors || 1}F</strong> •{' '}
                        {activeWcMaterials?.analysis?.elbowsPerDrop || 2} elbows/drop •{' '}
                        <strong style={{ color: '#38bdf8' }}>{activeWcMaterials?.analysis?.dropCount || 0} drops</strong>
                        {(activeWcMaterials?.analysis?.extraDrops || 0) > 0 && (
                          <span style={{ color: '#fbbf24' }}> (+{activeWcMaterials.analysis.extraDrops})</span>
                        )}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          type="button"
                          disabled={(wcConfig?.extraDrops || 0) <= 0}
                          onClick={() =>
                            setWcConfig &&
                            setWcConfig((p) => ({ ...p, extraDrops: Math.max(0, (p?.extraDrops || 0) - 1) }))
                          }
                          style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '5px',
                            background: '#1e293b',
                            color: (wcConfig?.extraDrops || 0) <= 0 ? '#475569' : '#e2e8f0',
                            border: '1px solid #334155',
                            fontWeight: 800,
                            cursor: (wcConfig?.extraDrops || 0) <= 0 ? 'not-allowed' : 'pointer',
                          }}
                        >
                          −
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setWcConfig &&
                            setWcConfig((p) => ({ ...p, extraDrops: Math.min(24, (p?.extraDrops || 0) + 1) }))
                          }
                          style={{
                            padding: '2px 7px',
                            height: '22px',
                            borderRadius: '5px',
                            background: 'rgba(14, 165, 233, 0.16)',
                            color: '#38bdf8',
                            border: '1px solid rgba(56, 189, 248, 0.45)',
                            fontSize: '10.5px',
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          + Drop
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Full-Height Scrollable WC BOQ Items */}
                  <div
                    style={{
                      flex: 1,
                      minHeight: 0,
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '5px',
                    }}
                  >
                    {(activeWcMaterials?.items || []).map((item, idx) => (
                      <div
                        key={`wc-${item.id}-${idx}`}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '7px 10px',
                          background: '#111827',
                          border: '1px solid #1f2937',
                          borderRadius: '9px',
                          fontSize: '12px',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0, paddingRight: '8px' }}>
                          <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{item.name}</div>
                          <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                            {item.quantity} {item.unit} × {formatCurrency(item.unitPrice, currencyCode)} • {item.spec}
                          </div>
                        </div>
                        <div style={{ fontWeight: 700, color: '#cbd5e1', whiteSpace: 'nowrap' }}>
                          {formatCurrency(item.total, currencyCode)}
                        </div>
                      </div>
                    ))}
                    {(activeWcMaterials?.summary?.laborTotal || 0) > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '7px 10px',
                          background: '#111827',
                          border: '1px solid #1f2937',
                          borderRadius: '9px',
                          fontSize: '12px',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: '#e2e8f0' }}>WC Installation Labour</div>
                        </div>
                        <div style={{ fontWeight: 700, color: '#cbd5e1' }}>
                          {formatCurrency(activeWcMaterials.summary.laborTotal, currencyCode)}
                        </div>
                      </div>
                    )}
                    {(activeWcMaterials?.summary?.transportTotal || 0) > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '7px 10px',
                          background: '#111827',
                          border: '1px solid #1f2937',
                          borderRadius: '9px',
                          fontSize: '12px',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: '#e2e8f0' }}>WC Transport &amp; Logistics</div>
                        </div>
                        <div style={{ fontWeight: 700, color: '#cbd5e1' }}>
                          {formatCurrency(activeWcMaterials.summary.transportTotal, currencyCode)}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Generic Market Price Disclaimer */}
                  <div
                    style={{
                      flexShrink: 0,
                      fontSize: '10px',
                      color: '#94a3b8',
                      lineHeight: 1.35,
                      padding: '5px 8px',
                      borderRadius: '8px',
                      background: 'rgba(15, 23, 42, 0.7)',
                      border: '1px solid #1e293b',
                    }}
                  >
                    <strong>Note:</strong> Default prices shown are generic estimates and may not reflect actual market prices.
                  </div>

                  {/* Pinned WC Export Actions */}
                  <div style={{ flexShrink: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={handleCopyWcSummary || handleCopySummary}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        background: '#1e293b',
                        color: '#e2e8f0',
                        border: '1px solid #334155',
                        borderRadius: '10px',
                        padding: '10px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {copiedToast ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
                      <span>{copiedToast ? 'Copied!' : 'Copy WC'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (setQuoteScope) setQuoteScope('wc');
                        setQuoteModalOpen(true);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        background: '#0ea5e9',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '10px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <Download className="w-4 h-4" />
                      <span>Export WC PDF</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* PAGE: COMPANY INFO & MATERIAL PRICES (PRO-ONLY — SET ONCE PER ACCOUNT) */}
          {activePage === 'prices' && (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {!isPremium ? (
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    padding: '22px',
                    gap: '10px',
                    background: 'linear-gradient(160deg, rgba(245, 158, 11, 0.12), rgba(15, 23, 42, 0.95))',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    borderRadius: '14px',
                  }}
                >
                  <div
                    style={{
                      width: '50px',
                      height: '50px',
                      borderRadius: '50%',
                      background: 'rgba(245, 158, 11, 0.18)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fbbf24',
                    }}
                  >
                    <Lock className="w-5 h-5" />
                  </div>
                  <div style={{ fontSize: '15.5px', fontWeight: 800, color: '#fef3c7' }}>
                    Company Info &amp; Material Prices — Pro Feature
                  </div>
                  <p style={{ fontSize: '12px', color: '#cbd5e1', margin: 0, lineHeight: 1.55 }}>
                    Upgrade to <strong>RoofCalc Pro</strong> to upload your <strong>company logo</strong>, set your
                    contractor name &amp; phone for exported PDFs, and save your custom Roof, WC &amp; Woodwork
                    material prices permanently to your account.
                  </p>
                  <button
                    type="button"
                    onClick={() => (onOpenProModal ? onOpenProModal() : setLocalIsPremium(true))}
                    style={{
                      marginTop: '6px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                      color: '#0f172a',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '10px 18px',
                      fontSize: '12.5px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    <Crown className="w-4 h-4" />
                    <span>Unlock RoofCalc Pro</span>
                  </button>
                </div>
              ) : (
                <>
              <div
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#111827',
                  border: '1px solid #1f2937',
                  borderRadius: '12px',
                  padding: '10px 12px',
                }}
              >
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 800 }}>Company Info &amp; Prices ({currencyCode})</div>
                  <div
                    style={{
                      fontSize: '10.5px',
                      color: priceSyncStatus === 'saved' ? '#34d399' : '#94a3b8',
                    }}
                  >
                    {priceSyncStatus === 'saving'
                      ? 'Saving to your Pro account...'
                      : priceSyncStatus === 'error'
                      ? 'Saved on device • Cloud sync pending'
                      : '✓ Saved permanently to your Pro account'}
                  </div>
                </div>
                {priceCategory !== 'company' && Object.keys(customPrices || {}).length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCustomPrices({})}
                    style={{
                      background: '#1e293b',
                      color: '#38bdf8',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      padding: '5px 9px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Reset Prices
                  </button>
                )}
              </div>

              <div
                style={{
                  flexShrink: 0,
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr 1fr',
                  gap: '4px',
                  background: '#111827',
                  padding: '4px',
                  borderRadius: '10px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setPriceCategory('company')}
                  style={{
                    padding: '7px 4px',
                    borderRadius: '7px',
                    border: 'none',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: priceCategory === 'company' ? '#6366f1' : 'transparent',
                    color: priceCategory === 'company' ? '#ffffff' : '#94a3b8',
                  }}
                >
                  Company
                </button>
                <button
                  type="button"
                  onClick={() => setPriceCategory('roof')}
                  style={{
                    padding: '7px 4px',
                    borderRadius: '7px',
                    border: 'none',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: priceCategory === 'roof' ? '#10b981' : 'transparent',
                    color: priceCategory === 'roof' ? '#052e16' : '#94a3b8',
                  }}
                >
                  Roof
                </button>
                <button
                  type="button"
                  onClick={() => setPriceCategory('wc')}
                  style={{
                    padding: '7px 4px',
                    borderRadius: '7px',
                    border: 'none',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: priceCategory === 'wc' ? '#0ea5e9' : 'transparent',
                    color: priceCategory === 'wc' ? '#ffffff' : '#94a3b8',
                  }}
                >
                  WC
                </button>
                <button
                  type="button"
                  onClick={() => setPriceCategory('wood')}
                  style={{
                    padding: '7px 4px',
                    borderRadius: '7px',
                    border: 'none',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: priceCategory === 'wood' ? '#f59e0b' : 'transparent',
                    color: priceCategory === 'wood' ? '#0f172a' : '#94a3b8',
                  }}
                >
                  Wood
                </button>
              </div>

              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {priceCategory === 'company' && (
                  <CompanyInfoEditor
                    contractorInfo={contractorInfo}
                    setContractorInfo={setContractorInfo}
                    onUploadLogo={onUploadContractorLogo}
                    logoUploadError={logoUploadError}
                    setLogoUploadError={setLogoUploadError}
                    compact={true}
                  />
                )}
                {priceCategory === 'roof' && (
                  <div style={{ display: 'grid', gridTemplateColumns: setWastePercentage ? '1fr 1fr 82px' : '1fr 1fr', gap: '6px' }}>
                    <label
                      style={{
                        background: '#111827',
                        border: '1px solid #1f2937',
                        borderRadius: '9px',
                        padding: '8px 10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px',
                        fontSize: '11px',
                        color: '#94a3b8',
                      }}
                    >
                      <span>Labour / m²</span>
                      <input
                        type="number"
                        min="0"
                        value={customPrices?.laborPerM2 !== undefined ? customPrices.laborPerM2 : (currencyCode === 'NGN' ? 1500 : 3.5)}
                        onChange={(e) => setCustomPrices({ ...(customPrices || {}), laborPerM2: e.target.value })}
                        style={{ background: '#090e1a', color: '#f8fafc', border: '1px solid #334155', borderRadius: '6px', padding: '5px 8px', fontSize: '13px', fontWeight: 700, width: '100%' }}
                      />
                    </label>
                    <label
                      style={{
                        background: '#111827',
                        border: '1px solid #1f2937',
                        borderRadius: '9px',
                        padding: '8px 10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px',
                        fontSize: '11px',
                        color: '#94a3b8',
                      }}
                    >
                      <span>Transport</span>
                      <input
                        type="number"
                        min="0"
                        value={customPrices?.transport !== undefined ? customPrices.transport : (currencyCode === 'NGN' ? 25000 : 50)}
                        onChange={(e) => setCustomPrices({ ...(customPrices || {}), transport: e.target.value })}
                        style={{ background: '#090e1a', color: '#f8fafc', border: '1px solid #334155', borderRadius: '6px', padding: '5px 8px', fontSize: '13px', fontWeight: 700, width: '100%' }}
                      />
                    </label>
                    {setWastePercentage && (
                      <label
                        style={{
                          background: '#111827',
                          border: '1px solid #1f2937',
                          borderRadius: '9px',
                          padding: '8px 8px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '3px',
                          fontSize: '11px',
                          color: '#94a3b8',
                        }}
                      >
                        <span>Waste %</span>
                        <input
                          className="compact-num-input"
                          type="number"
                          min="0"
                          max="30"
                          step="1"
                          value={Number(wastePercentage) || 0}
                          onChange={(e) => {
                            const v = Math.max(0, Math.min(30, Math.round(Number(e.target.value) || 0)));
                            setWastePercentage(v);
                          }}
                          style={{ background: '#090e1a', color: '#34d399', border: '1px solid #334155', borderRadius: '6px', padding: '5px 4px', fontSize: '13px', fontWeight: 800, textAlign: 'center', width: '100%' }}
                        />
                      </label>
                    )}
                  </div>
                )}

                {priceCategory === 'wc' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <label
                      style={{
                        background: '#111827',
                        border: '1px solid #1f2937',
                        borderRadius: '9px',
                        padding: '8px 10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px',
                        fontSize: '11px',
                        color: '#94a3b8',
                      }}
                    >
                      <span>WC Labour / m</span>
                      <input
                        type="number"
                        min="0"
                        value={customPrices?.wc_labor !== undefined ? customPrices.wc_labor : (currencyCode === 'NGN' ? 2000 : 4.0)}
                        onChange={(e) => setCustomPrices({ ...(customPrices || {}), wc_labor: e.target.value })}
                        style={{ background: '#090e1a', color: '#f8fafc', border: '1px solid #334155', borderRadius: '6px', padding: '5px 8px', fontSize: '13px', fontWeight: 700 }}
                      />
                    </label>
                    <label
                      style={{
                        background: '#111827',
                        border: '1px solid #1f2937',
                        borderRadius: '9px',
                        padding: '8px 10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px',
                        fontSize: '11px',
                        color: '#94a3b8',
                      }}
                    >
                      <span>WC Transport</span>
                      <input
                        type="number"
                        min="0"
                        value={customPrices?.wc_transport !== undefined ? customPrices.wc_transport : (currencyCode === 'NGN' ? 15000 : 30)}
                        onChange={(e) => setCustomPrices({ ...(customPrices || {}), wc_transport: e.target.value })}
                        style={{ background: '#090e1a', color: '#f8fafc', border: '1px solid #334155', borderRadius: '6px', padding: '5px 8px', fontSize: '13px', fontWeight: 700 }}
                      />
                    </label>
                  </div>
                )}

                {priceCategory !== 'company' && (
                <>
                {(priceCategory === 'wc'
                  ? (editableWcMaterials?.items || []).filter((it) => !it.isCustom)
                  : (editableMaterials?.items || []).filter((it) =>
                      !it.isCustom &&
                      (priceCategory === 'roof' ? !it.category.includes('Timber') : it.category.includes('Timber'))
                    )
                ).map((it) => (
                    <div
                      key={`price-row-${it.id}`}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '8px',
                        background: '#111827',
                        border: '1px solid #1f2937',
                        borderRadius: '9px',
                        padding: '7px 10px',
                        fontSize: '12px',
                      }}
                    >
                      <input
                        type="text"
                        aria-label={`Rename ${it.defaultName || it.name}`}
                        placeholder={it.defaultName || it.name}
                        value={
                          customPrices?.__customNames?.[it.id] !== undefined
                            ? customPrices.__customNames[it.id]
                            : it.name
                        }
                        onChange={(e) => {
                          const nextNames = {
                            ...(customPrices?.__customNames || {}),
                            [it.id]: e.target.value,
                          };
                          setCustomPrices({ ...(customPrices || {}), __customNames: nextNames });
                        }}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          background: '#090e1a',
                          color: '#e2e8f0',
                          border: '1px solid #263244',
                          borderRadius: '6px',
                          padding: '5px 8px',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      />
                      <input
                        type="number"
                        min="0"
                        value={customPrices?.[it.id] !== undefined ? customPrices[it.id] : it.unitPrice}
                        onChange={(e) => setCustomPrices({ ...(customPrices || {}), [it.id]: e.target.value })}
                        style={{
                          width: '92px',
                          background: '#090e1a',
                          color: '#f8fafc',
                          border: '1px solid #334155',
                          borderRadius: '6px',
                          padding: '5px 8px',
                          fontSize: '12.5px',
                          fontWeight: 700,
                          textAlign: 'right',
                        }}
                      />
                    </div>
                  ))}

                {/* User-Added Custom Material Rows */}
                {activeExtraItems.map((ci) => (
                  <div
                    key={`custom-row-${ci.id}`}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      background: 'rgba(14, 165, 233, 0.08)',
                      border: '1px solid rgba(56, 189, 248, 0.35)',
                      borderRadius: '9px',
                      padding: '8px 10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="text"
                        value={ci.name}
                        onChange={(e) => handleUpdateCustomMaterial(ci.id, { name: e.target.value })}
                        placeholder="Material name"
                        style={{
                          flex: 1,
                          minWidth: 0,
                          background: '#090e1a',
                          color: '#f8fafc',
                          border: '1px solid #334155',
                          borderRadius: '6px',
                          padding: '5px 8px',
                          fontSize: '12px',
                          fontWeight: 700,
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomMaterial(ci.id)}
                        title="Remove custom material"
                        style={{
                          background: 'rgba(239, 68, 68, 0.16)',
                          color: '#fca5a5',
                          border: '1px solid rgba(239, 68, 68, 0.35)',
                          borderRadius: '6px',
                          padding: '5px 7px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '64px 72px 1fr', gap: '6px', alignItems: 'center' }}>
                      <input
                        className="compact-num-input"
                        type="number"
                        min="0"
                        step="1"
                        value={ci.quantity}
                        onChange={(e) => handleUpdateCustomMaterial(ci.id, { quantity: Number(e.target.value) || 0 })}
                        placeholder="Qty"
                        aria-label="Custom material quantity"
                        style={{
                          background: '#090e1a',
                          color: '#38bdf8',
                          border: '1px solid #334155',
                          borderRadius: '6px',
                          padding: '5px 6px',
                          fontSize: '12px',
                          fontWeight: 700,
                          textAlign: 'center',
                        }}
                      />
                      <input
                        type="text"
                        value={ci.unit}
                        onChange={(e) => handleUpdateCustomMaterial(ci.id, { unit: e.target.value })}
                        placeholder="pcs"
                        aria-label="Custom material unit"
                        style={{
                          background: '#090e1a',
                          color: '#cbd5e1',
                          border: '1px solid #334155',
                          borderRadius: '6px',
                          padding: '5px 6px',
                          fontSize: '12px',
                          fontWeight: 600,
                          textAlign: 'center',
                        }}
                      />
                      <input
                        type="number"
                        min="0"
                        value={customPrices?.[ci.id] !== undefined ? customPrices[ci.id] : ci.unitPrice}
                        onChange={(e) => handleUpdateCustomMaterial(ci.id, { unitPrice: Number(e.target.value) || 0 })}
                        placeholder="Unit price"
                        aria-label="Custom material unit price"
                        style={{
                          background: '#090e1a',
                          color: '#34d399',
                          border: '1px solid #334155',
                          borderRadius: '6px',
                          padding: '5px 8px',
                          fontSize: '12.5px',
                          fontWeight: 700,
                          textAlign: 'right',
                        }}
                      />
                    </div>
                  </div>
                ))}

                {/* Add New Material & Price Row Form */}
                <form
                  onSubmit={handleAddCustomMaterial}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    background: '#0d1526',
                    border: '1px dashed rgba(56, 189, 248, 0.45)',
                    borderRadius: '10px',
                    padding: '9px 10px',
                    marginTop: '2px',
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Custom Material ({priceCategory === 'wc' ? 'WC' : priceCategory === 'wood' ? 'Wood' : 'Roof'})</span>
                  </div>
                  <input
                    type="text"
                    value={newMatName}
                    onChange={(e) => setNewMatName(e.target.value)}
                    placeholder="Material / item name (e.g. Scaffolding, Fascia Paint)"
                    style={{
                      background: '#090e1a',
                      color: '#f8fafc',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      padding: '6px 8px',
                      fontSize: '12px',
                    }}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '56px 66px 1fr auto', gap: '6px', alignItems: 'center' }}>
                    <input
                      className="compact-num-input"
                      type="number"
                      min="1"
                      step="1"
                      value={newMatQty}
                      onChange={(e) => setNewMatQty(e.target.value)}
                      placeholder="Qty"
                      style={{
                        background: '#090e1a',
                        color: '#f8fafc',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        padding: '6px 6px',
                        fontSize: '12px',
                        textAlign: 'center',
                      }}
                    />
                    <input
                      type="text"
                      value={newMatUnit}
                      onChange={(e) => setNewMatUnit(e.target.value)}
                      placeholder="pcs"
                      style={{
                        background: '#090e1a',
                        color: '#cbd5e1',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        padding: '6px 6px',
                        fontSize: '12px',
                        textAlign: 'center',
                      }}
                    />
                    <input
                      type="number"
                      min="0"
                      value={newMatPrice}
                      onChange={(e) => setNewMatPrice(e.target.value)}
                      placeholder={`Price (${currencyCode})`}
                      style={{
                        background: '#090e1a',
                        color: '#f8fafc',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        padding: '6px 8px',
                        fontSize: '12px',
                        textAlign: 'right',
                      }}
                    />
                    <button
                      type="submit"
                      disabled={!newMatName.trim()}
                      style={{
                        background: newMatName.trim() ? '#10b981' : '#1e293b',
                        color: newMatName.trim() ? '#052e16' : '#64748b',
                        border: 'none',
                        borderRadius: '7px',
                        padding: '6px 10px',
                        fontSize: '12px',
                        fontWeight: 800,
                        cursor: newMatName.trim() ? 'pointer' : 'not-allowed',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      + Add
                    </button>
                  </div>
                </form>
                </>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  if (priceCategory === 'wood') {
                    setWoodSubPage('quote');
                    setActivePage('wood');
                  } else if (priceCategory === 'wc') {
                    setWcSubPage('quote');
                    setActivePage('wc');
                  } else {
                    setRoofSubPage('quote');
                    setActivePage('roof');
                  }
                }}
                style={{
                  flexShrink: 0,
                  background: '#0ea5e9',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Done — View Quotation
              </button>
              </>
              )}
            </div>
          )}
        </main>

        {/* 3. COLLAPSIBLE LEFT SIDEBAR DRAWER */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 50,
              background: 'rgba(2, 6, 23, 0.72)',
              backdropFilter: 'blur(3px)',
              display: 'flex',
            }}
          >
            <aside
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '82%',
                maxWidth: '300px',
                height: '100%',
                background: '#0f172a',
                borderRight: '1px solid #1e293b',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '12px',
                gap: '10px',
                overflowY: 'auto',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Sidebar Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid #1e293b' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '7px',
                        background: 'linear-gradient(135deg, #10b981, #0ea5e9)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: '14px',
                        color: '#fff',
                      }}
                    >
                      S
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                      <span style={{ fontSize: '14px', fontWeight: 800 }}>RoofCalc Pro</span>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: '#94a3b8' }}>Sijitek Solutions</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(false)}
                    style={{
                      background: '#1e293b',
                      color: '#cbd5e1',
                      border: 'none',
                      borderRadius: '7px',
                      width: '28px',
                      height: '28px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Collapsible Section 1: App Pages */}
                <div style={{ background: '#111827', borderRadius: '10px', border: '1px solid #1f2937', overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => setPagesGroupOpen((v) => !v)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '9px 10px',
                      background: 'transparent',
                      border: 'none',
                      color: '#cbd5e1',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    <span>PAGES</span>
                    {pagesGroupOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                  {pagesGroupOpen && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 8px 8px' }}>
                      {navItems.map((item) => {
                        const Icon = item.icon;
                        const active = activePage === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => navigateTo(item.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '8px',
                              padding: '8px 10px',
                              borderRadius: '8px',
                              border: 'none',
                              background: active ? 'rgba(14, 165, 233, 0.18)' : 'transparent',
                              color: active ? '#38bdf8' : '#e2e8f0',
                              fontSize: '12px',
                              fontWeight: active ? 700 : 600,
                              textAlign: 'left',
                              cursor: 'pointer',
                            }}
                          >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Icon className="w-3.5 h-3.5" />
                              <span>{item.label}</span>
                            </span>
                            {item.pro && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {onInstallApp && (
                  <button
                    type="button"
                    onClick={() => {
                      setSidebarOpen(false);
                      onInstallApp();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(14, 165, 233, 0.18))',
                      color: '#6ee7b7',
                      border: '1px solid rgba(52, 211, 153, 0.45)',
                      borderRadius: '9px',
                      padding: '9px 10px',
                      fontSize: '12px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    <Download className="w-4 h-4" />
                    <span>Install RoofCalc Pro App</span>
                  </button>
                )}

                {setVideoModalOpen && (
                  <button
                    type="button"
                    onClick={() => {
                      setSidebarOpen(false);
                      setVideoModalOpen(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'rgba(14, 165, 233, 0.12)',
                      color: '#38bdf8',
                      border: '1px solid rgba(56, 189, 248, 0.35)',
                      borderRadius: '9px',
                      padding: '9px 10px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <Video className="w-4 h-4" />
                    <span>Watch Guide Video</span>
                  </button>
                )}

                {isCustomShape && (
                  <button
                    type="button"
                    onClick={() => {
                      setPolygonVertices(null);
                      setSketchUnderlayImage(null);
                      setSidebarOpen(false);
                    }}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', background: '#1e293b', color: '#f8fafc', border: '1px solid #334155', borderRadius: '9px', padding: '8px', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset to Rectangle</span>
                  </button>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
