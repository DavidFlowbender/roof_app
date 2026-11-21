import crypto from 'node:crypto';
import {
  getSupabaseConfig,
  getSupabaseAdminHeaders,
  activateProForUser,
} from './_supabase.js';

/**
 * Paystack Webhook -> Automatically activates/renews/revokes Pro plan in Supabase `profiles`
 * Deploy on Vercel at /api/paystack-webhook
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secretKey = (process.env.PAYSTACK_SECRET_KEY || '').trim();
  const { supabaseUrl, supabaseServiceKey } = getSupabaseConfig();

  if (!secretKey || !supabaseUrl || !supabaseServiceKey) {
    return res.status(503).json({ error: 'Webhook backend environment variables are not configured.' });
  }

  const signature = req.headers['x-paystack-signature'];
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  const expectedSig = crypto.createHmac('sha512', secretKey).update(rawBody).digest('hex');

  if (!signature || signature !== expectedSig) {
    return res.status(401).json({ error: 'Invalid Paystack signature' });
  }

  const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const eventType = event?.event;
  const data = event?.data || {};
  const email = data?.customer?.email || null;
  const userId = data?.metadata?.user_id || null;
  const customerCode = data?.customer?.customer_code || null;

  if (!email && !userId) {
    return res.status(200).json({ received: true, ignored: 'No customer identifier' });
  }

  if (
    eventType === 'charge.success' ||
    eventType === 'subscription.create' ||
    eventType === 'invoice.payment_succeeded'
  ) {
    await activateProForUser(supabaseUrl, supabaseServiceKey, {
      userId,
      email,
      customerCode,
    });
  } else if (eventType === 'subscription.disable' || eventType === 'subscription.not_renew') {
    const filter = userId
      ? `id=eq.${encodeURIComponent(userId)}`
      : `email=eq.${encodeURIComponent(String(email).toLowerCase())}`;
    await fetch(`${supabaseUrl}/rest/v1/profiles?${filter}`, {
      method: 'PATCH',
      headers: getSupabaseAdminHeaders(supabaseServiceKey),
      body: JSON.stringify({ is_pro: false }),
    });
  }

  return res.status(200).json({ received: true });
}
