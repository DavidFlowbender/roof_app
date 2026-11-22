import {
  getSupabaseConfig,
  getSupabaseAdminHeaders,
  verifySupabaseSessionUser,
  getSupabaseProfile,
  isAdminEmail,
} from './_supabase.js';

/**
 * POST /api/sync-profile
 * Self-healing profile sync: if a user already exists in `auth.users` (e.g. their row
 * in `public.profiles` was manually deleted during testing) and signs back in,
 * this safely creates their `public.profiles` row without ever overwriting existing Pro/quota fields.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { supabaseUrl, supabaseServiceKey } = getSupabaseConfig();
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(503).json({ error: 'Supabase backend is not configured.' });
  }

  const sessionCheck = await verifySupabaseSessionUser(
    req.headers.authorization,
    supabaseUrl,
    supabaseServiceKey
  );
  if (!sessionCheck.ok) {
    return res.status(sessionCheck.status).json({ error: sessionCheck.error });
  }

  const { user } = sessionCheck;
  const email = user.email ? String(user.email).trim().toLowerCase() : null;

  try {
    // Insert only if missing (resolution=ignore-duplicates preserves existing is_pro / scans)
    const upsertResp = await fetch(`${supabaseUrl}/rest/v1/profiles?on_conflict=id`, {
      method: 'POST',
      headers: getSupabaseAdminHeaders(supabaseServiceKey, 'resolution=ignore-duplicates,return=minimal'),
      body: JSON.stringify({
        id: user.id,
        ...(email ? { email } : {}),
      }),
    });

    if (!upsertResp.ok) {
      const errText = await upsertResp.text().catch(() => '');
      return res.status(500).json({ error: errText || 'Could not sync user profile.' });
    }

    const profile = await getSupabaseProfile(supabaseUrl, supabaseServiceKey, { userId: user.id });
    const isAdmin = isAdminEmail(email || profile?.email);
    const expired = profile?.plan_expires_at && new Date(profile.plan_expires_at) <= new Date();
    const isPro = Boolean(isAdmin || (profile?.is_pro && !expired));
    const limit = isAdmin ? 999999 : Number(profile?.ai_scans_limit) || 100;
    const used = Number(profile?.ai_scans_used) || 0;

    return res.status(200).json({
      ok: true,
      isPro,
      quota: {
        used,
        limit,
        remaining: isAdmin ? 999999 : Math.max(0, limit - used),
        unlimited: isAdmin,
      },
    });
  } catch (err) {
    return res.status(502).json({ error: err?.message || 'Profile sync failed.' });
  }
}
