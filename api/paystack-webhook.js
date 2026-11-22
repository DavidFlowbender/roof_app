import crypto from 'node:crypto';
import {
  getSupabaseConfig,
  getSupabaseAdminHeaders,
} from './_supabase.js';
import { fulfillVerifiedPaystackTransaction } from './_billing.js';

/**
 * Paystack Webhook -> Automatically fulfills Pro upgrades, AI Scan Top-Up packs,
 * and Option A influencer referral commissions idempotently in Supabase.
 * Deploy on Vercel at /api/paystack-webhook
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secretKey = (process.env.PAYSTACK_SECRET_KEY || '').trim();
  const webhookSecret = (process.env.PAYSTACK_WEBHOOK_SECRET || '').trim();
  const { supabaseUrl, supabaseServiceKey } = getSupabaseConfig();

  if ((!secretKey && !webhookSecret) || !supabaseUrl || !supabaseServiceKey) {
    return res.status(503).json({ error: 'Webhook backend environment variables are not configured.' });
  }

  const signature = req.headers['x-paystack-signature'];
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  const candidateKeys = [secretKey, webhookSecret].filter(Boolean);
  const signatureValid =
    Boolean(signature) &&
    candidateKeys.some(
      (k) => crypto.createHmac('sha512', k).update(rawBody).digest('hex') === signature
    );

  if (!signatureValid) {
    return res.status(401).json({ error: 'Invalid Paystack signature' });
  }

  const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const eventType = event?.event;
  const data = event?.data || {};
  const email = data?.customer?.email || null;
  const userId = data?.metadata?.user_id || null;

  if (!email && !userId) {
    return res.status(200).json({ received: true, ignored: 'No customer identifier' });
  }

  if (
    eventType === 'charge.success' ||
    eventType === 'subscription.create' ||
    eventType === 'invoice.payment_succeeded'
  ) {
    // Ensure a reference exists even for subscription/invoice events
    const txPayload = {
      ...data,
      reference: data?.reference || `evt_${eventType}_${data?.id || Date.now()}`,
    };
    await fulfillVerifiedPaystackTransaction(supabaseUrl, supabaseServiceKey, txPayload, {
      fallbackUserId: userId,
      fallbackEmail: email,
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
