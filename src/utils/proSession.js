/**
 * Lightweight Supabase REST Auth + Pro Subscription helper (zero npm SDK required).
 * Falls back cleanly to local Preview Pro state when Supabase env vars are not yet set.
 */

const AUTH_SESSION_KEY = 'roofcalc_supabase_session_v1';
const PRO_STATUS_CACHE_KEY = 'roofcalc_pro_status_v1';
const PREVIEW_PRO_KEY = 'roofcalc_preview_pro_v1';
const PENDING_PAYSTACK_REF_KEY = 'roofcalc_pending_paystack_ref_v1';
const PENDING_PAYSTACK_TTL_MS = 24 * 60 * 60 * 1000;
const REFERRAL_CODE_KEY = 'roofcalc_referral_code_v1';
const REFERRAL_CODE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const LEGACY_CUSTOM_PRICES_KEY = 'roofcalc_custom_prices_v1';
const CUSTOM_PRICES_PREFIX = 'roofcalc_custom_prices_acct_v2_';
const CONTRACTOR_PROFILE_PREFIX = 'roofcalc_contractor_acct_v1_';

export const DEFAULT_CONTRACTOR_INFO = {
  name: 'Sijitek Solutions',
  phone: '+234 810 000 0000',
  email: 'info@sijiteksolutions.com',
  address: 'Lagos, Nigeria',
  logoDataUrl: '',
};

export function getAccountCustomPrices(userId = null) {
  if (typeof window === 'undefined') return {};
  const key = `${CUSTOM_PRICES_PREFIX}${userId ? String(userId) : 'guest'}`;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    }
    // One-time read of legacy key for current guest/first-time migration if no account key exists yet
    if (!userId) {
      const legacy = window.localStorage.getItem(LEGACY_CUSTOM_PRICES_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
      }
    }
  } catch {
    // Ignore storage errors
  }
  return {};
}

export function saveAccountCustomPrices(userId = null, prices = {}) {
  if (typeof window === 'undefined') return;
  const key = `${CUSTOM_PRICES_PREFIX}${userId ? String(userId) : 'guest'}`;
  try {
    window.localStorage.setItem(key, JSON.stringify(prices || {}));
  } catch {
    // Ignore storage quota errors
  }
}

export function getAccountContractorProfile(userId = null) {
  if (typeof window === 'undefined') return { ...DEFAULT_CONTRACTOR_INFO };
  const key = `${CONTRACTOR_PROFILE_PREFIX}${userId ? String(userId) : 'guest'}`;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { ...DEFAULT_CONTRACTOR_INFO, ...parsed };
      }
    }
  } catch {
    // Ignore storage errors
  }
  return { ...DEFAULT_CONTRACTOR_INFO };
}

export function saveAccountContractorProfile(userId = null, profile = {}) {
  if (typeof window === 'undefined') return;
  const key = `${CONTRACTOR_PROFILE_PREFIX}${userId ? String(userId) : 'guest'}`;
  try {
    window.localStorage.setItem(key, JSON.stringify({ ...DEFAULT_CONTRACTOR_INFO, ...(profile || {}) }));
  } catch {
    // Ignore storage quota errors
  }
}

export async function saveUserAccountSettings(accessToken, payload = {}) {
  if (!accessToken) {
    return { ok: false, error: 'Sign in required.' };
  }
  try {
    const resp = await fetch('/api/user-settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return { ok: false, status: resp.status, error: data?.error || `Save failed (${resp.status})` };
    }
    return { ok: true, savedAt: data?.savedAt || new Date().toISOString() };
  } catch (err) {
    return { ok: false, error: err?.message || 'Network error while saving settings.' };
  }
}

export const DEFAULT_PRO_PLANS = [
  {
    id: 'pro_monthly',
    name: '30-Day Pass',
    shortLabel: '30 Days',
    badge: 'Try Pro',
    subtitle: '1 project or trial',
    amountKobo: 500000,
    days: 30,
    includedScans: 30,
    periodLabel: '/ 30 days',
    savingsText: '',
  },
  {
    id: 'pro_annual',
    name: 'Annual Pro',
    shortLabel: '1 Year',
    badge: 'Save 50%',
    subtitle: '₦2,500/mo billed yearly',
    amountKobo: 3000000,
    days: 365,
    includedScans: 100,
    periodLabel: '/ year',
    savingsText: 'Save 50%',
    popular: true,
  },
  {
    id: 'pro_lifetime',
    name: 'Founding Lifetime',
    shortLabel: 'Lifetime',
    badge: 'First 100',
    subtitle: 'Pay once, own forever',
    amountKobo: 7500000,
    days: null,
    includedScans: 200,
    periodLabel: 'one-time',
    savingsText: 'Never expires',
  },
];

export const DEFAULT_PRO_PLAN_ID = 'pro_annual';

export const DEFAULT_SCAN_TOPUP_PACKS = [
  { id: 'scans_50', label: '+50 AI Scans', scans: 50, amountKobo: 350000, badge: 'Quick Boost' },
  { id: 'scans_100', label: '+100 AI Scans', scans: 100, amountKobo: 600000, badge: 'Most Popular' },
  { id: 'scans_250', label: '+250 AI Scans', scans: 250, amountKobo: 1200000, badge: 'Best Value' },
];

export function formatKoboAsCurrency(amountKobo, currency = 'NGN') {
  const major = Math.round((Number(amountKobo) || 0) / 100);
  if (String(currency || 'NGN').toUpperCase() === 'NGN') {
    return `₦${major.toLocaleString('en-NG')}`;
  }
  return `${String(currency || 'NGN').toUpperCase()} ${major.toLocaleString()}`;
}

export function saveStoredReferralCode(code) {
  try {
    const clean = String(code || '').trim().toUpperCase();
    if (!clean) {
      localStorage.removeItem(REFERRAL_CODE_KEY);
      return;
    }
    localStorage.setItem(
      REFERRAL_CODE_KEY,
      JSON.stringify({ code: clean, savedAt: Date.now() })
    );
  } catch {
    // Ignore storage errors
  }
}

export function getStoredReferralCode() {
  try {
    const raw = localStorage.getItem(REFERRAL_CODE_KEY);
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    if (!parsed?.code) return '';
    if (parsed.savedAt && Date.now() - Number(parsed.savedAt) > REFERRAL_CODE_TTL_MS) {
      localStorage.removeItem(REFERRAL_CODE_KEY);
      return '';
    }
    return String(parsed.code).trim().toUpperCase();
  } catch {
    return '';
  }
}

/**
 * Captures `?ref=CODE` or `?promo=CODE` from shareable influencer links and persists it
 * across Google OAuth redirects and future visits.
 */
export function captureReferralCodeFromUrl() {
  if (typeof window === 'undefined') return getStoredReferralCode();
  try {
    const url = new URL(window.location.href);
    const ref = (url.searchParams.get('ref') || url.searchParams.get('promo') || '').trim().toUpperCase();
    if (ref && /^[A-Z0-9_-]{3,32}$/.test(ref)) {
      saveStoredReferralCode(ref);
      url.searchParams.delete('ref');
      url.searchParams.delete('promo');
      const cleanSearch = url.searchParams.toString();
      window.history.replaceState(
        {},
        '',
        `${url.pathname}${cleanSearch ? `?${cleanSearch}` : ''}${url.hash || ''}`
      );
      return ref;
    }
  } catch {
    // Ignore URL parse errors
  }
  return getStoredReferralCode();
}

export function extractPartnerLinkFromUrl() {
  if (typeof window === 'undefined') return null;
  try {
    const url = new URL(window.location.href);
    const code = (url.searchParams.get('partner') || '').trim().toUpperCase();
    const token = (url.searchParams.get('token') || '').trim();
    if (code && token) {
      return { code, token };
    }
  } catch {
    // Ignore URL parse errors
  }
  return null;
}

export const ADMIN_EMAILS = ['sijiteksub@gmail.com'];

export function isAdminEmail(email) {
  return ADMIN_EMAILS.includes(String(email || '').trim().toLowerCase());
}

export async function callAdminReferralsApi(accessToken, payload = { action: 'list' }) {
  if (!accessToken) {
    throw new Error('Sign in with an admin account first.');
  }
  const resp = await fetch('/api/admin-referrals', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data?.error || `Admin request failed (${resp.status}).`);
  }
  return data;
}

export async function fetchPartnerStats(code, token) {
  const resp = await fetch('/api/partner-stats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, token }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data?.error || `Could not load partner earnings (${resp.status}).`);
  }
  return data;
}

export async function fetchPricingAndReferral({ code = '', planId = DEFAULT_PRO_PLAN_ID, accessToken = '' } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  const resp = await fetch('/api/validate-referral', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      code: String(code || '').trim().toUpperCase(),
      planId: String(planId || DEFAULT_PRO_PLAN_ID).trim().toLowerCase(),
    }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data?.error || `Could not check pricing (${resp.status}).`);
  }
  return data;
}

export function hasPendingPaystackCheck() {
  if (typeof window === 'undefined') return false;
  try {
    const url = new URL(window.location.href);
    if (
      url.searchParams.get('paystack_verify') === '1' ||
      Boolean(url.searchParams.get('reference')) ||
      Boolean(url.searchParams.get('trxref'))
    ) {
      return true;
    }
  } catch {
    // Ignore URL parse errors
  }
  return Boolean(getPendingPaystackRef());
}

export function savePendingPaystackRef(reference) {
  try {
    if (!reference) {
      localStorage.removeItem(PENDING_PAYSTACK_REF_KEY);
      return;
    }
    localStorage.setItem(
      PENDING_PAYSTACK_REF_KEY,
      JSON.stringify({ reference: String(reference).trim(), savedAt: Date.now() })
    );
  } catch {
    // Ignore private-mode storage errors
  }
}

export function getPendingPaystackRef() {
  try {
    const raw = localStorage.getItem(PENDING_PAYSTACK_REF_KEY);
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    if (!parsed?.reference) return '';
    if (parsed.savedAt && Date.now() - Number(parsed.savedAt) > PENDING_PAYSTACK_TTL_MS) {
      localStorage.removeItem(PENDING_PAYSTACK_REF_KEY);
      return '';
    }
    return String(parsed.reference).trim();
  } catch {
    return '';
  }
}

export function getStoredProStatus() {
  try {
    const raw = localStorage.getItem(PRO_STATUS_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveStoredProStatus(status) {
  try {
    if (!status) {
      localStorage.removeItem(PRO_STATUS_CACHE_KEY);
    } else {
      localStorage.setItem(PRO_STATUS_CACHE_KEY, JSON.stringify(status));
    }
  } catch {
    // Ignore private-mode storage errors
  }
}

function getEnv(name) {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return String(import.meta.env[name] || '').trim();
  }
  return '';
}

export function isSupabaseConfigured() {
  const url = getEnv('VITE_SUPABASE_URL');
  const anon = getEnv('VITE_SUPABASE_ANON_KEY');
  return Boolean(url.startsWith('http') && anon.length > 20);
}

export function getPaystackCheckoutUrl(email = '') {
  const base = getEnv('VITE_PAYSTACK_PAYMENT_URL');
  if (!base) return '';
  if (!email) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}email=${encodeURIComponent(email)}`;
}

export function getStoredAuthSession() {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveAuthSession(session, options = {}) {
  try {
    if (!session) {
      localStorage.removeItem(AUTH_SESSION_KEY);
      localStorage.removeItem(PRO_STATUS_CACHE_KEY);
    } else {
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    }
  } catch {
    // Ignore private-mode storage errors
  }

  const isDev = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);
  if (isDev && !options.skipRemoteSync && typeof window !== 'undefined') {
    fetch('/api/__dev-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session: session || null,
        proStatus: session ? getStoredProStatus() : null,
      }),
    }).catch(() => { });
  }
}

export async function syncDevAuthSession(existingSession = null) {
  const isDev = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);
  if (!isDev || typeof window === 'undefined') {
    return existingSession;
  }
  if (existingSession?.access_token) {
    fetch('/api/__dev-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session: existingSession,
        proStatus: getStoredProStatus(),
      }),
    }).catch(() => { });
    return existingSession;
  }
  try {
    const resp = await fetch('/api/__dev-session');
    if (!resp.ok) return existingSession;
    const data = await resp.json().catch(() => ({}));
    if (data?.proStatus) {
      saveStoredProStatus(data.proStatus);
    }
    if (data?.session?.access_token) {
      saveAuthSession(data.session, { skipRemoteSync: true });
      return data.session;
    }
  } catch {
    // Ignore dev session bridge errors
  }
  return existingSession;
}

export function getPreviewProFlag() {
  try {
    return localStorage.getItem(PREVIEW_PRO_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setPreviewProFlag(enabled) {
  try {
    if (enabled) {
      localStorage.setItem(PREVIEW_PRO_KEY, 'true');
    } else {
      localStorage.removeItem(PREVIEW_PRO_KEY);
    }
  } catch {
    // Ignore private-mode storage errors
  }
}

async function supabaseAuthRequest(path, payload) {
  const url = getEnv('VITE_SUPABASE_URL').replace(/\/$/, '');
  const anonKey = getEnv('VITE_SUPABASE_ANON_KEY');
  const resp = await fetch(`${url}${path}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data?.msg || data?.error_description || data?.error || `Auth failed (${resp.status})`);
  }
  return data;
}

export async function signInWithSupabase(email, password) {
  const data = await supabaseAuthRequest('/auth/v1/token?grant_type=password', {
    email: String(email).trim(),
    password,
  });
  if (data?.access_token) {
    saveAuthSession(data);
  }
  return data;
}

export async function signUpWithSupabase(email, password) {
  const redirectTo = typeof window !== 'undefined' ? window.location.origin : '';
  const query = redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : '';
  const data = await supabaseAuthRequest(`/auth/v1/signup${query}`, {
    email: String(email).trim(),
    password,
  });
  if (data?.access_token) {
    saveAuthSession(data);
  }
  return data;
}

export async function requestPasswordReset(email) {
  const cleanEmail = String(email || '').trim();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }
  const redirectTo = typeof window !== 'undefined' ? window.location.origin : '';
  const query = redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : '';
  await supabaseAuthRequest(`/auth/v1/recover${query}`, {
    email: cleanEmail,
  });
  return { ok: true };
}

export async function updateSupabasePassword(accessToken, newPassword) {
  if (!accessToken) {
    throw new Error('Your password reset link has expired. Please request a new one.');
  }
  if (!newPassword || newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters.');
  }
  const url = getEnv('VITE_SUPABASE_URL').replace(/\/$/, '');
  const anonKey = getEnv('VITE_SUPABASE_ANON_KEY');
  const resp = await fetch(`${url}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password: newPassword }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data?.msg || data?.error_description || data?.error || `Could not update password (${resp.status})`);
  }
  return data;
}

export function getGoogleClientId() {
  return getEnv('VITE_GOOGLE_CLIENT_ID');
}

export function isDirectGoogleSignInSupported() {
  if (typeof window === 'undefined') return false;
  const clientId = getGoogleClientId();
  if (!clientId) return false;
  const isSecureOrigin =
    window.location.protocol === 'https:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';
  return isSecureOrigin && Boolean(window.crypto?.subtle);
}

export async function createGoogleAuthNoncePair() {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  const rawNonce = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const encoded = new TextEncoder().encode(rawNonce);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', encoded);
  const hashedNonce = Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, '0')).join('');
  return { rawNonce, hashedNonce };
}

/**
 * Exchanges a Google Identity Services `id_token` directly with Supabase Auth.
 * Shows your own domain (sijiteksolutions.com / RoofCalc Pro) on Google's sign-in screen
 * instead of `*.supabase.co`.
 */
export async function signInWithGoogleIdToken(idToken, rawNonce) {
  if (!idToken) {
    throw new Error('Google did not return a sign-in token.');
  }
  const data = await supabaseAuthRequest('/auth/v1/token?grant_type=id_token', {
    provider: 'google',
    id_token: idToken,
    ...(rawNonce ? { nonce: rawNonce } : {}),
  });
  if (data?.access_token) {
    saveAuthSession(data);
  }
  return data;
}

export function signInWithGoogle() {
  if (!isSupabaseConfigured() || typeof window === 'undefined') return;
  const url = getEnv('VITE_SUPABASE_URL').replace(/\/$/, '');
  const redirectTo = window.location.origin;
  window.location.assign(
    `${url}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`
  );
}

export async function consumeOAuthCallbackFromUrl(rawUrlOverride = '') {
  if (!isSupabaseConfigured() || typeof window === 'undefined') {
    return { session: null, error: null };
  }
  const overrideStr = typeof rawUrlOverride === 'string' ? rawUrlOverride.trim() : '';
  const hasOverride = Boolean(overrideStr);

  let hashStr = window.location.hash ? window.location.hash.replace(/^#/, '') : '';
  let searchStr = window.location.search ? window.location.search.replace(/^\?/, '') : '';

  if (hasOverride) {
    try {
      const normalized = overrideStr.includes('://')
        ? overrideStr
        : `http://localhost${overrideStr.startsWith('/') || overrideStr.startsWith('#') || overrideStr.startsWith('?') ? '' : '/'}${overrideStr}`;
      const parsed = new URL(normalized);
      hashStr = parsed.hash ? parsed.hash.replace(/^#/, '') : '';
      searchStr = parsed.search ? parsed.search.replace(/^\?/, '') : '';
    } catch {
      const hashIdx = overrideStr.indexOf('#');
      hashStr = hashIdx >= 0 ? overrideStr.slice(hashIdx + 1) : '';
      searchStr = '';
    }
    if (!hashStr && overrideStr.includes('access_token=')) {
      hashStr = overrideStr.replace(/^[?#]/, '');
    }
  }

  const hashParams = new URLSearchParams(hashStr);
  const queryParams = new URLSearchParams(searchStr);

  const errorDesc = hashParams.get('error_description') || queryParams.get('error_description');
  if (errorDesc) {
    if (!hasOverride) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    return { session: null, error: errorDesc };
  }

  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token') || '';
  const authType = (hashParams.get('type') || queryParams.get('type') || '').toLowerCase();
  if (!accessToken) {
    return { session: null, error: null, type: '' };
  }

  const url = getEnv('VITE_SUPABASE_URL').replace(/\/$/, '');
  const anonKey = getEnv('VITE_SUPABASE_ANON_KEY');
  try {
    const resp = await fetch(`${url}/auth/v1/user`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!resp.ok) {
      if (!hasOverride) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
      return { session: null, error: 'Sign-in link could not be verified or has expired.', type: authType };
    }
    const user = await resp.json();
    const session = { access_token: accessToken, refresh_token: refreshToken, user };
    saveAuthSession(session);
    if (!hasOverride) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    return { session, error: null, type: authType };
  } catch (err) {
    if (!hasOverride) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    return { session: null, error: err?.message || 'Sign-in failed.', type: authType };
  }
}

export async function fetchSupabaseProProfile(session) {
  if (!isSupabaseConfigured() || !session?.access_token || !session?.user?.id) {
    return { isPro: false, quota: null, sessionValid: false };
  }

  const url = getEnv('VITE_SUPABASE_URL').replace(/\/$/, '');
  const anonKey = getEnv('VITE_SUPABASE_ANON_KEY');

  const query = async (token, uid, includeSettings = true) => {
    const cols = includeSettings
      ? 'is_pro,plan_expires_at,ai_scans_used,ai_scans_limit,custom_prices,contractor_profile'
      : 'is_pro,plan_expires_at,ai_scans_used,ai_scans_limit';
    return fetch(
      `${url}/rest/v1/profiles?id=eq.${encodeURIComponent(uid)}&select=${cols}`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${token}`,
        },
      }
    );
  };

  let activeSession = session;
  let resp = await query(activeSession.access_token, activeSession.user.id, true);

  // Graceful fallback if custom_prices / contractor_profile columns are not yet migrated
  if (resp.status === 400) {
    resp = await query(activeSession.access_token, activeSession.user.id, false);
  }

  // Refresh expired token automatically if refresh_token is available
  if (resp.status === 401 && activeSession.refresh_token) {
    try {
      const refreshed = await supabaseAuthRequest('/auth/v1/token?grant_type=refresh_token', {
        refresh_token: activeSession.refresh_token,
      });
      if (refreshed?.access_token) {
        activeSession = refreshed;
        saveAuthSession(refreshed);
        resp = await query(activeSession.access_token, activeSession.user?.id || session.user.id, true);
        if (resp.status === 400) {
          resp = await query(activeSession.access_token, activeSession.user?.id || session.user.id, false);
        }
      }
    } catch {
      saveAuthSession(null);
      return { isPro: false, quota: null, sessionValid: false };
    }
  }

  if (!resp.ok) {
    return { isPro: false, quota: null, sessionValid: resp.status !== 401 };
  }

  const rows = await resp.json();
  let profile = rows?.[0];
  const isAdmin = isAdminEmail(activeSession.user?.email || profile?.email);

  // Self-heal missing profile row (e.g. if user already existed in auth.users after profiles cleanup)
  if (!profile) {
    try {
      const syncResp = await fetch('/api/sync-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeSession.access_token}`,
        },
        body: JSON.stringify({}),
      });
      if (syncResp.ok) {
        const synced = await syncResp.json().catch(() => null);
        if (synced?.ok) {
          const syncedStatus = { isPro: Boolean(synced.isPro), quota: synced.quota || null };
          saveStoredProStatus(syncedStatus);
          return {
            isPro: syncedStatus.isPro,
            quota: syncedStatus.quota,
            customPrices: synced.customPrices || null,
            contractorProfile: synced.contractorProfile || null,
            sessionValid: true,
            session: activeSession,
          };
        }
      }
    } catch {
      // Fall back gracefully below
    }

    if (isAdmin) {
      const adminQuota = { used: 0, limit: 999999, remaining: 999999, unlimited: true };
      saveStoredProStatus({ isPro: true, quota: adminQuota });
      return { isPro: true, quota: adminQuota, sessionValid: true, session: activeSession };
    }
    saveStoredProStatus({ isPro: false, quota: null });
    return { isPro: false, quota: null, sessionValid: true, session: activeSession };
  }

  const expired = profile.plan_expires_at && new Date(profile.plan_expires_at) <= new Date();
  const isPro = Boolean(isAdmin || (profile.is_pro && !expired));
  const limit = isAdmin ? 999999 : Number(profile.ai_scans_limit) || 100;
  const used = Number(profile.ai_scans_used) || 0;
  const quota = {
    used,
    limit,
    remaining: isAdmin ? 999999 : Math.max(0, limit - used),
    unlimited: isAdmin,
  };
  const planExpiresAt = profile.plan_expires_at ?? null;

  saveStoredProStatus({ isPro, quota, planExpiresAt });

  const customPrices =
    profile.custom_prices && typeof profile.custom_prices === 'object' && !Array.isArray(profile.custom_prices)
      ? profile.custom_prices
      : null;
  const contractorProfile =
    profile.contractor_profile &&
    typeof profile.contractor_profile === 'object' &&
    !Array.isArray(profile.contractor_profile)
      ? profile.contractor_profile
      : null;

  return {
    isPro,
    quota,
    planExpiresAt,
    customPrices,
    contractorProfile,
    sessionValid: true,
    session: activeSession,
  };
}

export async function startPaystackCheckout(accessToken, optionsOrFallbackEmail = '') {
  if (!accessToken) {
    throw new Error('Please sign in first before checking out.');
  }
  const opts =
    typeof optionsOrFallbackEmail === 'string'
      ? { fallbackEmail: optionsOrFallbackEmail }
      : optionsOrFallbackEmail || {};
  const {
    purchaseType = 'pro_upgrade',
    planId = DEFAULT_PRO_PLAN_ID,
    packId = null,
    referralCode = '',
    fallbackEmail = '',
  } = opts;

  const returnOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const resp = await fetch('/api/create-checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      returnOrigin,
      purchaseType,
      ...(purchaseType === 'pro_upgrade' && planId ? { planId } : {}),
      ...(packId ? { packId } : {}),
      ...(referralCode ? { referralCode: String(referralCode).trim().toUpperCase() } : {}),
    }),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    if (data?.code === 'PAYMENT_NOT_CONFIGURED' && purchaseType === 'pro_upgrade') {
      const staticUrl = getPaystackCheckoutUrl(fallbackEmail);
      if (staticUrl) return staticUrl;
    }
    throw new Error(data?.error || `Could not start checkout (${resp.status}).`);
  }

  if (!data?.authorization_url) {
    throw new Error('Checkout endpoint did not return a payment URL.');
  }
  // Persist Paystack transaction reference so Bank Transfer / Back-button returns can still verify automatically
  if (data?.reference) {
    savePendingPaystackRef(data.reference);
  }
  return data.authorization_url;
}

export async function verifyPaystackPaymentOnReturn(accessToken) {
  if (typeof window === 'undefined' || !accessToken) {
    return { checked: false, verified: false, fromUrl: false, error: '', purchaseType: null, scansAdded: 0 };
  }

  const url = new URL(window.location.href);
  const urlReference = (url.searchParams.get('reference') || url.searchParams.get('trxref') || '').trim();
  const hasVerifyFlag = url.searchParams.get('paystack_verify') === '1';
  const fromUrl = Boolean(urlReference || hasVerifyFlag);

  if (fromUrl) {
    // Clean Paystack return query params so refreshes don't replay URL params.
    url.searchParams.delete('paystack_verify');
    url.searchParams.delete('reference');
    url.searchParams.delete('trxref');
    const cleanSearch = url.searchParams.toString();
    window.history.replaceState(
      {},
      '',
      `${url.pathname}${cleanSearch ? `?${cleanSearch}` : ''}${url.hash || ''}`
    );
  }

  const reference = urlReference || getPendingPaystackRef();
  if (!reference) {
    return {
      checked: fromUrl,
      verified: false,
      fromUrl,
      error: hasVerifyFlag ? 'Missing Paystack transaction reference.' : '',
      purchaseType: null,
      scansAdded: 0,
    };
  }

  // Save reference in case verification is interrupted mid-flight
  savePendingPaystackRef(reference);

  try {
    const resp = await fetch('/api/verify-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ reference }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      // Clear pending ref on terminal mismatch (400/403); keep on 402 (bank transfer still processing) or transient 5xx
      if (resp.status === 400 || resp.status === 403) {
        savePendingPaystackRef(null);
      }
      return {
        checked: true,
        verified: false,
        fromUrl,
        error: data?.error || `Payment verification failed (${resp.status}).`,
        purchaseType: null,
        scansAdded: 0,
      };
    }
    const verified = Boolean(data?.verified);
    if (verified) {
      savePendingPaystackRef(null);
    }
    return {
      checked: true,
      verified,
      fromUrl,
      error: '',
      purchaseType: data?.purchaseType || 'pro_upgrade',
      scansAdded: Number(data?.scansAdded) || 0,
      quota: data?.quota || null,
      referralCode: data?.referralCode || null,
    };
  } catch (err) {
    return {
      checked: true,
      verified: false,
      fromUrl,
      error: err?.message || 'Network error while verifying payment.',
      purchaseType: null,
      scansAdded: 0,
    };
  }
}

export function getUserDisplayName(user) {
  if (!user) return 'Guest User';
  const fullName = String(user?.user_metadata?.full_name || user?.user_metadata?.name || '').trim();
  if (fullName) return fullName;
  const email = String(user?.email || '').trim();
  if (email.includes('@')) return email.split('@')[0];
  return email || 'Account';
}

export function getUserInitials(user) {
  if (!user) return '';
  const name = String(user?.user_metadata?.full_name || user?.user_metadata?.name || '').trim();
  if (name) {
    const words = name.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
    }
    if (words.length === 1) {
      return words[0].slice(0, 2).toUpperCase();
    }
  }
  const emailLocal = String(user?.email || '').split('@')[0].trim();
  if (emailLocal) {
    const parts = emailLocal.split(/[._-]+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return emailLocal.slice(0, 2).toUpperCase();
  }
  return 'U';
}
