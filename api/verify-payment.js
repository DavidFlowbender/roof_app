import {
  getSupabaseConfig,
  verifySupabaseSessionUser,
  activateProForUser,
} from './_supabase.js';

/**
 * POST /api/verify-payment
 * Verifies a Paystack transaction reference immediately when the user returns from checkout
 * and activates Pro in Supabase right away (while paystack-webhook handles background/recurring events).
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

    const minAmount = Math.max(100, Number(process.env.PAYSTACK_PRO_AMOUNT_KOBO || 500000));
    if (Number(tx.amount || 0) < minAmount) {
      return res.status(400).json({
        verified: false,
        error: 'Transaction amount does not match the Pro plan price.',
      });
    }

    const ok = await activateProForUser(supabaseUrl, supabaseServiceKey, {
      userId: user.id,
      email: user.email,
      customerCode: tx?.customer?.customer_code || null,
    });

    if (!ok) {
      return res.status(500).json({ verified: false, error: 'Could not update Pro status.' });
    }

    return res.status(200).json({ verified: true, isPro: true });
  } catch (err) {
    return res.status(502).json({
      verified: false,
      error: err?.message || 'Could not verify payment with Paystack.',
    });
  }
}
