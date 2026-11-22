import { getSupabaseConfig, getSupabaseAdminHeaders } from './_supabase.js';
import { getCurrencyCode, normalizeReferralCode } from './_billing.js';

function maskEmail(email) {
  const str = String(email || '').trim().toLowerCase();
  const [local, domain] = str.split('@');
  if (!local || !domain) return 'Pro Customer';
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}***@${domain}`;
}

/**
 * GET or POST /api/partner-stats
 * Read-only influencer earnings tracker secured by (code + secret partner_token).
 * Shareable URL: https://roofcalc.sijiteksolutions.com/?partner=CODE&token=TOKEN
 */
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { supabaseUrl, supabaseServiceKey } = getSupabaseConfig();
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(503).json({ error: 'Partner stats backend is not configured.' });
  }

  const rawCode = req.method === 'POST' ? req.body?.code : req.query?.code;
  const rawToken = req.method === 'POST' ? req.body?.token : req.query?.token;
  const code = normalizeReferralCode(rawCode);
  const token = String(rawToken || '').trim();

  if (!code || !token || token.length < 8) {
    return res.status(400).json({ error: 'Invalid partner link or missing token.' });
  }

  try {
    const codeResp = await fetch(
      `${supabaseUrl}/rest/v1/referral_codes?code=eq.${encodeURIComponent(
        code
      )}&partner_token=eq.${encodeURIComponent(
        token
      )}&select=code,influencer_name,discount_percent,commission_percent,commission_flat_kobo,is_active,uses_count,created_at`,
      { headers: getSupabaseAdminHeaders(supabaseServiceKey) }
    );

    if (!codeResp.ok) {
      return res.status(500).json({ error: 'Could not load partner details.' });
    }
    const codeRows = await codeResp.json().catch(() => []);
    const partner = codeRows?.[0];
    if (!partner) {
      return res.status(403).json({ error: 'Invalid partner code or access token.' });
    }

    const convResp = await fetch(
      `${supabaseUrl}/rest/v1/referral_conversions?referral_code=eq.${encodeURIComponent(
        partner.code
      )}&select=id,buyer_email,paid_amount_kobo,commission_kobo,payout_status,paid_at,created_at&order=created_at.desc&limit=50`,
      { headers: getSupabaseAdminHeaders(supabaseServiceKey) }
    );
    const conversions = convResp.ok ? await convResp.json().catch(() => []) : [];

    let totalSales = 0;
    let pendingKobo = 0;
    let paidKobo = 0;
    let totalRevenueKobo = 0;

    for (const row of conversions) {
      if (row.payout_status === 'void') continue;
      totalSales += 1;
      totalRevenueKobo += Number(row.paid_amount_kobo) || 0;
      if (row.payout_status === 'paid') {
        paidKobo += Number(row.commission_kobo) || 0;
      } else {
        pendingKobo += Number(row.commission_kobo) || 0;
      }
    }

    return res.status(200).json({
      code: partner.code,
      influencerName: partner.influencer_name,
      isActive: Boolean(partner.is_active),
      discountPercent: Number(partner.discount_percent) || 0,
      commissionPercent: Number(partner.commission_percent) || 0,
      commissionFlatKobo: partner.commission_flat_kobo ?? null,
      currency: getCurrencyCode(),
      summary: {
        totalSales,
        totalRevenueKobo,
        pendingCommissionKobo: pendingKobo,
        paidCommissionKobo: paidKobo,
        totalEarnedKobo: pendingKobo + paidKobo,
      },
      recentConversions: conversions.slice(0, 20).map((c) => ({
        id: c.id,
        buyer: maskEmail(c.buyer_email),
        paidAmountKobo: Number(c.paid_amount_kobo) || 0,
        commissionKobo: Number(c.commission_kobo) || 0,
        payoutStatus: c.payout_status,
        createdAt: c.created_at,
        paidAt: c.paid_at,
      })),
    });
  } catch (err) {
    return res.status(502).json({ error: err?.message || 'Failed to fetch partner stats.' });
  }
}
