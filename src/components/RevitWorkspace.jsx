import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowRight,
  Box,
  Building2,
  Calculator,
  Camera,
  Check,
  ChevronDown,
  Crown,
  Download,
  Droplets,
  FileText,
  Layers,
  LayoutGrid,
  Lock,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  RotateCcw,
  Ruler,
  Share2,
  Sliders,
  Smartphone,
  Trash2,
  User,
  Video,
} from 'lucide-react';
import { ROOF_TYPES, SHAPE_PRESETS } from '../utils/roofMath';
import { UNIT_SYSTEMS, formatLength, formatArea } from '../utils/units';
import { CURRENCIES, MATERIAL_PROFILES, formatCurrency } from '../utils/materials';
import { BUILDING_STAGES } from '../utils/stagePresets';
import { getUserInitials, getUserDisplayName, isAdminEmail } from '../utils/proSession';
import Roof3DViewer from './Roof3DViewer';
import Roof2DDiagram from './Roof2DDiagram';
import MobileWorkspace from './MobileWorkspace';
import LevelInfoButton from './LevelInfoButton';
import CompanyInfoEditor from './CompanyInfoEditor';

export default function RevitWorkspace({
  geometry,
  materials,
  unitSystem,
  setUnitSystem,
  currencyCode,
  setCurrencyCode,
  buildingStage,
  handleStageSelect,
  currentStageConfig,
  parapetConfig,
  setParapetConfig,
  woodworkConfig,
  setWoodworkConfig,
  roofType,
  setRoofType,
  overhang,
  displayLength,
  displayBreadth,
  handleLengthChange,
  handleBreadthChange,
  setOverhang,
  setIsUniformOverhang,
  polygonVertices,
  setPolygonVertices,
  hasActiveDesign = true,
  onResetToBlank = null,
  onActivateRectangle = null,
  extensions,
  handleAddExtension,
  handleRemoveExtension,
  handleTweakKingpost,
  handleTweakPitchAngle,
  handleTweakSlantingHeight,
  foundationOverhangM = 0.5,
  handleFoundationOverhangChange,
  applyPreset,
  selectedMaterial,
  setSelectedMaterial,
  customPrices,
  setCustomPrices,
  setSketchModalOpen,
  setQuoteModalOpen,
  setVideoModalOpen,
  handleExportCSV,
  handleCopySummary,
  copiedToast,
  sketchUnderlayImage,
  setSketchUnderlayImage,
  wastePercentage,
  setWastePercentage,
  onSwitchLayout,
  wcConfig = { floors: 1, extraDrops: 0 },
  setWcConfig,
  wcMaterials,
  setQuoteScope,
  handleCopyWcSummary,
  isPremium = false,
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
  // Primary navigation: 'design' | 'boq' | 'wc'
  const [mainTab, setMainTab] = useState('design');
  // Sub-view inside 'design': 'split' | '2d' | '3d'
  const [viewLayout, setViewLayout] = useState('split');
  // Sub-page inside 'wc': 'view' (3D WC View) | 'quote' (WC Quote & BOQ)
  const [wcSubPage, setWcSubPage] = useState('view');
  // Collapsible optional settings drawer
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  // Top-right profile dropdown menu
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);
  // Two-version mode: Desktop Studio vs. Simple Mobile App
  const [isMobileAppMode, setIsMobileAppMode] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768
  );
  // Inline custom material row composer (Desktop BOQ & WC Quote)
  const [isEditingPrices, setIsEditingPrices] = useState(false);
  const [priceSavedFlash, setPriceSavedFlash] = useState(false);
  const [newRowName, setNewRowName] = useState('');
  const [newRowQty, setNewRowQty] = useState('1');
  const [newRowUnit, setNewRowUnit] = useState('pcs');
  const [newRowPrice, setNewRowPrice] = useState('');

  const handleSaveDesktopPrices = () => {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setIsEditingPrices(false);
    setPriceSavedFlash(true);
    setTimeout(() => setPriceSavedFlash(false), 2500);
  };

  const handleAddDesktopCustomRow = (scope, e) => {
    if (e) e.preventDefault();
    const cleanName = String(newRowName || '').trim();
    if (!cleanName) return;
    const extraList = Array.isArray(customPrices?.__extraItems) ? customPrices.__extraItems : [];
    const nextItem = {
      id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      scope,
      name: cleanName,
      quantity: Math.max(1, Number(newRowQty) || 1),
      unit: String(newRowUnit || 'pcs').trim() || 'pcs',
      unitPrice: Math.max(0, Number(newRowPrice) || 0),
    };
    setCustomPrices({
      ...(customPrices || {}),
      __extraItems: [...extraList, nextItem],
    });
    setNewRowName('');
    setNewRowQty('1');
    setNewRowPrice('');
  };

  const handleDeleteDesktopCustomRow = (id) => {
    const extraList = Array.isArray(customPrices?.__extraItems) ? customPrices.__extraItems : [];
    const nextList = extraList.filter((ci) => ci.id !== id);
    const nextCustom = { ...(customPrices || {}), __extraItems: nextList };
    delete nextCustom[id];
    if (nextList.length === 0) delete nextCustom.__extraItems;
    setCustomPrices(nextCustom);
  };

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

  const isCustomShape = Boolean(polygonVertices && polygonVertices.length >= 3);
  const isAdmin = isAdminEmail(proUser?.email);

  // If admin logs out while previewing Mobile mode on a laptop/desktop, automatically return to Desktop Studio
  useEffect(() => {
    if (!isAdmin && isMobileAppMode && typeof window !== 'undefined' && window.innerWidth >= 768) {
      setIsMobileAppMode(false);
    }
  }, [isAdmin, isMobileAppMode]);

  if (isMobileAppMode) {
    return (
      <MobileWorkspace
        geometry={geometry}
        materials={materials}
        unitSystem={unitSystem}
        setUnitSystem={setUnitSystem}
        currencyCode={currencyCode}
        roofType={roofType}
        setRoofType={setRoofType}
        displayLength={displayLength}
        displayBreadth={displayBreadth}
        handleLengthChange={handleLengthChange}
        handleBreadthChange={handleBreadthChange}
        polygonVertices={polygonVertices}
        setPolygonVertices={setPolygonVertices}
        hasActiveDesign={hasActiveDesign}
        onResetToBlank={onResetToBlank}
        onActivateRectangle={onActivateRectangle}
        handleTweakKingpost={handleTweakKingpost}
        handleTweakPitchAngle={handleTweakPitchAngle}
        foundationOverhangM={foundationOverhangM}
        handleFoundationOverhangChange={handleFoundationOverhangChange}
        selectedMaterial={selectedMaterial}
        setSelectedMaterial={setSelectedMaterial}
        customPrices={customPrices}
        setCustomPrices={setCustomPrices}
        wastePercentage={wastePercentage}
        setWastePercentage={setWastePercentage}
        buildingStage={buildingStage}
        handleStageSelect={handleStageSelect}
        parapetConfig={parapetConfig}
        woodworkConfig={woodworkConfig}
        setSketchModalOpen={setSketchModalOpen}
        setQuoteModalOpen={setQuoteModalOpen}
        setVideoModalOpen={setVideoModalOpen}
        handleCopySummary={handleCopySummary}
        copiedToast={copiedToast}
        sketchUnderlayImage={sketchUnderlayImage}
        setSketchUnderlayImage={setSketchUnderlayImage}
        wcConfig={wcConfig}
        setWcConfig={setWcConfig}
        wcMaterials={wcMaterials}
        setQuoteScope={setQuoteScope}
        handleCopyWcSummary={handleCopyWcSummary}
        isPremium={isPremium}
        priceSyncStatus={priceSyncStatus}
        contractorInfo={contractorInfo}
        setContractorInfo={setContractorInfo}
        onUploadContractorLogo={onUploadContractorLogo}
        logoUploadError={logoUploadError}
        setLogoUploadError={setLogoUploadError}
        onOpenProModal={onOpenProModal}
        onOpenAdminModal={onOpenAdminModal}
        onInstallApp={onInstallApp}
        proUser={proUser}
        onSignOut={onSignOut}
      />
    );
  }

  return (
    <div className="studio-shell">
      {/* 1. CLEAN TOP HEADER */}
      <header className="studio-header">
        <div className="studio-header-left">
          <div className="studio-brand" title="RoofCalc Pro — Sijitek Solutions">
            <span className="studio-brand-mark">S</span>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
              <span className="studio-brand-name">RoofCalc</span>
              <span style={{ fontSize: '9.5px', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.02em' }}>
                Sijitek Solutions
              </span>
            </div>
          </div>

          <button
            type="button"
            className="studio-snap-cta"
            onClick={() => setSketchModalOpen(true)}
            title="Upload or take a photo of a paper sketch to trace into 2D & 3D"
          >
            <Camera className="w-4 h-4" />
            <span>Snap / Upload Sketch</span>
          </button>
        </div>

        {/* Primary 2-Step Workflow Tabs */}
        <nav className="studio-nav-tabs" aria-label="Workspace Steps">
          <button
            type="button"
            className={`studio-nav-tab ${mainTab === 'design' ? 'active' : ''}`}
            onClick={() => setMainTab('design')}
          >
            <Ruler className="w-4 h-4" />
            <span>1. 2D &amp; 3D Plan</span>
          </button>

          {mainTab === 'design' && (
            <div className="studio-layout-pills" role="group" aria-label="Canvas Layout">
              <button
                type="button"
                className={`studio-layout-pill ${viewLayout === 'split' ? 'active' : ''}`}
                onClick={() => setViewLayout('split')}
                title="Show 2D Plan and 3D Roof side by side"
              >
                Split
              </button>
              <button
                type="button"
                className={`studio-layout-pill ${viewLayout === '2d' ? 'active' : ''}`}
                onClick={() => setViewLayout('2d')}
                title="Focus on 2D Floor Plan"
              >
                2D
              </button>
              <button
                type="button"
                className={`studio-layout-pill ${viewLayout === '3d' ? 'active' : ''}`}
                onClick={() => setViewLayout('3d')}
                title="Focus on 3D Roof Model"
              >
                3D
              </button>
            </div>
          )}

          <button
            type="button"
            className={`studio-nav-tab ${mainTab === 'boq' ? 'active' : ''}`}
            onClick={() => setMainTab('boq')}
          >
            <Calculator className="w-4 h-4" />
            <span>2. BOQ &amp; Cost</span>
            <span className="studio-cost-pill">
              {hasActiveDesign ? formatCurrency(materials.summary.grandTotal, currencyCode) : '—'}
            </span>
          </button>

          <button
            type="button"
            className={`studio-nav-tab ${mainTab === 'wc' ? 'active' : ''}`}
            onClick={() => setMainTab('wc')}
            title="Water Collector (WC) Quotation & 3D Drop Pipe Plan"
          >
            <Droplets className="w-4 h-4 text-sky-400" />
            <span>3. WC</span>
            <span
              className="studio-cost-pill"
              style={{
                background: isPremium ? 'rgba(14, 165, 233, 0.16)' : 'rgba(245, 158, 11, 0.16)',
                color: isPremium ? '#38bdf8' : '#fbbf24',
              }}
            >
              {isPremium
                ? hasActiveDesign
                  ? formatCurrency(wcMaterials?.summary?.grandTotal || 0, currencyCode)
                  : '—'
                : 'PRO'}
            </span>
          </button>

          <button
            type="button"
            className={`studio-nav-tab ${mainTab === 'company' ? 'active' : ''}`}
            onClick={() => setMainTab('company')}
            title="Company Info, PDF Logo & Permanent Pro Branding"
          >
            <Building2 className="w-4 h-4 text-indigo-400" />
            <span>4. Company Info</span>
            {!isPremium && (
              <span
                className="studio-cost-pill"
                style={{
                  background: 'rgba(245, 158, 11, 0.16)',
                  color: '#fbbf24',
                }}
              >
                PRO
              </span>
            )}
          </button>
        </nav>

        {/* Compact Global Settings */}
        <div className="studio-header-right">
          <div className="studio-unit-toggle" role="group" aria-label="Measurement Unit">
            <button
              type="button"
              className={unitSystem === UNIT_SYSTEMS.METRIC ? 'active' : ''}
              onClick={() => setUnitSystem(UNIT_SYSTEMS.METRIC)}
            >
              m
            </button>
            <button
              type="button"
              className={unitSystem === UNIT_SYSTEMS.IMPERIAL ? 'active' : ''}
              onClick={() => setUnitSystem(UNIT_SYSTEMS.IMPERIAL)}
            >
              ft
            </button>
          </div>

          <select
            className="studio-select-compact"
            value={currencyCode}
            onChange={(e) => setCurrencyCode(e.target.value)}
            aria-label="Currency"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.symbol} {c.code}
              </option>
            ))}
          </select>

          {onOpenProModal && (
            <button
              type="button"
              className="studio-ghost-btn"
              onClick={onOpenProModal}
              title={isPremium ? 'Pro Active: AI Sketch, WC & Wood BOQ unlocked' : 'Upgrade to Pro for AI Sketch Scanning, WC & Wood BOQ'}
              style={{
                borderColor: isPremium ? 'rgba(245, 158, 11, 0.55)' : undefined,
                color: isPremium ? '#fbbf24' : undefined,
              }}
            >
              <Crown className="w-3.5 h-3.5" />
              <span>{isPremium ? 'Pro Active' : 'Go Pro'}</span>
            </button>
          )}

          <button
            type="button"
            className="studio-ghost-btn"
            onClick={() => setVideoModalOpen(true)}
            title="Watch quick guide"
          >
            <Video className="w-3.5 h-3.5" />
            <span>Guide</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              className="studio-ghost-btn"
              onClick={() => setIsMobileAppMode(true)}
              title="Admin preview: Mobile App version"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Mobile</span>
            </button>
          )}

          {onSwitchLayout && (
            <button
              type="button"
              className="studio-ghost-btn"
              onClick={onSwitchLayout}
              title="Switch to Classic Dashboard"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Classic</span>
            </button>
          )}

          {/* Profile Initials Avatar Badge & Login/Logout Dropdown */}
          <div ref={profileMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setProfileMenuOpen((v) => !v)}
              aria-label={proUser ? `Account (${getUserDisplayName(proUser)})` : 'Sign In / Profile'}
              title={proUser ? `${getUserDisplayName(proUser)} (${proUser.email || 'Signed in'})` : 'Click to Sign In / Log Out'}
              style={{
                width: '36px',
                height: '36px',
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
                fontSize: '13px',
                fontWeight: 900,
                letterSpacing: '0.03em',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                position: 'relative',
                boxShadow: proUser ? '0 0 12px rgba(14, 165, 233, 0.35)' : 'none',
              }}
            >
              {proUser ? getUserInitials(proUser) : <User className="w-4 h-4" />}
              {proUser && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: '-1px',
                    right: '-1px',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: isPremium ? '#fbbf24' : '#34d399',
                    border: '2px solid #090e1a',
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
                  width: '256px',
                  zIndex: 300,
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '12px',
                  padding: '12px',
                  boxShadow: '0 18px 40px rgba(2, 6, 23, 0.75)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                {proUser ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '10px', borderBottom: '1px solid #1e293b' }}>
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #0ea5e9, #10b981)',
                          color: '#ffffff',
                          fontSize: '14px',
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
                        <div style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {getUserDisplayName(proUser)}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {proUser.email || ''}
                        </div>
                        <span
                          style={{
                            display: 'inline-block',
                            marginTop: '4px',
                            fontSize: '10px',
                            fontWeight: 800,
                            padding: '2px 7px',
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
                          gap: '8px',
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
                          gap: '8px',
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
                        <Sliders className="w-3.5 h-3.5 text-emerald-400" />
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
                          gap: '8px',
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
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc' }}>Guest Session</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
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
                          fontSize: '12.5px',
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

      {/* 2. SLIM ESSENTIALS BAR (ONLY IN DESIGN VIEW) */}
      {mainTab === 'design' && (
        <section className="studio-controls-bar" aria-label="Roof Quick Settings">
          {/* Building Level */}
          <div className="studio-control-group">
            <span className="studio-control-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span>Level</span>
              <LevelInfoButton size={15} />
            </span>
            <div className="studio-segmented">
              {BUILDING_STAGES.map((stg) => (
                <button
                  key={stg.id}
                  type="button"
                  className={buildingStage === stg.id ? 'active' : ''}
                  onClick={() => handleStageSelect(stg.id)}
                  title={stg.summary}
                >
                  {stg.shortName}
                </button>
              ))}
            </div>
          </div>

          {/* Roof Covering */}
          <div className="studio-control-group">
            <span className="studio-control-label">Material</span>
            <select
              className="studio-select"
              value={selectedMaterial}
              onChange={(e) => setSelectedMaterial(e.target.value)}
            >
              {MATERIAL_PROFILES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Footprint Size OR Custom Shape Badge */}
          <div className="studio-control-group">
            <span className="studio-control-label">Footprint</span>
            {isCustomShape ? (
              <div className="studio-custom-shape-pill">
                <span>
                  Custom Plan ({polygonVertices.length} walls &bull;{' '}
                  {formatArea(geometry.baseArea, unitSystem)})
                </span>
                <button
                  type="button"
                  onClick={() => setPolygonVertices(null)}
                  title="Switch back to a simple rectangle"
                >
                  Reset Rect
                </button>
              </div>
            ) : (
              <div className="studio-dim-inputs">
                <label>
                  <span>L</span>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={displayLength}
                    onChange={(e) => handleLengthChange(e.target.value)}
                  />
                </label>
                <span className="studio-times">&times;</span>
                <label>
                  <span>W</span>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={displayBreadth}
                    onChange={(e) => handleBreadthChange(e.target.value)}
                  />
                </label>
              </div>
            )}
          </div>

          {/* Stage-Specific Overhang / Eaves Projection */}
          {buildingStage === 'foundation' ? (
            <div
              className="studio-control-group"
              title="Foundation level: automatically adds editable parapet/eaves allowance per side (default 0.5m) for the parapet that will be installed later"
            >
              <span className="studio-control-label">Parapet (+/side)</span>
              <div className="studio-stepper" style={{ gap: '3px' }}>
                <button
                  type="button"
                  onClick={() =>
                    handleFoundationOverhangChange
                      ? handleFoundationOverhangChange(Math.max(0, (Number(foundationOverhangM) || 0) - 0.05))
                      : setOverhang({
                          front: Math.max(0, (overhang.front || 0) - 0.05),
                          back: Math.max(0, (overhang.front || 0) - 0.05),
                          left: Math.max(0, (overhang.front || 0) - 0.05),
                          right: Math.max(0, (overhang.front || 0) - 0.05),
                        })
                  }
                  title="Decrease eaves projection by 0.05m"
                >
                  &minus;
                </button>
                <input
                  type="number"
                  min="0"
                  max="2"
                  step="0.05"
                  aria-label="Foundation eaves per side (m)"
                  value={foundationOverhangM}
                  onChange={(e) =>
                    handleFoundationOverhangChange
                      ? handleFoundationOverhangChange(e.target.value)
                      : setOverhang({
                          front: Math.max(0, Number(e.target.value) || 0),
                          back: Math.max(0, Number(e.target.value) || 0),
                          left: Math.max(0, Number(e.target.value) || 0),
                          right: Math.max(0, Number(e.target.value) || 0),
                        })
                  }
                  style={{
                    width: '48px',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#34d399',
                    fontSize: '12px',
                    fontWeight: 800,
                    textAlign: 'center',
                  }}
                />
                <span style={{ fontSize: '11px', color: '#94a3b8', marginRight: '2px' }}>m</span>
                <button
                  type="button"
                  onClick={() =>
                    handleFoundationOverhangChange
                      ? handleFoundationOverhangChange((Number(foundationOverhangM) || 0) + 0.05)
                      : setOverhang({
                          front: (overhang.front || 0) + 0.05,
                          back: (overhang.front || 0) + 0.05,
                          left: (overhang.front || 0) + 0.05,
                          right: (overhang.front || 0) + 0.05,
                        })
                  }
                  title="Increase eaves projection by 0.05m"
                >
                  +
                </button>
              </div>
            </div>
          ) : (
            <div
              className="studio-control-group"
              title="Parapet / Woodwork level: base dimensions stay exact (+0m added)"
            >
              <span className="studio-control-label">Base</span>
              <span
                style={{
                  fontSize: '11.5px',
                  fontWeight: 700,
                  color: '#38bdf8',
                  background: 'rgba(15, 23, 42, 0.7)',
                  border: '1px solid #334155',
                  borderRadius: '7px',
                  padding: '4px 9px',
                  whiteSpace: 'nowrap',
                }}
              >
                Exact (+0m)
              </span>
            </div>
          )}

          {/* Kingpost Height & Pitch Angle (coupled — edit either one) */}
          <div className="studio-control-group">
            <span className="studio-control-label">Kingpost</span>
            <div className="studio-stepper" style={{ gap: '2px' }}>
              <button
                type="button"
                onClick={() => handleTweakKingpost(Math.max(0.2, geometry.roofHeight - 0.1))}
                title="Lower kingpost height"
              >
                &minus;
              </button>
              <input
                type="number"
                min="0.2"
                max="8.5"
                step="0.1"
                aria-label="Kingpost height (m)"
                value={Number(geometry.roofHeight.toFixed(2))}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v) && v >= 0.2) handleTweakKingpost(v);
                }}
                style={{
                  width: '50px',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#f8fafc',
                  fontSize: '12px',
                  fontWeight: 800,
                  textAlign: 'center',
                }}
              />
              <span style={{ fontSize: '11px', color: '#94a3b8', marginRight: '2px' }}>m</span>
              <button
                type="button"
                onClick={() => handleTweakKingpost(geometry.roofHeight + 0.1)}
                title="Raise kingpost height"
              >
                +
              </button>
            </div>
          </div>

          <div className="studio-control-group">
            <span className="studio-control-label">Angle</span>
            <div className="studio-stepper" style={{ gap: '2px' }}>
              <button
                type="button"
                onClick={() => handleTweakPitchAngle && handleTweakPitchAngle(Math.max(roofType === 'shed' || roofType === 'flat' ? 2 : 5, (geometry.pitchDegrees || 30) - 1))}
                title="Decrease pitch angle"
              >
                &minus;
              </button>
              <input
                type="number"
                min={roofType === 'shed' || roofType === 'flat' ? 2 : 5}
                max="68"
                step="1"
                aria-label="Roof pitch angle (degrees)"
                value={Number(geometry.pitchDegrees || 0)}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  const minDeg = roofType === 'shed' || roofType === 'flat' ? 2 : 5;
                  if (Number.isFinite(v) && v >= minDeg && handleTweakPitchAngle) handleTweakPitchAngle(v);
                }}
                style={{
                  width: '42px',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#38bdf8',
                  fontSize: '12px',
                  fontWeight: 800,
                  textAlign: 'center',
                }}
              />
              <span style={{ fontSize: '11px', color: '#38bdf8', marginRight: '2px' }}>&deg;</span>
              <button
                type="button"
                onClick={() => handleTweakPitchAngle && handleTweakPitchAngle(Math.min(68, (geometry.pitchDegrees || 30) + 1))}
                title="Increase pitch angle"
              >
                +
              </button>
            </div>
          </div>

          {/* More Options Toggle */}
          <div className="studio-control-group" style={{ marginLeft: 'auto' }}>
            <button
              type="button"
              className={`studio-more-btn ${showMoreOptions ? 'active' : ''}`}
              onClick={() => setShowMoreOptions(!showMoreOptions)}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>More Options</span>
              <ChevronDown
                className="w-3.5 h-3.5"
                style={{
                  transform: showMoreOptions ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.15s',
                }}
              />
            </button>
          </div>
        </section>
      )}

      {/* Collapsible Secondary Settings Drawer (keeps main surface clean) */}
      {mainTab === 'design' && showMoreOptions && (
        <section className="studio-more-drawer" aria-label="Advanced Options">
          <div className="studio-drawer-item">
            <label>Roof Style</label>
            <select value={roofType} onChange={(e) => setRoofType(e.target.value)}>
              {ROOF_TYPES.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.name}
                </option>
              ))}
            </select>
          </div>

          <div className="studio-drawer-item">
            <label>Slanting Rafter (H)</label>
            <div className="studio-stepper">
              <button
                type="button"
                onClick={() => handleTweakSlantingHeight(Math.max(0.5, geometry.rafterLength - 0.1))}
              >
                &minus;
              </button>
              <span className="studio-stepper-val">{geometry.rafterLength.toFixed(2)}m</span>
              <button
                type="button"
                onClick={() => handleTweakSlantingHeight(geometry.rafterLength + 0.1)}
              >
                +
              </button>
            </div>
          </div>

          <div className="studio-drawer-item">
            <label>Waste Allowance (+{wastePercentage}%)</label>
            <input
              type="range"
              min="0"
              max="30"
              value={wastePercentage}
              onChange={(e) => setWastePercentage(Number(e.target.value))}
              style={{ width: '90px' }}
            />
          </div>

          <div className="studio-drawer-item">
            <label>Quick Sizes</label>
            <div className="studio-mini-btns">
              <button type="button" onClick={() => applyPreset('hip', 14, 9, 2.6)}>
                Bungalow
              </button>
              <button type="button" onClick={() => applyPreset('gable', 16, 10, 3.2)}>
                Duplex
              </button>
              <button type="button" onClick={() => applyPreset('shed', 10, 5, 1.8)}>
                Shed
              </button>
            </div>
          </div>

          {!isCustomShape && (
            <div className="studio-drawer-item">
              <label>Wings ({extensions.length})</label>
              <div className="studio-mini-btns">
                <button type="button" onClick={handleAddExtension}>
                  <Plus className="w-3 h-3" /> Add Wing
                </button>
                {extensions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveExtension(extensions[extensions.length - 1].id)}
                    style={{ color: '#f87171' }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="studio-drawer-item">
            <label>Outward Parapet</label>
            <input
              type="checkbox"
              checked={Boolean(buildingStage === 'parapet' || parapetConfig?.enabled)}
              onChange={(e) => {
                const on = e.target.checked;
                const proj = parapetConfig?.projection || 0.45;
                setParapetConfig({
                  ...parapetConfig,
                  enabled: on,
                  style: 'fascia_overhang',
                });
                if (on && !parapetConfig?.includedInSketch) {
                  setOverhang({ front: proj, back: proj, left: proj, right: proj });
                  setIsUniformOverhang(true);
                }
              }}
            />
          </div>

          {(buildingStage === 'parapet' || parapetConfig?.enabled) && (
            <div className="studio-drawer-item">
              <label>Parapet Projection</label>
              <select
                value={parapetConfig?.projection || 0.45}
                onChange={(e) => {
                  const proj = Number(e.target.value) || 0.45;
                  setParapetConfig({ ...parapetConfig, projection: proj });
                  if (!parapetConfig?.includedInSketch) {
                    setOverhang({ front: proj, back: proj, left: proj, right: proj });
                    setIsUniformOverhang(true);
                  }
                }}
              >
                <option value={0.3}>0.30 m (1 ft)</option>
                <option value={0.45}>0.45 m (1.5 ft)</option>
                <option value={0.6}>0.60 m (2 ft)</option>
              </select>
            </div>
          )}

          <div className="studio-drawer-item">
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span>Include Timber BOQ</span>
              {!isPremium && <Crown className="w-3 h-3 text-amber-400" />}
            </label>
            <input
              type="checkbox"
              checked={isPremium && woodworkConfig.includeTimberBOQ}
              onChange={(e) => {
                if (!isPremium) {
                  onOpenProModal?.();
                  return;
                }
                setWoodworkConfig({ ...woodworkConfig, includeTimberBOQ: e.target.checked });
              }}
            />
          </div>
          {isPremium && woodworkConfig.includeTimberBOQ && (
            <div className="studio-drawer-item">
              <label>Truss Spacing</label>
              <select
                value={woodworkConfig.trussSpacing}
                onChange={(e) =>
                  setWoodworkConfig({ ...woodworkConfig, trussSpacing: Number(e.target.value) })
                }
              >
                <option value={1.0}>1.0 m</option>
                <option value={1.2}>1.2 m (Std)</option>
                <option value={1.5}>1.5 m</option>
              </select>
            </div>
          )}

          <button
            type="button"
            className="studio-reset-btn"
            onClick={() => handleStageSelect(buildingStage)}
            title="Reset stage defaults"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
        </section>
      )}

      {/* 3. PRIMARY UNOBSTRUCTED WORKSPACE */}
      <main className="studio-main">
        {mainTab === 'design' && (
          <div className={`studio-canvas-grid ${viewLayout === 'split' ? 'split' : `layout-${viewLayout}`}`}>
            {(viewLayout === 'split' || viewLayout === '2d') && (
              <div className="studio-canvas-pane">
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
                  onOverhangChange={(newOv) => {
                    setOverhang(newOv);
                    setIsUniformOverhang(false);
                  }}
                  isSplitView={viewLayout === 'split'}
                  buildingStage={buildingStage}
                  onStageChange={handleStageSelect}
                  parapetConfig={parapetConfig}
                  woodworkConfig={woodworkConfig}
                  sketchUnderlayImage={sketchUnderlayImage}
                  onClearUnderlay={() => setSketchUnderlayImage(null)}
                  wastePercentage={wastePercentage}
                  setWastePercentage={setWastePercentage}
                />
              </div>
            )}

            {(viewLayout === 'split' || viewLayout === '3d') && (
              <div className="studio-canvas-pane">
                {hasActiveDesign ? (
                  <Roof3DViewer
                    geometry={geometry}
                    roofType={roofType}
                    extensions={extensions}
                    buildingStage={buildingStage}
                    parapetConfig={parapetConfig}
                    woodworkConfig={woodworkConfig}
                    selectedMaterial={selectedMaterial}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      minHeight: '380px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      padding: '28px',
                      gap: '12px',
                      background:
                        'radial-gradient(circle at 50% 42%, rgba(14, 165, 233, 0.08), rgba(9, 14, 26, 0.96) 65%)',
                    }}
                  >
                    <div
                      style={{
                        width: '52px',
                        height: '52px',
                        borderRadius: '14px',
                        background: 'rgba(14, 165, 233, 0.14)',
                        border: '1px solid rgba(56, 189, 248, 0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#38bdf8',
                      }}
                    >
                      <Box className="w-6 h-6" />
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#f8fafc' }}>
                      3D Roof Preview Ready
                    </div>
                    <p style={{ margin: 0, maxWidth: '340px', fontSize: '12.5px', color: '#94a3b8', lineHeight: 1.55 }}>
                      Click on the 2D Floor Plan to sketch your building walls, snap a paper sketch, or open an example to generate your live 3D roof &amp; BOQ.
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px', marginTop: '4px' }}>
                      <button
                        type="button"
                        onClick={() => setSketchModalOpen(true)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                          color: '#0f172a',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '8px 13px',
                          fontSize: '12px',
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Snap / Upload Sketch</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const lPreset = SHAPE_PRESETS.find((p) => p.id === 'l_shape') || SHAPE_PRESETS[0];
                          if (lPreset) setPolygonVertices(lPreset.vertices);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: '#1e293b',
                          color: '#cbd5e1',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          padding: '8px 13px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        <span>Load Example (L-Shape)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {mainTab === 'boq' && (
          <div className="studio-boq-scroll">
            <section className="boq-section glass-panel" style={{ background: '#18181c', margin: 0 }}>
              <div className="boq-header">
                <div className="boq-title">
                  <Calculator className="w-5 h-5 text-emerald-400" />
                  <span>Bill of Quantities &amp; Material Estimate</span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '10px',
                      background: currentStageConfig.bgLight,
                      color: currentStageConfig.color,
                      border: `1px solid ${currentStageConfig.borderLight}`,
                    }}
                  >
                    {currentStageConfig.badge}
                  </span>
                </div>

                <div className="material-selector-row">
                  <label className="text-xs text-slate-400">Roof Covering:</label>
                  <select
                    value={selectedMaterial}
                    onChange={(e) => setSelectedMaterial(e.target.value)}
                    className="material-select"
                  >
                    {MATERIAL_PROFILES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quick Price Settings: Labour, Transport & Edit/Save Toggle */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '10px 14px',
                  marginBottom: '12px',
                  background: 'rgba(15, 23, 42, 0.72)',
                  border: '1px solid rgba(51, 65, 85, 0.7)',
                  borderRadius: '10px',
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#cbd5e1' }}>
                    <span>Labour / m² ({currencyCode}):</span>
                    {isPremium && isEditingPrices ? (
                      <input
                        type="number"
                        min="0"
                        value={customPrices.laborPerM2 !== undefined ? customPrices.laborPerM2 : (currencyCode === 'NGN' ? 1500 : 3.5)}
                        onChange={(e) => setCustomPrices({ ...customPrices, laborPerM2: e.target.value })}
                        style={{
                          width: '92px',
                          padding: '4px 8px',
                          fontSize: '12px',
                          background: '#090e1a',
                          color: '#f8fafc',
                          border: '1px solid #334155',
                          borderRadius: '6px',
                        }}
                      />
                    ) : (
                      <strong style={{ color: '#f8fafc', fontSize: '12.5px' }}>
                        {formatCurrency(
                          customPrices.laborPerM2 !== undefined && customPrices.laborPerM2 !== ''
                            ? Number(customPrices.laborPerM2)
                            : currencyCode === 'NGN'
                            ? 1500
                            : 3.5,
                          currencyCode
                        )}
                      </strong>
                    )}
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#cbd5e1' }}>
                    <span>Transport ({currencyCode}):</span>
                    {isPremium && isEditingPrices ? (
                      <input
                        type="number"
                        min="0"
                        value={customPrices.transport !== undefined ? customPrices.transport : (currencyCode === 'NGN' ? 25000 : 50)}
                        onChange={(e) => setCustomPrices({ ...customPrices, transport: e.target.value })}
                        style={{
                          width: '100px',
                          padding: '4px 8px',
                          fontSize: '12px',
                          background: '#090e1a',
                          color: '#f8fafc',
                          border: '1px solid #334155',
                          borderRadius: '6px',
                        }}
                      />
                    ) : (
                      <strong style={{ color: '#f8fafc', fontSize: '12.5px' }}>
                        {formatCurrency(
                          customPrices.transport !== undefined && customPrices.transport !== ''
                            ? Number(customPrices.transport)
                            : currencyCode === 'NGN'
                            ? 25000
                            : 50,
                          currencyCode
                        )}
                      </strong>
                    )}
                  </label>
                  {setWastePercentage && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#cbd5e1' }}>
                      <span>Waste (%):</span>
                      <input
                        className="compact-num-input"
                        type="number"
                        min="0"
                        max="30"
                        step="1"
                        value={wastePercentage}
                        onChange={(e) => {
                          const v = Math.max(0, Math.min(30, Math.round(Number(e.target.value) || 0)));
                          setWastePercentage(v);
                        }}
                        style={{
                          width: '56px',
                          padding: '4px 6px',
                          fontSize: '12px',
                          fontWeight: 700,
                          textAlign: 'center',
                          background: '#090e1a',
                          color: '#34d399',
                          border: '1px solid #334155',
                          borderRadius: '6px',
                        }}
                      />
                    </label>
                  )}
                  <span style={{ fontSize: '11px', color: isPremium && (priceSavedFlash || priceSyncStatus === 'saved') ? '#34d399' : '#64748b' }}>
                    {isPremium
                      ? priceSavedFlash
                        ? '✓ Prices saved to your Pro account!'
                        : priceSyncStatus === 'saving'
                        ? 'Saving prices to your Pro account...'
                        : priceSyncStatus === 'error'
                        ? 'Saved locally • Cloud sync retrying on next edit'
                        : isEditingPrices
                        ? 'Editing prices • Click Save when done (set 0 to hide item)'
                        : '✓ Prices saved permanently to your Pro account'
                      : 'Default market prices shown • Upgrade to Pro to edit prices & company branding'}
                  </span>
                </div>
                {isPremium && (
                  isEditingPrices ? (
                    <button
                      type="button"
                      onClick={handleSaveDesktopPrices}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '6px 13px',
                        fontSize: '12px',
                        fontWeight: 800,
                        background: '#10b981',
                        color: '#052e16',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      <Check size={14} />
                      <span>Save</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsEditingPrices(true)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '5px 11px',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        background: '#1e293b',
                        color: '#38bdf8',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      <Pencil size={12} />
                      <span>Edit Prices</span>
                    </button>
                  )
                )}
              </div>

              <div className="boq-table-wrapper">
                {!isPremium && (buildingStage === 'woodwork' || woodworkConfig?.includeTimberBOQ) && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      flexWrap: 'wrap',
                      padding: '10px 14px',
                      marginBottom: '10px',
                      borderRadius: '10px',
                      background: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid rgba(245, 158, 11, 0.4)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#fef3c7' }}>
                      <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        <strong>Woodwork &amp; Timber BOQ (Pro Feature):</strong> Sign in with a RoofCalc Pro account to unlock full rafter, purlin, tie beam, kingpost, nail, and timber cost schedules.
                      </span>
                    </div>
                    {onOpenProModal && (
                      <button
                        type="button"
                        onClick={onOpenProModal}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                          color: '#0f172a',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <Crown className="w-3.5 h-3.5" />
                        <span>Unlock Pro Timber BOQ</span>
                      </button>
                    )}
                  </div>
                )}
                <table className="boq-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Item Description &amp; Specification</th>
                      <th>Quantity</th>
                      <th>Unit</th>
                      <th>Unit Price ({currencyCode})</th>
                      <th>Total Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materials.items.map((item, idx) => (
                      <tr key={item.id}>
                        <td style={{ color: '#64748b' }}>{idx + 1}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            {isPremium && isEditingPrices ? (
                              <input
                                type="text"
                                aria-label={`Edit name for ${item.defaultName || item.name}`}
                                placeholder={item.defaultName || item.name}
                                value={
                                  item.isCustom
                                    ? item.name
                                    : customPrices?.__customNames?.[item.id] !== undefined
                                    ? customPrices.__customNames[item.id]
                                    : item.name
                                }
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (item.isCustom) {
                                    const prevList = Array.isArray(customPrices?.__extraItems)
                                      ? customPrices.__extraItems
                                      : [];
                                    setCustomPrices({
                                      ...(customPrices || {}),
                                      __extraItems: prevList.map((ci) =>
                                        ci.id === item.id ? { ...ci, name: val } : ci
                                      ),
                                    });
                                  } else {
                                    setCustomPrices({
                                      ...(customPrices || {}),
                                      __customNames: {
                                        ...(customPrices?.__customNames || {}),
                                        [item.id]: val,
                                      },
                                    });
                                  }
                                }}
                                style={{
                                  flex: '1 1 200px',
                                  minWidth: '150px',
                                  background: 'rgba(15, 23, 42, 0.55)',
                                  color: '#f8fafc',
                                  border: '1px solid rgba(51, 65, 85, 0.75)',
                                  borderRadius: '6px',
                                  padding: '3px 8px',
                                  fontSize: '12.5px',
                                  fontWeight: 700,
                                }}
                              />
                            ) : (
                              <span className="boq-item-title">{item.name}</span>
                            )}
                            {item.category && (
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  padding: '1px 7px',
                                  borderRadius: '10px',
                                  background: item.category.includes('Timber')
                                    ? 'rgba(245, 158, 11, 0.15)'
                                    : item.category.includes('Parapet')
                                    ? 'rgba(6, 182, 212, 0.15)'
                                    : 'rgba(51, 65, 85, 0.5)',
                                  color: item.category.includes('Timber')
                                    ? '#f59e0b'
                                    : item.category.includes('Parapet')
                                    ? '#38bdf8'
                                    : '#94a3b8',
                                  border: item.category.includes('Timber')
                                    ? '1px solid rgba(245, 158, 11, 0.3)'
                                    : item.category.includes('Parapet')
                                    ? '1px solid rgba(6, 182, 212, 0.3)'
                                    : '1px solid rgba(71, 85, 105, 0.4)',
                                }}
                              >
                                {item.category}
                              </span>
                            )}
                          </div>
                          <div className="boq-item-spec">{item.spec}</div>
                        </td>
                        <td className="boq-qty">{item.quantity.toLocaleString()}</td>
                        <td>{item.unit}</td>
                        <td>
                          {isPremium && isEditingPrices ? (
                            <input
                              type="number"
                              className="boq-price-input"
                              style={{
                                width: '90px',
                                padding: '4px 8px',
                                fontSize: '12px',
                                background: 'rgba(15, 23, 42, 0.6)',
                              }}
                              value={
                                customPrices[item.id] !== undefined
                                  ? customPrices[item.id]
                                  : item.unitPrice
                              }
                              onChange={(e) =>
                                setCustomPrices({
                                  ...customPrices,
                                  [item.id]: e.target.value,
                                })
                              }
                            />
                          ) : isPremium ? (
                            <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#e2e8f0', fontFamily: 'monospace' }}>
                              {formatCurrency(item.unitPrice, currencyCode)}
                            </span>
                          ) : (
                            <span
                              title="Upgrade to RoofCalc Pro to customize material prices"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontSize: '12px',
                                color: '#94a3b8',
                                fontFamily: 'monospace',
                              }}
                            >
                              <Lock size={11} style={{ color: '#f59e0b' }} />
                              <span>{formatCurrency(item.unitPrice, currencyCode)}</span>
                            </span>
                          )}
                        </td>
                        <td className="boq-price">
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <span>{formatCurrency(item.total, currencyCode)}</span>
                            {item.isCustom && isEditingPrices && (
                              <button
                                type="button"
                                onClick={() => handleDeleteDesktopCustomRow(item.id)}
                                title="Remove custom row"
                                style={{
                                  background: 'rgba(239, 68, 68, 0.14)',
                                  color: '#fca5a5',
                                  border: '1px solid rgba(239, 68, 68, 0.35)',
                                  borderRadius: '5px',
                                  padding: '3px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  cursor: 'pointer',
                                }}
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {materials.summary.laborTotal > 0 && (
                      <tr>
                        <td style={{ color: '#64748b' }}>{materials.items.length + 1}</td>
                        <td>
                          <div className="boq-item-title">Roof Installation &amp; Skilled Labor</div>
                          <div className="boq-item-spec">Professional carpentry, framing &amp; covering</div>
                        </td>
                        <td className="boq-qty">—</td>
                        <td>—</td>
                        <td>
                          {isPremium && isEditingPrices ? (
                            <input
                              type="number"
                              min="0"
                              style={{
                                width: '90px',
                                padding: '4px 8px',
                                fontSize: '12px',
                                background: 'rgba(15, 23, 42, 0.6)',
                              }}
                              value={
                                customPrices.laborPerM2 !== undefined
                                  ? customPrices.laborPerM2
                                  : currencyCode === 'NGN'
                                  ? 1500
                                  : 3.5
                              }
                              onChange={(e) =>
                                setCustomPrices({
                                  ...customPrices,
                                  laborPerM2: e.target.value,
                                })
                              }
                            />
                          ) : isPremium ? (
                            <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#e2e8f0', fontFamily: 'monospace' }}>
                              {formatCurrency(
                                customPrices.laborPerM2 !== undefined && customPrices.laborPerM2 !== ''
                                  ? Number(customPrices.laborPerM2)
                                  : currencyCode === 'NGN'
                                  ? 1500
                                  : 3.5,
                                currencyCode
                              )}
                            </span>
                          ) : (
                            <span
                              title="Upgrade to RoofCalc Pro to customize labor rate"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontSize: '12px',
                                color: '#94a3b8',
                                fontFamily: 'monospace',
                              }}
                            >
                              <Lock size={11} style={{ color: '#f59e0b' }} />
                              <span>{formatCurrency(currencyCode === 'NGN' ? 1500 : 3.5, currencyCode)}</span>
                            </span>
                          )}
                        </td>
                        <td className="boq-price">
                          {formatCurrency(materials.summary.laborTotal, currencyCode)}
                        </td>
                      </tr>
                    )}
                    {materials.summary.transportTotal > 0 && (
                      <tr>
                        <td style={{ color: '#64748b' }}>
                          {materials.items.length + (materials.summary.laborTotal > 0 ? 2 : 1)}
                        </td>
                        <td>
                          <div className="boq-item-title">Transport &amp; Site Logistics</div>
                          <div className="boq-item-spec">Material delivery &amp; haulage to site</div>
                        </td>
                        <td className="boq-qty">—</td>
                        <td>—</td>
                        <td>
                          {isPremium && isEditingPrices ? (
                            <input
                              type="number"
                              min="0"
                              style={{
                                width: '90px',
                                padding: '4px 8px',
                                fontSize: '12px',
                                background: 'rgba(15, 23, 42, 0.6)',
                              }}
                              value={
                                customPrices.transport !== undefined
                                  ? customPrices.transport
                                  : currencyCode === 'NGN'
                                  ? 25000
                                  : 50
                              }
                              onChange={(e) =>
                                setCustomPrices({
                                  ...customPrices,
                                  transport: e.target.value,
                                })
                              }
                            />
                          ) : isPremium ? (
                            <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#e2e8f0', fontFamily: 'monospace' }}>
                              {formatCurrency(
                                customPrices.transport !== undefined && customPrices.transport !== ''
                                  ? Number(customPrices.transport)
                                  : currencyCode === 'NGN'
                                  ? 25000
                                  : 50,
                                currencyCode
                              )}
                            </span>
                          ) : (
                            <span
                              title="Upgrade to RoofCalc Pro to customize transport fee"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontSize: '12px',
                                color: '#94a3b8',
                                fontFamily: 'monospace',
                              }}
                            >
                              <Lock size={11} style={{ color: '#f59e0b' }} />
                              <span>{formatCurrency(currencyCode === 'NGN' ? 25000 : 50, currencyCode)}</span>
                            </span>
                          )}
                        </td>
                        <td className="boq-price">
                          {formatCurrency(materials.summary.transportTotal, currencyCode)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {isPremium ? (
              isEditingPrices ? (
              <form
                onSubmit={(e) => handleAddDesktopCustomRow(buildingStage === 'woodwork' ? 'wood' : 'roof', e)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap',
                  padding: '8px 10px',
                  marginBottom: '10px',
                  background: 'rgba(15, 23, 42, 0.55)',
                  border: '1px dashed rgba(56, 189, 248, 0.4)',
                  borderRadius: '8px',
                }}
              >
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#38bdf8', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Plus size={14} /> Add Material Row:
                </span>
                <input
                  type="text"
                  value={newRowName}
                  onChange={(e) => setNewRowName(e.target.value)}
                  placeholder="Material / item name"
                  style={{ flex: '2 1 180px', padding: '5px 8px', fontSize: '12px', background: '#090e1a' }}
                />
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={newRowQty}
                  onChange={(e) => setNewRowQty(e.target.value)}
                  placeholder="Qty"
                  style={{ width: '68px', padding: '5px 8px', fontSize: '12px', background: '#090e1a', textAlign: 'center' }}
                />
                <input
                  type="text"
                  value={newRowUnit}
                  onChange={(e) => setNewRowUnit(e.target.value)}
                  placeholder="pcs"
                  style={{ width: '74px', padding: '5px 8px', fontSize: '12px', background: '#090e1a', textAlign: 'center' }}
                />
                <input
                  type="number"
                  min="0"
                  value={newRowPrice}
                  onChange={(e) => setNewRowPrice(e.target.value)}
                  placeholder={`Unit Price (${currencyCode})`}
                  style={{ width: '125px', padding: '5px 8px', fontSize: '12px', background: '#090e1a', textAlign: 'right' }}
                />
                <button
                  type="submit"
                  disabled={!newRowName.trim()}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: newRowName.trim() ? '#10b981' : '#1e293b',
                    color: newRowName.trim() ? '#052e16' : '#64748b',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: newRowName.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  + Add Row
                </button>
              </form>
              ) : null
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    flexWrap: 'wrap',
                    padding: '10px 14px',
                    marginBottom: '10px',
                    borderRadius: '10px',
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    fontSize: '12px',
                    color: '#fef3c7',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      <strong>Disclaimer:</strong> Default prices are generic estimates and may not reflect actual market prices. Free &amp; Guest users can adjust prices or add materials at PDF export (not saved).
                    </span>
                  </div>
                  {onOpenProModal && (
                    <button
                      type="button"
                      onClick={onOpenProModal}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                        color: '#0f172a',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Crown className="w-3.5 h-3.5" />
                      <span>See all benefits of going Pro</span>
                    </button>
                  )}
                </div>
              )}

              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px' }}>
                <strong>Disclaimer:</strong> Default material prices are generic reference estimates and may not reflect actual local market prices.
              </div>

              <div className="boq-summary-bar">
                <div className="summary-figures">
                  <div className="figure-item">
                    <span className="figure-label">Materials Subtotal</span>
                    <span className="figure-val">
                      {formatCurrency(materials.summary.materialsSubtotal, currencyCode)}
                    </span>
                  </div>
                  {materials.summary.laborTotal > 0 && (
                    <div className="figure-item">
                      <span className="figure-label">Labor &amp; Installation</span>
                      <span className="figure-val">
                        {formatCurrency(materials.summary.laborTotal, currencyCode)}
                      </span>
                    </div>
                  )}
                  {materials.summary.transportTotal > 0 && (
                    <div className="figure-item">
                      <span className="figure-label">Transport &amp; Logistics</span>
                      <span className="figure-val">
                        {formatCurrency(materials.summary.transportTotal, currencyCode)}
                      </span>
                    </div>
                  )}
                  <div className="figure-item">
                    <span className="figure-label">Grand Total Estimate</span>
                    <span className="figure-val grand">
                      {formatCurrency(materials.summary.grandTotal, currencyCode)}
                    </span>
                  </div>
                </div>

                <div className="action-buttons-group">
                  <button
                    type="button"
                    className="btn-primary-action"
                    onClick={() => {
                      if (setQuoteScope) setQuoteScope('roof');
                      setQuoteModalOpen(true);
                    }}
                  >
                    <Download className="w-4 h-4" />
                    <span>Download PDF Quote</span>
                  </button>
                  <button
                    type="button"
                    className="btn-secondary-action"
                    onClick={handleExportCSV}
                  >
                    <FileText className="w-4 h-4" />
                    <span>Export CSV</span>
                  </button>
                  <button
                    type="button"
                    className="btn-secondary-action"
                    onClick={handleCopySummary}
                  >
                    <Share2 className="w-4 h-4" />
                    <span>{copiedToast ? 'Copied!' : 'Copy Summary'}</span>
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

        {mainTab === 'wc' && wcMaterials && (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              padding: '12px',
              overflow: 'hidden',
            }}
          >
            {/* Sub-Page Switcher Bar (matches Mobile WC two-subpage workflow) */}
            <div
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                background: '#111827',
                border: '1px solid #1f2937',
                borderRadius: '11px',
                padding: '6px 10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    display: 'inline-grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '4px',
                    background: '#090e1a',
                    padding: '4px',
                    borderRadius: '9px',
                    border: '1px solid #1e293b',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setWcSubPage('view')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '7px 14px',
                      borderRadius: '7px',
                      border: 'none',
                      background: wcSubPage === 'view' ? '#0ea5e9' : 'transparent',
                      color: wcSubPage === 'view' ? '#ffffff' : '#94a3b8',
                      fontSize: '12.5px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    <Box className="w-4 h-4" />
                    <span>3D WC View</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWcSubPage('quote')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '7px 14px',
                      borderRadius: '7px',
                      border: 'none',
                      background: wcSubPage === 'quote' ? '#0ea5e9' : 'transparent',
                      color: wcSubPage === 'quote' ? '#ffffff' : '#94a3b8',
                      fontSize: '12.5px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    <Droplets className="w-4 h-4" />
                    <span>WC Quote</span>
                    {!isPremium && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setWcSubPage((prev) => (prev === 'view' ? 'quote' : 'view'))}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '8px',
                    border: '1px solid #334155',
                    background: '#1e293b',
                    color: '#38bdf8',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {wcSubPage === 'view' ? 'View Quote →' : '← 3D WC View'}
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12.5px', color: '#94a3b8' }}>
                <span>
                  Floors: <strong style={{ color: '#e2e8f0' }}>{wcMaterials.analysis.floors}F</strong>
                </span>
                <span>
                  Drops: <strong style={{ color: '#38bdf8' }}>{wcMaterials.analysis.dropCount}</strong>
                </span>
                <span>
                  Gutter Run: <strong style={{ color: '#38bdf8' }}>{wcMaterials.analysis.activeGutterM}m</strong>
                </span>
                <span style={{ fontSize: '14px', fontWeight: 800, color: isPremium ? '#38bdf8' : '#fbbf24' }}>
                  {isPremium ? formatCurrency(wcMaterials.summary.grandTotal, currencyCode) : 'PRO ONLY'}
                </span>
              </div>
            </div>

            {/* SUB-PAGE 1: FULL-AREA 3D WC VIEW + CONTROLS */}
            {wcSubPage === 'view' && (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div className="studio-canvas-pane" style={{ flex: 1, minHeight: 0, height: 'auto' }}>
                  <Roof3DViewer
                    geometry={geometry}
                    roofType={roofType}
                    extensions={extensions}
                    buildingStage={buildingStage}
                    parapetConfig={parapetConfig}
                    woodworkConfig={woodworkConfig}
                    selectedMaterial={selectedMaterial}
                    polygonVertices={polygonVertices}
                    wcConfig={{ ...(wcConfig || {}), enabled: true }}
                    forcedDisplayMode="finished"
                  />
                </div>

                {/* Bottom Controls Bar: Floors, Add Drop Points, Detected Corners */}
                <div
                  style={{
                    flexShrink: 0,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(200px, 1fr)) auto',
                    gap: '10px',
                    alignItems: 'center',
                  }}
                >
                  {/* Floors Question */}
                  <div
                    style={{
                      background: 'rgba(15, 23, 42, 0.85)',
                      border: '1px solid #334155',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>How many floors?</div>
                      <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                        {wcMaterials.analysis.dropHeightM}m/drop ({wcMaterials.analysis.totalDropM}m total)
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setWcConfig && setWcConfig((p) => ({ ...p, floors: Math.max(1, (p?.floors || 1) - 1) }))}
                        style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#1e293b', color: '#f8fafc', border: '1px solid #475569', fontWeight: 800, cursor: 'pointer' }}
                      >
                        −
                      </button>
                      <span style={{ fontSize: '14px', fontWeight: 800, color: '#38bdf8', minWidth: '58px', textAlign: 'center' }}>
                        {wcConfig?.floors || 1} {(wcConfig?.floors || 1) === 1 ? 'Floor' : 'Floors'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setWcConfig && setWcConfig((p) => ({ ...p, floors: Math.min(8, (p?.floors || 1) + 1) }))}
                        style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#1e293b', color: '#f8fafc', border: '1px solid #475569', fontWeight: 800, cursor: 'pointer' }}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Drop Points Control */}
                  <div
                    style={{
                      background: 'rgba(15, 23, 42, 0.85)',
                      border: '1px solid #334155',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>Drop Points</div>
                      <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                        {wcMaterials.analysis.autoDropCount} auto
                        {wcMaterials.analysis.extraDrops > 0 ? ` + ${wcMaterials.analysis.extraDrops} added` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        disabled={(wcConfig?.extraDrops || 0) <= 0}
                        onClick={() =>
                          setWcConfig &&
                          setWcConfig((p) => ({ ...p, extraDrops: Math.max(0, (p?.extraDrops || 0) - 1) }))
                        }
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          background: '#1e293b',
                          color: (wcConfig?.extraDrops || 0) <= 0 ? '#475569' : '#f8fafc',
                          border: '1px solid #475569',
                          fontWeight: 800,
                          cursor: (wcConfig?.extraDrops || 0) <= 0 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        −
                      </button>
                      <span style={{ fontSize: '14px', fontWeight: 800, color: '#38bdf8' }}>
                        {wcMaterials.analysis.dropCount}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setWcConfig &&
                          setWcConfig((p) => ({ ...p, extraDrops: Math.min(24, (p?.extraDrops || 0) + 1) }))
                        }
                        style={{
                          padding: '5px 10px',
                          borderRadius: '6px',
                          background: 'rgba(14, 165, 233, 0.16)',
                          color: '#38bdf8',
                          border: '1px solid rgba(56, 189, 248, 0.45)',
                          fontSize: '11.5px',
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        + Add Drop
                      </button>
                    </div>
                  </div>

                  {/* Building Design Corners */}
                  <div
                    style={{
                      background: 'rgba(15, 23, 42, 0.85)',
                      border: '1px solid #334155',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>Corners from Design</div>
                      <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                        Auto-detected from {roofType} walls
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '12.5px', fontWeight: 800 }}>
                      <span style={{ color: '#22d3ee' }}>90°: {wcMaterials.analysis.angle90Count}</span>
                      <span style={{ color: '#34d399' }}>135°: {wcMaterials.analysis.angle135Count}</span>
                      <span style={{ color: '#fbbf24' }}>45°: {wcMaterials.analysis.angle45Count}</span>
                    </div>
                  </div>

                  {/* Quick Jump to WC Quote */}
                  <button
                    type="button"
                    className="studio-boq-cta"
                    onClick={() => setWcSubPage('quote')}
                    style={{ height: '100%', padding: '0 16px' }}
                  >
                    <span>Open WC Quote</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* SUB-PAGE 2: FULL-AREA WC QUOTATION TABLE & EXPORT */}
            {wcSubPage === 'quote' && !isPremium && (
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '20px',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    maxWidth: '520px',
                    background: 'linear-gradient(145deg, rgba(14, 165, 233, 0.14), rgba(15, 23, 42, 0.96))',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    borderRadius: '16px',
                    padding: '28px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    gap: '12px',
                    boxShadow: '0 20px 50px rgba(2, 6, 23, 0.55)',
                  }}
                >
                  <div
                    style={{
                      width: '54px',
                      height: '54px',
                      borderRadius: '50%',
                      background: 'rgba(245, 158, 11, 0.18)',
                      border: '1px solid rgba(245, 158, 11, 0.45)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fbbf24',
                    }}
                  >
                    <Lock className="w-6 h-6" />
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc' }}>
                    Water Collector (WC) Quote is Pro
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1', lineHeight: 1.55 }}>
                    Upgrade to Pro to unlock full rain gutter schedules, corner miters, downspout pipe lengths, installation labour rates, and PDF/clipboard quote exports.
                  </p>

                  {/* Preview Summary of Detected Geometry */}
                  <div
                    style={{
                      width: '100%',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '8px',
                      background: 'rgba(2, 6, 23, 0.55)',
                      border: '1px solid #1e293b',
                      borderRadius: '10px',
                      padding: '10px 12px',
                      fontSize: '12px',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>Floors</div>
                      <div style={{ fontWeight: 800, color: '#e2e8f0' }}>{wcMaterials.analysis.floors}F</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>Drop Points</div>
                      <div style={{ fontWeight: 800, color: '#38bdf8' }}>{wcMaterials.analysis.dropCount} drops</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>Corners</div>
                      <div style={{ fontWeight: 800, color: '#fbbf24' }}>
                        90°×{wcMaterials.analysis.angle90Count} · 135°×{wcMaterials.analysis.angle135Count} · 45°×{wcMaterials.analysis.angle45Count}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenProModal && onOpenProModal()}
                    style={{
                      marginTop: '4px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                      color: '#0f172a',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '11px 20px',
                      fontSize: '13.5px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    <Crown className="w-4 h-4" />
                    <span>Unlock Water Collector Quote (Pro)</span>
                  </button>
                </div>
              </div>
            )}

            {wcSubPage === 'quote' && isPremium && (
              <div className="studio-boq-scroll" style={{ padding: 0, flex: 1, minHeight: 0 }}>
                <section className="boq-section glass-panel" style={{ background: '#18181c', margin: 0 }}>
                  <div className="boq-header">
                    <div className="boq-title">
                      <Droplets className="w-5 h-5 text-sky-400" />
                      <span>Water Collector (WC) Quotation</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: '#94a3b8', flexWrap: 'wrap' }}>
                      <span>
                        Floors: <strong style={{ color: '#e2e8f0' }}>{wcMaterials.analysis.floors}F</strong>
                      </span>
                      <span>
                        Gutter Run: <strong style={{ color: '#38bdf8' }}>{wcMaterials.analysis.activeGutterM}m</strong>
                      </span>
                      <span>
                        Corners: <strong style={{ color: '#22d3ee' }}>90°×{wcMaterials.analysis.angle90Count}</strong>{' '}
                        <strong style={{ color: '#34d399' }}>135°×{wcMaterials.analysis.angle135Count}</strong>{' '}
                        <strong style={{ color: '#fbbf24' }}>45°×{wcMaterials.analysis.angle45Count}</strong>
                      </span>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span>Drops: <strong style={{ color: '#38bdf8' }}>{wcMaterials.analysis.dropCount}</strong></span>
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
                            color: (wcConfig?.extraDrops || 0) <= 0 ? '#475569' : '#f8fafc',
                            border: '1px solid #475569',
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
                            padding: '3px 8px',
                            borderRadius: '5px',
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
                        {isEditingPrices ? (
                          <button
                            type="button"
                            onClick={handleSaveDesktopPrices}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 11px',
                              borderRadius: '6px',
                              background: '#10b981',
                              color: '#052e16',
                              border: 'none',
                              fontSize: '11.5px',
                              fontWeight: 800,
                              cursor: 'pointer',
                              marginLeft: '6px',
                            }}
                          >
                            <Check size={13} />
                            <span>Save</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setIsEditingPrices(true)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              background: '#1e293b',
                              color: '#38bdf8',
                              border: '1px solid #334155',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              marginLeft: '6px',
                            }}
                          >
                            <Pencil size={11} />
                            <span>Edit Prices</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* WC Table */}
                  <div className="boq-table-wrapper">
                    <table className="boq-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>WC Item &amp; Specification</th>
                          <th>Qty</th>
                          <th>Unit</th>
                          <th>Unit Price ({currencyCode})</th>
                          <th>Total Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {wcMaterials.items.map((item, idx) => (
                          <tr key={item.id}>
                            <td style={{ color: '#64748b' }}>{idx + 1}</td>
                            <td>
                              {isEditingPrices ? (
                                <input
                                  type="text"
                                  aria-label={`Edit WC name for ${item.defaultName || item.name}`}
                                  placeholder={item.defaultName || item.name}
                                  value={
                                    item.isCustom
                                      ? item.name
                                      : customPrices?.__customNames?.[item.id] !== undefined
                                      ? customPrices.__customNames[item.id]
                                      : item.name
                                  }
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (item.isCustom) {
                                      const prevList = Array.isArray(customPrices?.__extraItems)
                                        ? customPrices.__extraItems
                                        : [];
                                      setCustomPrices({
                                        ...(customPrices || {}),
                                        __extraItems: prevList.map((ci) =>
                                          ci.id === item.id ? { ...ci, name: val } : ci
                                        ),
                                      });
                                    } else {
                                      setCustomPrices({
                                        ...(customPrices || {}),
                                        __customNames: {
                                          ...(customPrices?.__customNames || {}),
                                          [item.id]: val,
                                        },
                                      });
                                    }
                                  }}
                                  style={{
                                    width: '100%',
                                    maxWidth: '300px',
                                    background: 'rgba(15, 23, 42, 0.55)',
                                    color: '#f8fafc',
                                    border: '1px solid rgba(51, 65, 85, 0.75)',
                                    borderRadius: '6px',
                                    padding: '3px 8px',
                                    fontSize: '12.5px',
                                    fontWeight: 700,
                                    marginBottom: '2px',
                                  }}
                                />
                              ) : (
                                <div className="boq-item-title">{item.name}</div>
                              )}
                              <div className="boq-item-spec">{item.spec}</div>
                            </td>
                            <td className="boq-qty">{item.quantity.toLocaleString()}</td>
                            <td>{item.unit}</td>
                            <td>
                              {isEditingPrices ? (
                                <input
                                  type="number"
                                  min="0"
                                  className="boq-price-input"
                                  style={{ width: '90px', padding: '4px 8px', fontSize: '12px', background: 'rgba(15, 23, 42, 0.6)' }}
                                  value={customPrices[item.id] !== undefined ? customPrices[item.id] : item.unitPrice}
                                  onChange={(e) => setCustomPrices({ ...customPrices, [item.id]: e.target.value })}
                                />
                              ) : (
                                <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#e2e8f0', fontFamily: 'monospace' }}>
                                  {formatCurrency(item.unitPrice, currencyCode)}
                                </span>
                              )}
                            </td>
                            <td className="boq-price">
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <span>{formatCurrency(item.total, currencyCode)}</span>
                                {item.isCustom && isEditingPrices && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteDesktopCustomRow(item.id)}
                                    title="Remove custom WC row"
                                    style={{
                                      background: 'rgba(239, 68, 68, 0.14)',
                                      color: '#fca5a5',
                                      border: '1px solid rgba(239, 68, 68, 0.35)',
                                      borderRadius: '5px',
                                      padding: '3px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                        {wcMaterials.summary.laborTotal > 0 && (
                          <tr>
                            <td style={{ color: '#64748b' }}>{wcMaterials.items.length + 1}</td>
                            <td>
                              <div className="boq-item-title">WC Installation &amp; Plumbing Labour</div>
                              <div className="boq-item-spec">Gutter hanging, mitering &amp; downspout mounting</div>
                            </td>
                            <td className="boq-qty">—</td>
                            <td>—</td>
                            <td>
                              {isEditingPrices ? (
                                <input
                                  type="number"
                                  min="0"
                                  style={{ width: '90px', padding: '4px 8px', fontSize: '12px', background: 'rgba(15, 23, 42, 0.6)' }}
                                  value={customPrices.wc_labor !== undefined ? customPrices.wc_labor : wcMaterials.summary.laborUnitPrice}
                                  onChange={(e) => setCustomPrices({ ...customPrices, wc_labor: e.target.value })}
                                />
                              ) : (
                                <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#e2e8f0', fontFamily: 'monospace' }}>
                                  {formatCurrency(
                                    customPrices.wc_labor !== undefined && customPrices.wc_labor !== ''
                                      ? Number(customPrices.wc_labor)
                                      : wcMaterials.summary.laborUnitPrice,
                                    currencyCode
                                  )}
                                </span>
                              )}
                            </td>
                            <td className="boq-price">{formatCurrency(wcMaterials.summary.laborTotal, currencyCode)}</td>
                          </tr>
                        )}
                        {wcMaterials.summary.transportTotal > 0 && (
                          <tr>
                            <td style={{ color: '#64748b' }}>{wcMaterials.items.length + (wcMaterials.summary.laborTotal > 0 ? 2 : 1)}</td>
                            <td>
                              <div className="boq-item-title">WC Transport &amp; Delivery</div>
                              <div className="boq-item-spec">Pipe &amp; gutter logistics to site</div>
                            </td>
                            <td className="boq-qty">—</td>
                            <td>—</td>
                            <td>
                              {isEditingPrices ? (
                                <input
                                  type="number"
                                  min="0"
                                  style={{ width: '90px', padding: '4px 8px', fontSize: '12px', background: 'rgba(15, 23, 42, 0.6)' }}
                                  value={customPrices.wc_transport !== undefined ? customPrices.wc_transport : wcMaterials.summary.transportTotal}
                                  onChange={(e) => setCustomPrices({ ...customPrices, wc_transport: e.target.value })}
                                />
                              ) : (
                                <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#e2e8f0', fontFamily: 'monospace' }}>
                                  {formatCurrency(
                                    customPrices.wc_transport !== undefined && customPrices.wc_transport !== ''
                                      ? Number(customPrices.wc_transport)
                                      : wcMaterials.summary.transportTotal,
                                    currencyCode
                                  )}
                                </span>
                              )}
                            </td>
                            <td className="boq-price">{formatCurrency(wcMaterials.summary.transportTotal, currencyCode)}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {isEditingPrices && (
                  <form
                    onSubmit={(e) => handleAddDesktopCustomRow('wc', e)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      flexWrap: 'wrap',
                      padding: '8px 10px',
                      marginBottom: '10px',
                      background: 'rgba(15, 23, 42, 0.55)',
                      border: '1px dashed rgba(56, 189, 248, 0.4)',
                      borderRadius: '8px',
                    }}
                  >
                    <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#38bdf8', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Plus size={14} /> Add WC Material Row:
                    </span>
                    <input
                      type="text"
                      value={newRowName}
                      onChange={(e) => setNewRowName(e.target.value)}
                      placeholder="WC material / item name"
                      style={{ flex: '2 1 180px', padding: '5px 8px', fontSize: '12px', background: '#090e1a' }}
                    />
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={newRowQty}
                      onChange={(e) => setNewRowQty(e.target.value)}
                      placeholder="Qty"
                      style={{ width: '68px', padding: '5px 8px', fontSize: '12px', background: '#090e1a', textAlign: 'center' }}
                    />
                    <input
                      type="text"
                      value={newRowUnit}
                      onChange={(e) => setNewRowUnit(e.target.value)}
                      placeholder="pcs"
                      style={{ width: '74px', padding: '5px 8px', fontSize: '12px', background: '#090e1a', textAlign: 'center' }}
                    />
                    <input
                      type="number"
                      min="0"
                      value={newRowPrice}
                      onChange={(e) => setNewRowPrice(e.target.value)}
                      placeholder={`Unit Price (${currencyCode})`}
                      style={{ width: '125px', padding: '5px 8px', fontSize: '12px', background: '#090e1a', textAlign: 'right' }}
                    />
                    <button
                      type="submit"
                      disabled={!newRowName.trim()}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        background: newRowName.trim() ? '#0ea5e9' : '#1e293b',
                        color: newRowName.trim() ? '#ffffff' : '#64748b',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: newRowName.trim() ? 'pointer' : 'not-allowed',
                      }}
                    >
                      + Add Row
                    </button>
                  </form>
                  )}

                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px' }}>
                <strong>Disclaimer:</strong> Default material prices are generic reference estimates and may not reflect actual local market prices.
              </div>

              <div className="boq-summary-bar">
                    <div className="summary-figures">
                      <div className="figure-item">
                        <span className="figure-label">WC Materials</span>
                        <span className="figure-val">{formatCurrency(wcMaterials.summary.materialsSubtotal, currencyCode)}</span>
                      </div>
                      <div className="figure-item">
                        <span className="figure-label">WC Grand Total</span>
                        <span className="figure-val grand">{formatCurrency(wcMaterials.summary.grandTotal, currencyCode)}</span>
                      </div>
                    </div>
                    <div className="action-buttons-group">
                      <button
                        type="button"
                        className="btn-primary-action"
                        onClick={() => {
                          if (setQuoteScope) setQuoteScope('wc');
                          setQuoteModalOpen(true);
                        }}
                      >
                        <Download className="w-4 h-4" />
                        <span>Download WC PDF</span>
                      </button>
                      <button
                        type="button"
                        className="btn-secondary-action"
                        onClick={handleCopyWcSummary || handleCopySummary}
                      >
                        <Share2 className="w-4 h-4" />
                        <span>{copiedToast ? 'Copied!' : 'Copy WC Quote'}</span>
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            )}
          </div>
        )}

        {mainTab === 'company' && (
          <div className="studio-boq-view" style={{ maxWidth: '760px', margin: '0 auto', width: '100%' }}>
            <section className="boq-section glass-panel" style={{ padding: '20px' }}>
              <div style={{ marginBottom: '14px' }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building2 className="w-5 h-5 text-indigo-400" />
                  <span>Company Info &amp; PDF Branding</span>
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#94a3b8' }}>
                  Configure your company logo and contact details once — applied automatically to every exported Roof, Woodwork, and Water Collector PDF quote.
                </p>
              </div>

              {!isPremium ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    padding: '32px 20px',
                    gap: '12px',
                    background: 'linear-gradient(160deg, rgba(245, 158, 11, 0.12), rgba(15, 23, 42, 0.95))',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    borderRadius: '14px',
                  }}
                >
                  <div
                    style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '50%',
                      background: 'rgba(245, 158, 11, 0.18)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fbbf24',
                    }}
                  >
                    <Lock className="w-6 h-6" />
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#fef3c7' }}>
                    Company Branding &amp; Custom Prices — RoofCalc Pro
                  </div>
                  <p style={{ fontSize: '13px', color: '#cbd5e1', margin: 0, maxWidth: '460px', lineHeight: 1.55 }}>
                    Upgrade to <strong>RoofCalc Pro</strong> to upload your company logo, customize your contractor
                    name, phone &amp; address on exported PDFs, and permanently save your material prices to your account.
                  </p>
                  {onOpenProModal && (
                    <button
                      type="button"
                      onClick={onOpenProModal}
                      style={{
                        marginTop: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                        color: '#0f172a',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '10px 20px',
                        fontSize: '13px',
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      <Crown className="w-4 h-4" />
                      <span>Unlock RoofCalc Pro</span>
                    </button>
                  )}
                </div>
              ) : (
                <CompanyInfoEditor
                  contractorInfo={contractorInfo}
                  setContractorInfo={setContractorInfo}
                  onUploadLogo={onUploadContractorLogo}
                  logoUploadError={logoUploadError}
                  setLogoUploadError={setLogoUploadError}
                  compact={false}
                />
              )}
            </section>
          </div>
        )}
      </main>

      {/* 4. QUIET SUMMARY FOOTER (DESIGN VIEW ONLY) */}
      {mainTab === 'design' && (
        <footer className="studio-footer">
          <div className="studio-footer-stats">
            <span className="studio-stat">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              Roof Area: <strong>{hasActiveDesign ? formatArea(geometry.totalArea, unitSystem) : '—'}</strong>
            </span>
            <span className="studio-stat">
              <Box className="w-3.5 h-3.5 text-amber-400" />
              Ridges &amp; Hips: <strong>{hasActiveDesign ? formatLength(geometry.totalRidge, unitSystem) : '—'}</strong>
            </span>
            <span className="studio-stat">
              Footprint: <strong>{hasActiveDesign ? formatArea(geometry.baseArea, unitSystem) : '—'}</strong>
            </span>
          </div>

          <button
            type="button"
            className="studio-boq-cta"
            onClick={() => setMainTab('boq')}
          >
            <span>
              {hasActiveDesign
                ? `Total: ${formatCurrency(materials.summary.grandTotal, currencyCode)} — View BOQ`
                : 'Draw or Load an Example to View BOQ'}
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </footer>
      )}
    </div>
  );
}
