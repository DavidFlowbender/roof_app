import { getSupabaseConfig, verifySupabaseSessionUser } from './_supabase.js';
import {
  PRO_PLANS,
  DEFAULT_PRO_PLAN_ID,
  SCAN_TOPUP_PACKS,
  getProPlanById,
  getDefaultProPlan,
  getCurrencyCode,
  lookupReferralCode,
} from './_billing.js';

/**
 * POST /api/validate-referral
 * Returns live Pro plan tiers + pay-as-you-go AI Scan Top-Up packs,
 * and validates an optional influencer referral code server-side.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const requestedPlanId =
    req.method === 'POST'
      ? String(req.body?.planId || DEFAULT_PRO_PLAN_ID).trim().toLowerCase()
      : String(req.query?.planId || DEFAULT_PRO_PLAN_ID).trim().toLowerCase();
  const activePlan = getProPlanById(requestedPlanId) || getDefaultProPlan();
  const baseAmountKobo = activePlan.amountKobo;
  const currency = getCurrencyCode();
  const includedScans = activePlan.includedScans;
  const rawCode =
    req.method === 'POST'
      ? String(req.body?.code || '').trim()
      : String(req.query?.code || '').trim();

  // If no code was provided, return plans & top-up packs immediately
  if (!rawCode) {
    return res.status(200).json({
      valid: false,
      code: '',
      planId: activePlan.id,
      baseAmountKobo,
      discountPercent: 0,
      discountKobo: 0,
      finalAmountKobo: baseAmountKobo,
      currency,
      includedScans,
      plans: PRO_PLANS,
      scanPacks: SCAN_TOPUP_PACKS,
    });
  }

  const { supabaseUrl, supabaseServiceKey } = getSupabaseConfig();
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(503).json({
      valid: false,
      error: 'Referral validation backend is not configured yet.',
      planId: activePlan.id,
      baseAmountKobo,
      finalAmountKobo: baseAmountKobo,
      currency,
      includedScans,
      plans: PRO_PLANS,
      scanPacks: SCAN_TOPUP_PACKS,
    });
  }

  let buyerEmail = '';
  if (req.headers?.authorization) {
    const sessionCheck = await verifySupabaseSessionUser(
      req.headers.authorization,
      supabaseUrl,
      supabaseServiceKey
    ).catch(() => ({ ok: false }));
    if (sessionCheck.ok && sessionCheck.user?.email) {
      buyerEmail = sessionCheck.user.email;
    }
  }

  const lookup = await lookupReferralCode(supabaseUrl, supabaseServiceKey, rawCode, {
    buyerEmail,
    strictActive: true,
    planId: activePlan.id,
  });

  if (!lookup.ok) {
    return res.status(200).json({
      valid: false,
      code: rawCode.toUpperCase(),
      planId: activePlan.id,
      error: lookup.error,
      baseAmountKobo,
      discountPercent: 0,
      discountKobo: 0,
      finalAmountKobo: baseAmountKobo,
      currency,
      includedScans,
      plans: PRO_PLANS,
      scanPacks: SCAN_TOPUP_PACKS,
    });
  }

  return res.status(200).json({
    valid: true,
    code: lookup.code,
    planId: activePlan.id,
    influencerName: lookup.influencerName,
    discountPercent: lookup.discountPercent,
    baseAmountKobo: lookup.baseAmountKobo,
    discountKobo: lookup.discountKobo,
    finalAmountKobo: lookup.finalAmountKobo,
    currency,
    includedScans,
    plans: PRO_PLANS,
    scanPacks: SCAN_TOPUP_PACKS,
  });
}
