import crypto from 'node:crypto';
import {
  getSupabaseConfig,
  getSupabaseAdminHeaders,
  verifySupabaseSessionUser,
} from './_supabase.js';

const GEMINI_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    shapeType: {
      type: 'STRING',
      enum: ['rectangle', 'l_shape', 't_shape', 'u_shape', 'cross_shape', 'custom_polygon'],
    },
    roofType: {
      type: 'STRING',
      enum: ['hip', 'gable', 'shed', 'gambrel', 'unspecified'],
    },
    lengthMeters: { type: 'NUMBER', nullable: true },
    breadthMeters: { type: 'NUMBER', nullable: true },
    edgeDimensions: {
      type: 'OBJECT',
      properties: {
        top: { type: 'NUMBER', nullable: true },
        right: { type: 'NUMBER', nullable: true },
        bottom: { type: 'NUMBER', nullable: true },
        left: { type: 'NUMBER', nullable: true },
      },
    },
    slantingHeightMeters: { type: 'NUMBER', nullable: true },
    kingpostHeightMeters: { type: 'NUMBER', nullable: true },
    pitchAngleDegrees: { type: 'NUMBER', nullable: true },
    overhangMeters: { type: 'NUMBER', nullable: true },
    parapetHeightMeters: { type: 'NUMBER', nullable: true },
    polygonVertices: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          x: { type: 'NUMBER' },
          y: { type: 'NUMBER' },
        },
        required: ['x', 'y'],
      },
    },
    extensions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          length: { type: 'NUMBER' },
          breadth: { type: 'NUMBER' },
          quantity: { type: 'NUMBER' },
        },
        required: ['length', 'breadth'],
      },
    },
    detectedLabels: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          label: { type: 'STRING' },
          valueText: { type: 'STRING' },
          meters: { type: 'NUMBER', nullable: true },
        },
        required: ['label', 'valueText'],
      },
    },
    confidence: {
      type: 'STRING',
      enum: ['high', 'medium', 'low'],
    },
    notes: { type: 'STRING' },
  },
  required: ['shapeType', 'roofType', 'polygonVertices', 'detectedLabels', 'confidence', 'notes'],
};

async function verifySupabaseProUser(authHeader, supabaseUrl, serviceKey) {
  const sessionCheck = await verifySupabaseSessionUser(authHeader, supabaseUrl, serviceKey);
  if (!sessionCheck.ok) {
    return sessionCheck;
  }
  const { user } = sessionCheck;

  const profResp = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(
      user.id
    )}&select=id,is_pro,plan_expires_at,ai_scans_used,ai_scans_limit`,
    { headers: getSupabaseAdminHeaders(serviceKey) }
  );
  if (!profResp.ok) {
    return { ok: false, status: 500, code: 'PROFILE_ERROR', error: 'Could not verify Pro subscription status.' };
  }
  const rows = await profResp.json();
  const profile = rows?.[0];

  const isExpired = profile?.plan_expires_at && new Date(profile.plan_expires_at) <= new Date();
  if (!profile?.is_pro || isExpired) {
    return { ok: false, status: 403, code: 'PRO_REQUIRED', error: 'AI Sketch Scanning requires an active Pro plan.' };
  }

  const defaultLimit = Number(process.env.PRO_INITIAL_AI_SCANS || process.env.PRO_MONTHLY_AI_SCANS || 100);
  const limit = Number(profile.ai_scans_limit) > 0 ? Number(profile.ai_scans_limit) : defaultLimit;
  const used = Number(profile.ai_scans_used) || 0;

  // Pay-as-you-go AI scan credits: never auto-reset monthly; users buy Scan Top-Up packs at will when finished.
  if (used >= limit) {
    return {
      ok: false,
      status: 429,
      code: 'QUOTA_EXCEEDED',
      error: `You have used all ${limit} AI scan credits. Buy an on-demand Scan Top-Up pack in RoofCalc Pro to continue.`,
    };
  }

  return { ok: true, userId: user.id, used, limit };
}

async function readHashCache(supabaseUrl, serviceKey, imageHash) {
  try {
    const resp = await fetch(
      `${supabaseUrl}/rest/v1/sketch_cache?image_hash=eq.${encodeURIComponent(imageHash)}&select=payload`,
      { headers: getSupabaseAdminHeaders(serviceKey) }
    );
    if (!resp.ok) return null;
    const rows = await resp.json();
    return rows?.[0]?.payload || null;
  } catch {
    return null;
  }
}

async function writeHashCache(supabaseUrl, serviceKey, imageHash, payload) {
  try {
    await fetch(`${supabaseUrl}/rest/v1/sketch_cache`, {
      method: 'POST',
      headers: getSupabaseAdminHeaders(serviceKey, 'resolution=merge-duplicates'),
      body: JSON.stringify({ image_hash: imageHash, payload }),
    });
  } catch {
    // Non-fatal cache write failure
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
  const { supabaseUrl, supabaseServiceKey } = getSupabaseConfig();
  const allowPreviewBypass = process.env.DEV_ALLOW_PRO_PREVIEW === 'true';

  if (!geminiKey) {
    return res.status(503).json({
      code: 'BACKEND_NOT_CONFIGURED',
      error: 'Server GEMINI_API_KEY is not configured in Vercel Environment Variables.',
    });
  }

  let authCheck = { ok: true, userId: null, used: 0, limit: Number(process.env.PRO_MONTHLY_AI_SCANS || 100) };
  const usingSupabase = Boolean(supabaseUrl && supabaseServiceKey);

  if (usingSupabase) {
    authCheck = await verifySupabaseProUser(req.headers.authorization, supabaseUrl, supabaseServiceKey);
    if (!authCheck.ok) {
      return res.status(authCheck.status).json({ code: authCheck.code, error: authCheck.error });
    }
  } else if (!allowPreviewBypass) {
    return res.status(503).json({
      code: 'BACKEND_NOT_CONFIGURED',
      error: 'Supabase backend environment variables are not configured yet.',
    });
  }

  const {
    mimeType = 'image/jpeg',
    base64Data = '',
    stageId = 'foundation',
    unitSystem = 'metric',
    manualNotesText = '',
    offlineExtracted = null,
  } = req.body || {};

  if (!base64Data || typeof base64Data !== 'string' || base64Data.length > 4_000_000) {
    return res.status(400).json({ code: 'INVALID_IMAGE', error: 'Invalid or oversized compressed image payload.' });
  }

  const imageHash = crypto
    .createHash('sha256')
    .update(`v2:${unitSystem}:${stageId}:${base64Data}`)
    .digest('hex');

  if (usingSupabase) {
    const cachedPayload = await readHashCache(supabaseUrl, supabaseServiceKey, imageHash);
    if (cachedPayload) {
      return res.status(200).json({
        ...cachedPayload,
        cached: true,
        quota: {
          used: authCheck.used,
          limit: authCheck.limit,
          remaining: Math.max(0, authCheck.limit - authCheck.used),
        },
      });
    }
  }

  const aspectHint =
    offlineExtracted && Number(offlineExtracted.aspect) > 0
      ? ` Visual contour aspect ratio W:H is ~${Number(offlineExtracted.aspect).toFixed(2)}.`
      : '';

  const systemInstruction = `Extract hand-drawn building/roof sketch geometry and measurements into compact JSON (meters; convert ft -> m with 1 ft = 0.3048 m; assume ${
    unitSystem === 'imperial' ? 'feet' : 'meters'
  } when unlabeled).${aspectHint}
Rules:
1. Read ALL handwritten/printed dimension numbers in ANY orientation (upright, upside-down 180°, vertical 90°/270°, including decimals like 1.4, 2.5, 3.0) and list each one in detectedLabels with its position label (e.g. top, left, bottom, right_upper, step_1).
2. ALWAYS output clockwise orthogonal (90-degree) outer perimeter corners polygonVertices [{x, y}] in meters starting from top-leftmost wall corner (0, 0) with x right and y down (do NOT repeat (0,0) at the end).
   - Trace EVERY horizontal jog and vertical step cleanly so segment lengths match the numbers written beside each wall. Do NOT simplify multi-stepped walls (e.g. 2+ steps along one side) into a 4-wall rectangle or 6-wall L-shape; use "custom_polygon" with all corners (8, 10, etc.).
   - If an outer wall has no written label, compute its exact length geometrically from parallel walls so opposite spans balance cleanly (sum of right edges == sum of left edges; sum of top edges == sum of bottom edges).
   - For a simple 4-wall rectangle, output its 4 corners [(0,0), (L,0), (L,B), (0,B)].
3. ALWAYS set overall bounding lengthMeters = (max x - min x) and breadthMeters = (max y - min y) from polygonVertices, plus edgeDimensions {top, right, bottom, left} for clear outer edge spans.
4. Also extract roofType, slantingHeightMeters (H), kingpostHeightMeters (KP), pitchAngleDegrees, overhangMeters, parapetHeightMeters if shown. Active stage: "${stageId}". Keep "notes" <= 15 words.${
    manualNotesText ? ` User note hint: "${String(manualNotesText).slice(0, 120)}".` : ''
  }`;

  const modelsToTry = ['gemini-3-flash-preview', 'gemini-flash-lite-latest', 'gemini-3.1-flash-lite-preview'];
  let lastError = null;

  for (const modelName of modelsToTry) {
    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(
          geminiKey
        )}`,
        {
          method: 'POST',
          signal: AbortSignal.timeout(28000),
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  { text: systemInstruction },
                  {
                    inlineData: {
                      mimeType,
                      data: base64Data,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 4096,
              ...(modelName.startsWith('gemini-3') ? { thinkingConfig: { thinkingLevel: 'low' } } : {}),
              responseMimeType: 'application/json',
              responseSchema: GEMINI_RESPONSE_SCHEMA,
            },
          }),
        }
      );

      if (!resp.ok) {
        const errBody = await resp.text();
        lastError = `Gemini (${modelName}) HTTP ${resp.status}: ${errBody.slice(0, 180)}`;
        continue;
      }

      const json = await resp.json();
      const rawContent = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawContent) {
        lastError = 'Empty response from Gemini Vision';
        continue;
      }

      const parsed = JSON.parse(rawContent);
      const responsePayload = { parsed, model: modelName };

      let nextUsed = authCheck.used;
      if (usingSupabase && authCheck.userId) {
        nextUsed = authCheck.used + 1;
        await Promise.all([
          writeHashCache(supabaseUrl, supabaseServiceKey, imageHash, responsePayload),
          fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(authCheck.userId)}`, {
            method: 'PATCH',
            headers: getSupabaseAdminHeaders(supabaseServiceKey),
            body: JSON.stringify({ ai_scans_used: nextUsed }),
          }),
        ]);
      }

      return res.status(200).json({
        ...responsePayload,
        cached: false,
        quota: {
          used: nextUsed,
          limit: authCheck.limit,
          remaining: Math.max(0, authCheck.limit - nextUsed),
        },
      });
    } catch (err) {
      lastError = err?.message || 'Gemini Vision call failed';
    }
  }

  return res.status(502).json({ code: 'UPSTREAM_ERROR', error: lastError || 'Gemini Vision failed' });
}
