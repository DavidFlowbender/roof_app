import { getSupabaseConfig, verifySupabaseSessionUser } from './_supabase.js';

/**
 * POST /api/create-checkout
 * Initializes a Paystack transaction tied directly to the signed-in user's ID & email
 * so payment confirmation upgrades them to Pro automatically.
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

  const amount = Math.max(10000, Number(process.env.PAYSTACK_PRO_AMOUNT_KOBO || 500000));
  const currency = (process.env.PAYSTACK_CURRENCY || 'NGN').trim().toUpperCase();
  const planCode = (process.env.PAYSTACK_PLAN_CODE || '').trim();

  const initBody = {
    email: user.email,
    amount,
    currency,
    ...(callbackUrl ? { callback_url: callbackUrl } : {}),
    ...(planCode ? { plan: planCode } : {}),
    metadata: {
      user_id: user.id,
      app: 'roofcalc_pro',
    },
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
    });
  } catch (err) {
    return res.status(502).json({
      code: 'PAYSTACK_NETWORK_ERROR',
      error: err?.message || 'Failed to reach Paystack.',
    });
  }
}
