export const DEFAULT_ADMIN_EMAILS = ['sijiteksub@gmail.com'];

export function isAdminEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return false;
  const extra = String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return DEFAULT_ADMIN_EMAILS.includes(normalized) || extra.includes(normalized);
}

export function getSupabaseConfig() {
  return {
    supabaseUrl: (process.env.SUPABASE_URL || '').trim().replace(/\/$/, ''),
    supabaseServiceKey: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
  };
}

export function getSupabaseAdminHeaders(serviceKey, prefer) {
  const headers = {
    apikey: serviceKey,
    'Content-Type': 'application/json',
  };
  // Legacy `service_role` JWTs require Bearer Auth, while modern `sb_secret_` keys must NOT be sent as Bearer JWTs
  if (!serviceKey.startsWith('sb_secret_')) {
    headers.Authorization = `Bearer ${serviceKey}`;
  }
  if (prefer) headers.Prefer = prefer;
  return headers;
}

export async function verifySupabaseSessionUser(authHeader, supabaseUrl, serviceKey) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      ok: false,
      status: 401,
      code: 'AUTH_REQUIRED',
      error: 'Please sign in first.',
    };
  }
  const userToken = authHeader.slice(7).trim();

  const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${userToken}`,
    },
  });
  if (!userResp.ok) {
    return {
      ok: false,
      status: 401,
      code: 'INVALID_SESSION',
      error: 'Session expired. Please sign in again.',
    };
  }
  const user = await userResp.json();
  if (!user?.id) {
    return {
      ok: false,
      status: 401,
      code: 'INVALID_SESSION',
      error: 'Invalid user session.',
    };
  }

  return { ok: true, user, userToken };
}

export async function getSupabaseProfile(supabaseUrl, serviceKey, { userId = null, email = null }) {
  const filter = userId
    ? `id=eq.${encodeURIComponent(userId)}`
    : email
      ? `email=eq.${encodeURIComponent(String(email).toLowerCase())}`
      : null;
  if (!filter) return null;

  let resp = await fetch(
    `${supabaseUrl}/rest/v1/profiles?${filter}&select=id,email,is_pro,plan_expires_at,paystack_customer_code,ai_scans_used,ai_scans_limit,referred_by_code,custom_prices,contractor_profile`,
    { headers: getSupabaseAdminHeaders(serviceKey) }
  );
  if (!resp.ok) {
    // Graceful fallback if custom_prices / contractor_profile columns are not yet migrated
    resp = await fetch(
      `${supabaseUrl}/rest/v1/profiles?${filter}&select=id,email,is_pro,plan_expires_at,paystack_customer_code,ai_scans_used,ai_scans_limit,referred_by_code`,
      { headers: getSupabaseAdminHeaders(serviceKey) }
    );
  }
  if (!resp.ok) return null;
  const rows = await resp.json().catch(() => []);
  return rows?.[0] || null;
}

export async function activateProForUser(
  supabaseUrl,
  serviceKey,
  { userId = null, email = null, customerCode = null, referredByCode = null, days = 365, includedScans = 100 }
) {
  const existing = await getSupabaseProfile(supabaseUrl, serviceKey, { userId, email });
  const keepReferral = existing?.referred_by_code || referredByCode || null;

  // Determine plan_expires_at:
  // - `days === null` -> Founding Lifetime (never expires)
  // - If user already has Lifetime (`is_pro && plan_expires_at === null`), preserve Lifetime
  // - If user has an active timed pass, stack new days onto their remaining expiry so they never lose days
  const alreadyLifetime = Boolean(existing?.is_pro && existing?.plan_expires_at === null);
  let expires = null;
  if (days !== null && days !== undefined && !alreadyLifetime) {
    const existingMs = existing?.plan_expires_at ? new Date(existing.plan_expires_at).getTime() : 0;
    const baseMs = existing?.is_pro && existingMs > Date.now() ? existingMs : Date.now();
    expires = new Date(baseMs + Number(days) * 24 * 60 * 60 * 1000).toISOString();
  }

  // Determine AI scan credit limit:
  // - Brand-new Pro buyer gets exact plan `includedScans` (30 / 100 / 200)
  // - Returning/renewing/upgrading user keeps unused scans + adds new plan's `includedScans`
  const planScans = Math.max(1, Math.round(Number(includedScans) || 100));
  const hadPriorPro = Boolean(
    existing?.is_pro ||
      existing?.plan_expires_at ||
      existing?.paystack_customer_code ||
      (Number(existing?.ai_scans_used) || 0) > 0
  );
  const currentLimit = Number(existing?.ai_scans_limit) || 0;
  const currentUsed = Number(existing?.ai_scans_used) || 0;
  const nextScansLimit = hadPriorPro ? Math.max(currentLimit, currentUsed) + planScans : planScans;

  if (userId) {
    const resp = await fetch(`${supabaseUrl}/rest/v1/profiles?on_conflict=id`, {
      method: 'POST',
      headers: getSupabaseAdminHeaders(serviceKey, 'resolution=merge-duplicates'),
      body: JSON.stringify({
        id: userId,
        ...(email ? { email: String(email).toLowerCase() } : {}),
        is_pro: true,
        plan_expires_at: expires,
        ai_scans_limit: nextScansLimit,
        ...(customerCode ? { paystack_customer_code: customerCode } : {}),
        ...(keepReferral ? { referred_by_code: keepReferral } : {}),
      }),
    });
    return resp.ok;
  }

  if (email) {
    const resp = await fetch(
      `${supabaseUrl}/rest/v1/profiles?email=eq.${encodeURIComponent(String(email).toLowerCase())}`,
      {
        method: 'PATCH',
        headers: getSupabaseAdminHeaders(serviceKey),
        body: JSON.stringify({
          is_pro: true,
          plan_expires_at: expires,
          ai_scans_limit: nextScansLimit,
          ...(customerCode ? { paystack_customer_code: customerCode } : {}),
          ...(keepReferral ? { referred_by_code: keepReferral } : {}),
        }),
      }
    );
    return resp.ok;
  }

  return false;
}

export async function addScanCreditsForUser(
  supabaseUrl,
  serviceKey,
  { userId = null, email = null, scansToAdd = 0, customerCode = null }
) {
  const addCount = Math.max(0, Math.round(Number(scansToAdd) || 0));
  if (!addCount) return { ok: false, quota: null };

  const existing = await getSupabaseProfile(supabaseUrl, serviceKey, { userId, email });
  const defaultInitial = Math.max(1, Number(process.env.PRO_INITIAL_AI_SCANS || process.env.PRO_MONTHLY_AI_SCANS || 100));
  const currentLimit = Number(existing?.ai_scans_limit) > 0 ? Number(existing.ai_scans_limit) : defaultInitial;
  const currentUsed = Number(existing?.ai_scans_used) || 0;
  const nextLimit = currentLimit + addCount;

  const filter = existing?.id
    ? `id=eq.${encodeURIComponent(existing.id)}`
    : userId
      ? `id=eq.${encodeURIComponent(userId)}`
      : email
        ? `email=eq.${encodeURIComponent(String(email).toLowerCase())}`
        : null;

  if (!filter) return { ok: false, quota: null };

  const resp = await fetch(`${supabaseUrl}/rest/v1/profiles?${filter}`, {
    method: 'PATCH',
    headers: getSupabaseAdminHeaders(serviceKey),
    body: JSON.stringify({
      ai_scans_limit: nextLimit,
      ...(customerCode ? { paystack_customer_code: customerCode } : {}),
    }),
  });

  if (!resp.ok) {
    return { ok: false, quota: null };
  }

  return {
    ok: true,
    quota: {
      used: currentUsed,
      limit: nextLimit,
      remaining: Math.max(0, nextLimit - currentUsed),
    },
  };
}
