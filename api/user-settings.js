import {
  getSupabaseConfig,
  getSupabaseAdminHeaders,
  verifySupabaseSessionUser,
  getSupabaseProfile,
  isAdminEmail,
} from './_supabase.js';

const MAX_CUSTOM_PRICES_BYTES = 64 * 1024; // 64 KB
const MAX_CONTRACTOR_PROFILE_BYTES = 240 * 1024; // 240 KB (allows resized PNG company logo)

function isPlainObject(val) {
  return Boolean(val) && typeof val === 'object' && !Array.isArray(val);
}

/**
 * POST /api/user-settings
 * Persists per-account custom material prices (Pro / Admin accounts) and contractor branding
 * (company name, phone, email, address, uploaded PDF logo) to `public.profiles`.
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
  const body = isPlainObject(req.body) ? req.body : {};

  const hasCustomPrices = Object.prototype.hasOwnProperty.call(body, 'customPrices');
  const hasContractorProfile = Object.prototype.hasOwnProperty.call(body, 'contractorProfile');

  if (!hasCustomPrices && !hasContractorProfile) {
    return res.status(400).json({ error: 'Nothing to save.' });
  }

  try {
    // Ensure profile row exists without overwriting Pro/quota fields
    await fetch(`${supabaseUrl}/rest/v1/profiles?on_conflict=id`, {
      method: 'POST',
      headers: getSupabaseAdminHeaders(supabaseServiceKey, 'resolution=ignore-duplicates,return=minimal'),
      body: JSON.stringify({
        id: user.id,
        ...(email ? { email } : {}),
      }),
    });

    const profile = await getSupabaseProfile(supabaseUrl, supabaseServiceKey, { userId: user.id });
    const isAdmin = isAdminEmail(email || profile?.email);
    const expired = profile?.plan_expires_at && new Date(profile.plan_expires_at) <= new Date();
    const isPro = Boolean(isAdmin || (profile?.is_pro && !expired));

    const patchPayload = {};

    if (hasCustomPrices) {
      if (!isPro) {
        return res.status(403).json({
          code: 'PRO_REQUIRED',
          error: 'Upgrade to RoofCalc Pro to save your custom prices permanently to your account.',
        });
      }
      if (!isPlainObject(body.customPrices)) {
        return res.status(400).json({ error: 'customPrices must be a JSON object.' });
      }
      const serialized = JSON.stringify(body.customPrices);
      if (Buffer.byteLength(serialized, 'utf8') > MAX_CUSTOM_PRICES_BYTES) {
        return res.status(413).json({ error: 'Custom price list is too large to save.' });
      }
      patchPayload.custom_prices = body.customPrices;
    }

    if (hasContractorProfile) {
      if (!isPro) {
        return res.status(403).json({
          code: 'PRO_REQUIRED',
          error: 'Upgrade to RoofCalc Pro to save your company logo and branding details.',
        });
      }
      if (!isPlainObject(body.contractorProfile)) {
        return res.status(400).json({ error: 'contractorProfile must be a JSON object.' });
      }
      const raw = body.contractorProfile;
      const logoVal = typeof raw.logoDataUrl === 'string' ? raw.logoDataUrl.trim() : '';
      if (logoVal && !/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(logoVal)) {
        return res.status(400).json({ error: 'Uploaded logo must be a PNG, JPEG, or WebP image.' });
      }
      const cleanContractor = {
        name: String(raw.name || '').slice(0, 120),
        phone: String(raw.phone || '').slice(0, 60),
        email: String(raw.email || '').slice(0, 120),
        address: String(raw.address || '').slice(0, 180),
        logoDataUrl: logoVal,
      };
      const serialized = JSON.stringify(cleanContractor);
      if (Buffer.byteLength(serialized, 'utf8') > MAX_CONTRACTOR_PROFILE_BYTES) {
        return res.status(413).json({ error: 'Logo image is too large. Please upload a smaller image.' });
      }
      patchPayload.contractor_profile = cleanContractor;
    }

    const patchResp = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`,
      {
        method: 'PATCH',
        headers: getSupabaseAdminHeaders(supabaseServiceKey, 'return=minimal'),
        body: JSON.stringify(patchPayload),
      }
    );

    if (!patchResp.ok) {
      const errText = await patchResp.text().catch(() => '');
      return res.status(500).json({
        error: errText || 'Could not save account settings.',
      });
    }

    return res.status(200).json({
      ok: true,
      savedAt: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(502).json({ error: err?.message || 'Failed to save account settings.' });
  }
}
