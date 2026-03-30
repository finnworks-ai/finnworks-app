/**
 * FinnWorks Server
 *
 * Routes:
 *   POST /audit              — Submit URL for free audit (async, returns 202)
 *   GET  /upgrade            — Create Stripe checkout session → redirect
 *   POST /webhook            — Stripe webhook handler
 *   GET  /health             — Health check
 *
 * Required env vars (.env):
 *   STRIPE_SECRET_KEY
 *   STRIPE_WEBHOOK_SECRET
 *   STRIPE_FIX_GUIDE_PRICE_ID  — Stripe Price ID for the $97 fix guide product
 *   OPENAI_API_KEY
 *   GMAIL_FROM               (optional, defaults to finn@finnworks.ai)
 *   APP_BASE_URL             (optional, defaults to https://finnworks.ai)
 *   PORT                     (optional, defaults to 3000)
 */

require('dotenv').config();
const express = require('express');
const Stripe = require('stripe');
const { runAuditPipeline } = require('./pipeline');
const { runFixGuidePipeline } = require('./fix-guide-pipeline');
const { getAuditCount } = require('./counter');

const path = require('path');
const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const BASE_URL = process.env.APP_BASE_URL || 'https://finnworks.ai';

// Serve landing page + static assets
// Note: Stripe webhook must be registered BEFORE express.json() body parser
app.use(express.static(path.join(__dirname, '../public')));

// ─── Free audit submission ────────────────────────────────────────────────────
// Accepts JSON body: { url, email }
// Validates inputs, responds 202 immediately, runs pipeline async.

app.post('/audit', express.json(), async (req, res) => {
  const { url, email } = req.body || {};

  if (!url || !email) {
    return res.status(400).json({ error: 'url and email are required' });
  }

  // Basic URL validation
  let parsedUrl;
  try {
    parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  // Basic email validation
  if (!email.includes('@') || email.length < 5) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  // Respond immediately — pipeline runs async
  res.status(202).json({ status: 'processing', message: 'Your audit is running. Check your email in a few minutes.' });

  const websiteUrl = parsedUrl.href;
  runAuditPipeline({ websiteUrl, customerEmail: email })
    .then(result => console.log('[audit] Pipeline complete:', result))
    .catch(err => console.error('[audit] Pipeline error:', err));
});

// ─── Upgrade to Fix Guide — create Stripe checkout ───────────────────────────
// Query params: ?url=<website>&email=<customer_email>

app.get('/upgrade', async (req, res) => {
  const { url, email } = req.query;

  if (!url || !email) {
    return res.status(400).send('Missing url or email parameter');
  }

  const priceId = process.env.STRIPE_FIX_GUIDE_PRICE_ID;
  if (!priceId) {
    return res.status(500).send('Fix guide product not configured');
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'payment',
      customer_email: email,
      metadata: {
        website_url: url,
        customer_email: email,
        product: 'fix_guide',
      },
      success_url: `${BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/?cancelled=1`,
    });

    res.redirect(303, session.url);
  } catch (err) {
    console.error('[upgrade] Stripe session error:', err.message);
    res.status(500).send('Could not create checkout session. Please try again.');
  }
});

// ─── Stripe webhook handler ───────────────────────────────────────────────────
// Handles both:
//   product = 'fix_guide' → runFixGuidePipeline
//   (no product / legacy)  → runAuditPipeline

app.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('[webhook] Signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const websiteUrl = session.metadata?.website_url;
      const customerEmail = session.customer_details?.email || session.metadata?.customer_email;
      const product = session.metadata?.product;

      if (!websiteUrl || !customerEmail) {
        console.error('[webhook] Missing metadata: website_url or customer_email');
        return res.status(400).send('Missing metadata');
      }

      // Respond immediately — run pipeline async
      res.status(200).json({ received: true });

      if (product === 'fix_guide') {
        runFixGuidePipeline({ websiteUrl, customerEmail })
          .then(result => console.log('[webhook] Fix guide complete:', result))
          .catch(err => console.error('[webhook] Fix guide error:', err));
      } else {
        runAuditPipeline({ websiteUrl, customerEmail })
          .then(result => console.log('[webhook] Audit complete:', result))
          .catch(err => console.error('[webhook] Audit error:', err));
      }
    } else {
      res.status(200).json({ received: true });
    }
  }
);

// ─── Success page ─────────────────────────────────────────────────────────────

app.get('/success', express.json(), (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fix Guide on its way — FinnWorks AI</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
    .card { background: #1e293b; border-radius: 16px; padding: 48px 40px; max-width: 500px; width: 100%; text-align: center; border: 1px solid #334155; }
    .icon { font-size: 52px; margin-bottom: 24px; }
    h1 { font-size: 26px; font-weight: 700; margin-bottom: 12px; }
    p { color: #94a3b8; font-size: 15px; line-height: 1.6; }
    .back { display: inline-block; margin-top: 28px; padding: 12px 28px; background: #6366f1; color: white; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>Payment confirmed</h1>
    <p>Your Fix Guide is being generated now. You'll receive it by email within the next few minutes.</p>
    <a href="/" class="back">Back to home</a>
  </div>
</body>
</html>`);
});

// ─── Audit counter ────────────────────────────────────────────────────────────

app.get('/api/audit-count', async (_req, res) => {
  try {
    const count = await getAuditCount();
    res.json({ count });
  } catch (err) {
    console.error('[audit-count] Redis error:', err.message);
    res.json({ count: 1247 }); // fallback to seed value if Redis unavailable
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[server] FinnWorks server running on port ${PORT}`);
});
