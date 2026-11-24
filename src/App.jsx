import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Home,
  Ruler,
  Layers,
  Calculator,
  Download,
  FileText,
  Share2,
  Video,
  Plus,
  Trash2,
  RotateCcw,
  Sparkles,
  Info,
  CheckCircle2,
  Sliders,
  DollarSign,
  Box,
  ChevronDown,
  ChevronUp,
  Hammer,
  Shield,
  Camera,
  LayoutGrid,
  Printer,
  Save,
  Undo2,
  Redo2,
  FolderTree,
  Sun,
  Eye,
  Grid,
  Crown,
  LogIn,
  LogOut,
  User,
} from 'lucide-react';
import confetti from 'canvas-confetti';

import {
  ROOF_TYPES,
  PITCH_PRESETS,
  calculateRoofHeight,
  calculateRoofGeometry,
  calculateSlantingHeightFromAngle,
  calculateSlantingHeightFromKingpost,
  calculateVerticalRiseFromSlantingHeight,
  getEffectiveSlopeRun,
} from './utils/roofMath';
import {
  UNIT_SYSTEMS,
  metersToFeet,
  feetToMeters,
  formatLength,
  formatArea,
} from './utils/units';
import {
  CURRENCIES,
  MATERIAL_PROFILES,
  estimateMaterials,
  formatCurrency,
} from './utils/materials';
import { estimateWaterCollector } from './utils/waterCollector';
import {
  BUILDING_STAGES,
  getStageConfig,
  PURLIN_SPACING_PRESETS,
  WOODWORK_ANGLE_PRESETS,
} from './utils/stagePresets';
import { generateQuotePDF } from './utils/pdfGenerator';
import Roof3DViewer from './components/Roof3DViewer';
import Roof2DDiagram from './components/Roof2DDiagram';
import PaperSketchModal from './components/PaperSketchModal';
import ProUpgradeModal from './components/ProUpgradeModal';
import PartnerStatsModal from './components/PartnerStatsModal';
import AdminReferralsModal from './components/AdminReferralsModal';
import InstallAppBanner from './components/InstallAppBanner';
import RevitWorkspace from './components/RevitWorkspace';
import { usePwaInstall } from './utils/pwaInstall';
import {
  isSupabaseConfigured,
  isAdminEmail,
  getStoredAuthSession,
  saveAuthSession,
  syncDevAuthSession,
  getStoredProStatus,
  saveStoredProStatus,
  fetchSupabaseProProfile,
  consumeOAuthCallbackFromUrl,
  captureReferralCodeFromUrl,
  extractPartnerLinkFromUrl,
  hasPendingPaystackCheck,
  verifyPaystackPaymentOnReturn,
  getPreviewProFlag,
  setPreviewProFlag,
  getUserInitials,
  getUserDisplayName,
} from './utils/proSession';
import './App.css';

const ACTIVE_DESIGN_STORAGE_KEY = 'roofcalc_active_design_v1';

function readStoredActiveDesign() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(ACTIVE_DESIGN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function App() {
  // Global Units & Currency
  const [unitSystem, setUnitSystem] = useState(UNIT_SYSTEMS.METRIC);
  const [currencyCode, setCurrencyCode] = useState('NGN');

  // Pro Account / AI Subscription State (shared across AI Sketch Scan & Woodwork Quotes)
  const [proModalOpen, setProModalOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const pwaInstall = usePwaInstall();
  const [proAuthError, setProAuthError] = useState('');
  const [paymentToast, setPaymentToast] = useState('');
  const [partnerParams, setPartnerParams] = useState(() => extractPartnerLinkFromUrl());
  const [classicProfileMenuOpen, setClassicProfileMenuOpen] = useState(false);
  const classicProfileMenuRef = useRef(null);
  const [proSession, setProSession] = useState(() => getStoredAuthSession());
  const [proQuota, setProQuota] = useState(() => getStoredProStatus()?.quota || null);
  const [isPremium, setIsPremium] = useState(() =>
    isSupabaseConfigured()
      ? Boolean(getStoredProStatus()?.isPro || isAdminEmail(getStoredAuthSession()?.user?.email))
      : getPreviewProFlag()
  );
  const isAdminUser = isAdminEmail(proSession?.user?.email);
  const effectiveIsPremium = Boolean(isPremium || isAdminUser);

  const showPaymentSuccessToast = (message) => {
    setPaymentToast(message);
    setTimeout(() => {
      setPaymentToast((curr) => (curr === message ? '' : curr));
    }, 6000);
  };

  useEffect(() => {
    if (!classicProfileMenuOpen) return;
    const onOutside = (e) => {
      if (classicProfileMenuRef.current && !classicProfileMenuRef.current.contains(e.target)) {
        setClassicProfileMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onOutside);
    window.addEventListener('touchstart', onOutside);
    return () => {
      window.removeEventListener('mousedown', onOutside);
      window.removeEventListener('touchstart', onOutside);
    };
  }, [classicProfileMenuOpen]);

  const syncProAccount = async (sessionOverride) => {
    const activeSession = sessionOverride !== undefined ? sessionOverride : proSession;
    if (!isSupabaseConfigured()) {
      setIsPremium(getPreviewProFlag());
      return;
    }
    if (!activeSession?.access_token) {
      setIsPremium(false);
      setProQuota(null);
      return;
    }
    const status = await fetchSupabaseProProfile(activeSession);
    if (!status.sessionValid) {
      setProSession(null);
      setIsPremium(false);
      setProQuota(null);
      return;
    }
    const verifiedSession = status.session || activeSession;
    let finalStatus = status;
    if (!status.isPro || hasPendingPaystackCheck()) {
      const paymentCheck = await verifyPaystackPaymentOnReturn(verifiedSession.access_token);
      if (paymentCheck.verified) {
        finalStatus = await fetchSupabaseProProfile(verifiedSession);
        if (paymentCheck.purchaseType === 'scan_topup' && paymentCheck.scansAdded > 0) {
          confetti({ particleCount: 75, spread: 65, origin: { y: 0.6 } });
          showPaymentSuccessToast(`+${paymentCheck.scansAdded} AI scan credits added to your account!`);
        } else if (finalStatus.isPro) {
          confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
          showPaymentSuccessToast('RoofCalc Pro is now active!');
        }
      }
    }
    if (finalStatus.session && finalStatus.session !== activeSession) {
      setProSession(finalStatus.session);
    }
    setIsPremium(finalStatus.isPro);
    setProQuota(finalStatus.quota);
  };

  useEffect(() => {
    if (!isSupabaseConfigured() || !proSession?.access_token) return;
    let cancelled = false;
    (async () => {
      const initialStatus = await fetchSupabaseProProfile(proSession);
      if (cancelled) return;
      if (!initialStatus.sessionValid) {
        setProSession(null);
        setIsPremium(false);
        setProQuota(null);
        return;
      }

      const activeSession = initialStatus.session || proSession;
      const shouldVerifyPaystack = !initialStatus.isPro || hasPendingPaystackCheck();
      const paymentCheck = shouldVerifyPaystack
        ? await verifyPaystackPaymentOnReturn(activeSession.access_token)
        : { checked: false, verified: false, fromUrl: false, error: '', purchaseType: null, scansAdded: 0 };
      if (cancelled) return;

      const finalStatus = paymentCheck.verified
        ? await fetchSupabaseProProfile(activeSession)
        : initialStatus;
      if (cancelled) return;

      if (finalStatus.session && finalStatus.session !== proSession) {
        setProSession(finalStatus.session);
      }
      setIsPremium(finalStatus.isPro);
      setProQuota(finalStatus.quota);
      syncDevAuthSession(finalStatus.session || activeSession);

      if (paymentCheck.verified) {
        if (paymentCheck.purchaseType === 'scan_topup' && paymentCheck.scansAdded > 0) {
          confetti({ particleCount: 75, spread: 65, origin: { y: 0.6 } });
          showPaymentSuccessToast(`+${paymentCheck.scansAdded} AI scan credits added to your account!`);
        } else if (finalStatus.isPro) {
          confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
          showPaymentSuccessToast('RoofCalc Pro is now active!');
        }
      } else if (!paymentCheck.verified && paymentCheck.fromUrl && paymentCheck.error) {
        setProAuthError(paymentCheck.error);
        setProModalOpen(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [proSession]);

  const handleTogglePreviewPro = (enabled) => {
    setPreviewProFlag(enabled);
    setIsPremium(Boolean(enabled));
  };

  const handleProSignOut = () => {
    saveAuthSession(null);
    saveStoredProStatus(null);
    setPreviewProFlag(false);
    setAdminModalOpen(false);
    setProSession(null);
    setIsPremium(false);
    setProQuota(null);
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('roofcalc_pending_paystack_ref_v1');
        window.sessionStorage.removeItem('roofcalc_active_sketch_modal_v1');
        window.google?.accounts?.id?.disableAutoSelect?.();
      }
    } catch {
      // Ignore storage errors
    }
  };

  // Top Workspace Ribbons Navigation ('studio' | 'specs' | 'boq' | 'dashboard')
  const [activeRibbon, setActiveRibbon] = useState('studio');

  // ==========================================
  // Sijitek CAD Studio States
  // ==========================================
  const [layoutMode, setLayoutMode] = useState('revit'); // 'revit' | 'classic'
  const [revitTab, setRevitTab] = useState('architecture'); // 'architecture' | 'structure' | 'annotate' | 'view' | 'manage' | 'schedules'
  const [dockTab, setDockTab] = useState('properties'); // 'properties' | 'browser'
  const [docView, setDocView] = useState('split'); // 'split' | '2d' | '3d' | 'schedule'
  const [propGroupsOpen, setPropGroupsOpen] = useState({
    constraints: true,
    dimensions: true,
    slopes: true,
    materials: true,
  });
  const [scaleRatio, setScaleRatio] = useState('1:100');
  const [thinLines, setThinLines] = useState(false);

  // ==========================================
  // On-Site Building Stage State
  // ==========================================
  const [buildingStage, setBuildingStage] = useState(() => {
    const stg = readStoredActiveDesign()?.buildingStage;
    return stg === 'foundation' || stg === 'parapet' || stg === 'woodwork' ? stg : 'foundation';
  }); // 'foundation' | 'parapet' | 'woodwork'
  const [isCustomizingDefaults, setIsCustomizingDefaults] = useState(false);

  // Parapet Level Config (Stage 2 or added onto Foundation wall sketch)
  const [parapetConfig, setParapetConfig] = useState(() => ({
    enabled: readStoredActiveDesign()?.buildingStage === 'parapet',
    height: 0.42, // stepped outward concrete parapet cornice height
    projection: 0.45, // visual concrete parapet depth
    wallThickness: 0.225, // 9-inch standard block
    style: 'fascia_overhang', // outward-extending concrete parapet; roof rests cleanly on top
    includedInSketch: true, // Parapet level drawing dimensions stay exact (+0m)
    includeCoping: true,
  }));

  // Woodwork Level Config (Stage 3)
  const [woodworkConfig, setWoodworkConfig] = useState(() => ({
    includeTimberBOQ: readStoredActiveDesign()?.buildingStage === 'woodwork',
    trussSpacing: 1.2,
    purlinSpacing: 0.6,
    timberLengthStandard: 3.6,
    includeTreatment: true,
    rafterSize: '2x4',
    tieBeamSize: '2x6',
    purlinSize: '2x3',
  }));
  const [hasSlantingHeight, setHasSlantingHeight] = useState(true); // Ask user if they have Slanting Height (H)
  const [slantingHeightInput, setSlantingHeightInput] = useState(() => {
    const val = readStoredActiveDesign()?.slantingHeightInput;
    return typeof val === 'string' ? val : '';
  }); // Measured H (falls back to angle preset if empty)
  const [woodworkAngle, setWoodworkAngle] = useState(45.0); // Angle preset driving H (defaults to 45° standard)
  const [kingpostOverrideM, setKingpostOverrideM] = useState(() => {
    const kp = readStoredActiveDesign()?.kingpostOverrideM;
    return kp !== undefined && kp !== null && Number.isFinite(Number(kp)) ? Number(kp) : null;
  }); // Direct coupled Kingpost/Slanting height override (in meters)

  // Roof Geometry State (Stored internally in Meters)
  const [roofType, setRoofType] = useState(() => readStoredActiveDesign()?.roofType || 'hip');
  const [length, setLength] = useState(() => Number(readStoredActiveDesign()?.length) || 12.0);
  const [breadth, setBreadth] = useState(() => Number(readStoredActiveDesign()?.breadth) || 8.0);
  const [foundationOverhangM, setFoundationOverhangM] = useState(() => {
    const saved = readStoredActiveDesign();
    if (saved?.buildingStage === 'foundation' && Number.isFinite(Number(saved?.overhang?.front))) {
      return Math.max(0, Number(saved.overhang.front));
    }
    return 0.5;
  });
  const [overhang, setOverhang] = useState(() => {
    const saved = readStoredActiveDesign();
    if (saved?.overhang && typeof saved.overhang === 'object') return saved.overhang;
    if (saved?.buildingStage === 'parapet' || saved?.buildingStage === 'woodwork') {
      return { front: 0, back: 0, left: 0, right: 0 };
    }
    return { front: 0.5, back: 0.5, left: 0.5, right: 0.5 };
  });
  const [isUniformOverhang, setIsUniformOverhang] = useState(true);
  const [hasActiveDesign, setHasActiveDesign] = useState(() =>
    Boolean(readStoredActiveDesign()?.hasActiveDesign)
  );
  const [polygonVertices, setPolygonVertices] = useState(() => {
    const saved = readStoredActiveDesign();
    if (!saved?.hasActiveDesign) return null;
    const pts = saved?.polygonVertices;
    return Array.isArray(pts) && pts.length >= 3 ? pts : null;
  });
  const [sketchUnderlayImage, setSketchUnderlayImage] = useState(null);

  // Pitch Mode & Value
  const [pitchMode, setPitchMode] = useState('ratio'); // 'ratio' | 'angle' | 'height'
  const [pitchRatio, setPitchRatio] = useState(12); // 12:12 standard (45°, Kingpost = Breadth / 2)
  const [pitchAngle, setPitchAngle] = useState(45.0);
  const [heightVal, setHeightVal] = useState(4.0);

  // Waste Allowance (%)
  const [wastePercentage, setWastePercentage] = useState(10);

  // Extensions list
  const [extensions, setExtensions] = useState([]);

  const resetToBlankCanvas = () => {
    setHasActiveDesign(false);
    setPolygonVertices(null);
    setSketchUnderlayImage(null);
    setKingpostOverrideM(null);
    setSlantingHeightInput('');
    setExtensions([]);
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem('roofcalc_inprogress_sketch_v1');
        window.sessionStorage.removeItem(ACTIVE_DESIGN_STORAGE_KEY);
      } catch {
        // Ignore storage errors
      }
    }
  };

  useEffect(() => {
    captureReferralCodeFromUrl();
    if (!isSupabaseConfigured()) return;
    let cancelled = false;
    (async () => {
      const { session, error } = await consumeOAuthCallbackFromUrl();
      if (cancelled) return;
      if (error) {
        setProAuthError(error);
        setProModalOpen(true);
        return;
      }
      if (session?.access_token) {
        setProAuthError('');
        resetToBlankCanvas();
        setProSession(session);
        return;
      }
      const storedSession = getStoredAuthSession();
      const syncedSession = await syncDevAuthSession(storedSession);
      if (
        !cancelled &&
        syncedSession?.access_token &&
        syncedSession.access_token !== storedSession?.access_token
      ) {
        setProSession(syncedSession);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSetPolygonVertices = (pts) => {
    setPolygonVertices(pts);
    if (Array.isArray(pts) && pts.length >= 3) {
      setHasActiveDesign(true);
    }
  };

  const handleActivateRectangle = () => {
    setPolygonVertices(null);
    setHasActiveDesign(true);
  };

  // Materials & Pricing State
  const [selectedMaterial, setSelectedMaterial] = useState('stone_coated');
  const [customPrices, setCustomPrices] = useState(() => {
    if (typeof window === 'undefined') return {};
    try {
      const saved = window.localStorage.getItem('roofcalc_custom_prices_v1');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('roofcalc_custom_prices_v1', JSON.stringify(customPrices || {}));
    } catch {
      // ignore storage quota errors
    }
  }, [customPrices]);

  // UI Modes & Modals
  const [viewerMode, setViewerMode] = useState('split'); // 'split' | '3d' | '2d'
  const [sketchModalOpen, setSketchModalOpen] = useState(false);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [quoteScope, setQuoteScope] = useState('roof'); // 'roof' | 'wc'
  const [wcConfig, setWcConfig] = useState({
    floors: 1,
    extraDrops: 0,
  });
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);

  useEffect(() => {
    const isDev = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);
    if (!isDev || (!sketchModalOpen && !proModalOpen) || proSession?.access_token) return;
    let cancelled = false;
    (async () => {
      const synced = await syncDevAuthSession(null);
      if (cancelled) return;
      const cachedPro = getStoredProStatus();
      if (cachedPro) {
        setIsPremium(Boolean(cachedPro.isPro));
        if (cachedPro.quota) setProQuota(cachedPro.quota);
      }
      if (synced?.access_token) {
        setProSession(synced);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sketchModalOpen, proModalOpen, proSession?.access_token]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (!hasActiveDesign) {
        window.sessionStorage.removeItem(ACTIVE_DESIGN_STORAGE_KEY);
        return;
      }
      window.sessionStorage.setItem(
        ACTIVE_DESIGN_STORAGE_KEY,
        JSON.stringify({
          hasActiveDesign: true,
          roofType,
          length,
          breadth,
          overhang,
          polygonVertices,
          buildingStage,
          kingpostOverrideM,
          slantingHeightInput,
        })
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [
    hasActiveDesign,
    roofType,
    length,
    breadth,
    overhang,
    polygonVertices,
    buildingStage,
    kingpostOverrideM,
    slantingHeightInput,
  ]);

  // Quote Form State
  const [clientInfo, setClientInfo] = useState({
    name: '',
    site: '',
    phone: '',
    email: '',
    quoteNumber: `RF-${Date.now().toString().slice(-5)}`,
  });

  const [contractorInfo, setContractorInfo] = useState({
    name: 'Sijitek Solutions',
    phone: '+234 810 000 0000',
    email: 'info@sijiteksolutions.com',
    address: 'Lagos, Nigeria',
  });

  // Handle stage switching with automatic standard presets
  const handleStageSelect = (stageId) => {
    setBuildingStage(stageId);
    setKingpostOverrideM(null);
    const cfg = getStageConfig(stageId);

    if (stageId === 'foundation') {
      const fOv = Math.max(0, Number(foundationOverhangM) || 0);
      setRoofType(cfg.defaults.roofType);
      setPitchMode(cfg.defaults.pitchMode);
      setPitchRatio(cfg.defaults.pitchRatio);
      setPitchAngle(cfg.defaults.pitchAngle);
      setWoodworkAngle(cfg.defaults.pitchAngle);
      setOverhang({ front: fOv, back: fOv, left: fOv, right: fOv });
      setIsUniformOverhang(true);
      setParapetConfig((prev) => ({ ...prev, enabled: false }));
      setWoodworkConfig((prev) => ({ ...prev, includeTimberBOQ: false }));
    } else if (stageId === 'parapet') {
      setRoofType(cfg.defaults.roofType);
      setPitchMode(cfg.defaults.pitchMode);
      setPitchRatio(cfg.defaults.pitchRatio); // 12:12 full roof laying cleanly on parapet
      setPitchAngle(cfg.defaults.pitchAngle);
      setWoodworkAngle(cfg.defaults.pitchAngle);
      setOverhang({ front: 0, back: 0, left: 0, right: 0 });
      setIsUniformOverhang(true);
      setParapetConfig((prev) => ({
        ...prev,
        enabled: true,
        height: 0.42,
        projection: prev.projection || 0.45,
        style: 'fascia_overhang',
        includedInSketch: true,
      }));
      setWoodworkConfig((prev) => ({ ...prev, includeTimberBOQ: false }));
    } else if (stageId === 'woodwork') {
      setRoofType(cfg.defaults.roofType);
      setPitchMode('angle');
      setPitchAngle(cfg.defaults.pitchAngle);
      setWoodworkAngle(cfg.defaults.pitchAngle);
      setHasSlantingHeight(true);
      setSlantingHeightInput('');
      setOverhang({ front: 0, back: 0, left: 0, right: 0 });
      setIsUniformOverhang(true);
      setParapetConfig((prev) => ({ ...prev, enabled: false }));
      setWoodworkConfig((prev) => ({ ...prev, includeTimberBOQ: true }));
    }
  };

  const handleFoundationOverhangChange = (val) => {
    const parsed = Number(val);
    const clamped = Number.isFinite(parsed) ? Math.round(Math.max(0, Math.min(2.0, parsed)) * 100) / 100 : 0;
    setFoundationOverhangM(clamped);
    setOverhang({ front: clamped, back: clamped, left: clamped, right: clamped });
    setIsUniformOverhang(true);
  };

  // Angle-dependent preset Slanting Height (H) in meters
  const presetSlantingHeight = useMemo(() => {
    return calculateSlantingHeightFromAngle(woodworkAngle, breadth, overhang, roofType, polygonVertices);
  }, [woodworkAngle, breadth, overhang, roofType, polygonVertices]);

  // Parse user-entered measured Slanting Height (H) in meters (null if left blank)
  const parsedSlantingHeightM = useMemo(() => {
    if (!hasSlantingHeight || slantingHeightInput === '' || slantingHeightInput === null) {
      return null;
    }
    const rawNum = Number(slantingHeightInput);
    if (!Number.isFinite(rawNum) || rawNum <= 0) return null;
    return unitSystem === UNIT_SYSTEMS.IMPERIAL ? feetToMeters(rawNum) : rawNum;
  }, [hasSlantingHeight, slantingHeightInput, unitSystem]);

  // Validation & conversion of measured Slanting Height (H) -> vertical rise & angle
  const slantingHeightInfo = useMemo(() => {
    if (parsedSlantingHeightM === null) {
      return {
        ...calculateVerticalRiseFromSlantingHeight(presetSlantingHeight, breadth, overhang, roofType, polygonVertices),
        isUsingPreset: true,
        hasInvalidInput: false,
      };
    }
    const check = calculateVerticalRiseFromSlantingHeight(parsedSlantingHeightM, breadth, overhang, roofType, polygonVertices);
    return {
      ...check,
      isUsingPreset: !check.isValid,
      hasInvalidInput: !check.isValid,
    };
  }, [parsedSlantingHeightM, presetSlantingHeight, breadth, overhang, roofType, polygonVertices]);

  // Calculate actual vertical roof rise (Kingpost Height KP) based on mode & stage
  const effectiveHeight = useMemo(() => {
    if (kingpostOverrideM !== null && Number.isFinite(kingpostOverrideM) && kingpostOverrideM > 0.1) {
      return kingpostOverrideM;
    }
    if (buildingStage === 'woodwork') {
      if (hasSlantingHeight && parsedSlantingHeightM !== null && slantingHeightInfo.isValid) {
        return slantingHeightInfo.verticalRise;
      }
      // If user doesn't have H (or left blank), put the preset dependent on woodworkAngle
      return calculateRoofHeight('angle', woodworkAngle, breadth, roofType, overhang, polygonVertices);
    }
    if (pitchMode === 'ratio') {
      return calculateRoofHeight('ratio', pitchRatio, breadth, roofType, overhang, polygonVertices);
    }
    if (pitchMode === 'angle') {
      return calculateRoofHeight('angle', pitchAngle, breadth, roofType, overhang, polygonVertices);
    }
    return Math.max(0.1, Number(heightVal) || 1.5);
  }, [
    kingpostOverrideM,
    buildingStage,
    hasSlantingHeight,
    parsedSlantingHeightM,
    slantingHeightInfo,
    woodworkAngle,
    pitchMode,
    pitchRatio,
    pitchAngle,
    heightVal,
    breadth,
    roofType,
    overhang,
    polygonVertices,
  ]);

  // Coupled Height Tweakers: Tweak Kingpost Height (KP) or Slanting Height (H) anywhere!
  const currentRunM = useMemo(() => {
    return getEffectiveSlopeRun(breadth, overhang, roofType, polygonVertices);
  }, [breadth, overhang, roofType, polygonVertices]);

  const handleTweakKingpost = (newKpMeters) => {
    const kp = Math.round(Math.max(0.2, Math.min(8.5, Number(newKpMeters) || 0.2)) * 100) / 100;
    setKingpostOverrideM(kp);
    setHeightVal(kp);
    const synced = calculateSlantingHeightFromKingpost(kp, breadth, overhang, roofType, polygonVertices);
    setWoodworkAngle(synced.pitchDegrees);
    setPitchAngle(synced.pitchDegrees);
    if (buildingStage === 'woodwork' && hasSlantingHeight && slantingHeightInput !== '') {
      const dispH =
        unitSystem === UNIT_SYSTEMS.IMPERIAL
          ? metersToFeet(synced.slantingHeight).toFixed(2)
          : synced.slantingHeight.toFixed(2);
      setSlantingHeightInput(dispH);
    }
  };

  const handleTweakPitchAngle = (newAngleDeg) => {
    const deg = Math.round(Math.max(5, Math.min(68, Number(newAngleDeg) || 5)) * 10) / 10;
    setKingpostOverrideM(null);
    setPitchMode('angle');
    setPitchAngle(deg);
    setWoodworkAngle(deg);
    const kp = Math.round(calculateRoofHeight('angle', deg, breadth, roofType, overhang, polygonVertices) * 100) / 100;
    setHeightVal(kp);
    if (buildingStage === 'woodwork' && hasSlantingHeight && slantingHeightInput !== '') {
      const slantM = calculateSlantingHeightFromAngle(deg, breadth, overhang, roofType, polygonVertices);
      const dispH =
        unitSystem === UNIT_SYSTEMS.IMPERIAL
          ? metersToFeet(slantM).toFixed(2)
          : slantM.toFixed(2);
      setSlantingHeightInput(dispH);
    }
  };

  const handleTweakSlantingHeight = (newSlantMeters) => {
    const minValid = currentRunM + 0.05;
    const sM = Math.max(minValid, Math.min(22, Number(newSlantMeters) || minValid));
    const check = calculateVerticalRiseFromSlantingHeight(sM, breadth, overhang, roofType, polygonVertices);
    if (check.isValid) {
      const kp = Math.round(check.verticalRise * 100) / 100;
      setKingpostOverrideM(kp);
      setHeightVal(kp);
      setWoodworkAngle(check.pitchDegrees);
      setPitchAngle(check.pitchDegrees);
      if (buildingStage === 'woodwork' && hasSlantingHeight) {
        const dispH =
          unitSystem === UNIT_SYSTEMS.IMPERIAL
            ? metersToFeet(sM).toFixed(2)
            : (Math.round(sM * 100) / 100).toString();
        setSlantingHeightInput(dispH);
      }
    }
  };

  // Apply converted Paper Sketch -> 2D & Calculations into main workspace
  const handleApplyConvertedSketch = (payload, options = {}) => {
    setHasActiveDesign(true);
    const nextStage = payload.stageId || buildingStage;
    setBuildingStage(nextStage);
    setRoofType(payload.roofType || 'hip');
    setLength(payload.length || 12);
    setBreadth(payload.breadth || 8);
    const stageOv =
      nextStage === 'foundation'
        ? Math.max(0, Number(payload.overhang?.front ?? foundationOverhangM) || 0.5)
        : 0;
    if (nextStage === 'foundation') setFoundationOverhangM(stageOv);
    setOverhang({ front: stageOv, back: stageOv, left: stageOv, right: stageOv });
    setIsUniformOverhang(true);
    setPolygonVertices(payload.polygonVertices || null);
    setExtensions(payload.extensions || []);
    setSketchUnderlayImage(payload.sketchUnderlayImage || null);

    if (nextStage === 'parapet') {
      setParapetConfig((prev) => ({
        ...prev,
        enabled: true,
        height: payload.parapetHeight || 0.42,
        projection: prev.projection || 0.45,
        style: 'fascia_overhang',
        includedInSketch: true,
      }));
      setWoodworkConfig((prev) => ({ ...prev, includeTimberBOQ: false }));
    } else if (nextStage === 'woodwork') {
      setParapetConfig((prev) => ({ ...prev, enabled: false }));
      setWoodworkConfig((prev) => ({ ...prev, includeTimberBOQ: true }));
      setHasSlantingHeight(true);
      const dispH =
        unitSystem === UNIT_SYSTEMS.IMPERIAL
          ? metersToFeet(payload.slantingHeight).toFixed(2)
          : Number(payload.slantingHeight).toFixed(2);
      setSlantingHeightInput(dispH);
    } else {
      setParapetConfig((prev) => ({ ...prev, enabled: false }));
      setWoodworkConfig((prev) => ({ ...prev, includeTimberBOQ: false }));
    }

    setKingpostOverrideM(payload.kingpostHeight);
    setHeightVal(payload.kingpostHeight);
    if (payload.pitchDegrees) {
      setWoodworkAngle(payload.pitchDegrees);
      setPitchAngle(payload.pitchDegrees);
    }
    setViewerMode((prev) => (prev === '3d' ? 'split' : prev));
    if (!options?.silent) {
      confetti({ particleCount: 55, spread: 55, origin: { y: 0.72 } });
    }
  };

  // Main Geometry Results
  const geometry = useMemo(() => {
    return calculateRoofGeometry({
      length,
      breadth,
      height: effectiveHeight,
      overhang,
      roofType,
      wastePercentage,
      extensions,
      polygonVertices,
    });
  }, [length, breadth, effectiveHeight, overhang, roofType, wastePercentage, extensions, polygonVertices]);

  // Bill of Quantities / Materials Results (Stage Aware, Timber BOQ Pro-gated)
  const materials = useMemo(() => {
    return estimateMaterials(
      geometry,
      selectedMaterial,
      currencyCode,
      customPrices,
      {
        buildingStage,
        parapetConfig,
        woodworkConfig,
        allowTimber: effectiveIsPremium,
      }
    );
  }, [geometry, selectedMaterial, currencyCode, customPrices, buildingStage, parapetConfig, woodworkConfig, effectiveIsPremium]);

  // Water Collector (WC) Estimate
  const wcMaterials = useMemo(() => {
    return estimateWaterCollector(geometry, currencyCode, customPrices, {
      roofType,
      polygonVertices,
      wcConfig,
    });
  }, [geometry, currencyCode, customPrices, roofType, polygonVertices, wcConfig]);

  // Active Stage Metadata
  const currentStageConfig = useMemo(() => getStageConfig(buildingStage), [buildingStage]);

  // Extensions Handlers
  const handleAddExtension = () => {
    setExtensions([
      ...extensions,
      { id: Date.now(), length: 3.5, breadth: 2.5, quantity: 1 },
    ]);
  };

  const handleUpdateExtension = (id, field, val) => {
    setExtensions(
      extensions.map((ext) =>
        ext.id === id ? { ...ext, [field]: Number(val) || 0 } : ext
      )
    );
  };

  const handleRemoveExtension = (id) => {
    setExtensions(extensions.filter((ext) => ext.id !== id));
  };

  // Reset Everything to Default
  const handleReset = () => {
    setLength(12.0);
    setBreadth(8.0);
    setOverhang({ front: 0.4, back: 0.4, left: 0.4, right: 0.4 });
    setIsUniformOverhang(true);
    setRoofType('hip');
    setPitchMode('ratio');
    setPitchRatio(6);
    setWastePercentage(10);
    setExtensions([]);
    setCustomPrices({});
    setPolygonVertices(null);
    setKingpostOverrideM(null);
    setSlantingHeightInput('');
    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(ACTIVE_DESIGN_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  };

  // Preset House Dimensions
  const applyPreset = (type, l, b, h) => {
    setHasActiveDesign(true);
    setRoofType(type);
    setLength(l);
    setBreadth(b);
    setPitchMode('height');
    setHeightVal(h);
    setKingpostOverrideM(null);
    const run = type === 'shed' ? b + 0.8 : (b + 0.8) / 2;
    const deg = Math.round(((Math.atan(h / run) * 180) / Math.PI) * 10) / 10;
    setWoodworkAngle(deg);
    setSlantingHeightInput('');
    setPolygonVertices(null);
  };

  // Unit conversions for display
  const displayLength = unitSystem === UNIT_SYSTEMS.IMPERIAL ? metersToFeet(length).toFixed(1) : length;
  const displayBreadth = unitSystem === UNIT_SYSTEMS.IMPERIAL ? metersToFeet(breadth).toFixed(1) : breadth;
  const displayOverhang = unitSystem === UNIT_SYSTEMS.IMPERIAL ? metersToFeet(overhang).toFixed(1) : overhang;

  const handleLengthChange = (val) => {
    const num = Number(val) || 0;
    setHasActiveDesign(true);
    setLength(unitSystem === UNIT_SYSTEMS.IMPERIAL ? feetToMeters(num) : num);
  };

  const handleBreadthChange = (val) => {
    const num = Number(val) || 0;
    setHasActiveDesign(true);
    setBreadth(unitSystem === UNIT_SYSTEMS.IMPERIAL ? feetToMeters(num) : num);
  };

  const handleOverhangChange = (val) => {
    const num = Number(val) || 0;
    setOverhang(unitSystem === UNIT_SYSTEMS.IMPERIAL ? feetToMeters(num) : num);
  };

  // Export CSV
  const handleExportCSV = () => {
    const rows = [
      ['ROOF ESTIMATE & BILL OF QUANTITIES'],
      ['Roof Type', geometry.roofType.toUpperCase()],
      ['Building Length', `${geometry.buildingDimensions.length} m`],
      ['Building Breadth', `${geometry.buildingDimensions.breadth} m`],
      ['Slanting Height (H)', `${geometry.rafterLength} m`],
      ['Kingpost Height (KP)', `${geometry.roofHeight} m`],
      ['Pitch Angle', `${geometry.pitchDegrees}°`],
      [
        'Eave Overhang',
        `${geometry.buildingDimensions.overhang.front} m (F) / ${geometry.buildingDimensions.overhang.back} m (B) / ${geometry.buildingDimensions.overhang.left} m (L) / ${geometry.buildingDimensions.overhang.right} m (R)`,
      ],
      ['Base Roof Area', `${geometry.baseArea} m²`],
      ['Wastage Allowance', `${geometry.wastePercentage}%`],
      ['Total Area with Waste', `${geometry.totalArea} m²`],
      ['Total Ridge / Hips Length', `${geometry.totalRidge} m`],
      ['Total Gutters Length', `${geometry.totalGutter} m`],
      [],
      ['BILL OF QUANTITIES'],
      ['Item', 'Specification', 'Quantity', 'Unit', 'Unit Price', 'Total Cost'],
      ...materials.items.map((i) => [
        i.name,
        i.spec,
        i.quantity,
        i.unit,
        i.unitPrice,
        i.total,
      ]),
      ['Labor & Installation', 'Per m²', geometry.totalArea, 'm²', '-', materials.summary.laborTotal],
      [],
      ['Materials Subtotal', '', '', '', '', materials.summary.materialsSubtotal],
      ['Labor Total', '', '', '', '', materials.summary.laborTotal],
      ['GRAND TOTAL', '', '', '', '', materials.summary.grandTotal],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Roof_Estimate_${geometry.roofType}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copy Summary to Clipboard
  const handleCopySummary = () => {
    const text = `🏠 ROOF ESTIMATE SUMMARY (${geometry.roofType.toUpperCase()})
• Building Dimensions: ${formatLength(length, unitSystem)} × ${formatLength(breadth, unitSystem)}
• Slanting Height (H): ${formatLength(geometry.rafterLength, unitSystem)} | Kingpost (KP): ${formatLength(geometry.roofHeight, unitSystem)} (${geometry.pitchDegrees}° pitch)
• Total Roof Area: ${formatArea(geometry.totalArea, unitSystem)} (incl. ${geometry.wastePercentage}% waste)
• Total Ridge Length: ${formatLength(geometry.totalRidge, unitSystem)}
• Total Gutter Length: ${formatLength(geometry.totalGutter, unitSystem)}
• Selected Covering: ${materials.profile.name}
• Estimated Grand Total: ${formatCurrency(materials.summary.grandTotal, currencyCode)}

Generated by Sijitek Solutions • RoofCalc Pro`;

    navigator.clipboard.writeText(text);
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 3000);
  };

  const handleCopyWcSummary = () => {
    const a = wcMaterials?.analysis || {};
    const text = `💧 WATER COLLECTOR (WC) ESTIMATE (${geometry.roofType.toUpperCase()})
• Floors: ${a.floors || 1} (${a.dropHeightM || 3.2} m/drop)
• Collector Gutter Run: ${a.activeGutterM || 0} m | Drop Points: ${a.dropCount || 0}
• Corners from Design: 90° (${a.angle90Count || 0}), 135° (${a.angle135Count || 0}), 45° (${a.angle45Count || 0})
• Drop Pipe Length: ${a.totalDropM || 0} m | Elbows: ${a.totalElbows || 0} pcs (${a.elbowsPerDrop || 2}/drop)
• Estimated WC Total: ${formatCurrency(wcMaterials?.summary?.grandTotal || 0, currencyCode)}

Generated by Sijitek Solutions • RoofCalc Pro`;

    navigator.clipboard.writeText(text);
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 3000);
  };

  // Download PDF with Confetti celebration
  const handleDownloadPDF = async () => {
    if (quoteScope === 'wc' && !effectiveIsPremium) {
      setQuoteModalOpen(false);
      setProModalOpen(true);
      return;
    }
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.7 },
    });
    const activeQuoteMaterials = quoteScope === 'wc' ? wcMaterials : materials;
    await generateQuotePDF({
      geometry,
      materials: activeQuoteMaterials,
      clientInfo,
      contractorInfo,
      unitSystem,
    });
    setQuoteModalOpen(false);
  };


  // -------------------------------------------------------------
  // Reusable Sub-Sections for Top Ribbons & Workspaces
  // -------------------------------------------------------------
  const stageSelectorSection = (
    <div className="stage-selector-container">
      <div className="section-title" style={{ marginBottom: 0 }}>
        <Layers className="w-4 h-4 text-emerald-400" />
        <span>On-Site Building Stage</span>
      </div>
      <p className="stage-selector-hint">
        Select what stage the building is currently at on site:
      </p>

      <div className="stage-cards-grid">
        {BUILDING_STAGES.map((stg) => {
          const isSelected = buildingStage === stg.id;
          return (
            <button
              key={stg.id}
              type="button"
              className={`stage-card ${isSelected ? 'active' : ''}`}
              style={{
                borderColor: isSelected ? stg.color : undefined,
                backgroundColor: isSelected ? stg.bgLight : undefined,
              }}
              onClick={() => handleStageSelect(stg.id)}
            >
              <div className="stage-card-top">
                <span
                  className="stage-badge-pill"
                  style={{ color: stg.color, backgroundColor: stg.bgLight }}
                >
                  {stg.badge}
                </span>
                {isSelected && <CheckCircle2 className="w-4 h-4" style={{ color: stg.color }} />}
              </div>
              <span className="stage-card-title">{stg.name}</span>
              <span className="stage-card-tagline">{stg.tagline}</span>
            </button>
          );
        })}
      </div>

      {/* Active Stage Information & Presets Banner */}
      <div className="stage-info-banner" style={{ borderLeftColor: currentStageConfig.color }}>
        <div className="stage-info-header">
          <span className="stage-info-title">
            {currentStageConfig.badge} Active
          </span>
          <span className="stage-preset-tag">Smart Presets Applied</span>
        </div>
        <p className="stage-info-text">{currentStageConfig.summary}</p>
        <div className="stage-preset-details">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>{currentStageConfig.presetNotice}</span>
        </div>
      </div>

      {/* Paper Sketch Upload Quick Launch Card */}
      <button
        type="button"
        className="sidebar-paper-cta"
        onClick={() => setSketchModalOpen(true)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Camera className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>
              Have a Labeled Paper Sketch?
            </div>
            <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>
              Upload photo → Auto-convert to 2D & tweak Kingpost / Slanting H
            </div>
          </div>
        </div>
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#34d399', whiteSpace: 'nowrap' }}>
          Upload →
        </span>
      </button>
    </div>
  );

  const dimensionsSection = (
    <div>
      <div className="section-title">
        <Ruler className="w-4 h-4" />
        <span>1. Building Dimensions & Footprint</span>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">
            Length <span className="unit">({unitSystem === UNIT_SYSTEMS.METRIC ? 'm' : 'ft'})</span>
          </label>
          <div className="input-with-adornment">
            <input
              type="number"
              min="1"
              step="0.1"
              value={displayLength}
              onChange={(e) => handleLengthChange(e.target.value)}
            />
            <span className="input-adornment">{unitSystem === UNIT_SYSTEMS.METRIC ? 'm' : 'ft'}</span>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">
            Breadth <span className="unit">({unitSystem === UNIT_SYSTEMS.METRIC ? 'm' : 'ft'})</span>
          </label>
          <div className="input-with-adornment">
            <input
              type="number"
              min="1"
              step="0.1"
              value={displayBreadth}
              onChange={(e) => handleBreadthChange(e.target.value)}
            />
            <span className="input-adornment">{unitSystem === UNIT_SYSTEMS.METRIC ? 'm' : 'ft'}</span>
          </div>
        </div>
      </div>

      {/* Overhang Inputs: Auto-zero if sketch already includes outer parapet */}
      {(buildingStage === 'parapet' || parapetConfig.enabled) && parapetConfig.includedInSketch ? (
        <div
          style={{
            background: 'rgba(6, 182, 212, 0.08)',
            border: '1px dashed rgba(6, 182, 212, 0.4)',
            borderRadius: 'var(--radius-sm)',
            padding: '8px 12px',
            fontSize: '11px',
            color: '#94a3b8',
            marginTop: '4px',
          }}
        >
          <strong style={{ color: '#67e8f9' }}>Parapet Included in Sketch:</strong> Extra overhang set to 0m so parapet is not double-counted; roof rests directly on outer parapet.
        </div>
      ) : (
        <div className="form-group" style={{ marginTop: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <label className="form-label" style={{ margin: 0 }}>
              Eave Overhangs & Porches
            </label>
            <button
              type="button"
              onClick={() => setIsUniformOverhang(!isUniformOverhang)}
              style={{ background: 'transparent', fontSize: '11px', color: '#10b981', fontWeight: 600 }}
            >
              {isUniformOverhang ? '📐 Custom Porch / Sides' : '🔒 All Equal'}
            </button>
          </div>

          {isUniformOverhang ? (
            <div className="input-with-adornment">
              <input
                type="number"
                min="0"
                step="0.05"
                value={overhang.front}
                onChange={(e) => {
                  const v = Math.max(0, Number(e.target.value) || 0);
                  setOverhang({ front: v, back: v, left: v, right: v });
                }}
              />
              <span className="input-adornment">{unitSystem === UNIT_SYSTEMS.METRIC ? 'm' : 'ft'}</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '10px' }}>Front Porch (m)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={overhang.front}
                    onChange={(e) => setOverhang({ ...overhang, front: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '10px' }}>Rear Eave (m)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={overhang.back}
                    onChange={(e) => setOverhang({ ...overhang, back: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </div>
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '10px' }}>Left (Carport)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={overhang.left}
                    onChange={(e) => setOverhang({ ...overhang, left: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '10px' }}>Right Eave (m)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={overhang.right}
                    onChange={(e) => setOverhang({ ...overhang, right: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>

  );

  const stageSpecificsSection = (
    <>
      {buildingStage === 'parapet' && (
        <div className="stage-feature-card">
          <div className="stage-feature-card-header">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#06b6d4' }}>
              <Shield className="w-4 h-4" />
              <span>2. Parapet & Gutter Specifications</span>
            </span>
            <span className="stage-preset-tag">Stage Required</span>
          </div>

          {/* Parapet Wall Height */}
          <div className="form-group">
            <label className="form-label">
              Parapet Wall Height <span>{parapetConfig.height}m</span>
            </label>
            <div className="input-with-adornment">
              <input
                type="number"
                min="0.3"
                max="2.5"
                step="0.1"
                value={parapetConfig.height}
                onChange={(e) =>
                  setParapetConfig({ ...parapetConfig, height: Math.max(0.2, Number(e.target.value) || 0.9) })
                }
              />
              <span className="input-adornment">m</span>
            </div>
            {/* Quick Chips */}
            <div className="chip-group">
              <button
                type="button"
                className={`chip-btn ${parapetConfig.height === 0.6 ? 'active' : ''}`}
                onClick={() => setParapetConfig({ ...parapetConfig, height: 0.6 })}
              >
                0.6m (2ft / 3 blocks)
              </button>
              <button
                type="button"
                className={`chip-btn ${parapetConfig.height === 0.9 ? 'active' : ''}`}
                onClick={() => setParapetConfig({ ...parapetConfig, height: 0.9 })}
              >
                0.9m (3ft - Standard)
              </button>
              <button
                type="button"
                className={`chip-btn ${parapetConfig.height === 1.2 ? 'active' : ''}`}
                onClick={() => setParapetConfig({ ...parapetConfig, height: 1.2 })}
              >
                1.2m (4ft / 5 blocks)
              </button>
            </div>
          </div>

          {/* Does Original Sketch Already Include Parapet? */}
          <div className="form-group">
            <label className="form-label">Original Sketch Source</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button
                type="button"
                className={`roof-type-card ${!parapetConfig.includedInSketch ? 'active' : ''}`}
                style={{ padding: '8px 12px' }}
                onClick={() => {
                  const proj = parapetConfig.projection || 0.45;
                  setParapetConfig({ ...parapetConfig, style: 'fascia_overhang', includedInSketch: false });
                  setOverhang({ front: proj, back: proj, left: proj, right: proj });
                  setIsUniformOverhang(true);
                }}
              >
                <div className="roof-card-header">
                  <span className="roof-card-title" style={{ fontSize: '12px' }}>
                    Wall / Foundation Sketch (Add Outward Parapet)
                  </span>
                  {!parapetConfig.includedInSketch && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />}
                </div>
                <span className="roof-card-desc" style={{ fontSize: '10.5px' }}>
                  Sketch shows walls only — adds +{parapetConfig.projection || 0.45}m outward parapet onto roof edge.
                </span>
              </button>
              <button
                type="button"
                className={`roof-type-card ${parapetConfig.includedInSketch ? 'active' : ''}`}
                style={{ padding: '8px 12px' }}
                onClick={() => {
                  setParapetConfig({ ...parapetConfig, style: 'fascia_overhang', includedInSketch: true });
                  setOverhang({ front: 0, back: 0, left: 0, right: 0 });
                  setIsUniformOverhang(true);
                }}
              >
                <div className="roof-card-header">
                  <span className="roof-card-title" style={{ fontSize: '12px' }}>
                    Sketch Already Includes Parapet
                  </span>
                  {parapetConfig.includedInSketch && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />}
                </div>
                <span className="roof-card-desc" style={{ fontSize: '10.5px' }}>
                  Measured outer parapet to outer parapet (+0m added; roof rests directly on sketch boundary).
                </span>
              </button>
            </div>
          </div>

          {/* Wall Thickness & Accessories */}
          <div className="form-row" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '10px' }}>Wall Thickness</label>
              <select
                value={parapetConfig.wallThickness}
                onChange={(e) => setParapetConfig({ ...parapetConfig, wallThickness: Number(e.target.value) })}
                style={{ fontSize: '11px' }}
              >
                <option value={0.225}>9" (225mm) Standard</option>
                <option value={0.15}>6" (150mm) Partition</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontSize: '10px' }}>Top Wall Coping</label>
              <button
                type="button"
                onClick={() => setParapetConfig({ ...parapetConfig, includeCoping: !parapetConfig.includeCoping })}
                className={`pill-btn ${parapetConfig.includeCoping ? 'active' : ''}`}
                style={{ width: '100%', justifyContent: 'center', height: '32px', fontSize: '11px' }}
              >
                {parapetConfig.includeCoping ? '✓ Coping Included' : 'No Coping'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- STAGE 3: WOODWORK SPECIFIC INPUTS --- */}
      {buildingStage === 'woodwork' && (
        <div className="stage-feature-card">
          <div className="stage-feature-card-header">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b' }}>
              <Hammer className="w-4 h-4" />
              <span>2. Slanting Height (H) & Woodwork</span>
            </span>
            <span className="stage-preset-tag">Stage Required</span>
          </div>

          {/* Prompt: Do you have Slanting Height (H) already? */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#f8fafc', marginBottom: '3px' }}>
              Do you have your Slanting Height (H) already?
            </div>
            <div style={{ fontSize: '10.5px', color: '#94a3b8', marginBottom: '8px' }}>
              <strong>H</strong> = sloped distance from top ridge down to the outer eave edge.
            </div>
            <div className="sub-tabs">
              <button
                type="button"
                className={`sub-tab-btn ${hasSlantingHeight ? 'active' : ''}`}
                onClick={() => setHasSlantingHeight(true)}
              >
                📏 Yes, Enter H
              </button>
              <button
                type="button"
                className={`sub-tab-btn ${!hasSlantingHeight ? 'active' : ''}`}
                onClick={() => setHasSlantingHeight(false)}
              >
                📐 No, Use Angle Preset
              </button>
            </div>
          </div>

          {hasSlantingHeight ? (
            <div className="form-group">
              <label className="form-label">
                <span>Measured Slanting Height (H)</span>
                <span style={{ color: '#f59e0b', fontWeight: 700 }}>
                  H = {formatLength(geometry.rafterLength, unitSystem)} ({geometry.pitchDegrees}°)
                </span>
              </label>
              <div className="input-with-adornment">
                <input
                  type="number"
                  min={
                    unitSystem === UNIT_SYSTEMS.IMPERIAL
                      ? metersToFeet(slantingHeightInfo.minSlantingHeight).toFixed(2)
                      : slantingHeightInfo.minSlantingHeight
                  }
                  step="0.05"
                  placeholder={`Preset: ${unitSystem === UNIT_SYSTEMS.IMPERIAL
                    ? metersToFeet(presetSlantingHeight).toFixed(2)
                    : presetSlantingHeight
                    } (at ${woodworkAngle}°)`}
                  value={slantingHeightInput}
                  onChange={(e) => {
                    setKingpostOverrideM(null);
                    setSlantingHeightInput(e.target.value);
                  }}
                />
                <span className="input-adornment">{unitSystem === UNIT_SYSTEMS.METRIC ? 'm' : 'ft'}</span>
              </div>

              {slantingHeightInfo.hasInvalidInput ? (
                <div
                  style={{
                    marginTop: '6px',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    fontSize: '10.5px',
                    color: '#fcd34d',
                  }}
                >
                  ⚠️ Slanting height <strong>H</strong> must exceed horizontal slope run (
                  {formatLength(slantingHeightInfo.run, unitSystem)}). Using {woodworkAngle}° preset (
                  {formatLength(presetSlantingHeight, unitSystem)}) until valid.
                </div>
              ) : parsedSlantingHeightM !== null ? (
                <div
                  style={{
                    marginTop: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    fontSize: '10.5px',
                    color: '#6ee7b7',
                  }}
                >
                  <span>
                    ✓ Measured <strong>H = {formatLength(geometry.rafterLength, unitSystem)}</strong> • KP:{' '}
                    {formatLength(geometry.roofHeight, unitSystem)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setKingpostOverrideM(null);
                      setSlantingHeightInput('');
                    }}
                    style={{
                      background: 'transparent',
                      color: '#f59e0b',
                      fontSize: '10px',
                      fontWeight: 600,
                      textDecoration: 'underline',
                      cursor: 'pointer',
                    }}
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    marginTop: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    background: 'rgba(15, 23, 42, 0.55)',
                    border: '1px dashed rgba(71, 85, 105, 0.6)',
                    fontSize: '10.5px',
                    color: '#94a3b8',
                  }}
                >
                  <span>
                    Auto-preset active: <strong style={{ color: '#e2e8f0' }}>H = {formatLength(presetSlantingHeight, unitSystem)}</strong> ({woodworkAngle}°)
                  </span>
                  <button
                    type="button"
                    onClick={() => setHasSlantingHeight(false)}
                    style={{
                      background: 'transparent',
                      color: '#38bdf8',
                      fontSize: '10.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Change Angle →
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">
                <span>Roof Pitch Angle (Drives Preset H)</span>
                <span style={{ color: '#38bdf8', fontWeight: 700 }}>{woodworkAngle}°</span>
              </label>
              <select
                value={
                  WOODWORK_ANGLE_PRESETS.some((p) => Math.abs(p.degrees - woodworkAngle) < 0.15)
                    ? WOODWORK_ANGLE_PRESETS.find((p) => Math.abs(p.degrees - woodworkAngle) < 0.15).degrees
                    : 'custom'
                }
                onChange={(e) => {
                  if (e.target.value !== 'custom') {
                    const deg = Number(e.target.value);
                    setKingpostOverrideM(null);
                    setWoodworkAngle(deg);
                    setPitchAngle(deg);
                  }
                }}
              >
                {WOODWORK_ANGLE_PRESETS.map((p) => (
                  <option key={p.degrees} value={p.degrees}>
                    {p.label}
                  </option>
                ))}
                {!WOODWORK_ANGLE_PRESETS.some((p) => Math.abs(p.degrees - woodworkAngle) < 0.15) && (
                  <option value="custom">Custom Angle ({woodworkAngle}°)</option>
                )}
              </select>

              <div className="slider-container" style={{ marginTop: '8px' }}>
                <input
                  type="range"
                  min="10"
                  max="60"
                  step="0.5"
                  value={woodworkAngle}
                  onChange={(e) => {
                    const deg = Number(e.target.value);
                    setKingpostOverrideM(null);
                    setWoodworkAngle(deg);
                    setPitchAngle(deg);
                  }}
                  className="slider-input"
                />
                <span className="slider-badge">{woodworkAngle}°</span>
              </div>

              {/* Calculated Preset Slanting Height (H) Readout */}
              <div
                style={{
                  marginTop: '8px',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '10.5px', color: '#fcd34d', fontWeight: 600 }}>
                    Preset Slanting Height (H)
                  </div>
                  <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                    Dependent on {woodworkAngle}° angle & {formatLength(slantingHeightInfo.run, unitSystem)} slope run
                  </div>
                </div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#f59e0b', fontFamily: 'monospace' }}>
                  {formatLength(presetSlantingHeight, unitSystem)}
                </div>
              </div>
            </div>
          )}

          {/* Timber Spacing Specs */}
          <div className="form-group">
            <label className="form-label">Roof Purlin / Batten Spacing</label>
            <select
              value={woodworkConfig.purlinSpacing}
              onChange={(e) => setWoodworkConfig({ ...woodworkConfig, purlinSpacing: Number(e.target.value) })}
            >
              {PURLIN_SPACING_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Include Timber Carcass Toggle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(30, 41, 59, 0.6)',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(71, 85, 105, 0.5)',
            }}
          >
            <div>
              <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#f8fafc' }}>
                Include Full Timber Carcass in BOQ
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                Wall plates, tie beams, rafters, king posts, purlins & nails
              </div>
            </div>
            <input
              type="checkbox"
              checked={woodworkConfig.includeTimberBOQ}
              onChange={(e) => setWoodworkConfig({ ...woodworkConfig, includeTimberBOQ: e.target.checked })}
              style={{ width: '16px', height: '16px', accentColor: '#f59e0b', cursor: 'pointer' }}
            />
          </div>
        </div>
      )}
    </>
  );

  const kingpostSlantingTweaks = (
    <div
      className="stage-feature-card"
      style={{
        borderColor: 'rgba(168, 85, 247, 0.4)',
        background: 'linear-gradient(180deg, rgba(88, 28, 135, 0.14), rgba(15, 23, 42, 0.78))',
      }}
    >
      <div className="stage-feature-card-header">
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#e9d5ff' }}>
          <Sliders className="w-4 h-4" style={{ color: '#c084fc' }} />
          <span>Tweak Kingpost (KP) ↔ Slanting (H)</span>
        </span>
        {kingpostOverrideM !== null ? (
          <button
            type="button"
            onClick={() => setKingpostOverrideM(null)}
            style={{
              fontSize: '10px',
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: '8px',
              background: 'rgba(245, 158, 11, 0.16)',
              color: '#fbbf24',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              cursor: 'pointer',
            }}
            title="Revert height back to active stage preset"
          >
            ↺ Preset
          </button>
        ) : (
          <span style={{ fontSize: '10.5px', color: '#c084fc', fontWeight: 700 }}>
            {geometry.pitchDegrees}° Pitch
          </span>
        )}
      </div>

      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '-6px', lineHeight: 1.35 }}>
        Adjusting vertical <strong style={{ color: '#e2e8f0' }}>Kingpost Height (KP)</strong> or rafter{' '}
        <strong style={{ color: '#fbbf24' }}>Slanting Height (H)</strong> live-updates the other across{' '}
        <span style={{ color: '#38bdf8' }}>Run R = {formatLength(currentRunM, unitSystem)}</span>.
      </div>

      {/* Kingpost Height (KP) Control */}
      <div className="tweak-dual-box" style={{ borderColor: 'rgba(192, 132, 252, 0.35)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#e9d5ff' }}>
            👑 Kingpost Height (KP)
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              className="stepper-mini-btn"
              onClick={() => handleTweakKingpost(geometry.roofHeight - 0.1)}
              title="Decrease Kingpost by 0.1m"
            >
              −
            </button>
            <input
              type="number"
              min="0.2"
              max="28"
              step="0.05"
              value={
                unitSystem === UNIT_SYSTEMS.IMPERIAL
                  ? Number(metersToFeet(geometry.roofHeight).toFixed(2))
                  : Number(geometry.roofHeight.toFixed(2))
              }
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v) && v > 0) {
                  handleTweakKingpost(unitSystem === UNIT_SYSTEMS.IMPERIAL ? feetToMeters(v) : v);
                }
              }}
              style={{
                width: '68px',
                padding: '3px 6px',
                fontSize: '12px',
                fontWeight: 700,
                textAlign: 'center',
                fontFamily: 'monospace',
                color: '#f3e8ff',
              }}
            />
            <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>
              {unitSystem === UNIT_SYSTEMS.IMPERIAL ? 'ft' : 'm'}
            </span>
            <button
              type="button"
              className="stepper-mini-btn"
              onClick={() => handleTweakKingpost(geometry.roofHeight + 0.1)}
              title="Increase Kingpost by 0.1m"
            >
              +
            </button>
          </div>
        </div>
        <input
          type="range"
          min="0.3"
          max={Math.max(6.0, Math.round(currentRunM * 1.6 * 10) / 10)}
          step="0.05"
          value={Math.min(Math.max(6.0, currentRunM * 1.6), geometry.roofHeight)}
          onChange={(e) => handleTweakKingpost(Number(e.target.value))}
          className="slider-input"
        />
      </div>

      {/* Slanting Height (H) Control */}
      <div className="tweak-dual-box" style={{ borderColor: 'rgba(245, 158, 11, 0.35)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#fde68a' }}>
            📐 Slanting Height (H)
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              className="stepper-mini-btn"
              onClick={() => handleTweakSlantingHeight(geometry.rafterLength - 0.1)}
              title="Decrease Slanting Height by 0.1m"
            >
              −
            </button>
            <input
              type="number"
              min="0.5"
              max="65"
              step="0.05"
              value={
                unitSystem === UNIT_SYSTEMS.IMPERIAL
                  ? Number(metersToFeet(geometry.rafterLength).toFixed(2))
                  : Number(geometry.rafterLength.toFixed(2))
              }
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v) && v > 0) {
                  handleTweakSlantingHeight(unitSystem === UNIT_SYSTEMS.IMPERIAL ? feetToMeters(v) : v);
                }
              }}
              style={{
                width: '68px',
                padding: '3px 6px',
                fontSize: '12px',
                fontWeight: 700,
                textAlign: 'center',
                fontFamily: 'monospace',
                color: '#fef3c7',
              }}
            />
            <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>
              {unitSystem === UNIT_SYSTEMS.IMPERIAL ? 'ft' : 'm'}
            </span>
            <button
              type="button"
              className="stepper-mini-btn"
              onClick={() => handleTweakSlantingHeight(geometry.rafterLength + 0.1)}
              title="Increase Slanting Height by 0.1m"
            >
              +
            </button>
          </div>
        </div>
        <input
          type="range"
          min={(currentRunM + 0.08).toFixed(2)}
          max={Math.max(12.0, Math.round(currentRunM * 2.1 * 10) / 10)}
          step="0.05"
          value={Math.min(
            Math.max(12.0, currentRunM * 2.1),
            Math.max(currentRunM + 0.08, geometry.rafterLength)
          )}
          onChange={(e) => handleTweakSlantingHeight(Number(e.target.value))}
          className="slider-input"
        />
      </div>
    </div>
  );

  const extensionsSection = (
    <div>
      <div className="section-title">
        <Plus className="w-4 h-4" />
        <span>3. Extensions & Dormers ({extensions.length})</span>
      </div>

      <div className="extensions-container">
        {extensions.map((ext, idx) => (
          <div key={ext.id} className="ext-card">
            <div className="ext-card-header">
              <span>Extension #{idx + 1}</span>
              <button
                type="button"
                onClick={() => handleRemoveExtension(ext.id)}
                className="btn-remove-ext"
                title="Remove"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="form-row" style={{ marginBottom: 0 }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '10px' }}>Length (m)</label>
                <input
                  type="number"
                  min="0.5"
                  step="0.1"
                  value={ext.length}
                  onChange={(e) => handleUpdateExtension(ext.id, 'length', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '10px' }}>Breadth (m)</label>
                <input
                  type="number"
                  min="0.5"
                  step="0.1"
                  value={ext.breadth}
                  onChange={(e) => handleUpdateExtension(ext.id, 'breadth', e.target.value)}
                />
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          className="btn-add-ext"
          onClick={handleAddExtension}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Roof Extension / Wing</span>
        </button>
      </div>
    </div>

  );

  const advancedDefaultsSection = (
    <div>
      <button
        type="button"
        className="tweak-toggle-btn"
        onClick={() => setIsCustomizingDefaults(!isCustomizingDefaults)}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sliders className="w-3.5 h-3.5" />
          <span>
            {isCustomizingDefaults
              ? 'Hide Advanced Pitch & Style Options'
              : '⚙️ Customize Stage Defaults (Pitch, Style & Waste)'}
          </span>
        </span>
        {isCustomizingDefaults ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {isCustomizingDefaults && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            background: 'rgba(15, 23, 42, 0.5)',
            border: '1px solid rgba(51, 65, 85, 0.5)',
            borderRadius: 'var(--radius-md)',
            padding: '14px',
            marginTop: '8px',
          }}
        >
          {/* Roof Type Selection */}
          <div>
            <div className="form-label" style={{ marginBottom: '6px' }}>Roof Geometry Type</div>
            <div className="roof-type-grid">
              {ROOF_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`roof-type-card ${roofType === t.id ? 'active' : ''}`}
                  onClick={() => setRoofType(t.id)}
                >
                  <div className="roof-card-header">
                    <span className="roof-card-title">{t.name}</span>
                    {roofType === t.id && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  </div>
                  <span className="roof-card-desc">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Pitch / Slope Controls */}
          <div>
            <div className="form-label" style={{ marginBottom: '6px' }}>Roof Pitch & Height</div>
            <div className="sub-tabs">
              <button
                type="button"
                className={`sub-tab-btn ${pitchMode === 'ratio' ? 'active' : ''}`}
                onClick={() => setPitchMode('ratio')}
              >
                Ratio (:12)
              </button>
              <button
                type="button"
                className={`sub-tab-btn ${pitchMode === 'angle' ? 'active' : ''}`}
                onClick={() => setPitchMode('angle')}
              >
                Angle (°)
              </button>
              <button
                type="button"
                className={`sub-tab-btn ${pitchMode === 'height' ? 'active' : ''}`}
                onClick={() => setPitchMode('height')}
              >
                Direct Height
              </button>
            </div>

            {pitchMode === 'ratio' && (
              <div className="form-group" style={{ marginTop: '8px' }}>
                <select
                  value={pitchRatio}
                  onChange={(e) => {
                    setKingpostOverrideM(null);
                    setPitchRatio(Number(e.target.value));
                  }}
                >
                  {PITCH_PRESETS.map((p) => (
                    <option key={p.ratio} value={parseInt(p.ratio)}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {pitchMode === 'angle' && (
              <div className="slider-group" style={{ marginTop: '8px' }}>
                <label className="form-label">
                  Pitch Angle <span>{pitchAngle}°</span>
                </label>
                <div className="slider-container">
                  <input
                    type="range"
                    min="10"
                    max="65"
                    step="0.5"
                    value={pitchAngle}
                    onChange={(e) => {
                      setKingpostOverrideM(null);
                      setPitchAngle(Number(e.target.value));
                    }}
                    className="slider-input"
                  />
                  <span className="slider-badge">{pitchAngle}°</span>
                </div>
              </div>
            )}

            {pitchMode === 'height' && (
              <div className="form-group" style={{ marginTop: '8px' }}>
                <input
                  type="number"
                  min="0.2"
                  step="0.1"
                  value={heightVal}
                  onChange={(e) => {
                    setKingpostOverrideM(null);
                    setHeightVal(Number(e.target.value));
                  }}
                />
              </div>
            )}
          </div>

          {/* Waste Factor */}
          <div>
            <div className="slider-group">
              <label className="form-label">
                Wastage Factor for Cuts & Valleys <span>+{wastePercentage}%</span>
              </label>
              <div className="slider-container">
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="1"
                  value={wastePercentage}
                  onChange={(e) => setWastePercentage(Number(e.target.value))}
                  className="slider-input"
                />
                <span className="slider-badge">+{wastePercentage}%</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>

  );

  const resetButton = (
    <button
      type="button"
      className="btn-reset"
      onClick={() => handleStageSelect(buildingStage)}
      title="Reset to default presets for this stage"
    >
      <RotateCcw className="w-3.5 h-3.5" />
      <span>Reset {currentStageConfig.name} Defaults</span>
    </button>
  );

  const kpiCardsRow = (
    <div className="kpi-grid">
      <div className="kpi-card glass-panel emerald">
        <div className="kpi-label">
          <span>Total Roof Area</span>
          <Sparkles className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="kpi-value">{formatArea(geometry.totalArea, unitSystem)}</div>
        <div className="kpi-sub">Base: {formatArea(geometry.baseArea, unitSystem)} (+{geometry.wastePercentage}% waste)</div>
      </div>

      <div className="kpi-card glass-panel amber">
        <div className="kpi-label">
          <span>Total Ridge Length</span>
          <Ruler className="w-4 h-4 text-amber-400" />
        </div>
        <div className="kpi-value">{formatLength(geometry.totalRidge, unitSystem)}</div>
        <div className="kpi-sub">Top ridge: {formatLength(geometry.topRidgeLength, unitSystem)}</div>
      </div>

      <div className="kpi-card glass-panel sky">
        <div className="kpi-label">
          <span>Total Gutter Length</span>
          <Layers className="w-4 h-4 text-sky-400" />
        </div>
        <div className="kpi-value">
          {typeof geometry.totalGutter === 'number' && geometry.totalGutter > 0
            ? formatLength(geometry.totalGutter, unitSystem)
            : '0 m (No valley gutter)'}
        </div>
        <div className="kpi-sub">
          {geometry.totalGutter > 0
            ? (buildingStage === 'parapet' ? 'Parapet trough gutter' : 'Roof valley gutter')
            : 'Water sheds freely over eaves'}
        </div>
      </div>

      <div className="kpi-card glass-panel purple">
        <div className="kpi-label">
          <span>Slanting Height (H)</span>
          <Box className="w-4 h-4 text-purple-400" />
        </div>
        <div className="kpi-value">{formatLength(geometry.rafterLength, unitSystem)}</div>
        <div className="kpi-sub">
          Kingpost (KP): {formatLength(geometry.roofHeight, unitSystem)} • Pitch: {geometry.pitchDegrees}°
        </div>
      </div>
    </div>

  );

  const visualizerContent = (
    viewerMode === 'split' ? (
      <div className="viewer-split-grid">
        <Roof2DDiagram
          geometry={geometry}
          roofType={roofType}
          unitSystem={unitSystem}
          polygonVertices={polygonVertices}
          onPolygonChange={(pts) => setPolygonVertices(pts)}
          onDimensionsChange={({ length: l, breadth: b }) => {
            setLength(l);
            setBreadth(b);
          }}
          onOverhangChange={(newOv) => {
            setOverhang(newOv);
            setIsUniformOverhang(false);
          }}
          isSplitView={true}
          buildingStage={buildingStage}
          onStageChange={handleStageSelect}
          parapetConfig={parapetConfig}
          woodworkConfig={woodworkConfig}
          sketchUnderlayImage={sketchUnderlayImage}
          onClearUnderlay={() => setSketchUnderlayImage(null)}
          onOpenPaperUpload={() => setSketchModalOpen(true)}
        />
        <Roof3DViewer
          geometry={geometry}
          roofType={roofType}
          extensions={extensions}
          buildingStage={buildingStage}
          parapetConfig={parapetConfig}
          woodworkConfig={woodworkConfig}
          selectedMaterial={selectedMaterial}
        />
      </div>
    ) : viewerMode === '3d' ? (
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
      <Roof2DDiagram
        geometry={geometry}
        roofType={roofType}
        unitSystem={unitSystem}
        polygonVertices={polygonVertices}
        onPolygonChange={(pts) => setPolygonVertices(pts)}
        onDimensionsChange={({ length: l, breadth: b }) => {
          setLength(l);
          setBreadth(b);
        }}
        onOverhangChange={(newOv) => {
          setOverhang(newOv);
          setIsUniformOverhang(false);
        }}
        isSplitView={false}
        buildingStage={buildingStage}
        onStageChange={handleStageSelect}
        parapetConfig={parapetConfig}
        woodworkConfig={woodworkConfig}
        sketchUnderlayImage={sketchUnderlayImage}
        onClearUnderlay={() => setSketchUnderlayImage(null)}
        onOpenPaperUpload={() => setSketchModalOpen(true)}
      />
    )
  );

  const boqContent = (
    <section className="boq-section glass-panel">
      <div className="boq-header">
        <div className="boq-title">
          <Calculator className="w-5 h-5 text-emerald-400" />
          <span>Bill of Quantities & Material Estimate</span>
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
          <label className="text-xs text-slate-400">Select Profile:</label>
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

      {/* BOQ Table */}
      <div className="boq-table-wrapper">
        <table className="boq-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Item Description & Specification</th>
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
                    <span className="boq-item-title">{item.name}</span>
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
                </td>
                <td className="boq-price">
                  {formatCurrency(item.total, currencyCode)}
                </td>
              </tr>
            ))}
            {/* Labor Row */}
            <tr>
              <td style={{ color: '#64748b' }}>{materials.items.length + 1}</td>
              <td>
                <div className="boq-item-title">Roof Installation & Skilled Labor</div>
                <div className="boq-item-spec">Professional carpentry, framing & covering</div>
              </td>
              <td className="boq-qty">{geometry.totalArea}</td>
              <td>m²</td>
              <td>
                <input
                  type="number"
                  style={{
                    width: '90px',
                    padding: '4px 8px',
                    fontSize: '12px',
                    background: 'rgba(15, 23, 42, 0.6)',
                  }}
                  value={
                    customPrices['laborPerM2'] !== undefined
                      ? customPrices['laborPerM2']
                      : (currencyCode === 'NGN' ? 1500 : 3.5)
                  }
                  onChange={(e) =>
                    setCustomPrices({
                      ...customPrices,
                      laborPerM2: e.target.value,
                    })
                  }
                />
              </td>
              <td className="boq-price">
                {formatCurrency(materials.summary.laborTotal, currencyCode)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Total Summary Bar */}
      <div className="boq-summary-bar">
        <div className="summary-figures">
          <div className="figure-item">
            <span className="figure-label">Materials Subtotal</span>
            <span className="figure-val">
              {formatCurrency(materials.summary.materialsSubtotal, currencyCode)}
            </span>
          </div>
          <div className="figure-item">
            <span className="figure-label">Labor & Installation</span>
            <span className="figure-val">
              {formatCurrency(materials.summary.laborTotal, currencyCode)}
            </span>
          </div>
          <div className="figure-item">
            <span className="figure-label">Grand Total Estimate</span>
            <span className="figure-val grand">
              {formatCurrency(materials.summary.grandTotal, currencyCode)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="action-buttons-group">
          <button
            type="button"
            className="btn-primary-action"
            onClick={() => setQuoteModalOpen(true)}
          >
            <Download className="w-4 h-4" />
            <span>Generate PDF Quotation</span>
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
            <span>{copiedToast ? 'Copied to Clipboard!' : 'Share Summary'}</span>
          </button>
        </div>
      </div>
    </section>
  );

  return (
    <>
      {layoutMode === 'revit' ? (
        <RevitWorkspace
          geometry={geometry}
          materials={materials}
          unitSystem={unitSystem}
          setUnitSystem={setUnitSystem}
          currencyCode={currencyCode}
          setCurrencyCode={setCurrencyCode}
          buildingStage={buildingStage}
          handleStageSelect={handleStageSelect}
          currentStageConfig={currentStageConfig}
          parapetConfig={parapetConfig}
          setParapetConfig={setParapetConfig}
          woodworkConfig={woodworkConfig}
          setWoodworkConfig={setWoodworkConfig}
          roofType={roofType}
          setRoofType={setRoofType}
          length={length}
          breadth={breadth}
          overhang={overhang}
          displayLength={displayLength}
          displayBreadth={displayBreadth}
          handleLengthChange={handleLengthChange}
          handleBreadthChange={handleBreadthChange}
          setOverhang={setOverhang}
          isUniformOverhang={isUniformOverhang}
          setIsUniformOverhang={setIsUniformOverhang}
          polygonVertices={polygonVertices}
          setPolygonVertices={handleSetPolygonVertices}
          hasActiveDesign={hasActiveDesign}
          onResetToBlank={resetToBlankCanvas}
          onActivateRectangle={handleActivateRectangle}
          extensions={extensions}
          handleAddExtension={handleAddExtension}
          handleRemoveExtension={handleRemoveExtension}
          handleUpdateExtension={handleUpdateExtension}
          handleTweakKingpost={handleTweakKingpost}
          handleTweakPitchAngle={handleTweakPitchAngle}
          handleTweakSlantingHeight={handleTweakSlantingHeight}
          foundationOverhangM={foundationOverhangM}
          handleFoundationOverhangChange={handleFoundationOverhangChange}
          applyPreset={applyPreset}
          selectedMaterial={selectedMaterial}
          setSelectedMaterial={setSelectedMaterial}
          customPrices={customPrices}
          setCustomPrices={setCustomPrices}
          setSketchModalOpen={setSketchModalOpen}
          setQuoteModalOpen={setQuoteModalOpen}
          setQuoteScope={setQuoteScope}
          wcConfig={wcConfig}
          setWcConfig={setWcConfig}
          wcMaterials={wcMaterials}
          handleCopyWcSummary={handleCopyWcSummary}
          setVideoModalOpen={setVideoModalOpen}
          handleExportCSV={handleExportCSV}
          handleCopySummary={handleCopySummary}
          copiedToast={copiedToast}
          sketchUnderlayImage={sketchUnderlayImage}
          setSketchUnderlayImage={setSketchUnderlayImage}
          wastePercentage={wastePercentage}
          setWastePercentage={setWastePercentage}
          isPremium={effectiveIsPremium}
          onOpenProModal={() => setProModalOpen(true)}
          onOpenAdminModal={isAdminUser ? () => setAdminModalOpen(true) : null}
          onInstallApp={pwaInstall.canInstall ? pwaInstall.triggerInstall : null}
          proUser={proSession?.user || null}
          onSignOut={handleProSignOut}
          onSwitchLayout={() => setLayoutMode('classic')}
        />
      ) : (
        <div className="app-container">
          {/* 1. Header Section */}
          <header className="app-header glass-panel">
            <div className="brand-section">
              <div
                className="studio-brand-mark"
                style={{ width: '44px', height: '44px', fontSize: '22px', borderRadius: '11px', flexShrink: 0 }}
              >
                S
              </div>
              <div>
                <h1 className="brand-title">
                  RoofCalc Pro
                  <span className="brand-badge">Sijitek Solutions</span>
                </h1>
                <p className="brand-subtitle">
                  © Sijitek Solutions — Engineering &amp; Architectural Estimation Suite
                </p>
              </div>
            </div>

            <div className="header-controls">
              {/* Paper Sketch Upload CTA */}
              <button
                type="button"
                className="btn-primary-action"
                style={{ padding: '8px 14px' }}
                onClick={() => setSketchModalOpen(true)}
                title="Upload a labeled paper sketch to convert to 2D & calculate"
              >
                <Camera className="w-4 h-4" />
                <span>Upload Paper Sketch</span>
              </button>

              {/* Unit System Toggle */}
              <div className="pill-group">
                <button
                  type="button"
                  className={`pill-btn ${unitSystem === UNIT_SYSTEMS.METRIC ? 'active' : ''}`}
                  onClick={() => {
                    if (unitSystem !== UNIT_SYSTEMS.METRIC && slantingHeightInput !== '') {
                      const n = Number(slantingHeightInput);
                      if (Number.isFinite(n) && n > 0) {
                        setSlantingHeightInput(feetToMeters(n).toFixed(2));
                      }
                    }
                    setUnitSystem(UNIT_SYSTEMS.METRIC);
                  }}
                >
                  Metric (m/m²)
                </button>
                <button
                  type="button"
                  className={`pill-btn ${unitSystem === UNIT_SYSTEMS.IMPERIAL ? 'active' : ''}`}
                  onClick={() => {
                    if (unitSystem !== UNIT_SYSTEMS.IMPERIAL && slantingHeightInput !== '') {
                      const n = Number(slantingHeightInput);
                      if (Number.isFinite(n) && n > 0) {
                        setSlantingHeightInput(metersToFeet(n).toFixed(2));
                      }
                    }
                    setUnitSystem(UNIT_SYSTEMS.IMPERIAL);
                  }}
                >
                  Imperial (ft/sq)
                </button>
              </div>

              {/* Currency Select */}
              <select
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value)}
                className="header-btn"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.symbol} {c.code}
                  </option>
                ))}
              </select>

              {/* Tutorial Video Button */}
              <button
                type="button"
                className="header-btn"
                onClick={() => setVideoModalOpen(true)}
                title="Watch Tutorial Video"
              >
                <Video className="w-4 h-4 text-emerald-400" />
                <span>Tutorial</span>
              </button>

              {/* Switch to Sijitek CAD Studio */}
              <button
                type="button"
                className="header-btn"
                style={{ background: 'rgba(16, 185, 129, 0.2)', borderColor: '#10b981', color: '#34d399' }}
                onClick={() => setLayoutMode('revit')}
                title="Switch to Sijitek CAD Studio"
              >
                <Box className="w-4 h-4" />
                <span>CAD Studio</span>
              </button>

              {/* Top-Right Profile Initials Avatar & Login/Logout Popover */}
              <div ref={classicProfileMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setClassicProfileMenuOpen((v) => !v)}
                  aria-label={proSession?.user ? `Account (${getUserDisplayName(proSession.user)})` : 'Sign In / Profile'}
                  title={proSession?.user ? `${getUserDisplayName(proSession.user)} (${proSession.user.email || 'Signed in'})` : 'Click to Sign In / Log Out'}
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    background: proSession?.user
                      ? 'linear-gradient(135deg, #0ea5e9, #10b981)'
                      : '#1e293b',
                    border: proSession?.user
                      ? isPremium
                        ? '2px solid #fbbf24'
                        : '2px solid #38bdf8'
                      : '1.5px solid #475569',
                    color: proSession?.user ? '#ffffff' : '#cbd5e1',
                    fontSize: '13.5px',
                    fontWeight: 900,
                    letterSpacing: '0.03em',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                >
                  {proSession?.user ? getUserInitials(proSession.user) : <User className="w-4 h-4" />}
                  {proSession?.user && (
                    <span
                      style={{
                        position: 'absolute',
                        bottom: '-1px',
                        right: '-1px',
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: isPremium ? '#fbbf24' : '#34d399',
                        border: '2px solid #0f172a',
                      }}
                    />
                  )}
                </button>

                {classicProfileMenuOpen && (
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
                      boxShadow: '0 18px 40px rgba(2, 6, 23, 0.78)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    {proSession?.user ? (
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
                            {getUserInitials(proSession.user)}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {getUserDisplayName(proSession.user)}
                            </div>
                            <div style={{ fontSize: '11px', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {proSession.user.email || ''}
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

                        <button
                          type="button"
                          onClick={() => {
                            setClassicProfileMenuOpen(false);
                            setProModalOpen(true);
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

                        <button
                          type="button"
                          onClick={() => {
                            setClassicProfileMenuOpen(false);
                            handleProSignOut();
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
                      </>
                    ) : (
                      <>
                        <div style={{ paddingBottom: '8px', borderBottom: '1px solid #1e293b' }}>
                          <div style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc' }}>Guest Session</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                            Sign in to sync your account &amp; Pro features
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setClassicProfileMenuOpen(false);
                            setProModalOpen(true);
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
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* 2. Main Layout Grid */}

          {/* 2. Top Workspace Ribbon Navigation Bar */}
          <nav className="app-top-ribbon-bar">
            {/* Workspace Ribbon Tabs */}
            <div className="ribbon-tabs-group">
              <button
                type="button"
                className={`ribbon-tab-btn ${activeRibbon === 'studio' ? 'active' : ''}`}
                onClick={() => setActiveRibbon('studio')}
              >
                <Box className="w-4 h-4 text-sky-400" />
                <span>2D & 3D CAD Studio</span>
                <span className="ribbon-tab-badge">Interactive</span>
              </button>

              <button
                type="button"
                className={`ribbon-tab-btn ${activeRibbon === 'specs' ? 'active' : ''}`}
                onClick={() => setActiveRibbon('specs')}
              >
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Building Stage & Specs</span>
                <span
                  className="ribbon-tab-badge"
                  style={{ color: currentStageConfig.color }}
                >
                  {currentStageConfig.badge}
                </span>
              </button>

              <button
                type="button"
                className={`ribbon-tab-btn ${activeRibbon === 'boq' ? 'active' : ''}`}
                onClick={() => setActiveRibbon('boq')}
              >
                <Calculator className="w-4 h-4 text-amber-400" />
                <span>Bill of Quantities (BOQ)</span>
                <span className="ribbon-tab-badge" style={{ color: '#34d399' }}>
                  {formatCurrency(materials.summary.grandTotal, currencyCode)}
                </span>
              </button>

              <button
                type="button"
                className={`ribbon-tab-btn ${activeRibbon === 'dashboard' ? 'active' : ''}`}
                onClick={() => setActiveRibbon('dashboard')}
              >
                <LayoutGrid className="w-4 h-4 text-purple-400" />
                <span>All-in-One Dashboard</span>
              </button>
            </div>

            {/* Global Live KPI Metrics Strip */}
            <div className="global-kpi-ribbon">
              <div className="kpi-ribbon-pill highlight">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span className="pill-lbl">Roof Area</span>
                <span className="pill-val">{formatArea(geometry.totalArea, unitSystem)}</span>
              </div>

              <div className="kpi-ribbon-pill">
                <Ruler className="w-3.5 h-3.5 text-amber-400" />
                <span className="pill-lbl">Ridge</span>
                <span className="pill-val">{formatLength(geometry.totalRidge, unitSystem)}</span>
              </div>

              <div className="kpi-ribbon-pill">
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                <span className="pill-lbl">Gutter</span>
                <span className="pill-val">
                  {typeof geometry.totalGutter === 'number' && geometry.totalGutter > 0
                    ? formatLength(geometry.totalGutter, unitSystem)
                    : '0 m'}
                </span>
              </div>

              <div className="kpi-ribbon-pill">
                <Box className="w-3.5 h-3.5 text-purple-400" />
                <span className="pill-lbl">KP / H</span>
                <span className="pill-val">
                  KP {formatLength(geometry.roofHeight, unitSystem)} • H {formatLength(geometry.rafterLength, unitSystem)} ({geometry.pitchDegrees}°)
                </span>
              </div>

              <div className="kpi-ribbon-pill highlight" style={{ borderColor: 'rgba(52, 211, 153, 0.6)' }}>
                <Calculator className="w-3.5 h-3.5 text-emerald-400" />
                <span className="pill-lbl">Est. Total</span>
                <span className="pill-val" style={{ color: '#34d399' }}>
                  {formatCurrency(materials.summary.grandTotal, currencyCode)}
                </span>
              </div>
            </div>
          </nav>

          {/* 3. Main Workspace Based on Active Ribbon */}
          {activeRibbon === 'studio' && (
            <div className="full-width-viewer">
              {/* Studio Quick Ribbon Toolbar */}
              <div className="studio-ribbon-bar glass-panel">
                {/* Footprint Inputs */}
                <div className="ribbon-cluster">
                  <span className="ribbon-cluster-title">
                    <Ruler className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Footprint</span>
                  </span>
                  <div className="ribbon-inputs-group">
                    <div className="ribbon-field">
                      <label>L:</label>
                      <div className="ribbon-input-wrap">
                        <input
                          type="number"
                          min="1"
                          step="0.5"
                          value={displayLength}
                          onChange={(e) => handleLengthChange(e.target.value)}
                        />
                        <span>{unitSystem === UNIT_SYSTEMS.METRIC ? 'm' : 'ft'}</span>
                      </div>
                    </div>
                    <div className="ribbon-field">
                      <label>B:</label>
                      <div className="ribbon-input-wrap">
                        <input
                          type="number"
                          min="1"
                          step="0.5"
                          value={displayBreadth}
                          onChange={(e) => handleBreadthChange(e.target.value)}
                        />
                        <span>{unitSystem === UNIT_SYSTEMS.METRIC ? 'm' : 'ft'}</span>
                      </div>
                    </div>
                    {!((buildingStage === 'parapet' || parapetConfig.enabled) && parapetConfig.includedInSketch) && (
                      <div className="ribbon-field">
                        <label>Eaves:</label>
                        <div className="ribbon-input-wrap">
                          <input
                            type="number"
                            min="0"
                            step="0.05"
                            value={overhang.front}
                            onChange={(e) => {
                              const v = Math.max(0, Number(e.target.value) || 0);
                              setOverhang({ front: v, back: v, left: v, right: v });
                              setIsUniformOverhang(true);
                            }}
                          />
                          <span>{unitSystem === UNIT_SYSTEMS.METRIC ? 'm' : 'ft'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Slopes & Kingpost Quick Adjuster */}
                <div className="ribbon-cluster">
                  <span className="ribbon-cluster-title">
                    <Box className="w-3.5 h-3.5 text-amber-400" />
                    <span>Slope & KP</span>
                  </span>
                  <div className="ribbon-inputs-group">
                    <div className="ribbon-field">
                      <label>KP:</label>
                      <div className="ribbon-stepper-wrap">
                        <button
                          type="button"
                          onClick={() => handleTweakKingpost(geometry.roofHeight - 0.1)}
                          title="Decrease Kingpost by 0.1m"
                        >
                          −
                        </button>
                        <span>{geometry.roofHeight.toFixed(2)}m</span>
                        <button
                          type="button"
                          onClick={() => handleTweakKingpost(geometry.roofHeight + 0.1)}
                          title="Increase Kingpost by 0.1m"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="ribbon-field">
                      <label>Slanting H:</label>
                      <div className="ribbon-stepper-wrap">
                        <button
                          type="button"
                          onClick={() => handleTweakSlantingHeight(geometry.rafterLength - 0.1)}
                          title="Decrease Slanting H by 0.1m"
                        >
                          −
                        </button>
                        <span>{geometry.rafterLength.toFixed(2)}m</span>
                        <button
                          type="button"
                          onClick={() => handleTweakSlantingHeight(geometry.rafterLength + 0.1)}
                          title="Increase Slanting H by 0.1m"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <span className="ribbon-val-pill">{geometry.pitchDegrees}°</span>
                  </div>
                </div>

                {/* Stage Pill, View Toggle & Presets */}
                <div className="ribbon-cluster">
                  <button
                    type="button"
                    className="ribbon-stage-pill"
                    style={{
                      backgroundColor: currentStageConfig.bgLight,
                      color: currentStageConfig.color,
                      border: `1px solid ${currentStageConfig.borderLight}`,
                    }}
                    onClick={() => setActiveRibbon('specs')}
                    title="Click to configure building stage specs"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>{currentStageConfig.badge}</span>
                  </button>

                  <div className="view-toggle-pills">
                    <button
                      type="button"
                      className={`view-pill ${viewerMode === 'split' ? 'active' : ''}`}
                      onClick={() => setViewerMode('split')}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      <span>⚡ Split View</span>
                    </button>
                    <button
                      type="button"
                      className={`view-pill ${viewerMode === '3d' ? 'active' : ''}`}
                      onClick={() => setViewerMode('3d')}
                    >
                      <Box className="w-3.5 h-3.5 text-blue-400" />
                      <span>3D Model</span>
                    </button>
                    <button
                      type="button"
                      className={`view-pill ${viewerMode === '2d' ? 'active' : ''}`}
                      onClick={() => setViewerMode('2d')}
                    >
                      <Ruler className="w-3.5 h-3.5 text-amber-400" />
                      <span>2D Sketch</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-400 mr-1">Presets:</span>
                    <button
                      type="button"
                      className="header-btn"
                      style={{ padding: '3px 7px', fontSize: '11px' }}
                      onClick={() => applyPreset('hip', 14, 9, 2.6)}
                    >
                      Bungalow
                    </button>
                    <button
                      type="button"
                      className="header-btn"
                      style={{ padding: '3px 7px', fontSize: '11px' }}
                      onClick={() => applyPreset('gable', 16, 10, 3.2)}
                    >
                      Duplex
                    </button>
                    <button
                      type="button"
                      className="header-btn"
                      style={{ padding: '3px 7px', fontSize: '11px' }}
                      onClick={() => applyPreset('shed', 10, 5, 1.8)}
                    >
                      Shed
                    </button>
                  </div>
                </div>
              </div>

              {/* Full Width Visualizer Canvas & 3D */}
              <div className="viewer-wrapper">
                {visualizerContent}
              </div>
            </div>
          )}

          {activeRibbon === 'specs' && (
            <div className="specs-workspace-grid">
              {/* Card 1: On-Site Stage & Paper Upload */}
              <div className="specs-card glass-panel">
                {stageSelectorSection}
              </div>

              {/* Card 2: Dimensions, Overhangs & Extensions */}
              <div className="specs-card glass-panel">
                {dimensionsSection}
                <div style={{ marginTop: '16px' }}>
                  {extensionsSection}
                </div>
              </div>

              {/* Card 3: Stage Specific Specs & Defaults */}
              <div className="specs-card glass-panel">
                {stageSpecificsSection}
                <div style={{ marginTop: '16px' }}>
                  {kingpostSlantingTweaks}
                </div>
                <div style={{ marginTop: '16px' }}>
                  {advancedDefaultsSection}
                </div>
                {resetButton}
              </div>
            </div>
          )}

          {activeRibbon === 'boq' && (
            <div style={{ width: '100%' }}>
              {boqContent}
            </div>
          )}

          {activeRibbon === 'dashboard' && (
            <div className="main-layout-grid">
              <aside className="config-sidebar glass-panel">
                {stageSelectorSection}
                {dimensionsSection}
                {stageSpecificsSection}
                {kingpostSlantingTweaks}
                {extensionsSection}
                {advancedDefaultsSection}
                {resetButton}
              </aside>

              <main className="content-stage">
                {kpiCardsRow}
                <div className="viewer-wrapper">
                  <div className="viewer-header">
                    <div className="view-toggle-pills">
                      <button
                        type="button"
                        className={`view-pill ${viewerMode === 'split' ? 'active' : ''}`}
                        onClick={() => setViewerMode('split')}
                      >
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        <span>⚡ Split View (2D Sketch + 3D Sync)</span>
                      </button>
                      <button
                        type="button"
                        className={`view-pill ${viewerMode === '3d' ? 'active' : ''}`}
                        onClick={() => setViewerMode('3d')}
                      >
                        <Box className="w-3.5 h-3.5 text-blue-400" />
                        <span>3D Model</span>
                      </button>
                      <button
                        type="button"
                        className={`view-pill ${viewerMode === '2d' ? 'active' : ''}`}
                        onClick={() => setViewerMode('2d')}
                      >
                        <Ruler className="w-3.5 h-3.5 text-amber-400" />
                        <span>2D Sketch Pad</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Presets:</span>
                      <button
                        type="button"
                        className="header-btn"
                        style={{ padding: '4px 8px', fontSize: '11px' }}
                        onClick={() => applyPreset('hip', 14, 9, 2.6)}
                      >
                        Bungalow
                      </button>
                      <button
                        type="button"
                        className="header-btn"
                        style={{ padding: '4px 8px', fontSize: '11px' }}
                        onClick={() => applyPreset('gable', 16, 10, 3.2)}
                      >
                        Duplex
                      </button>
                      <button
                        type="button"
                        className="header-btn"
                        style={{ padding: '4px 8px', fontSize: '11px' }}
                        onClick={() => applyPreset('shed', 10, 5, 1.8)}
                      >
                        Shed Wing
                      </button>
                    </div>
                  </div>
                  {visualizerContent}
                </div>
                {boqContent}
              </main>
            </div>
          )}
        </div>
      )}

      {/* Quote Generator Modal Dialog */}
      {quoteModalOpen && (
        <div className="modal-overlay" onClick={() => setQuoteModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Generate Official PDF Quote</h3>
              <button
                type="button"
                className="btn-close-modal"
                onClick={() => setQuoteModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#94a3b8' }}>
              Fill in client and site details to create an official contractor estimate with itemized BOQ and signature sign-off.
            </p>

            <div className="form-group">
              <label className="form-label">Client / Company Name</label>
              <input
                type="text"
                placeholder="e.g. Chief Adeyemi / Greenfield Estates"
                value={clientInfo.name}
                onChange={(e) => setClientInfo({ ...clientInfo, name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Project Site Address / Location</label>
              <input
                type="text"
                placeholder="e.g. Plot 14, Lekki Phase 1, Lagos"
                value={clientInfo.site}
                onChange={(e) => setClientInfo({ ...clientInfo, site: e.target.value })}
              />
            </div>

            <div className="form-row" style={{ marginBottom: 0 }}>
              <div className="form-group">
                <label className="form-label">Client Phone</label>
                <input
                  type="text"
                  placeholder="+234..."
                  value={clientInfo.phone}
                  onChange={(e) => setClientInfo({ ...clientInfo, phone: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Quote Ref Number</label>
                <input
                  type="text"
                  value={clientInfo.quoteNumber}
                  onChange={(e) => setClientInfo({ ...clientInfo, quoteNumber: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Contractor Company Name</label>
              <input
                type="text"
                value={contractorInfo.name}
                onChange={(e) => setContractorInfo({ ...contractorInfo, name: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-3" style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-secondary-action"
                onClick={() => setQuoteModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary-action"
                onClick={handleDownloadPDF}
              >
                <Download className="w-4 h-4" />
                <span>Download Branded PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tutorial Video Modal */}
      {videoModalOpen && (
        <div className="modal-overlay" onClick={() => setVideoModalOpen(false)}>
          <div
            className="modal-card"
            style={{ maxWidth: '420px', width: '92vw' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <Video className="w-5 h-5 text-sky-400" />
                <span>RoofCalc Pro Guide Video</span>
              </h3>
              <button
                type="button"
                className="btn-close-modal"
                onClick={() => setVideoModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                padding: '1.75rem 1rem 1.25rem',
                gap: '0.75rem',
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'rgba(14, 165, 233, 0.14)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#38bdf8',
                }}
              >
                <Video className="w-6 h-6" />
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc' }}>
                Coming Soon
              </div>
              <p style={{ margin: 0, fontSize: '0.84rem', color: '#94a3b8', lineHeight: 1.5, maxWidth: '320px' }}>
                Our step-by-step RoofCalc Pro walkthrough video is on the way. Stay tuned!
              </p>
              <button
                type="button"
                className="btn-primary-action"
                onClick={() => setVideoModalOpen(false)}
                style={{ marginTop: '0.35rem', padding: '0.55rem 1.4rem' }}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Paper Sketch -> 2D Conversion Modal */}
      <PaperSketchModal
        isOpen={sketchModalOpen}
        onClose={() => setSketchModalOpen(false)}
        initialStage={buildingStage}
        unitSystem={unitSystem}
        isPremium={effectiveIsPremium}
        proAccessToken={proSession?.access_token || ''}
        proQuota={proQuota}
        onQuotaUpdate={setProQuota}
        onOpenUpgrade={() => setProModalOpen(true)}
        onApplyConvertedSketch={handleApplyConvertedSketch}
      />

      {/* Shared Pro Account & Upgrade Modal */}
      <ProUpgradeModal
        isOpen={proModalOpen}
        onClose={() => {
          setProModalOpen(false);
          setProAuthError('');
        }}
        isPremium={effectiveIsPremium}
        proEmail={proSession?.user?.email || ''}
        proAccessToken={proSession?.access_token || ''}
        proQuota={proQuota}
        initialError={proAuthError}
        onAuthSuccess={async (session) => {
          setProAuthError('');
          resetToBlankCanvas();
          setProSession(session);
          await syncProAccount(session);
        }}
        onRefreshStatus={() => syncProAccount()}
        onSignOut={handleProSignOut}
        onTogglePreviewPro={handleTogglePreviewPro}
      />

      {/* Admin Dashboard Modal (sijiteksub@gmail.com only) */}
      <AdminReferralsModal
        isOpen={adminModalOpen && isAdminUser}
        onClose={() => setAdminModalOpen(false)}
        accessToken={proSession?.access_token || ''}
      />

      {/* Influencer / Partner Read-Only Earnings Modal (?partner=CODE&token=TOKEN) */}
      <PartnerStatsModal
        partnerParams={partnerParams}
        onClose={() => {
          setPartnerParams(null);
          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.delete('partner');
            url.searchParams.delete('token');
            const cleanSearch = url.searchParams.toString();
            window.history.replaceState(
              {},
              '',
              `${url.pathname}${cleanSearch ? `?${cleanSearch}` : ''}${url.hash || ''}`
            );
          }
        }}
      />

      {/* Installable PWA Banner & iOS Add-to-Home-Screen Guide */}
      <InstallAppBanner
        showBanner={pwaInstall.showBanner}
        isIos={pwaInstall.isIos}
        iosGuideOpen={pwaInstall.iosGuideOpen}
        onInstall={pwaInstall.triggerInstall}
        onDismiss={pwaInstall.dismissBanner}
        onCloseIosGuide={() => pwaInstall.setIosGuideOpen(false)}
      />

      {/* Payment Confirmation Toast */}
      {paymentToast && (
        <div
          style={{
            position: 'fixed',
            bottom: '1.25rem',
            right: '1.25rem',
            zIndex: 9999,
            padding: '0.75rem 1.05rem',
            borderRadius: '10px',
            background: 'rgba(6, 78, 59, 0.96)',
            border: '1px solid rgba(52, 211, 153, 0.6)',
            color: '#ecfdf5',
            fontSize: '0.84rem',
            fontWeight: 700,
            boxShadow: '0 10px 30px rgba(0,0,0,0.38)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <CheckCircle2 size={17} style={{ color: '#34d399' }} />
          <span>{paymentToast}</span>
        </div>
      )}
    </>
  );
}

