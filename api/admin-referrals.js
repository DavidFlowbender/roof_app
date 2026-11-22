import {
  getSupabaseConfig,
  getSupabaseAdminHeaders,
  verifySupabaseSessionUser,
  isAdminEmail,
} from './_supabase.js';
import {
  getProBaseAmountKobo,
  getCurrencyCode,
  normalizeReferralCode,
} from './_billing.js';

async function fetchAdminOverview(supabaseUrl, serviceKey) {
  const [codesResp, convResp, profilesResp, txResp] = await Promise.all([
    fetch(
      `${supabaseUrl}/rest/v1/referral_codes?select=code,influencer_name,influencer_email,discount_percent,commission_percent,commission_flat_kobo,partner_token,is_active,max_uses,uses_count,expires_at,notes,created_at&order=created_at.desc`,
      { headers: getSupabaseAdminHeaders(serviceKey) }
    ),
    fetch(
      `${supabaseUrl}/rest/v1/referral_conversions?select=id,paystack_reference,referral_code,buyer_email,paid_amount_kobo,discount_kobo,commission_kobo,payout_status,paid_at,payout_note,created_at&order=created_at.desc&limit=500`,
      { headers: getSupabaseAdminHeaders(serviceKey) }
    ),
    fetch(
      `${supabaseUrl}/rest/v1/profiles?select=id,email,is_pro,plan_expires_at,ai_scans_used,ai_scans_limit,referred_by_code,created_at&order=created_at.desc&limit=500`,
      { headers: getSupabaseAdminHeaders(serviceKey) }
    ),
    fetch(
      `${supabaseUrl}/rest/v1/payment_transactions?select=paystack_reference,email,purchase_type,pack_id,scans_added,original_amount_kobo,paid_amount_kobo,discount_kobo,referral_code,created_at&order=created_at.desc&limit=200`,
      { headers: getSupabaseAdminHeaders(serviceKey) }
    ),
  ]);

  if (!codesResp.ok) {
    const errText = await codesResp.text().catch(() => '');
    throw new Error(errText || 'Failed to read referral_codes table.');
  }

  const codes = await codesResp.json().catch(() => []);
  const conversions = convResp.ok ? await convResp.json().catch(() => []) : [];
  const profiles = profilesResp.ok ? await profilesResp.json().catch(() => []) : [];
  const transactions = txResp.ok ? await txResp.json().catch(() => []) : [];

  const statsByCode = new Map();
  let totalReferredSales = 0;
  let totalReferredRevenueKobo = 0;
  let totalPendingKobo = 0;
  let totalPaidKobo = 0;

  for (const conv of conversions) {
    if (conv.payout_status === 'void') continue;
    const key = String(conv.referral_code || '').toUpperCase();
    if (!statsByCode.has(key)) {
      statsByCode.set(key, {
        totalSales: 0,
        totalRevenueKobo: 0,
        pendingCommissionKobo: 0,
        paidCommissionKobo: 0,
        pendingCount: 0,
      });
    }
    const bucket = statsByCode.get(key);
    const paidAmt = Number(conv.paid_amount_kobo) || 0;
    const commAmt = Number(conv.commission_kobo) || 0;

    bucket.totalSales += 1;
    bucket.totalRevenueKobo += paidAmt;
    totalReferredSales += 1;
    totalReferredRevenueKobo += paidAmt;

    if (conv.payout_status === 'paid') {
      bucket.paidCommissionKobo += commAmt;
      totalPaidKobo += commAmt;
    } else {
      bucket.pendingCommissionKobo += commAmt;
      bucket.pendingCount += 1;
      totalPendingKobo += commAmt;
    }
  }

  const enrichedCodes = codes.map((rc) => {
    const s = statsByCode.get(String(rc.code || '').toUpperCase()) || {
      totalSales: 0,
      totalRevenueKobo: 0,
      pendingCommissionKobo: 0,
      paidCommissionKobo: 0,
      pendingCount: 0,
    };
    return {
      code: rc.code,
      influencerName: rc.influencer_name,
      influencerEmail: rc.influencer_email || '',
      discountPercent: Number(rc.discount_percent) || 0,
      commissionPercent: Number(rc.commission_percent) || 0,
      commissionFlatKobo: rc.commission_flat_kobo ?? null,
      partnerToken: rc.partner_token,
      isActive: Boolean(rc.is_active),
      maxUses: rc.max_uses ?? null,
      usesCount: Number(rc.uses_count) || 0,
      expiresAt: rc.expires_at || null,
      notes: rc.notes || '',
      createdAt: rc.created_at,
      ...s,
    };
  });

  const now = new Date();
  let activeProUsers = 0;
  let totalAiScansUsed = 0;
  for (const p of profiles) {
    const expired = p.plan_expires_at && new Date(p.plan_expires_at) <= now;
    if ((p.is_pro && !expired) || isAdminEmail(p.email)) {
      activeProUsers += 1;
    }
    totalAiScansUsed += Number(p.ai_scans_used) || 0;
  }

  let totalGrossRevenueKobo = 0;
  let proUpgradesCount = 0;
  let scanTopupsCount = 0;
  for (const tx of transactions) {
    totalGrossRevenueKobo += Number(tx.paid_amount_kobo) || 0;
    if (tx.purchase_type === 'scan_topup') {
      scanTopupsCount += 1;
    } else {
      proUpgradesCount += 1;
    }
  }

  return {
    currency: getCurrencyCode(),
    baseProAmountKobo: getProBaseAmountKobo(),
    summary: {
      totalUsers: profiles.length,
      activeProUsers,
      totalAiScansUsed,
      totalGrossRevenueKobo,
      proUpgradesCount,
      scanTopupsCount,
      totalCodes: enrichedCodes.length,
      activeCodes: enrichedCodes.filter((c) => c.isActive).length,
      totalSales: totalReferredSales,
      totalRevenueKobo: totalReferredRevenueKobo,
      totalPendingKobo,
      totalPaidKobo,
    },
    codes: enrichedCodes,
    recentTransactions: transactions.slice(0, 25),
    recentUsers: profiles.slice(0, 30).map((p) => {
      const expired = p.plan_expires_at && new Date(p.plan_expires_at) <= now;
      return {
        id: p.id,
        email: p.email || 'Unknown',
        isPro: Boolean((p.is_pro && !expired) || isAdminEmail(p.email)),
        isAdmin: isAdminEmail(p.email),
        scansUsed: Number(p.ai_scans_used) || 0,
        scansLimit: Number(p.ai_scans_limit) || 100,
        referredByCode: p.referred_by_code || null,
        createdAt: p.created_at,
      };
    }),
    recentConversions: conversions.slice(0, 30),
  };
}

/**
 * GET / POST /api/admin-referrals
 * Admin Dashboard API strictly restricted to sijiteksub@gmail.com.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { supabaseUrl, supabaseServiceKey } = getSupabaseConfig();
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(503).json({ error: 'Supabase admin backend is not configured.' });
  }

  const sessionCheck = await verifySupabaseSessionUser(
    req.headers.authorization,
    supabaseUrl,
    supabaseServiceKey
  );
  if (!sessionCheck.ok) {
    return res.status(sessionCheck.status).json({ error: sessionCheck.error });
  }

  const adminEmail = String(sessionCheck.user?.email || '').trim().toLowerCase();
  if (!isAdminEmail(adminEmail)) {
    return res.status(403).json({ error: 'Admin access is restricted to sijiteksub@gmail.com.' });
  }

  const action = req.method === 'GET' ? 'list' : String(req.body?.action || 'list').trim().toLowerCase();

  try {
    if (action === 'list') {
      const overview = await fetchAdminOverview(supabaseUrl, supabaseServiceKey);
      return res.status(200).json(overview);
    }

    if (action === 'create') {
      const code = normalizeReferralCode(req.body?.code);
      if (!code) {
        return res.status(400).json({
          error: 'Code must be 3–32 characters using letters, numbers, hyphens, or underscores.',
        });
      }
      const influencerName = String(req.body?.influencerName || '').trim();
      if (!influencerName) {
        return res.status(400).json({ error: 'Enter an influencer or campaign name.' });
      }
      const influencerEmail = String(req.body?.influencerEmail || '').trim().toLowerCase() || null;
      const discountPercent = Math.min(90, Math.max(0, Number(req.body?.discountPercent) || 0));
      const commissionType = req.body?.commissionType === 'flat' ? 'flat' : 'percent';
      const commissionPercent =
        commissionType === 'percent'
          ? Math.min(90, Math.max(0, Number(req.body?.commissionPercent) || 0))
          : 0;
      const commissionFlatKobo =
        commissionType === 'flat'
          ? Math.max(0, Math.round((Number(req.body?.commissionFlatNgn) || 0) * 100))
          : null;
      const rawMaxUses = req.body?.maxUses;
      const maxUses =
        rawMaxUses !== '' && rawMaxUses !== null && rawMaxUses !== undefined && Number(rawMaxUses) > 0
          ? Math.round(Number(rawMaxUses))
          : null;
      const rawExpires = String(req.body?.expiresAt || '').trim();
      const expiresAt = rawExpires ? new Date(rawExpires).toISOString() : null;
      const notes = String(req.body?.notes || '').trim() || null;

      const insertResp = await fetch(`${supabaseUrl}/rest/v1/referral_codes`, {
        method: 'POST',
        headers: getSupabaseAdminHeaders(supabaseServiceKey, 'return=representation'),
        body: JSON.stringify({
          code,
          influencer_name: influencerName,
          influencer_email: influencerEmail,
          discount_percent: discountPercent,
          commission_percent: commissionPercent,
          commission_flat_kobo: commissionFlatKobo,
          is_active: true,
          max_uses: maxUses,
          expires_at: expiresAt,
          notes,
        }),
      });

      if (!insertResp.ok) {
        const errBody = await insertResp.text().catch(() => '');
        if (errBody.includes('duplicate key') || insertResp.status === 409) {
          return res.status(409).json({ error: `Code "${code}" already exists.` });
        }
        return res.status(400).json({ error: errBody || 'Could not create referral code.' });
      }

      const overview = await fetchAdminOverview(supabaseUrl, supabaseServiceKey);
      return res.status(200).json({ ok: true, createdCode: code, ...overview });
    }

    if (action === 'toggle') {
      const code = normalizeReferralCode(req.body?.code);
      if (!code) return res.status(400).json({ error: 'Invalid code.' });
      const isActive = Boolean(req.body?.isActive);

      const patchResp = await fetch(
        `${supabaseUrl}/rest/v1/referral_codes?code=eq.${encodeURIComponent(code)}`,
        {
          method: 'PATCH',
          headers: getSupabaseAdminHeaders(supabaseServiceKey),
          body: JSON.stringify({ is_active: isActive }),
        }
      );
      if (!patchResp.ok) {
        return res.status(500).json({ error: 'Could not update code status.' });
      }
      const overview = await fetchAdminOverview(supabaseUrl, supabaseServiceKey);
      return res.status(200).json({ ok: true, ...overview });
    }

    if (action === 'mark_paid') {
      const code = normalizeReferralCode(req.body?.code);
      if (!code) return res.status(400).json({ error: 'Invalid code.' });
      const payoutNote = String(req.body?.payoutNote || '').trim() || `Paid by ${adminEmail}`;

      const patchResp = await fetch(
        `${supabaseUrl}/rest/v1/referral_conversions?referral_code=eq.${encodeURIComponent(
          code
        )}&payout_status=eq.pending`,
        {
          method: 'PATCH',
          headers: getSupabaseAdminHeaders(supabaseServiceKey, 'return=representation'),
          body: JSON.stringify({
            payout_status: 'paid',
            paid_at: new Date().toISOString(),
            payout_note: payoutNote,
          }),
        }
      );
      if (!patchResp.ok) {
        return res.status(500).json({ error: 'Could not mark conversions as paid.' });
      }
      const updatedRows = await patchResp.json().catch(() => []);
      const overview = await fetchAdminOverview(supabaseUrl, supabaseServiceKey);
      return res.status(200).json({ ok: true, markedPaidCount: updatedRows.length, ...overview });
    }

    if (action === 'delete') {
      const code = normalizeReferralCode(req.body?.code);
      if (!code) return res.status(400).json({ error: 'Invalid code.' });

      const convCheckResp = await fetch(
        `${supabaseUrl}/rest/v1/referral_conversions?referral_code=eq.${encodeURIComponent(code)}&select=id&limit=1`,
        { headers: getSupabaseAdminHeaders(supabaseServiceKey) }
      );
      const existingConvs = convCheckResp.ok ? await convCheckResp.json().catch(() => []) : [];
      if (existingConvs.length > 0) {
        return res.status(400).json({
          error: `Code "${code}" already has sales history. Pause it instead so payout records stay intact.`,
        });
      }

      const delResp = await fetch(
        `${supabaseUrl}/rest/v1/referral_codes?code=eq.${encodeURIComponent(code)}`,
        {
          method: 'DELETE',
          headers: getSupabaseAdminHeaders(supabaseServiceKey),
        }
      );
      if (!delResp.ok) {
        return res.status(500).json({ error: 'Could not delete referral code.' });
      }
      const overview = await fetchAdminOverview(supabaseUrl, supabaseServiceKey);
      return res.status(200).json({ ok: true, ...overview });
    }

    return res.status(400).json({ error: `Unsupported admin action "${action}".` });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Admin request failed.' });
  }
}
