import {
  getSupabaseConfig,
  verifySupabaseSessionUser,
  getSupabaseProfile,
} from './_supabase.js';
import {
  DEFAULT_PRO_PLAN_ID,
  getProPlanById,
  getDefaultProPlan,
  getCurrencyCode,
  getScanPackById,
  normalizeReferralCode,
  lookupReferralCode,
} from './_billing.js';

/**
 * POST /api/create-checkout
 * Initializes a Paystack transaction for either:
 *   1. `purchaseType: 'pro_upgrade'` (with optional server-verified influencer referral code discount)
 *   2. `purchaseType: 'scan_topup'`  (pay-as-you-go AI scan packs for Pro users; credits never expire)
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secretKey = (process.env.PAYSTACK_SECRET_KEY || '').trim();
  const { supabaseUrl, supabaseServiceKey } = getSupabaseConfig();

  if (!secretKey) {
    return res.status(503).json({
      code: 'PAYMENT_NOT_CONFIGURED',
      error: 'Paystack payment key is not configured yet on the server.',
    });
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(503).json({
      code: 'BACKEND_NOT_CONFIGURED',
      error: 'Authentication backend is not configured yet.',
    });
  }

  const sessionCheck = await verifySupabaseSessionUser(
    req.headers.authorization,
    supabaseUrl,
    supabaseServiceKey
  );
  if (!sessionCheck.ok) {
    return res.status(sessionCheck.status).json({
      code: sessionCheck.code,
      error: sessionCheck.error,
    });
  }

  const { user } = sessionCheck;
  if (!user.email) {
    return res.status(400).json({ error: 'Signed-in account is missing an email address.' });
  }

  const rawOrigin =
    req.body?.returnOrigin ||
    req.headers.origin ||
    (req.headers.host ? `https://${req.headers.host}` : '');
  const cleanOrigin = String(rawOrigin || '').replace(/\/$/, '');
  const callbackUrl = cleanOrigin ? `${cleanOrigin}/?paystack_verify=1` : undefined;

  const purchaseType = req.body?.purchaseType === 'scan_topup' ? 'scan_topup' : 'pro_upgrade';
  const currency = getCurrencyCode();

  let amount = getDefaultProPlan().amountKobo;
  let metadata = {
    user_id: user.id,
    app: 'roofcalc_pro',
    purchase_type: purchaseType,
  };

  if (purchaseType === 'scan_topup') {
    const profile = await getSupabaseProfile(supabaseUrl, supabaseServiceKey, {
      userId: user.id,
      email: user.email,
    });
    const isExpired = profile?.plan_expires_at && new Date(profile.plan_expires_at) <= new Date();
    if (!profile?.is_pro || isExpired) {
      return res.status(403).json({
        code: 'PRO_REQUIRED',
        error: 'Active RoofCalc Pro plan is required before buying AI scan packs.',
      });
    }

    const pack = getScanPackById(req.body?.packId);
    if (!pack) {
      return res.status(400).json({
        code: 'INVALID_PACK',
        error: 'Please select a valid AI scan top-up pack.',
      });
    }

    amount = pack.amountKobo;
    metadata = {
      ...metadata,
      pack_id: pack.id,
      scans_added: pack.scans,
      pack_label: pack.label,
    };
  } else {
    const requestedPlanId = String(req.body?.planId || DEFAULT_PRO_PLAN_ID).trim().toLowerCase();
    const selectedPlan = getProPlanById(requestedPlanId);
    if (!selectedPlan) {
      return res.status(400).json({
        code: 'INVALID_PLAN',
        error: 'Please select a valid RoofCalc Pro plan.',
      });
    }

    amount = selectedPlan.amountKobo;
    metadata = {
      ...metadata,
      plan_id: selectedPlan.id,
      plan_name: selectedPlan.name,
      plan_days: selectedPlan.days,
      included_scans: selectedPlan.includedScans,
    };

    const rawReferral = String(req.body?.referralCode || '').trim();
    if (rawReferral) {
      const cleanCode = normalizeReferralCode(rawReferral);
      if (!cleanCode) {
        return res.status(400).json({
          code: 'INVALID_REFERRAL',
          error: 'Invalid referral code format.',
        });
      }
      const refCheck = await lookupReferralCode(supabaseUrl, supabaseServiceKey, cleanCode, {
        buyerEmail: user.email,
        strictActive: true,
        planId: selectedPlan.id,
      });
      if (!refCheck.ok) {
        return res.status(400).json({
          code: 'INVALID_REFERRAL',
          error: refCheck.error || 'Referral code could not be applied.',
        });
      }

      amount = refCheck.finalAmountKobo;
      metadata = {
        ...metadata,
        referral_code: refCheck.code,
        influencer_name: refCheck.influencerName,
        discount_percent: refCheck.discountPercent,
        original_amount_kobo: refCheck.baseAmountKobo,
        discount_kobo: refCheck.discountKobo,
      };
    }
  }

  const initBody = {
    email: user.email,
    amount,
    currency,
    ...(callbackUrl ? { callback_url: callbackUrl } : {}),
    metadata,
  };

  try {
    const payResp = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(initBody),
    });

    const payData = await payResp.json().catch(() => ({}));
    if (!payResp.ok || !payData?.status || !payData?.data?.authorization_url) {
      return res.status(502).json({
        code: 'PAYSTACK_INIT_FAILED',
        error: payData?.message || 'Could not start Paystack checkout.',
      });
    }

    return res.status(200).json({
      authorization_url: payData.data.authorization_url,
      reference: payData.data.reference,
      amountKobo: amount,
      purchaseType,
    });
  } catch (err) {
    return res.status(502).json({
      code: 'PAYSTACK_NETWORK_ERROR',
      error: err?.message || 'Failed to reach Paystack.',
    });
  }
}
