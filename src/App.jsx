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
  Upload,
} from 'lucide-react';
import confetti from 'canvas-confetti';

import {
  ROOF_TYPES,
  ROOF_TYPE_DEFAULT_ANGLES,
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
  clearDevAuthSession,
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
  DEFAULT_CONTRACTOR_INFO,
  getAccountCustomPrices,
  saveAccountCustomPrices,
  getAccountContractorProfile,
  saveAccountContractorProfile,
  saveUserAccountSettings,
} from './utils/proSession';
import './App.css';

const ACTIVE_DESIGN_STORAGE_KEY = 'roofcalc_active_design_v1';

function resizeLogoFileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith('image/')) {
      reject(new Error('Please select a PNG, JPG, WebP, or SVG image file.'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error('Logo file is too large (max 5 MB).'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not decode the selected image.'));
      img.onload = () => {
        const maxW = 360;
        const maxH = 180;
        const scale = Math.min(1, maxW / (img.width || 1), maxH / (img.height || 1));
        const w = Math.max(1, Math.round((img.width || 1) * scale));
        const h = Math.max(1, Math.round((img.height || 1) * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

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
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const pwaInstall = usePwaInstall();
  const [proAuthError, setProAuthError] = useState('');
  const [paymentToast, setPaymentToast] = useState('');
  const [partnerParams, setPartnerParams] = useState(() => extractPartnerLinkFromUrl());
  const [classicProfileMenuOpen, setClassicProfileMenuOpen] = useState(false);
  const classicProfileMenuRef = useRef(null);
  const [proSession, setProSession] = useState(() => getStoredAuthSession());
  const [proQuota, setProQuota] = useState(() => getStoredProStatus()?.quota || null);
  const [proPlanExpiresAt, setProPlanExpiresAt] = useState(() => getStoredProStatus()?.planExpiresAt ?? null);
  const [isPremium, setIsPremium] = useState(() =>
    isSupabaseConfigured()
      ? Boolean(getStoredProStatus()?.isPro || isAdminEmail(getStoredAuthSession()?.user?.email))
      : getPreviewProFlag()
  );
  const isAdminUser = isAdminEmail(proSession?.user?.email);
  const effectiveIsPremium = Boolean(isPremium || isAdminUser);
  const activeAccountUserId = proSession?.user?.id || null;
  const [priceSyncStatus, setPriceSyncStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [logoUploadError, setLogoUploadError] = useState('');
  const hydratedUserIdRef = useRef(null);
  const lastSyncedPricesJsonRef = useRef('');
  const lastSyncedContractorJsonRef = useRef('');

  const hydrateAccountFromProfile = (sessionObj, statusObj) => {
    const uid = sessionObj?.user?.id || null;
    if (!uid) return;

    const cloudPrices =
      statusObj?.customPrices &&
      typeof statusObj.customPrices === 'object' &&
      !Array.isArray(statusObj.customPrices)
        ? statusObj.customPrices
        : null;
    const localPrices = getAccountCustomPrices(uid);

    if (statusObj?.isPro) {
      if (cloudPrices && Object.keys(cloudPrices).length > 0) {
        const json = JSON.stringify(cloudPrices);
        lastSyncedPricesJsonRef.current = json;
        saveAccountCustomPrices(uid, cloudPrices);
        setCustomPrices(cloudPrices);
        setPriceSyncStatus('saved');
      } else if (Object.keys(localPrices).length > 0) {
        const json = JSON.stringify(localPrices);
        lastSyncedPricesJsonRef.current = json;
        setCustomPrices(localPrices);
        setPriceSyncStatus('saving');
        saveUserAccountSettings(sessionObj.access_token, { customPrices: localPrices }).then((res) => {
          setPriceSyncStatus(res.ok ? 'saved' : 'error');
        });
      } else {
        lastSyncedPricesJsonRef.current = '{}';
        setCustomPrices({});
        setPriceSyncStatus('saved');
      }
    } else {
      lastSyncedPricesJsonRef.current = JSON.stringify(localPrices || {});
      setCustomPrices(localPrices || {});
      setPriceSyncStatus('idle');
    }

    const cloudContractor =
      statusObj?.contractorProfile &&
      typeof statusObj.contractorProfile === 'object' &&
      !Array.isArray(statusObj.contractorProfile)
        ? statusObj.contractorProfile
        : null;
    const localContractor = getAccountContractorProfile(uid);

    if (cloudContractor && Object.keys(cloudContractor).length > 0) {
      const merged = { ...DEFAULT_CONTRACTOR_INFO, ...cloudContractor };
      lastSyncedContractorJsonRef.current = JSON.stringify(merged);
      saveAccountContractorProfile(uid, merged);
      setContractorInfo(merged);
    } else {
      lastSyncedContractorJsonRef.current = JSON.stringify(localContractor);
      setContractorInfo(localContractor);
    }

    hydratedUserIdRef.current = uid;
  };

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
    setProPlanExpiresAt(finalStatus.planExpiresAt ?? null);
    hydrateAccountFromProfile(finalStatus.session || verifiedSession, finalStatus);
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
      setProPlanExpiresAt(finalStatus.planExpiresAt ?? null);
      hydrateAccountFromProfile(finalStatus.session || activeSession, finalStatus);
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

  const handleProSignOut = async () => {
    saveAuthSession(null, { skipRemoteSync: true });
    saveStoredProStatus(null);
    setPreviewProFlag(false);
    setIsPasswordRecovery(false);
    setAdminModalOpen(false);
    setProModalOpen(false);
    setSketchModalOpen(false);
    hydratedUserIdRef.current = null;
    lastSyncedPricesJsonRef.current = '';
    lastSyncedContractorJsonRef.current = '';
    setPriceSyncStatus('idle');
    setProSession(null);
    setIsPremium(false);
    setProQuota(null);
    setProPlanExpiresAt(null);
    setCustomPrices(getAccountCustomPrices(null));
    setContractorInfo(getAccountContractorProfile(null));
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('roofcalc_pending_paystack_ref_v1');
        window.sessionStorage.removeItem(ACTIVE_DESIGN_STORAGE_KEY);
        window.sessionStorage.removeItem('roofcalc_in_progress_sketch_v1');
        window.sessionStorage.removeItem('roofcalc_active_sketch_modal_v1');
        window.google?.accounts?.id?.disableAutoSelect?.();
      }
    } catch {
      // Ignore storage errors
    }
    await clearDevAuthSession();
    if (typeof window !== 'undefined') {
      window.location.replace(`${window.location.origin}${window.location.pathname}`);
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
    return stg === 'parapet' || stg === 'woodwork' ? 'parapet' : 'foundation';
  }); // 'foundation' | 'parapet'
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
  const [roofType, setRoofType] = useState(() => {
    const saved = readStoredActiveDesign()?.roofType;
    return saved === 'flat' ? 'shed' : saved || 'hip';
  });
  const roofTypeAnglesRef = useRef({ ...ROOF_TYPE_DEFAULT_ANGLES });
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
      const { session, error, type } = await consumeOAuthCallbackFromUrl();
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
        if (type === 'recovery') {
          setIsPasswordRecovery(true);
          setProModalOpen(true);
        } else if (type === 'signup') {
          showPaymentSuccessToast('Email confirmed! Welcome to RoofCalc Pro.');
        }
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

  // Materials & Pricing State (scoped per account; Pro accounts permanently synced in Supabase)
  const [selectedMaterial, setSelectedMaterial] = useState('stone_coated');
  const [customPrices, setCustomPrices] = useState(() =>
    getAccountCustomPrices(getStoredAuthSession()?.user?.id || null)
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    saveAccountCustomPrices(activeAccountUserId, customPrices || {});

    if (!effectiveIsPremium || !proSession?.access_token || !activeAccountUserId) return;
    if (hydratedUserIdRef.current !== activeAccountUserId) return;

    const serialized = JSON.stringify(customPrices || {});
    if (serialized === lastSyncedPricesJsonRef.current) return;

    setPriceSyncStatus('saving');
    const timer = setTimeout(async () => {
      const res = await saveUserAccountSettings(proSession.access_token, {
        customPrices: customPrices || {},
      });
      if (res.ok) {
        lastSyncedPricesJsonRef.current = serialized;
        setPriceSyncStatus('saved');
      } else {
        setPriceSyncStatus('error');
      }
    }, 650);

    return () => clearTimeout(timer);
  }, [customPrices, activeAccountUserId, effectiveIsPremium, proSession?.access_token]);

  // UI Modes & Modals
  const [viewerMode, setViewerMode] = useState('split'); // 'split' | '3d' | '2d'
  const [sketchModalOpen, setSketchModalOpen] = useState(false);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [quoteScope, setQuoteScope] = useState('roof'); // 'roof' | 'roof_only' | 'wood' | 'wc'
  // Ephemeral one-off export price/material adjustments for Free & Guest users (NEVER persisted)
  const [exportTempPrices, setExportTempPrices] = useState({});
  const [exportPriceEditorOpen, setExportPriceEditorOpen] = useState(false);
  const [tempExportRowName, setTempExportRowName] = useState('');
  const [tempExportRowQty, setTempExportRowQty] = useState('1');
  const [tempExportRowUnit, setTempExportRowUnit] = useState('pcs');
  const [tempExportRowPrice, setTempExportRowPrice] = useState('');

  useEffect(() => {
    if (!quoteModalOpen) {
      setExportTempPrices({});
      setExportPriceEditorOpen(false);
      setTempExportRowName('');
      setTempExportRowQty('1');
      setTempExportRowUnit('pcs');
      setTempExportRowPrice('');
    }
  }, [quoteModalOpen]);
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

  const [contractorInfo, setContractorInfo] = useState(() =>
    getAccountContractorProfile(getStoredAuthSession()?.user?.id || null)
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    saveAccountContractorProfile(activeAccountUserId, contractorInfo);

    if (!effectiveIsPremium || !proSession?.access_token || !activeAccountUserId) return;
    if (hydratedUserIdRef.current !== activeAccountUserId) return;

    const serialized = JSON.stringify(contractorInfo);
    if (serialized === lastSyncedContractorJsonRef.current) return;

    const timer = setTimeout(async () => {
      const res = await saveUserAccountSettings(proSession.access_token, {
        contractorProfile: contractorInfo,
      });
      if (res.ok) {
        lastSyncedContractorJsonRef.current = serialized;
      }
    }, 650);

    return () => clearTimeout(timer);
  }, [contractorInfo, activeAccountUserId, effectiveIsPremium, proSession?.access_token]);

  const handleContractorLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLogoUploadError('');
    try {
      const logoDataUrl = await resizeLogoFileToDataUrl(file);
      setContractorInfo((prev) => ({ ...prev, logoDataUrl }));
    } catch (err) {
      setLogoUploadError(err?.message || 'Could not process logo image.');
    }
  };

  // Handle stage switching with automatic standard presets
  const handleStageSelect = (stageId) => {
    const normalizedStage = stageId === 'parapet' || stageId === 'woodwork' ? 'parapet' : 'foundation';
    setBuildingStage(normalizedStage);
    setKingpostOverrideM(null);
    const cfg = getStageConfig(normalizedStage);

    if (normalizedStage === 'foundation') {
      const fOv = Math.max(0, Number(foundationOverhangM) || 0);
      setRoofType(cfg.defaults.roofType);
      setPitchMode(cfg.defaults.pitchMode);
      setPitchRatio(cfg.defaults.pitchRatio);
      setPitchAngle(cfg.defaults.pitchAngle);
      setWoodworkAngle(cfg.defaults.pitchAngle);
      setOverhang({ front: fOv, back: fOv, left: fOv, right: fOv });
      setIsUniformOverhang(true);
      setParapetConfig((prev) => ({ ...prev, enabled: false }));
    } else {
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

  const handleRoofTypeChange = (nextType) => {
    const cleanNext = String(nextType || 'hip').trim().toLowerCase();
    if (cleanNext === roofType) return;

    // Remember the current roof type's active angle before switching away
    const currentDeg = Number(pitchMode === 'angle' ? pitchAngle : woodworkAngle);
    if (Number.isFinite(currentDeg) && currentDeg >= 1 && currentDeg <= 68 && roofType !== 'flat') {
      roofTypeAnglesRef.current[roofType] = Math.round(currentDeg * 10) / 10;
    }

    const targetAngle =
      roofTypeAnglesRef.current[cleanNext] ?? ROOF_TYPE_DEFAULT_ANGLES[cleanNext] ?? 30;
    const syncedRatio = Math.max(0.5, Math.min(24, Math.round(Math.tan((targetAngle * Math.PI) / 180) * 12 * 10) / 10));
    const syncedKp =
      cleanNext === 'flat'
        ? 0
        : Math.round(calculateRoofHeight('angle', targetAngle, breadth, cleanNext, overhang, polygonVertices) * 100) / 100;

    setRoofType(cleanNext);
    setKingpostOverrideM(null);
    setSlantingHeightInput('');
    setPitchMode('angle');
    setPitchAngle(targetAngle);
    setWoodworkAngle(targetAngle);
    setPitchRatio(syncedRatio);
    setHeightVal(syncedKp);
  };

  const handleTweakKingpost = (newKpMeters) => {
    const kp = Math.round(Math.max(0.2, Math.min(8.5, Number(newKpMeters) || 0.2)) * 100) / 100;
    setKingpostOverrideM(kp);
    setHeightVal(kp);
    const synced = calculateSlantingHeightFromKingpost(kp, breadth, overhang, roofType, polygonVertices);
    setWoodworkAngle(synced.pitchDegrees);
    setPitchAngle(synced.pitchDegrees);
    if (roofType !== 'flat') {
      roofTypeAnglesRef.current[roofType] = synced.pitchDegrees;
    }
    if (buildingStage === 'woodwork' && hasSlantingHeight && slantingHeightInput !== '') {
      const dispH =
        unitSystem === UNIT_SYSTEMS.IMPERIAL
          ? metersToFeet(synced.slantingHeight).toFixed(2)
          : synced.slantingHeight.toFixed(2);
      setSlantingHeightInput(dispH);
    }
  };

  const handleTweakPitchAngle = (newAngleDeg) => {
    const minDeg = roofType === 'shed' || roofType === 'flat' ? 2 : 5;
    const deg = Math.round(Math.max(minDeg, Math.min(68, Number(newAngleDeg) || minDeg)) * 10) / 10;
    setKingpostOverrideM(null);
    setPitchMode('angle');
    setPitchAngle(deg);
    setWoodworkAngle(deg);
    if (roofType !== 'flat') {
      roofTypeAnglesRef.current[roofType] = deg;
    }
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
      if (roofType !== 'flat') {
        roofTypeAnglesRef.current[roofType] = check.pitchDegrees;
      }
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
    const rawStage = payload.stageId || buildingStage;
    const nextStage = rawStage === 'parapet' || rawStage === 'woodwork' ? 'parapet' : 'foundation';
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

  // Free & Guest users always calculate with default market rates and default Sijitek PDF branding
  const effectiveCustomPrices = effectiveIsPremium ? customPrices : {};
  const effectiveContractorInfo = effectiveIsPremium ? contractorInfo : DEFAULT_CONTRACTOR_INFO;

  // Bill of Quantities / Materials Results (Stage Aware, Timber BOQ & Custom Prices Pro-gated)
  const materials = useMemo(() => {
    return estimateMaterials(
      geometry,
      selectedMaterial,
      currencyCode,
      effectiveCustomPrices,
      {
        buildingStage,
        parapetConfig,
        woodworkConfig,
        allowTimber: effectiveIsPremium,
      }
    );
  }, [geometry, selectedMaterial, currencyCode, effectiveCustomPrices, buildingStage, parapetConfig, woodworkConfig, effectiveIsPremium]);

  // Water Collector (WC) Estimate
  const wcMaterials = useMemo(() => {
    return estimateWaterCollector(geometry, currencyCode, effectiveCustomPrices, {
      roofType,
      polygonVertices,
      wcConfig,
    });
  }, [geometry, currencyCode, effectiveCustomPrices, roofType, polygonVertices, wcConfig]);

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

  // Temporary one-time export estimate for Free/Guest users inside Export PDF modal (never saved)
  const freeExportPreviewMaterials = useMemo(() => {
    if (effectiveIsPremium || !quoteModalOpen) return null;
    const est = estimateMaterials(geometry, selectedMaterial, currencyCode, exportTempPrices, {
      buildingStage,
      parapetConfig,
      woodworkConfig,
      allowTimber: false,
      includeZeroItems: true,
    });
    const roofOnly = (est.items || []).filter((it) => !it.category.includes('Timber'));
    const activeItems = roofOnly.filter((it) => Number(it.quantity) > 0 && Number(it.total) > 0);
    const materialsSubtotal = activeItems.reduce((acc, it) => acc + (Number(it.total) || 0), 0);
    const laborTotal = est.summary?.laborTotal || 0;
    const transportTotal = est.summary?.transportTotal || 0;
    const grandTotal = materialsSubtotal + laborTotal + transportTotal;
    return {
      ...est,
      editableItems: roofOnly,
      items: activeItems,
      summary: {
        materialsSubtotal,
        laborTotal,
        transportTotal,
        grandTotal,
        costPerM2: geometry?.totalArea > 0 ? Math.round(grandTotal / geometry.totalArea) : 0,
      },
    };
  }, [effectiveIsPremium, quoteModalOpen, geometry, selectedMaterial, currencyCode, exportTempPrices, buildingStage, parapetConfig, woodworkConfig]);

  const handleAddTempExportMaterial = (e) => {
    e.preventDefault();
    const cleanName = tempExportRowName.trim();
    if (!cleanName) return;
    const qty = Math.max(1, Number(tempExportRowQty) || 1);
    const unitPrice = Math.max(0, Number(tempExportRowPrice) || 0);
    const unit = tempExportRowUnit.trim() || 'pcs';
    const id = `tmp_exp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const prevList = Array.isArray(exportTempPrices.__extraItems) ? exportTempPrices.__extraItems : [];
    setExportTempPrices({
      ...exportTempPrices,
      __extraItems: [...prevList, { id, scope: 'roof', name: cleanName, quantity: qty, unit, unitPrice }],
      [id]: String(unitPrice),
    });
    setTempExportRowName('');
    setTempExportRowQty('1');
    setTempExportRowUnit('pcs');
    setTempExportRowPrice('');
  };

  const handleRemoveTempExportMaterial = (itemId) => {
    const prevList = Array.isArray(exportTempPrices.__extraItems) ? exportTempPrices.__extraItems : [];
    const nextList = prevList.filter((it) => it.id !== itemId);
    const next = { ...exportTempPrices };
    delete next[itemId];
    if (nextList.length > 0) next.__extraItems = nextList;
    else delete next.__extraItems;
    setExportTempPrices(next);
  };

  // Download PDF with Confetti celebration
  const handleDownloadPDF = async () => {
    if ((quoteScope === 'wc' || quoteScope === 'wood') && !effectiveIsPremium) {
      setQuoteModalOpen(false);
      setProModalOpen(true);
      return;
    }
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.7 },
    });

    let activeQuoteMaterials = materials;
    if (!effectiveIsPremium && freeExportPreviewMaterials) {
      // Apply one-off unsaved Free/Guest export price & material edits strictly to this PDF
      activeQuoteMaterials = {
        ...freeExportPreviewMaterials,
        items: freeExportPreviewMaterials.items,
        summary: freeExportPreviewMaterials.summary,
      };
    } else if (quoteScope === 'wc') {
      activeQuoteMaterials = wcMaterials;
    } else if (quoteScope === 'wood') {
      const fullTimber = estimateMaterials(geometry, selectedMaterial, currencyCode, customPrices, {
        buildingStage: 'woodwork',
        parapetConfig,
        woodworkConfig: { ...(woodworkConfig || {}), includeTimberBOQ: true },
        allowTimber: true,
      });
      const woodOnlyItems = (fullTimber.items || []).filter((it) => it.category.includes('Timber'));
      const woodSubtotal = woodOnlyItems.reduce((acc, it) => acc + (Number(it.total) || 0), 0);
      activeQuoteMaterials = {
        ...fullTimber,
        buildingStage: 'woodwork_only',
        items: woodOnlyItems,
        summary: {
          materialsSubtotal: woodSubtotal,
          laborTotal: 0,
          transportTotal: 0,
          grandTotal: woodSubtotal,
          costPerM2: geometry?.totalArea > 0 ? Math.round(woodSubtotal / geometry.totalArea) : 0,
        },
      };
    } else if (quoteScope === 'roof_only') {
      const roofOnlyItems = (materials.items || []).filter((it) => !it.category.includes('Timber'));
      const roofSubtotal = roofOnlyItems.reduce((acc, it) => acc + (Number(it.total) || 0), 0);
      const laborTotal = materials.summary?.laborTotal || 0;
      const transportTotal = materials.summary?.transportTotal || 0;
      const grandTotal = roofSubtotal + laborTotal + transportTotal;
      activeQuoteMaterials = {
        ...materials,
        items: roofOnlyItems,
        summary: {
          materialsSubtotal: roofSubtotal,
          laborTotal,
          transportTotal,
          grandTotal,
          costPerM2: geometry?.totalArea > 0 ? Math.round(grandTotal / geometry.totalArea) : 0,
        },
      };
    }

    await generateQuotePDF({
      geometry,
      materials: activeQuoteMaterials,
      clientInfo,
      contractorInfo: effectiveContractorInfo,
      unitSystem,
    });
    setExportTempPrices({});
    setExportPriceEditorOpen(false);
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
                  onClick={() => handleRoofTypeChange(t.id)}
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
          wastePercentage={wastePercentage}
          setWastePercentage={setWastePercentage}
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
        wastePercentage={wastePercentage}
        setWastePercentage={setWastePercentage}
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
          setRoofType={handleRoofTypeChange}
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
          priceSyncStatus={priceSyncStatus}
          contractorInfo={contractorInfo}
          setContractorInfo={setContractorInfo}
          onUploadContractorLogo={handleContractorLogoUpload}
          logoUploadError={logoUploadError}
          setLogoUploadError={setLogoUploadError}
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
          <div
            className="modal-card"
            style={{ maxHeight: '90dvh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="modal-title">
                {quoteScope === 'wc'
                  ? 'Export Water Collector (WC) PDF'
                  : quoteScope === 'wood'
                  ? 'Export Woodwork & Timber PDF'
                  : 'Generate Official Roof Quote PDF'}
              </h3>
              <button
                type="button"
                className="btn-close-modal"
                onClick={() => setQuoteModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#94a3b8' }}>
              Enter client and site details to generate an official PDF quotation with itemized BOQ and signature sign-off.
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

            {/* Free & Guest One-Time Export Price & Material Adjustments (Never Saved) */}
            {!effectiveIsPremium && freeExportPreviewMaterials && (
              <div
                style={{
                  borderRadius: '10px',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  background: 'rgba(15, 23, 42, 0.72)',
                  padding: '9px 11px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#f8fafc' }}>
                      Edit Prices &amp; Add Materials for This Export
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                      One-time only — changes apply to this PDF and will not be saved.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExportPriceEditorOpen((prev) => !prev)}
                    style={{
                      background: exportPriceEditorOpen ? '#0ea5e9' : 'rgba(14, 165, 233, 0.16)',
                      color: exportPriceEditorOpen ? '#ffffff' : '#38bdf8',
                      border: '1px solid rgba(56, 189, 248, 0.45)',
                      borderRadius: '7px',
                      padding: '5px 10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {exportPriceEditorOpen ? 'Hide Editor' : 'Adjust Now'}
                  </button>
                </div>

                {exportPriceEditorOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div
                      style={{
                        maxHeight: '190px',
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '5px',
                        paddingRight: '2px',
                      }}
                    >
                      {(freeExportPreviewMaterials.editableItems || []).map((it) => (
                        <div
                          key={`tmp-row-${it.id}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '6px',
                            background: '#0b1220',
                            border: '1px solid #1e293b',
                            borderRadius: '7px',
                            padding: '5px 8px',
                            fontSize: '11.5px',
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <input
                              type="text"
                              aria-label={`Edit name for ${it.defaultName || it.name}`}
                              placeholder={it.defaultName || it.name}
                              value={
                                it.isCustom
                                  ? it.name
                                  : exportTempPrices.__customNames?.[it.id] !== undefined
                                  ? exportTempPrices.__customNames[it.id]
                                  : it.name
                              }
                              onChange={(e) => {
                                const val = e.target.value;
                                if (it.isCustom) {
                                  const prevList = Array.isArray(exportTempPrices.__extraItems)
                                    ? exportTempPrices.__extraItems
                                    : [];
                                  setExportTempPrices((prev) => ({
                                    ...prev,
                                    __extraItems: prevList.map((ci) =>
                                      ci.id === it.id ? { ...ci, name: val } : ci
                                    ),
                                  }));
                                } else {
                                  setExportTempPrices((prev) => ({
                                    ...prev,
                                    __customNames: {
                                      ...(prev.__customNames || {}),
                                      [it.id]: val,
                                    },
                                  }));
                                }
                              }}
                              style={{
                                width: '100%',
                                padding: '3px 6px',
                                fontSize: '11.5px',
                                fontWeight: 600,
                                background: '#090e1a',
                                color: '#e2e8f0',
                                border: '1px solid #263244',
                                borderRadius: '5px',
                              }}
                            />
                            <div style={{ fontSize: '10px', color: '#64748b' }}>
                              {it.quantity} {it.unit}
                            </div>
                          </div>
                          <input
                            type="number"
                            min="0"
                            value={exportTempPrices[it.id] !== undefined ? exportTempPrices[it.id] : it.unitPrice}
                            onChange={(e) =>
                              setExportTempPrices((prev) => ({ ...prev, [it.id]: e.target.value }))
                            }
                            style={{
                              width: '86px',
                              padding: '4px 6px',
                              fontSize: '11.5px',
                              textAlign: 'right',
                              background: '#090e1a',
                              color: '#34d399',
                              border: '1px solid #334155',
                              borderRadius: '6px',
                            }}
                          />
                          {it.isCustom && (
                            <button
                              type="button"
                              onClick={() => handleRemoveTempExportMaterial(it.id)}
                              title="Remove item"
                              style={{
                                background: 'rgba(239, 68, 68, 0.14)',
                                color: '#f87171',
                                border: '1px solid rgba(239, 68, 68, 0.35)',
                                borderRadius: '6px',
                                padding: '4px',
                                cursor: 'pointer',
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                        <label style={{ background: '#0b1220', border: '1px solid #1e293b', borderRadius: '7px', padding: '5px 8px', fontSize: '10.5px', color: '#94a3b8' }}>
                          <span>Labor / m²</span>
                          <input
                            type="number"
                            min="0"
                            value={exportTempPrices.laborPerM2 !== undefined ? exportTempPrices.laborPerM2 : (currencyCode === 'NGN' ? 1500 : 3.5)}
                            onChange={(e) => setExportTempPrices((prev) => ({ ...prev, laborPerM2: e.target.value }))}
                            style={{ width: '100%', marginTop: '3px', padding: '4px 6px', fontSize: '11.5px', background: '#090e1a', color: '#f8fafc', border: '1px solid #334155', borderRadius: '5px' }}
                          />
                        </label>
                        <label style={{ background: '#0b1220', border: '1px solid #1e293b', borderRadius: '7px', padding: '5px 8px', fontSize: '10.5px', color: '#94a3b8' }}>
                          <span>Transport</span>
                          <input
                            type="number"
                            min="0"
                            value={exportTempPrices.transport !== undefined ? exportTempPrices.transport : (currencyCode === 'NGN' ? 25000 : 50)}
                            onChange={(e) => setExportTempPrices((prev) => ({ ...prev, transport: e.target.value }))}
                            style={{ width: '100%', marginTop: '3px', padding: '4px 6px', fontSize: '11.5px', background: '#090e1a', color: '#f8fafc', border: '1px solid #334155', borderRadius: '5px' }}
                          />
                        </label>
                      </div>
                    </div>

                    {/* Add One-Time Custom Material Row */}
                    <form
                      onSubmit={handleAddTempExportMaterial}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '5px',
                        padding: '7px 8px',
                        borderRadius: '8px',
                        background: '#090e1a',
                        border: '1px dashed rgba(56, 189, 248, 0.4)',
                      }}
                    >
                      <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#38bdf8' }}>
                        + Add Material (This Export Only)
                      </div>
                      <input
                        type="text"
                        placeholder="Item name (e.g. Scaffolding, Paint)"
                        value={tempExportRowName}
                        onChange={(e) => setTempExportRowName(e.target.value)}
                        style={{ padding: '5px 7px', fontSize: '11.5px' }}
                      />
                      <div style={{ display: 'grid', gridTemplateColumns: '52px 60px 1fr auto', gap: '5px' }}>
                        <input
                          type="number"
                          min="1"
                          placeholder="Qty"
                          value={tempExportRowQty}
                          onChange={(e) => setTempExportRowQty(e.target.value)}
                          style={{ padding: '5px 5px', fontSize: '11.5px', textAlign: 'center' }}
                        />
                        <input
                          type="text"
                          placeholder="Unit"
                          value={tempExportRowUnit}
                          onChange={(e) => setTempExportRowUnit(e.target.value)}
                          style={{ padding: '5px 5px', fontSize: '11.5px', textAlign: 'center' }}
                        />
                        <input
                          type="number"
                          min="0"
                          placeholder={`Price (${currencyCode})`}
                          value={tempExportRowPrice}
                          onChange={(e) => setTempExportRowPrice(e.target.value)}
                          style={{ padding: '5px 7px', fontSize: '11.5px', textAlign: 'right' }}
                        />
                        <button
                          type="submit"
                          disabled={!tempExportRowName.trim()}
                          style={{
                            padding: '5px 9px',
                            borderRadius: '6px',
                            border: 'none',
                            background: tempExportRowName.trim() ? '#10b981' : '#1e293b',
                            color: tempExportRowName.trim() ? '#052e16' : '#64748b',
                            fontSize: '11.5px',
                            fontWeight: 800,
                            cursor: tempExportRowName.trim() ? 'pointer' : 'not-allowed',
                          }}
                        >
                          Add
                        </button>
                      </div>
                    </form>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', padding: '2px 2px 0' }}>
                      <span style={{ color: '#94a3b8' }}>Updated PDF Total:</span>
                      <strong style={{ color: '#34d399', fontFamily: 'monospace' }}>
                        {formatCurrency(freeExportPreviewMaterials.summary.grandTotal, currencyCode)}
                      </strong>
                    </div>
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    paddingTop: '6px',
                    borderTop: '1px solid rgba(51, 65, 85, 0.7)',
                    fontSize: '11px',
                    color: '#cbd5e1',
                    flexWrap: 'wrap',
                  }}
                >
                  <span>Want your prices &amp; company logo saved permanently?</span>
                  <button
                    type="button"
                    onClick={() => {
                      setQuoteModalOpen(false);
                      setProModalOpen(true);
                    }}
                    style={{
                      background: 'rgba(245, 158, 11, 0.16)',
                      border: '1px solid rgba(245, 158, 11, 0.45)',
                      color: '#fbbf24',
                      borderRadius: '6px',
                      padding: '4px 9px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    See all benefits of going Pro →
                  </button>
                </div>
              </div>
            )}

            {effectiveIsPremium && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: '9px',
                  background: 'rgba(15, 23, 42, 0.7)',
                  border: '1px solid rgba(51, 65, 85, 0.8)',
                  fontSize: '11.5px',
                  color: '#94a3b8',
                }}
              >
                {contractorInfo.logoDataUrl && (
                  <img
                    src={contractorInfo.logoDataUrl}
                    alt="Brand Logo"
                    style={{
                      width: '28px',
                      height: '20px',
                      objectFit: 'contain',
                      background: '#ffffff',
                      borderRadius: '4px',
                      padding: '1px',
                      flexShrink: 0,
                    }}
                  />
                )}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Header Brand: <strong style={{ color: '#e2e8f0' }}>{contractorInfo.name || 'Sijitek Solutions'}</strong>
                  {' '}• Edit anytime in <strong>Company Info &amp; Prices</strong>
                </span>
              </div>
            )}

            <div
              style={{
                fontSize: '10.5px',
                color: '#94a3b8',
                lineHeight: 1.4,
                padding: '6px 9px',
                borderRadius: '7px',
                background: 'rgba(15, 23, 42, 0.45)',
                border: '1px solid rgba(51, 65, 85, 0.55)',
              }}
            >
              <strong>Disclaimer:</strong> Default prices shown are generic reference estimates and may not reflect actual current local market prices.
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
          setIsPasswordRecovery(false);
          setProAuthError('');
        }}
        isPremium={effectiveIsPremium}
        proEmail={proSession?.user?.email || ''}
        proAccessToken={proSession?.access_token || ''}
        proQuota={proQuota}
        planExpiresAt={proPlanExpiresAt}
        initialError={proAuthError}
        isPasswordRecovery={isPasswordRecovery}
        onPasswordResetComplete={() => {
          setIsPasswordRecovery(false);
          setProModalOpen(false);
          showPaymentSuccessToast('Password updated! You are now signed in.');
        }}
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

