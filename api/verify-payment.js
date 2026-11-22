import {
  getSupabaseConfig,
  verifySupabaseSessionUser,
} from './_supabase.js';
import { fulfillVerifiedPaystackTransaction } from './_billing.js';

/**
 * POST /api/verify-payment
 * Verifies a Paystack transaction reference immediately when the user returns from checkout
 * and fulfills either:
 *   - Pro upgrade (with optional referral discount & Option A commission tracking)
 *   - On-demand AI Scan Top-Up pack (+50 / +100 / +250 credits)
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secretKey = (process.env.PAYSTACK_SECRET_KEY || '').trim();
  const { supabaseUrl, supabaseServiceKey } = getSupabaseConfig();

  if (!secretKey || !supabaseUrl || !supabaseServiceKey) {
    return res.status(503).json({ error: 'Payment verification backend is not configured.' });
  }

  const sessionCheck = await verifySupabaseSessionUser(
    req.headers.authorization,
    supabaseUrl,
    supabaseServiceKey
  );
  if (!sessionCheck.ok) {
    return res.status(sessionCheck.status).json({ error: sessionCheck.error });
  }

  const reference = String(req.body?.reference || '').trim();
  if (!reference || reference.length > 160) {
    return res.status(400).json({ error: 'Invalid Paystack transaction reference.' });
  }

  try {
    const verifyResp = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      }
    );
    const json = await verifyResp.json().catch(() => ({}));
    const tx = json?.data;

    if (!verifyResp.ok || !json?.status || tx?.status !== 'success') {
      return res.status(402).json({
        verified: false,
        error: tx?.gateway_response || json?.message || 'Payment has not succeeded yet.',
      });
    }

    const { user } = sessionCheck;
    const metaUserId = tx?.metadata?.user_id ? String(tx.metadata.user_id) : null;
    const txEmail = tx?.customer?.email ? String(tx.customer.email).toLowerCase() : null;
    const userEmail = user.email ? String(user.email).toLowerCase() : null;

    if ((metaUserId && metaUserId !== user.id) && (!txEmail || txEmail !== userEmail)) {
      return res.status(403).json({
        verified: false,
        error: 'This payment belongs to a different account.',
      });
    }

    const result = await fulfillVerifiedPaystackTransaction(supabaseUrl, supabaseServiceKey, tx, {
      fallbackUserId: user.id,
      fallbackEmail: user.email,
    });

    if (!result.ok) {
      return res.status(result.status || 500).json({
        verified: false,
        error: result.error || 'Could not finalize purchase.',
      });
    }

    return res.status(200).json({
      verified: true,
      isPro: Boolean(result.isPro),
      purchaseType: result.purchaseType,
      scansAdded: result.scansAdded || 0,
      quota: result.quota || null,
      referralCode: result.referralCode || null,
    });
  } catch (err) {
    return res.status(502).json({
      verified: false,
      error: err?.message || 'Could not verify payment with Paystack.',
    });
  }
}
