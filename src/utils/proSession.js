/**
 * Lightweight Supabase REST Auth + Pro Subscription helper (zero npm SDK required).
 * Falls back cleanly to local Preview Pro state when Supabase env vars are not yet set.
 */

const AUTH_SESSION_KEY = 'roofcalc_supabase_session_v1';
const PRO_STATUS_CACHE_KEY = 'roofcalc_pro_status_v1';
const PREVIEW_PRO_KEY = 'roofcalc_preview_pro_v1';

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
    }).catch(() => {});
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
    }).catch(() => {});
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
  const data = await supabaseAuthRequest('/auth/v1/signup', {
    email: String(email).trim(),
    password,
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
  if (!accessToken) {
    return { session: null, error: null };
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
      return { session: null, error: 'Google sign-in session could not be verified.' };
    }
    const user = await resp.json();
    const session = { access_token: accessToken, refresh_token: refreshToken, user };
    saveAuthSession(session);
    if (!hasOverride) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    return { session, error: null };
  } catch (err) {
    if (!hasOverride) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    return { session: null, error: err?.message || 'Google sign-in failed.' };
  }
}

export async function fetchSupabaseProProfile(session) {
  if (!isSupabaseConfigured() || !session?.access_token || !session?.user?.id) {
    return { isPro: false, quota: null, sessionValid: false };
  }

  const url = getEnv('VITE_SUPABASE_URL').replace(/\/$/, '');
  const anonKey = getEnv('VITE_SUPABASE_ANON_KEY');

  const query = async (token, uid) =>
    fetch(
      `${url}/rest/v1/profiles?id=eq.${encodeURIComponent(
        uid
      )}&select=is_pro,plan_expires_at,ai_scans_used,ai_scans_limit`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${token}`,
        },
      }
    );

  let activeSession = session;
  let resp = await query(activeSession.access_token, activeSession.user.id);

  // Refresh expired token automatically if refresh_token is available
  if (resp.status === 401 && activeSession.refresh_token) {
    try {
      const refreshed = await supabaseAuthRequest('/auth/v1/token?grant_type=refresh_token', {
        refresh_token: activeSession.refresh_token,
      });
      if (refreshed?.access_token) {
        activeSession = refreshed;
        saveAuthSession(refreshed);
        resp = await query(activeSession.access_token, activeSession.user?.id || session.user.id);
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
  const profile = rows?.[0];
  if (!profile) {
    saveStoredProStatus({ isPro: false, quota: null });
    return { isPro: false, quota: null, sessionValid: true, session: activeSession };
  }

  const expired = profile.plan_expires_at && new Date(profile.plan_expires_at) <= new Date();
  const isPro = Boolean(profile.is_pro && !expired);
  const limit = Number(profile.ai_scans_limit) || 100;
  const used = Number(profile.ai_scans_used) || 0;
  const quota = { used, limit, remaining: Math.max(0, limit - used) };

  saveStoredProStatus({ isPro, quota });

  return {
    isPro,
    quota,
    sessionValid: true,
    session: activeSession,
  };
}

export async function startPaystackCheckout(accessToken, fallbackEmail = '') {
  if (!accessToken) {
    throw new Error('Please sign in first before upgrading to Pro.');
  }
  const returnOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const resp = await fetch('/api/create-checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ returnOrigin }),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    if (data?.code === 'PAYMENT_NOT_CONFIGURED') {
      const staticUrl = getPaystackCheckoutUrl(fallbackEmail);
      if (staticUrl) return staticUrl;
    }
    throw new Error(data?.error || `Could not start checkout (${resp.status}).`);
  }

  if (!data?.authorization_url) {
    throw new Error('Checkout endpoint did not return a payment URL.');
  }
  return data.authorization_url;
}

export async function verifyPaystackPaymentOnReturn(accessToken) {
  if (typeof window === 'undefined' || !accessToken) {
    return { checked: false, verified: false, error: '' };
  }

  const url = new URL(window.location.href);
  const reference = url.searchParams.get('reference') || url.searchParams.get('trxref') || '';
  const hasVerifyFlag = url.searchParams.get('paystack_verify') === '1';

  if (!reference && !hasVerifyFlag) {
    return { checked: false, verified: false, error: '' };
  }

  // Clean Paystack return query params immediately so refreshes don't replay verification.
  url.searchParams.delete('paystack_verify');
  url.searchParams.delete('reference');
  url.searchParams.delete('trxref');
  const cleanSearch = url.searchParams.toString();
  window.history.replaceState(
    {},
    '',
    `${url.pathname}${cleanSearch ? `?${cleanSearch}` : ''}${url.hash || ''}`
  );

  if (!reference) {
    return { checked: true, verified: false, error: 'Missing Paystack transaction reference.' };
  }

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
      return {
        checked: true,
        verified: false,
        error: data?.error || `Payment verification failed (${resp.status}).`,
      };
    }
    return { checked: true, verified: Boolean(data?.verified), error: '' };
  } catch (err) {
    return {
      checked: true,
      verified: false,
      error: err?.message || 'Network error while verifying payment.',
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
