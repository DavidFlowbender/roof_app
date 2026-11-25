import React, { useState, useEffect, useRef } from 'react';
import {
  Crown,
  Sparkles,
  CheckCircle2,
  LogOut,
  RefreshCw,
  Loader2,
  ExternalLink,
  Tag,
  Zap,
  X,
} from 'lucide-react';
import {
  isSupabaseConfigured,
  isAdminEmail,
  startPaystackCheckout,
  signInWithSupabase,
  signUpWithSupabase,
  requestPasswordReset,
  updateSupabasePassword,
  signInWithGoogle,
  getGoogleClientId,
  isDirectGoogleSignInSupported,
  createGoogleAuthNoncePair,
  signInWithGoogleIdToken,
  syncDevAuthSession,
  consumeOAuthCallbackFromUrl,
  getStoredReferralCode,
  saveStoredReferralCode,
  fetchPricingAndReferral,
  formatKoboAsCurrency,
  DEFAULT_PRO_PLANS,
  DEFAULT_PRO_PLAN_ID,
  DEFAULT_SCAN_TOPUP_PACKS,
} from '../utils/proSession';

let googleGsiScriptPromise = null;
function loadGoogleGsiScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('No browser window'));
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (!googleGsiScriptPromise) {
    googleGsiScriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.google));
        existing.addEventListener('error', () => reject(new Error('Failed to load Google Sign-In')));
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(window.google);
      script.onerror = () => {
        googleGsiScriptPromise = null;
        reject(new Error('Failed to load Google Sign-In'));
      };
      document.head.appendChild(script);
    });
  }
  return googleGsiScriptPromise;
}

/**
 * Shared Pro Account, Influencer Referral Discount, and Pay-As-You-Go AI Scan Top-Up Modal.
 */
export default function ProUpgradeModal({
  isOpen,
  onClose,
  isPremium = false,
  proEmail = '',
  proAccessToken = '',
  proQuota = null,
  planExpiresAt = null,
  initialError = '',
  isPasswordRecovery = false,
  onPasswordResetComplete,
  onAuthSuccess,
  onRefreshStatus,
  onSignOut,
  onTogglePreviewPro,
}) {
  const [authMode, setAuthMode] = useState('signin'); // 'signin' | 'signup' | 'forgot'
  const [email, setEmail] = useState(proEmail || '');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [checkoutBusyId, setCheckoutBusyId] = useState(''); // '' | 'pro_upgrade' | pack.id
  const [feedback, setFeedback] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [pastedCallbackUrl, setPastedCallbackUrl] = useState('');
  const [lanSyncBusy, setLanSyncBusy] = useState(false);
  const [googleBtnReady, setGoogleBtnReady] = useState(false);
  const [googleAuthBusy, setGoogleAuthBusy] = useState(false);
  const googleBtnHostRef = useRef(null);
  const directGoogleSupported = isDirectGoogleSignInSupported();

  // Live Pro Plans (30-Day Pass, Annual Pro, Founding Lifetime) + Scan Top-Up Packs + Referral Discount
  const [selectedPlanId, setSelectedPlanId] = useState(DEFAULT_PRO_PLAN_ID);
  const [pricingInfo, setPricingInfo] = useState({
    currency: 'NGN',
    plans: DEFAULT_PRO_PLANS,
    scanPacks: DEFAULT_SCAN_TOPUP_PACKS,
  });
  const [referralInput, setReferralInput] = useState(() => getStoredReferralCode());
  const [appliedReferral, setAppliedReferral] = useState(null); // { code, influencerName, discountPercent }
  const [referralBusy, setReferralBusy] = useState(false);
  const [referralError, setReferralError] = useState('');

  const supabaseEnabled = isSupabaseConfigured();

  // Fetch live server plans & packs + auto-validate any saved ?ref=CODE whenever modal opens
  useEffect(() => {
    if (!isOpen || !supabaseEnabled) return;
    let cancelled = false;
    const savedCode = getStoredReferralCode();
    if (savedCode && !referralInput) {
      setReferralInput(savedCode);
    }

    (async () => {
      try {
        const data = await fetchPricingAndReferral({
          code: isPremium ? '' : savedCode,
          planId: selectedPlanId,
          accessToken: proAccessToken,
        });
        if (cancelled) return;
        setPricingInfo({
          currency: data.currency || 'NGN',
          plans: Array.isArray(data.plans) && data.plans.length > 0 ? data.plans : DEFAULT_PRO_PLANS,
          scanPacks: Array.isArray(data.scanPacks) && data.scanPacks.length > 0 ? data.scanPacks : DEFAULT_SCAN_TOPUP_PACKS,
        });
        if (!isPremium && savedCode) {
          if (data.valid) {
            setAppliedReferral({
              code: data.code,
              influencerName: data.influencerName || '',
              discountPercent: data.discountPercent || 0,
            });
            setReferralError('');
          } else {
            setAppliedReferral(null);
            if (data.error) setReferralError(data.error);
          }
        }
      } catch {
        // Keep safe defaults if local/offline
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, supabaseEnabled, isPremium, proAccessToken]);

  // Render official Google Identity Services button when VITE_GOOGLE_CLIENT_ID is configured
  // so Google's chooser shows sijiteksolutions.com / RoofCalc Pro instead of *.supabase.co
  useEffect(() => {
    if (!isOpen || !supabaseEnabled || proEmail || !directGoogleSupported) {
      setGoogleBtnReady(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [{ rawNonce, hashedNonce }] = await Promise.all([
          createGoogleAuthNoncePair(),
          loadGoogleGsiScript(),
        ]);
        if (cancelled || !window.google?.accounts?.id || !googleBtnHostRef.current) return;

        window.google.accounts.id.initialize({
          client_id: getGoogleClientId(),
          nonce: hashedNonce,
          ux_mode: 'popup',
          callback: async (response) => {
            if (!response?.credential) return;
            setErrorMsg('');
            setFeedback('');
            setGoogleAuthBusy(true);
            try {
              const session = await signInWithGoogleIdToken(response.credential, rawNonce);
              if (session?.access_token) {
                setFeedback('Signed in with Google.');
                if (onAuthSuccess) await onAuthSuccess(session);
              } else {
                setErrorMsg('Google sign-in did not return a valid session.');
              }
            } catch (err) {
              setErrorMsg(err?.message || 'Google sign-in failed.');
            } finally {
              setGoogleAuthBusy(false);
            }
          },
        });

        googleBtnHostRef.current.innerHTML = '';
        const hostWidth = Math.min(400, Math.max(260, Math.round(googleBtnHostRef.current.clientWidth || 360)));
        window.google.accounts.id.renderButton(googleBtnHostRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          width: hostWidth,
        });
        setGoogleBtnReady(true);
      } catch {
        if (!cancelled) setGoogleBtnReady(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, supabaseEnabled, proEmail, directGoogleSupported]);

  if (!isOpen) return null;

  const isLanDev =
    typeof window !== 'undefined' &&
    Boolean(import.meta.env?.DEV) &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1';

  const handleApplyReferral = async (e) => {
    if (e) e.preventDefault();
    const cleaned = String(referralInput || '').trim().toUpperCase();
    setReferralError('');
    if (!cleaned) {
      saveStoredReferralCode('');
      setAppliedReferral(null);
      return;
    }

    setReferralBusy(true);
    try {
      const data = await fetchPricingAndReferral({
        code: cleaned,
        planId: selectedPlanId,
        accessToken: proAccessToken,
      });
      if (data.valid) {
        saveStoredReferralCode(data.code);
        setReferralInput(data.code);
        setAppliedReferral({
          code: data.code,
          influencerName: data.influencerName || '',
          discountPercent: data.discountPercent || 0,
        });
        setPricingInfo((prev) => ({
          ...prev,
          currency: data.currency || prev.currency,
          plans: Array.isArray(data.plans) && data.plans.length > 0 ? data.plans : prev.plans,
          scanPacks: Array.isArray(data.scanPacks) && data.scanPacks.length > 0 ? data.scanPacks : prev.scanPacks,
        }));
        setReferralError('');
      } else {
        setAppliedReferral(null);
        setReferralError(data.error || 'Referral code is invalid or inactive.');
      }
    } catch (err) {
      setReferralError(err?.message || 'Could not validate referral code.');
    } finally {
      setReferralBusy(false);
    }
  };

  const handleClearReferral = () => {
    saveStoredReferralCode('');
    setReferralInput('');
    setAppliedReferral(null);
    setReferralError('');
  };

  const handleSyncFromLaptop = async () => {
    setErrorMsg('');
    setFeedback('');
    setLanSyncBusy(true);
    try {
      const synced = await syncDevAuthSession(null);
      if (synced?.access_token) {
        setFeedback('Synced sign-in session from laptop.');
        if (onAuthSuccess) await onAuthSuccess(synced);
      } else {
        setErrorMsg(
          'No active sign-in found on laptop yet. Sign in on laptop first, or paste the redirected URL below.'
        );
      }
    } catch (err) {
      setErrorMsg(err?.message || 'Could not sync session from laptop.');
    } finally {
      setLanSyncBusy(false);
    }
  };

  const handleConsumePastedUrl = async () => {
    setErrorMsg('');
    setFeedback('');
    if (!pastedCallbackUrl.trim()) {
      setErrorMsg('Paste the redirected http://localhost:5173/#access_token=... URL first.');
      return;
    }
    setLanSyncBusy(true);
    try {
      const { session, error } = await consumeOAuthCallbackFromUrl(pastedCallbackUrl);
      if (session?.access_token) {
        setPastedCallbackUrl('');
        setFeedback('Signed in from Google callback URL.');
        if (onAuthSuccess) await onAuthSuccess(session);
      } else {
        setErrorMsg(error || 'No valid access token found in that URL.');
      }
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to read sign-in URL.');
    } finally {
      setLanSyncBusy(false);
    }
  };

  const handleStartProCheckout = async () => {
    setCheckoutBusyId('pro_upgrade');
    setErrorMsg('');
    setFeedback('');
    try {
      const checkoutUrl = await startPaystackCheckout(proAccessToken, {
        purchaseType: 'pro_upgrade',
        planId: selectedPlan.id,
        referralCode: appliedReferral?.code || '',
        fallbackEmail: proEmail || email,
      });
      window.location.assign(checkoutUrl);
    } catch (err) {
      setErrorMsg(err?.message || 'Unable to launch Paystack checkout.');
      setCheckoutBusyId('');
    }
  };

  const handleBuyScanPack = async (pack) => {
    setCheckoutBusyId(pack.id);
    setErrorMsg('');
    setFeedback('');
    try {
      const checkoutUrl = await startPaystackCheckout(proAccessToken, {
        purchaseType: 'scan_topup',
        packId: pack.id,
        fallbackEmail: proEmail || email,
      });
      window.location.assign(checkoutUrl);
    } catch (err) {
      setErrorMsg(err?.message || 'Unable to launch scan top-up checkout.');
      setCheckoutBusyId('');
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setFeedback('');

    if (authMode === 'forgot') {
      if (!email.trim() || !email.includes('@')) {
        setErrorMsg('Enter the email address for your account.');
        return;
      }
      setIsBusy(true);
      try {
        await requestPasswordReset(email);
        setFeedback(`Password reset link sent to ${email.trim()}. Check your inbox and click Reset Password.`);
      } catch (err) {
        setErrorMsg(err?.message || 'Could not send password reset email.');
      } finally {
        setIsBusy(false);
      }
      return;
    }

    if (!email.trim() || password.length < 6) {
      setErrorMsg('Enter a valid email and a password of at least 6 characters.');
      return;
    }

    setIsBusy(true);
    try {
      const session =
        authMode === 'signin'
          ? await signInWithSupabase(email, password)
          : await signUpWithSupabase(email, password);

      if (session?.access_token) {
        setFeedback(authMode === 'signin' ? 'Signed in successfully.' : 'Account created and signed in.');
        if (onAuthSuccess) await onAuthSuccess(session);
      } else {
        setFeedback('Check your email to confirm your account, then sign in.');
      }
    } catch (err) {
      setErrorMsg(err?.message || 'Authentication failed.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleUpdateRecoveredPassword = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setFeedback('');
    if (newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    setIsBusy(true);
    try {
      await updateSupabasePassword(proAccessToken, newPassword);
      setNewPassword('');
      setConfirmNewPassword('');
      setFeedback('Password updated successfully!');
      if (onPasswordResetComplete) {
        onPasswordResetComplete();
      }
    } catch (err) {
      setErrorMsg(err?.message || 'Could not update password.');
    } finally {
      setIsBusy(false);
    }
  };

  const isAdminAccount = isAdminEmail(proEmail);
  const currency = pricingInfo.currency || 'NGN';
  const availablePlans = pricingInfo.plans?.length ? pricingInfo.plans : DEFAULT_PRO_PLANS;
  const selectedPlan =
    availablePlans.find((p) => p.id === selectedPlanId) ||
    availablePlans.find((p) => p.id === DEFAULT_PRO_PLAN_ID) ||
    availablePlans[0];
  const discountPercent = appliedReferral ? Math.min(90, Math.max(0, Number(appliedReferral.discountPercent) || 0)) : 0;
  const computedDiscountKobo = discountPercent > 0 ? Math.round((selectedPlan.amountKobo * discountPercent) / 100) : 0;
  const computedFinalKobo = Math.max(10000, selectedPlan.amountKobo - computedDiscountKobo);
  const actualDiscountKobo = Math.max(0, selectedPlan.amountKobo - computedFinalKobo);
  const hasDiscount = Boolean(appliedReferral && actualDiscountKobo > 0);
  const displayFinalPrice = formatKoboAsCurrency(hasDiscount ? computedFinalKobo : selectedPlan.amountKobo, currency);
  const displayBasePrice = formatKoboAsCurrency(selectedPlan.amountKobo, currency);
  const isCheckoutBusy = Boolean(checkoutBusyId);
  const formattedPlanExpiry = (() => {
    if (!isPremium || isAdminAccount) return '';
    if (!planExpiresAt) return 'LIFETIME PRO';
    const d = new Date(planExpiresAt);
    if (Number.isNaN(d.getTime())) return 'PRO ACTIVE';
    return `PRO • ENDS ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()}`;
  })();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content paper-sketch-modal-card"
        style={{ maxWidth: '480px', width: '94vw', padding: '1.35rem', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <Crown size={20} style={{ color: '#f59e0b' }} />
            <h3 style={{ margin: 0, fontSize: '1.08rem', color: 'var(--text-primary)' }}>
              RoofCalc Pro
            </h3>
          </div>
          <button type="button" className="btn-close-modal" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Core Pro Features */}
        <div
          style={{
            padding: '0.85rem',
            borderRadius: '12px',
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.28)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            marginBottom: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.82rem', color: '#fef3c7' }}>
            <Sparkles size={15} style={{ color: '#fbbf24', flexShrink: 0, marginTop: '2px' }} />
            <span>
              <strong>AI Sketch Auto-Dimension:</strong> Includes {selectedPlan.includedScans} AI scan credits on {selectedPlan.name}; buy extra scans anytime at will (credits never expire).
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.82rem', color: '#fef3c7' }}>
            <CheckCircle2 size={15} style={{ color: '#fbbf24', flexShrink: 0, marginTop: '2px' }} />
            <span>
              <strong>Full Woodwork &amp; Timber BOQ:</strong> Unlocked rafter, purlin, kingpost, tie beam, and carpenter cost schedules.
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.82rem', color: '#fef3c7' }}>
            <CheckCircle2 size={15} style={{ color: '#fbbf24', flexShrink: 0, marginTop: '2px' }} />
            <span>
              <strong>Water Collector (WC) BOQ &amp; Downpipe Quotations:</strong> Unlocked rain gutter runs, corner miters (90°/135°/45°), floor drop pipes, elbows, and PDF exports.
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.82rem', color: '#fef3c7' }}>
            <CheckCircle2 size={15} style={{ color: '#fbbf24', flexShrink: 0, marginTop: '2px' }} />
            <span>
              <strong>Company Info, PDF Logo &amp; Permanent Saved Prices:</strong> Upload your company logo, set your contractor name &amp; phone once, and save your custom material prices permanently to your account across devices.
            </span>
          </div>
        </div>

        {supabaseEnabled ? (
          /* Live Supabase + Paystack Auth & Billing Flow */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {isPasswordRecovery && proAccessToken ? (
              <form
                onSubmit={handleUpdateRecoveredPassword}
                style={{
                  padding: '1rem',
                  borderRadius: '10px',
                  background: 'rgba(15, 23, 42, 0.55)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.7rem',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Set a New Password
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    {proEmail ? `Choose a new password for ${proEmail}.` : 'Choose a new password for your RoofCalc Pro account.'}
                  </div>
                </div>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (min 6 chars)"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  style={{
                    padding: '0.55rem 0.7rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'rgba(2, 6, 23, 0.55)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                />
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  style={{
                    padding: '0.55rem 0.7rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'rgba(2, 6, 23, 0.55)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                />
                {(errorMsg || initialError) && (
                  <div style={{ color: '#fca5a5', fontSize: '0.78rem' }}>{errorMsg || initialError}</div>
                )}
                {feedback && <div style={{ color: '#6ee7b7', fontSize: '0.78rem' }}>{feedback}</div>}
                <button
                  type="submit"
                  className="btn-primary-action"
                  disabled={isBusy}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                >
                  {isBusy && <Loader2 size={15} className="animate-spin" />}
                  <span>Save New Password</span>
                </button>
              </form>
            ) : proEmail ? (
              <div
                style={{
                  padding: '0.9rem',
                  borderRadius: '10px',
                  background: 'rgba(15, 23, 42, 0.55)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{proEmail}</span>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: '0.74rem',
                      padding: '0.2rem 0.55rem',
                      borderRadius: '999px',
                      background: isAdminAccount
                        ? 'rgba(16, 185, 129, 0.22)'
                        : isPremium
                        ? 'rgba(16, 185, 129, 0.16)'
                        : 'rgba(148, 163, 184, 0.15)',
                      color: isAdminAccount ? '#34d399' : isPremium ? '#34d399' : '#cbd5e1',
                    }}
                  >
                    {isAdminAccount ? 'ADMIN • ALL ACCESS' : isPremium ? (formattedPlanExpiry || 'PRO ACTIVE') : 'FREE PLAN'}
                  </span>
                </div>

                {isPremium ? (
                  /* Active Pro: Pay-As-You-Go AI Scan Credit Balance + On-Demand Top-Up Packs */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {isAdminAccount ? (
                      <div
                        style={{
                          padding: '0.7rem 0.8rem',
                          borderRadius: '9px',
                          background: 'rgba(16, 185, 129, 0.12)',
                          border: '1px solid rgba(52, 211, 153, 0.35)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.2rem',
                        }}
                      >
                        <div style={{ fontSize: '0.83rem', fontWeight: 700, color: '#6ee7b7' }}>
                          Admin Full Access Active — Unlimited AI Sketch Scans
                        </div>
                        <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                          All Pro features, BOQs, and the Sijitek Admin Dashboard are permanently unlocked on this account.
                        </div>
                      </div>
                    ) : proQuota && (
                      <div
                        style={{
                          padding: '0.7rem 0.8rem',
                          borderRadius: '9px',
                          background:
                            proQuota.remaining <= 0
                              ? 'rgba(239, 68, 68, 0.12)'
                              : proQuota.remaining <= 15
                                ? 'rgba(245, 158, 11, 0.12)'
                                : 'rgba(14, 165, 233, 0.1)',
                          border: `1px solid ${
                            proQuota.remaining <= 0
                              ? 'rgba(239, 68, 68, 0.35)'
                              : proQuota.remaining <= 15
                                ? 'rgba(245, 158, 11, 0.35)'
                                : 'rgba(56, 189, 248, 0.28)'
                          }`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.2rem',
                        }}
                      >
                        <div style={{ fontSize: '0.83rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          AI Sketch Scan Credits:{' '}
                          <span style={{ color: proQuota.remaining <= 0 ? '#fca5a5' : '#38bdf8' }}>
                            {proQuota.remaining} remaining
                          </span>
                        </div>
                        <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                          {proQuota.used} used of {proQuota.limit} total credits • Pay-as-you-go (never expires)
                        </div>
                      </div>
                    )}

                    {/* On-Demand Scan Top-Up Packs */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Zap size={14} style={{ color: '#fbbf24' }} />
                          Buy Extra AI Scans (Pay Anytime, One-Time)
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.5rem' }}>
                        {pricingInfo.scanPacks.map((pack) => {
                          const busy = checkoutBusyId === pack.id;
                          const isPopular = pack.id === 'scans_100';
                          return (
                            <button
                              key={pack.id}
                              type="button"
                              disabled={isCheckoutBusy}
                              onClick={() => handleBuyScanPack(pack)}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '0.32rem',
                                padding: '0.72rem 0.45rem',
                                borderRadius: '10px',
                                border: `1px solid ${isPopular ? 'rgba(245, 158, 11, 0.65)' : 'var(--border-color)'}`,
                                background: isPopular
                                  ? 'rgba(245, 158, 11, 0.12)'
                                  : 'rgba(2, 6, 23, 0.55)',
                                color: 'var(--text-primary)',
                                cursor: isCheckoutBusy ? 'wait' : 'pointer',
                                textAlign: 'center',
                              }}
                            >
                              <span
                                style={{
                                  fontSize: '0.64rem',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.03em',
                                  color: isPopular ? '#fbbf24' : '#38bdf8',
                                }}
                              >
                                {pack.badge}
                              </span>
                              <span style={{ fontSize: '0.86rem', fontWeight: 800 }}>
                                +{pack.scans} Scans
                              </span>
                              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#34d399' }}>
                                {busy ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  formatKoboAsCurrency(pack.amountKobo, currency)
                                )}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn-secondary-action"
                        onClick={onRefreshStatus}
                        disabled={isCheckoutBusy}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem' }}
                      >
                        <RefreshCw size={13} />
                        Refresh Scan Balance
                      </button>
                    </div>

                    {errorMsg && (
                      <div style={{ fontSize: '0.76rem', color: '#f87171', lineHeight: 1.4 }}>
                        {errorMsg}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Free Plan: 3-Tier Prepaid Ladder (30-Day, Annual, Founding Lifetime) + Referral Discount */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                    {/* 3-Tier Plan Selector */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.45rem' }}>
                      {availablePlans.map((plan) => {
                        const isSelected = plan.id === selectedPlan.id;
                        const planDiscKobo =
                          discountPercent > 0 ? Math.round((plan.amountKobo * discountPercent) / 100) : 0;
                        const planFinalKobo = Math.max(10000, plan.amountKobo - planDiscKobo);
                        const isPopular = Boolean(plan.popular);
                        return (
                          <button
                            key={plan.id}
                            type="button"
                            disabled={isCheckoutBusy}
                            onClick={() => setSelectedPlanId(plan.id)}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '0.26rem',
                              padding: '0.62rem 0.35rem',
                              borderRadius: '10px',
                              border: `1.5px solid ${
                                isSelected
                                  ? '#10b981'
                                  : isPopular
                                    ? 'rgba(245, 158, 11, 0.5)'
                                    : 'var(--border-color)'
                              }`,
                              background: isSelected
                                ? 'rgba(16, 185, 129, 0.14)'
                                : isPopular
                                  ? 'rgba(245, 158, 11, 0.08)'
                                  : 'rgba(2, 6, 23, 0.5)',
                              color: 'var(--text-primary)',
                              cursor: isCheckoutBusy ? 'wait' : 'pointer',
                              textAlign: 'center',
                              transition: 'border-color 0.15s ease, background 0.15s ease',
                            }}
                          >
                            <span
                              style={{
                                fontSize: '0.6rem',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                letterSpacing: '0.03em',
                                padding: '0.12rem 0.38rem',
                                borderRadius: '999px',
                                background: isSelected
                                  ? 'rgba(16, 185, 129, 0.24)'
                                  : isPopular
                                    ? 'rgba(245, 158, 11, 0.2)'
                                    : 'rgba(56, 189, 248, 0.14)',
                                color: isSelected ? '#6ee7b7' : isPopular ? '#fbbf24' : '#7dd3fc',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {plan.badge}
                            </span>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, lineHeight: 1.15 }}>
                              {plan.name}
                            </span>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.05rem' }}>
                              {hasDiscount && (
                                <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                                  {formatKoboAsCurrency(plan.amountKobo, currency)}
                                </span>
                              )}
                              <span style={{ fontSize: '0.9rem', fontWeight: 800, color: isSelected ? '#34d399' : '#f8fafc' }}>
                                {formatKoboAsCurrency(hasDiscount ? planFinalKobo : plan.amountKobo, currency)}
                              </span>
                              <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>
                                {plan.periodLabel}
                              </span>
                            </div>
                            <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#38bdf8' }}>
                              +{plan.includedScans} AI scans
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Selected Plan Summary Banner */}
                    <div
                      style={{
                        padding: '0.68rem 0.8rem',
                        borderRadius: '9px',
                        background: hasDiscount ? 'rgba(16, 185, 129, 0.1)' : 'rgba(2, 6, 23, 0.45)',
                        border: `1px solid ${hasDiscount ? 'rgba(16, 185, 129, 0.35)' : 'var(--border-color)'}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.4rem',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          <strong>{selectedPlan.name}</strong> • {selectedPlan.subtitle} • {selectedPlan.includedScans} AI scans
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.45rem', marginTop: '0.12rem' }}>
                          {hasDiscount && (
                            <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                              {displayBasePrice}
                            </span>
                          )}
                          <span style={{ fontSize: '1.16rem', fontWeight: 800, color: hasDiscount ? '#34d399' : '#f8fafc' }}>
                            {displayFinalPrice}
                          </span>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            {selectedPlan.periodLabel}
                          </span>
                        </div>
                      </div>
                      {hasDiscount && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.55rem',
                            borderRadius: '999px',
                            background: 'rgba(16, 185, 129, 0.2)',
                            color: '#34d399',
                          }}
                        >
                          {discountPercent}% OFF • {appliedReferral.code}
                        </span>
                      )}
                    </div>

                    {/* Referral / Promo Code Input */}
                    <form onSubmit={handleApplyReferral} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <label style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Tag size={12} style={{ color: '#38bdf8' }} />
                        Have an influencer or referral code?
                      </label>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <input
                          type="text"
                          value={referralInput}
                          onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                          placeholder="Enter code (e.g. CHUKA15)"
                          disabled={referralBusy || isCheckoutBusy}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            padding: '0.45rem 0.65rem',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            background: 'rgba(2, 6, 23, 0.55)',
                            color: 'var(--text-primary)',
                            fontSize: '0.8rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}
                        />
                        {appliedReferral ? (
                          <button
                            type="button"
                            className="btn-secondary-action"
                            onClick={handleClearReferral}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.45rem 0.65rem', fontSize: '0.76rem' }}
                          >
                            <X size={13} />
                            Remove
                          </button>
                        ) : (
                          <button
                            type="submit"
                            className="btn-secondary-action"
                            disabled={referralBusy || !referralInput.trim()}
                            style={{ padding: '0.45rem 0.75rem', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                          >
                            {referralBusy ? <Loader2 size={13} className="animate-spin" /> : 'Apply'}
                          </button>
                        )}
                      </div>
                      {appliedReferral && (
                        <div style={{ fontSize: '0.73rem', color: '#34d399' }}>
                          Code <strong>{appliedReferral.code}</strong> applied
                          {appliedReferral.influencerName ? ` (${appliedReferral.influencerName})` : ''} — you save{' '}
                          {formatKoboAsCurrency(actualDiscountKobo, currency)} on {selectedPlan.name}!
                        </div>
                      )}
                      {referralError && (
                        <div style={{ fontSize: '0.73rem', color: '#fca5a5' }}>{referralError}</div>
                      )}
                    </form>

                    {/* Checkout & Refresh Buttons */}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn-primary-action"
                        onClick={handleStartProCheckout}
                        disabled={isCheckoutBusy}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          fontSize: '0.82rem',
                        }}
                      >
                        {checkoutBusyId === 'pro_upgrade' ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            <span>Redirecting to Paystack...</span>
                          </>
                        ) : (
                          <>
                            <span>
                              Get {selectedPlan.name} — {displayFinalPrice}
                            </span>
                            <ExternalLink size={14} />
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary-action"
                        onClick={onRefreshStatus}
                        disabled={isCheckoutBusy}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}
                      >
                        <RefreshCw size={14} />
                        Refresh Status
                      </button>
                    </div>
                    <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      Pay easily via Bank Transfer, OPay, USSD, or Card on Paystack. No forced auto-renewals.
                    </div>
                    {errorMsg && (
                      <div style={{ fontSize: '0.76rem', color: '#f87171', lineHeight: 1.4 }}>
                        {errorMsg}
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={onSignOut}
                  style={{
                    alignSelf: 'flex-start',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontSize: '0.76rem',
                    padding: 0,
                  }}
                >
                  <LogOut size={13} />
                  Sign out
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {appliedReferral && (
                  <div
                    style={{
                      padding: '0.55rem 0.75rem',
                      borderRadius: '9px',
                      background: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      fontSize: '0.76rem',
                      color: '#6ee7b7',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    <Tag size={14} />
                    <span>
                      Referral code <strong>{appliedReferral.code}</strong> ({appliedReferral.discountPercent}% off →{' '}
                      <strong>{displayFinalPrice}</strong>) is ready — sign in to claim it!
                    </span>
                  </div>
                )}

                {directGoogleSupported ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.45rem', width: '100%' }}>
                    <div
                      ref={googleBtnHostRef}
                      style={{
                        width: '100%',
                        minHeight: '42px',
                        display: 'flex',
                        justifyContent: 'center',
                        opacity: googleAuthBusy ? 0.6 : 1,
                        pointerEvents: googleAuthBusy ? 'none' : 'auto',
                      }}
                    />
                    {googleAuthBusy && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: '#38bdf8' }}>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Signing in with Google...</span>
                      </div>
                    )}
                    {!googleBtnReady && !googleAuthBusy && (
                      <button
                        type="button"
                        onClick={signInWithGoogle}
                        style={{
                          width: '100%',
                          padding: '0.62rem 0.9rem',
                          borderRadius: '9px',
                          border: '1px solid rgba(255,255,255,0.2)',
                          background: '#ffffff',
                          color: '#0f172a',
                          fontSize: '0.86rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.55rem',
                        }}
                      >
                        <span>Continue with Google (Gmail)</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={signInWithGoogle}
                    style={{
                      width: '100%',
                      padding: '0.62rem 0.9rem',
                      borderRadius: '9px',
                      border: '1px solid rgba(255,255,255,0.2)',
                      background: '#ffffff',
                      color: '#0f172a',
                      fontSize: '0.86rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.55rem',
                    }}
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.37 24 12 24Z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.37 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                      />
                    </svg>
                    <span>Continue with Google (Gmail)</span>
                  </button>
                )}

                {isLanDev && (
                  <div
                    style={{
                      padding: '0.7rem 0.75rem',
                      borderRadius: '10px',
                      background: 'rgba(14, 165, 233, 0.08)',
                      border: '1px solid rgba(56, 189, 248, 0.28)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', color: '#bae6fd', lineHeight: 1.4 }}>
                      <strong>Phone LAN Sign-In Helper:</strong> Supabase redirects to{' '}
                      <code>localhost</code> unless <code>{window.location.origin}</code> is added to{' '}
                      <strong>Supabase → Authentication → URL Configuration → Redirect URLs</strong>.
                    </div>
                    <button
                      type="button"
                      className="btn-secondary-action"
                      onClick={handleSyncFromLaptop}
                      disabled={lanSyncBusy}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        fontSize: '0.78rem',
                        padding: '0.45rem 0.65rem',
                      }}
                    >
                      {lanSyncBusy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                      <span>Sync Sign-In from Laptop</span>
                    </button>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <input
                        type="url"
                        value={pastedCallbackUrl}
                        onChange={(e) => setPastedCallbackUrl(e.target.value)}
                        placeholder="Paste http://localhost:5173/#access_token=..."
                        style={{
                          flex: 1,
                          minWidth: 0,
                          padding: '0.42rem 0.6rem',
                          borderRadius: '7px',
                          border: '1px solid var(--border-color)',
                          background: 'rgba(2, 6, 23, 0.55)',
                          color: 'var(--text-primary)',
                          fontSize: '0.76rem',
                        }}
                      />
                      <button
                        type="button"
                        className="btn-secondary-action"
                        onClick={handleConsumePastedUrl}
                        disabled={lanSyncBusy}
                        style={{
                          padding: '0.42rem 0.65rem',
                          fontSize: '0.76rem',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Apply
                      </button>
                    </div>
                    {errorMsg && <div style={{ color: '#fca5a5', fontSize: '0.75rem' }}>{errorMsg}</div>}
                    {feedback && <div style={{ color: '#6ee7b7', fontSize: '0.75rem' }}>{feedback}</div>}
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.74rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  <span style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
                  <span>or continue with email</span>
                  <span style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
                </div>

                <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {authMode === 'forgot' ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          Reset your password
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setAuthMode('signin');
                            setErrorMsg('');
                            setFeedback('');
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#38bdf8',
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          ← Back to Sign In
                        </button>
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                        Enter your account email and we&apos;ll send a reset link from{' '}
                        <strong style={{ color: 'var(--text-secondary)' }}>support@sijiteksolutions.com</strong>.
                      </div>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email address"
                        required
                        style={{
                          padding: '0.55rem 0.7rem',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'rgba(2, 6, 23, 0.55)',
                          color: 'var(--text-primary)',
                          fontSize: '0.85rem',
                        }}
                      />
                      {(errorMsg || initialError) && (
                        <div style={{ color: '#fca5a5', fontSize: '0.78rem' }}>{errorMsg || initialError}</div>
                      )}
                      {feedback && <div style={{ color: '#6ee7b7', fontSize: '0.78rem', lineHeight: 1.45 }}>{feedback}</div>}
                      <button
                        type="submit"
                        className="btn-primary-action"
                        disabled={isBusy}
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                      >
                        {isBusy && <Loader2 size={15} className="animate-spin" />}
                        <span>Send Reset Link</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        {['signin', 'signup'].map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => {
                              setAuthMode(mode);
                              setErrorMsg('');
                              setFeedback('');
                            }}
                            style={{
                              flex: 1,
                              padding: '0.45rem',
                              borderRadius: '8px',
                              border: `1px solid ${authMode === mode ? '#0ea5e9' : 'var(--border-color)'}`,
                              background: authMode === mode ? 'rgba(14, 165, 233, 0.14)' : 'transparent',
                              color: authMode === mode ? '#38bdf8' : 'var(--text-secondary)',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            {mode === 'signin' ? 'Sign In' : 'Create Account'}
                          </button>
                        ))}
                      </div>

                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email address"
                        required
                        style={{
                          padding: '0.55rem 0.7rem',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'rgba(2, 6, 23, 0.55)',
                          color: 'var(--text-primary)',
                          fontSize: '0.85rem',
                        }}
                      />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password (min 6 chars)"
                        required
                        style={{
                          padding: '0.55rem 0.7rem',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'rgba(2, 6, 23, 0.55)',
                          color: 'var(--text-primary)',
                          fontSize: '0.85rem',
                        }}
                      />

                      {authMode === 'signin' && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-0.2rem' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setAuthMode('forgot');
                              setErrorMsg('');
                              setFeedback('');
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#38bdf8',
                              fontSize: '0.76rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              padding: '0.1rem 0',
                            }}
                          >
                            Forgot password?
                          </button>
                        </div>
                      )}

                      {(errorMsg || initialError) && (
                        <div style={{ color: '#fca5a5', fontSize: '0.78rem' }}>{errorMsg || initialError}</div>
                      )}
                      {feedback && <div style={{ color: '#6ee7b7', fontSize: '0.78rem' }}>{feedback}</div>}

                      <button
                        type="submit"
                        className="btn-primary-action"
                        disabled={isBusy}
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                      >
                        {isBusy && <Loader2 size={15} className="animate-spin" />}
                        <span>{authMode === 'signin' ? 'Sign In' : 'Create Account'}</span>
                      </button>
                    </>
                  )}
                </form>
              </div>
            )}
          </div>
        ) : (
          /* Preview Pro fallback before Supabase env vars are added */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div
              style={{
                padding: '0.85rem',
                borderRadius: '10px',
                background: 'rgba(15, 23, 42, 0.55)',
                border: '1px solid var(--border-color)',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              <strong>Pro Preview Mode:</strong> Toggle Pro features below to test Pro AI sketch scanning and timber quotations.
            </div>

            <button
              type="button"
              className={isPremium ? 'btn-secondary-action' : 'btn-primary-action'}
              onClick={() => {
                onTogglePreviewPro?.(!isPremium);
                onClose();
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem',
              }}
            >
              <Crown size={16} />
              <span>{isPremium ? 'Disable Pro Preview' : 'Enable Pro Preview (Test AI & Quotes)'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
