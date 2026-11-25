import {
  getSupabaseAdminHeaders,
  getSupabaseProfile,
  activateProForUser,
  addScanCreditsForUser,
} from './_supabase.js';

/**
 * RoofCalc Pro Plans (Prepaid Passes + Founding Lifetime — works with Bank Transfer, OPay, USSD & Cards).
 * Prices are stored in kobo (NGN * 100).
 * `days: null` indicates a Lifetime plan (`plan_expires_at = null`).
 */
export const PRO_PLANS = [
  {
    id: 'pro_monthly',
    name: '30-Day Pass',
    shortLabel: '30 Days',
    badge: 'Try Pro',
    subtitle: 'Ideal for 1 project or testing Pro',
    amountKobo: 500000, // ₦5,000
    days: 30,
    includedScans: 30,
    periodLabel: '/ 30 days',
    savingsText: '',
  },
  {
    id: 'pro_annual',
    name: 'Annual Pro',
    shortLabel: '1 Year',
    badge: 'Most Popular • Save 50%',
    subtitle: '₦2,500/mo billed yearly',
    amountKobo: 3000000, // ₦30,000
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
    badge: 'First 100 Buyers',
    subtitle: 'Pay once, own Pro forever',
    amountKobo: 7500000, // ₦75,000
    days: null,
    includedScans: 200,
    periodLabel: 'one-time',
    savingsText: 'Never expires',
  },
];

export const DEFAULT_PRO_PLAN_ID = 'pro_annual';

/**
 * Pay-as-you-go AI Scan Top-Up Packs (buy anytime at will; credits never expire).
 * Prices are stored in kobo (NGN * 100).
 */
export const SCAN_TOPUP_PACKS = [
  {
    id: 'scans_50',
    label: '+50 AI Scans',
    scans: 50,
    amountKobo: 350000, // ₦3,500 (₦70/scan)
    badge: 'Quick Boost',
  },
  {
    id: 'scans_100',
    label: '+100 AI Scans',
    scans: 100,
    amountKobo: 600000, // ₦6,000 (₦60/scan)
    badge: 'Most Popular',
  },
  {
    id: 'scans_250',
    label: '+250 AI Scans',
    scans: 250,
    amountKobo: 1200000, // ₦12,000 (₦48/scan)
    badge: 'Best Value',
  },
];

export function getProPlanById(planId) {
  const id = String(planId || '').trim().toLowerCase();
  return PRO_PLANS.find((p) => p.id === id) || null;
}

export function getDefaultProPlan() {
  return getProPlanById(DEFAULT_PRO_PLAN_ID) || PRO_PLANS[1] || PRO_PLANS[0];
}

export function getProBaseAmountKobo(planId = DEFAULT_PRO_PLAN_ID) {
  const plan = getProPlanById(planId) || getDefaultProPlan();
  return plan.amountKobo;
}

export function getProInitialScans(planId = DEFAULT_PRO_PLAN_ID) {
  const plan = getProPlanById(planId) || getDefaultProPlan();
  return plan.includedScans;
}

export function getCurrencyCode() {
  return (process.env.PAYSTACK_CURRENCY || 'NGN').trim().toUpperCase();
}

export function getScanPackById(packId) {
  const id = String(packId || '').trim().toLowerCase();
  return SCAN_TOPUP_PACKS.find((p) => p.id === id) || null;
}

export function normalizeReferralCode(raw) {
  const cleaned = String(raw || '').trim().toUpperCase();
  if (!cleaned) return '';
  if (!/^[A-Z0-9_-]{3,32}$/.test(cleaned)) return '';
  return cleaned;
}

export function computeDiscountAndCommission(baseAmountKobo, referralRow) {
  const base = Math.max(10000, Math.round(Number(baseAmountKobo) || 0));
  const discountPercent = Math.min(90, Math.max(0, Number(referralRow?.discount_percent) || 0));
  const discountKobo = Math.round((base * discountPercent) / 100);
  // Keep final checkout amount at least ₦100 (10,000 kobo)
  const finalAmountKobo = Math.max(10000, base - discountKobo);
  const actualDiscountKobo = Math.max(0, base - finalAmountKobo);

  let commissionKobo = 0;
  if (
    referralRow?.commission_flat_kobo !== null &&
    referralRow?.commission_flat_kobo !== undefined &&
    Number(referralRow.commission_flat_kobo) >= 0
  ) {
    commissionKobo = Math.min(finalAmountKobo, Math.round(Number(referralRow.commission_flat_kobo)));
  } else {
    const commissionPercent = Math.min(90, Math.max(0, Number(referralRow?.commission_percent) || 0));
    commissionKobo = Math.round((finalAmountKobo * commissionPercent) / 100);
  }

  return {
    baseAmountKobo: base,
    discountPercent,
    discountKobo: actualDiscountKobo,
    finalAmountKobo,
    commissionPercent: Math.min(90, Math.max(0, Number(referralRow?.commission_percent) || 0)),
    commissionKobo,
  };
}

/**
 * Look up a referral code in Supabase `public.referral_codes`.
 * When `strictActive` is true (checkout/preview), enforces active flag, expiry, max_uses, and self-referral checks.
 * When `strictActive` is false (post-payment verification), accepts any existing code so in-flight payments never fail.
 */
export async function lookupReferralCode(
  supabaseUrl,
  serviceKey,
  rawCode,
  { buyerEmail = '', strictActive = true, planId = DEFAULT_PRO_PLAN_ID } = {}
) {
  const code = normalizeReferralCode(rawCode);
  if (!code) {
    return { ok: false, notFound: true, error: 'Enter a valid referral code (letters and numbers).' };
  }

  const resp = await fetch(
    `${supabaseUrl}/rest/v1/referral_codes?code=eq.${encodeURIComponent(
      code
    )}&select=code,influencer_name,influencer_email,discount_percent,commission_percent,commission_flat_kobo,is_active,max_uses,uses_count,expires_at`,
    { headers: getSupabaseAdminHeaders(serviceKey) }
  );

  if (!resp.ok) {
    const bodyText = await resp.text().catch(() => '');
    if (bodyText.includes('referral_codes') || resp.status === 404) {
      return {
        ok: false,
        schemaMissing: true,
        error: 'Referral codes table is not set up yet in Supabase. Run supabase/schema.sql first.',
      };
    }
    return { ok: false, error: 'Could not verify referral code right now.' };
  }

  const rows = await resp.json().catch(() => []);
  const row = rows?.[0];
  if (!row) {
    return { ok: false, notFound: true, error: `Referral code "${code}" was not found.` };
  }

  if (strictActive) {
    if (!row.is_active) {
      return { ok: false, error: `Referral code "${code}" is no longer active.` };
    }
    if (row.expires_at && new Date(row.expires_at) <= new Date()) {
      return { ok: false, error: `Referral code "${code}" has expired.` };
    }
    if (row.max_uses !== null && row.max_uses !== undefined && Number(row.uses_count || 0) >= Number(row.max_uses)) {
      return { ok: false, error: `Referral code "${code}" has reached its maximum uses.` };
    }
    if (
      buyerEmail &&
      row.influencer_email &&
      String(buyerEmail).trim().toLowerCase() === String(row.influencer_email).trim().toLowerCase()
    ) {
      return { ok: false, error: 'You cannot apply your own influencer referral code.' };
    }
  }

  const baseAmountKobo = getProBaseAmountKobo(planId);
  const pricing = computeDiscountAndCommission(baseAmountKobo, row);

  return {
    ok: true,
    code: row.code,
    row,
    influencerName: row.influencer_name,
    ...pricing,
  };
}

/**
 * Atomically records a verified Paystack reference in `payment_transactions`.
 * Returns:
 *   - `{ inserted: true }` if this is the first time this reference is being fulfilled
 *   - `{ inserted: false, alreadyProcessed: true }` if already fulfilled (webhook vs verify-payment race)
 *   - `{ inserted: true, schemaMissing: true }` if the table isn't migrated yet (lets legacy Pro upgrade still succeed)
 */
async function claimPaymentTransaction(supabaseUrl, serviceKey, record) {
  const resp = await fetch(
    `${supabaseUrl}/rest/v1/payment_transactions?on_conflict=paystack_reference`,
    {
      method: 'POST',
      headers: getSupabaseAdminHeaders(serviceKey, 'resolution=ignore-duplicates,return=representation'),
      body: JSON.stringify(record),
    }
  );

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    if (errText.includes('payment_transactions') || resp.status === 404) {
      return { inserted: true, schemaMissing: true };
    }
    return { inserted: false, error: errText || 'Failed to record payment transaction.' };
  }

  const rows = await resp.json().catch(() => []);
  if (Array.isArray(rows) && rows.length > 0) {
    return { inserted: true, schemaMissing: false };
  }
  return { inserted: false, alreadyProcessed: true };
}

async function recordReferralConversion(supabaseUrl, serviceKey, conversion, referralRow) {
  const resp = await fetch(
    `${supabaseUrl}/rest/v1/referral_conversions?on_conflict=paystack_reference`,
    {
      method: 'POST',
      headers: getSupabaseAdminHeaders(serviceKey, 'resolution=ignore-duplicates,return=representation'),
      body: JSON.stringify(conversion),
    }
  );
  if (!resp.ok) return false;
  const rows = await resp.json().catch(() => []);
  if (Array.isArray(rows) && rows.length > 0 && referralRow?.code) {
    const nextUses = (Number(referralRow.uses_count) || 0) + 1;
    await fetch(
      `${supabaseUrl}/rest/v1/referral_codes?code=eq.${encodeURIComponent(referralRow.code)}`,
      {
        method: 'PATCH',
        headers: getSupabaseAdminHeaders(serviceKey),
        body: JSON.stringify({ uses_count: nextUses }),
      }
    ).catch(() => {});
    return true;
  }
  return false;
}

/**
 * Shared server-side fulfillment used by BOTH /api/verify-payment and /api/paystack-webhook.
 * Handles:
 *   1. `pro_upgrade` (with optional influencer referral discount & Option A commission logging)
 *   2. `scan_topup` (pay-as-you-go AI scan packs that never expire)
 */
export async function fulfillVerifiedPaystackTransaction(
  supabaseUrl,
  serviceKey,
  tx,
  { fallbackUserId = null, fallbackEmail = null } = {}
) {
  const reference = String(tx?.reference || '').trim();
  const paidAmountKobo = Math.round(Number(tx?.amount) || 0);
  const metadata = tx?.metadata && typeof tx.metadata === 'object' ? tx.metadata : {};
  const purchaseType = metadata.purchase_type === 'scan_topup' ? 'scan_topup' : 'pro_upgrade';
  const userId = metadata.user_id ? String(metadata.user_id) : fallbackUserId || null;
  const email = tx?.customer?.email ? String(tx.customer.email).toLowerCase() : fallbackEmail ? String(fallbackEmail).toLowerCase() : null;
  const customerCode = tx?.customer?.customer_code || null;

  if (!reference) {
    return { ok: false, status: 400, error: 'Missing Paystack transaction reference.' };
  }

  // Case 1: On-Demand AI Scan Top-Up Pack
  if (purchaseType === 'scan_topup') {
    const pack = getScanPackById(metadata.pack_id);
    if (!pack) {
      return { ok: false, status: 400, error: 'Unknown AI scan top-up pack.' };
    }
    if (paidAmountKobo < pack.amountKobo) {
      return { ok: false, status: 400, error: 'Transaction amount does not match the selected AI scan pack.' };
    }

    const claim = await claimPaymentTransaction(supabaseUrl, serviceKey, {
      paystack_reference: reference,
      user_id: userId,
      email,
      purchase_type: 'scan_topup',
      pack_id: pack.id,
      scans_added: pack.scans,
      original_amount_kobo: pack.amountKobo,
      paid_amount_kobo: paidAmountKobo,
      discount_kobo: 0,
      referral_code: null,
    });

    if (claim.error) {
      return { ok: false, status: 500, error: 'Could not record scan top-up transaction.' };
    }

    if (claim.schemaMissing) {
      return {
        ok: false,
        status: 503,
        error: 'Database schema needs update (payment_transactions table missing). Run supabase/schema.sql.',
      };
    }

    if (claim.alreadyProcessed) {
      const profile = await getSupabaseProfile(supabaseUrl, serviceKey, { userId, email });
      const limit = Number(profile?.ai_scans_limit) || getProInitialScans();
      const used = Number(profile?.ai_scans_used) || 0;
      return {
        ok: true,
        alreadyProcessed: true,
        purchaseType: 'scan_topup',
        packId: pack.id,
        scansAdded: pack.scans,
        isPro: Boolean(profile?.is_pro),
        quota: { used, limit, remaining: Math.max(0, limit - used) },
      };
    }

    const credited = await addScanCreditsForUser(supabaseUrl, serviceKey, {
      userId,
      email,
      scansToAdd: pack.scans,
      customerCode,
    });

    if (!credited.ok) {
      return { ok: false, status: 500, error: 'Payment succeeded, but scan credits could not be updated.' };
    }

    return {
      ok: true,
      alreadyProcessed: false,
      purchaseType: 'scan_topup',
      packId: pack.id,
      scansAdded: pack.scans,
      isPro: true,
      quota: credited.quota,
    };
  }

  // Case 2: Pro Upgrade (30-Day Pass, Annual Pro, or Founding Lifetime — full price or Influencer Referral Discount)
  const selectedPlan = getProPlanById(metadata.plan_id) || getDefaultProPlan();
  const baseAmountKobo = selectedPlan.amountKobo;
  let expectedMinAmountKobo = baseAmountKobo;
  let discountKobo = 0;
  let appliedReferral = null;

  const rawRefCode = normalizeReferralCode(metadata.referral_code);
  if (rawRefCode) {
    const refLookup = await lookupReferralCode(supabaseUrl, serviceKey, rawRefCode, {
      buyerEmail: email || '',
      strictActive: false,
      planId: selectedPlan.id,
    });
    if (refLookup.ok) {
      // Prevent self-referral commission even on webhook replay
      const isSelfReferral =
        email &&
        refLookup.row?.influencer_email &&
        email.toLowerCase() === String(refLookup.row.influencer_email).trim().toLowerCase();
      if (!isSelfReferral) {
        expectedMinAmountKobo = refLookup.finalAmountKobo;
        discountKobo = refLookup.discountKobo;
        appliedReferral = refLookup;
      }
    }
  }

  if (paidAmountKobo < expectedMinAmountKobo) {
    return {
      ok: false,
      status: 400,
      error: `Transaction amount does not match the ${selectedPlan.name} price.`,
    };
  }

  const claim = await claimPaymentTransaction(supabaseUrl, serviceKey, {
    paystack_reference: reference,
    user_id: userId,
    email,
    purchase_type: 'pro_upgrade',
    pack_id: selectedPlan.id,
    scans_added: selectedPlan.includedScans,
    original_amount_kobo: baseAmountKobo,
    paid_amount_kobo: paidAmountKobo,
    discount_kobo: discountKobo,
    referral_code: appliedReferral?.code || null,
  });

  if (claim.error) {
    return { ok: false, status: 500, error: 'Could not record Pro upgrade transaction.' };
  }

  if (!claim.alreadyProcessed) {
    const activated = await activateProForUser(supabaseUrl, serviceKey, {
      userId,
      email,
      customerCode,
      referredByCode: appliedReferral?.code || null,
      days: selectedPlan.days,
      includedScans: selectedPlan.includedScans,
    });
    if (!activated) {
      return { ok: false, status: 500, error: 'Could not update Pro status.' };
    }

    // Log Option A influencer commission exactly once
    if (appliedReferral && !claim.schemaMissing) {
      const commissionCalc = computeDiscountAndCommission(baseAmountKobo, appliedReferral.row);
      const actualCommissionKobo =
        appliedReferral.row?.commission_flat_kobo !== null &&
        appliedReferral.row?.commission_flat_kobo !== undefined
          ? Math.min(paidAmountKobo, Math.round(Number(appliedReferral.row.commission_flat_kobo)))
          : Math.round((paidAmountKobo * commissionCalc.commissionPercent) / 100);

      await recordReferralConversion(
        supabaseUrl,
        serviceKey,
        {
          paystack_reference: reference,
          referral_code: appliedReferral.code,
          buyer_user_id: userId,
          buyer_email: email,
          purchase_type: 'pro_upgrade',
          original_amount_kobo: baseAmountKobo,
          paid_amount_kobo: paidAmountKobo,
          discount_kobo: Math.max(0, baseAmountKobo - paidAmountKobo),
          commission_kobo: Math.max(0, actualCommissionKobo),
          payout_status: 'pending',
        },
        appliedReferral.row
      );
    }
  }

  const profile = await getSupabaseProfile(supabaseUrl, serviceKey, { userId, email });
  const limit = Number(profile?.ai_scans_limit) || selectedPlan.includedScans;
  const used = Number(profile?.ai_scans_used) || 0;

  return {
    ok: true,
    alreadyProcessed: Boolean(claim.alreadyProcessed),
    purchaseType: 'pro_upgrade',
    planId: selectedPlan.id,
    planName: selectedPlan.name,
    scansAdded: selectedPlan.includedScans,
    referralCode: appliedReferral?.code || null,
    isPro: true,
    planExpiresAt: profile?.plan_expires_at ?? null,
    quota: { used, limit, remaining: Math.max(0, limit - used) },
  };
}
