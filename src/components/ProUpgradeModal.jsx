import React, { useState } from 'react';
import { Crown, Sparkles, CheckCircle2, LogOut, RefreshCw, Loader2, ExternalLink } from 'lucide-react';
import {
  isSupabaseConfigured,
  startPaystackCheckout,
  signInWithSupabase,
  signUpWithSupabase,
  signInWithGoogle,
  syncDevAuthSession,
  consumeOAuthCallbackFromUrl,
} from '../utils/proSession';

/**
 * Shared Pro Account & Upgrade modal used by PaperSketchModal & Mobile/Desktop Workspace.
 * Works both with live Supabase + Paystack in Vercel production and with local Pro Preview mode.
 */
export default function ProUpgradeModal({
  isOpen,
  onClose,
  isPremium = false,
  proEmail = '',
  proAccessToken = '',
  proQuota = null,
  onAuthSuccess,
  onRefreshStatus,
  onSignOut,
  onTogglePreviewPro,
}) {
  const [authMode, setAuthMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState(proEmail || '');
  const [password, setPassword] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [pastedCallbackUrl, setPastedCallbackUrl] = useState('');
  const [lanSyncBusy, setLanSyncBusy] = useState(false);

  if (!isOpen) return null;

  const supabaseEnabled = isSupabaseConfigured();
  const isLanDev =
    typeof window !== 'undefined' &&
    Boolean(import.meta.env?.DEV) &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1';

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

  const handleStartCheckout = async () => {
    setCheckoutBusy(true);
    setErrorMsg('');
    setFeedback('');
    try {
      const checkoutUrl = await startPaystackCheckout(proAccessToken, proEmail || email);
      window.location.assign(checkoutUrl);
    } catch (err) {
      setErrorMsg(err?.message || 'Unable to launch Paystack checkout.');
      setCheckoutBusy(false);
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setFeedback('');
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content paper-sketch-modal-card"
        style={{ maxWidth: '460px', width: '92vw', padding: '1.35rem' }}
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
              <strong>AI Sketch Auto-Dimension:</strong> Reads handwritten numbers in any orientation so you jump straight to a scaled 2D plan without manual resizing.
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
        </div>

        {supabaseEnabled ? (
          /* Live Supabase + Paystack Auth & Billing Flow */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {proEmail ? (
              <div
                style={{
                  padding: '0.85rem',
                  borderRadius: '10px',
                  background: 'rgba(15, 23, 42, 0.55)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{proEmail}</span>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: '0.74rem',
                      padding: '0.2rem 0.55rem',
                      borderRadius: '999px',
                      background: isPremium ? 'rgba(16, 185, 129, 0.16)' : 'rgba(148, 163, 184, 0.15)',
                      color: isPremium ? '#34d399' : '#cbd5e1',
                    }}
                  >
                    {isPremium ? 'PRO ACTIVE' : 'FREE PLAN'}
                  </span>
                </div>

                {isPremium && proQuota && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Monthly AI Sketch Scans: <strong>{proQuota.used}</strong> / {proQuota.limit} used ({proQuota.remaining} remaining)
                  </div>
                )}

                {!isPremium && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn-primary-action"
                        onClick={handleStartCheckout}
                        disabled={checkoutBusy}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          fontSize: '0.82rem',
                        }}
                      >
                        {checkoutBusy ? (
                          <>
                            <Loader2 size={14} className="spin" />
                            <span>Redirecting to Paystack...</span>
                          </>
                        ) : (
                          <>
                            <span>Upgrade to Pro</span>
                            <ExternalLink size={14} />
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary-action"
                        onClick={onRefreshStatus}
                        disabled={checkoutBusy}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}
                      >
                        <RefreshCw size={14} />
                        Refresh Status
                      </button>
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
                      {lanSyncBusy ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
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
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {['signin', 'signup'].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setAuthMode(mode)}
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

                {errorMsg && <div style={{ color: '#fca5a5', fontSize: '0.78rem' }}>{errorMsg}</div>}
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
