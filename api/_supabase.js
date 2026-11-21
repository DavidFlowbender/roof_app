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

export async function activateProForUser(
  supabaseUrl,
  serviceKey,
  { userId = null, email = null, customerCode = null, days = 32 }
) {
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  if (userId) {
    const resp = await fetch(`${supabaseUrl}/rest/v1/profiles?on_conflict=id`, {
      method: 'POST',
      headers: getSupabaseAdminHeaders(serviceKey, 'resolution=merge-duplicates'),
      body: JSON.stringify({
        id: userId,
        ...(email ? { email: String(email).toLowerCase() } : {}),
        is_pro: true,
        plan_expires_at: expires,
        ...(customerCode ? { paystack_customer_code: customerCode } : {}),
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
          ...(customerCode ? { paystack_customer_code: customerCode } : {}),
        }),
      }
    );
    return resp.ok;
  }

  return false;
}
