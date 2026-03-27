/**
 * Gmail API email sender.
 * Requires credentials.json (OAuth client) + token.json (user token).
 * Both are set up via scripts/gmail-auth.js (one-time setup).
 *
 * Env vars needed (or set in .env):
 *   GMAIL_CREDENTIALS_PATH — path to credentials.json (default: ./credentials.json)
 *   GMAIL_TOKEN_PATH       — path to token.json (default: ./token.json)
 *   GMAIL_FROM             — sender address (default: finn@finnworks.ai)
 *   APP_BASE_URL           — public URL of the server (e.g. https://finnworks.ai)
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const CREDENTIALS_PATH = process.env.GMAIL_CREDENTIALS_PATH || path.join(__dirname, '../../../credentials.json');
const TOKEN_PATH = process.env.GMAIL_TOKEN_PATH || path.join(__dirname, '../../../token.json');
const FROM_EMAIL = process.env.GMAIL_FROM || 'finn@finnworks.ai';
const BASE_URL = process.env.APP_BASE_URL || 'https://finnworks.ai';

function getAuthClient() {
  // Support env-var-based credentials for Railway/production deployments
  // where the filesystem resets on redeploy.
  let credentials;
  if (process.env.GMAIL_CREDENTIALS_JSON) {
    credentials = JSON.parse(process.env.GMAIL_CREDENTIALS_JSON);
  } else if (fs.existsSync(CREDENTIALS_PATH)) {
    credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  } else {
    throw new Error(`Gmail credentials not found. Set GMAIL_CREDENTIALS_JSON env var or provide ${CREDENTIALS_PATH}.`);
  }

  let token;
  if (process.env.GMAIL_TOKEN_JSON) {
    token = JSON.parse(process.env.GMAIL_TOKEN_JSON);
  } else if (fs.existsSync(TOKEN_PATH)) {
    token = JSON.parse(fs.readFileSync(TOKEN_PATH));
  } else {
    throw new Error(`Gmail token not found. Set GMAIL_TOKEN_JSON env var or run scripts/gmail-auth.js.`);
  }

  const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;
  const auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  auth.setCredentials(token);
  return auth;
}

async function sendRaw(raw) {
  const auth = getAuthClient();
  const gmail = google.gmail({ version: 'v1', auth });
  const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
  return { messageId: res.data.id };
}

function buildRawMessage({ to, subject, text, pdfBuffer, pdfFilename }) {
  const boundary = `----=_FinnWorks_${Date.now()}`;
  const encodedPdf = pdfBuffer.toString('base64');

  const message = [
    `From: FinnWorks AI <${FROM_EMAIL}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    text,
    ``,
    `--${boundary}`,
    `Content-Type: application/pdf`,
    `Content-Transfer-Encoding: base64`,
    `Content-Disposition: attachment; filename="${pdfFilename}"`,
    ``,
    encodedPdf,
    `--${boundary}--`,
  ].join('\r\n');

  return Buffer.from(message).toString('base64url');
}

function buildPlainMessage({ to, subject, text }) {
  const message = [
    `From: FinnWorks AI <${FROM_EMAIL}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    text,
  ].join('\r\n');
  return Buffer.from(message).toString('base64url');
}

// ─── Free audit email (with PDF attached + upsell CTA) ───────────────────────

async function sendAuditEmail({ to, websiteUrl, pdfBuffer, overallScore }) {
  const domain = new URL(websiteUrl).hostname.replace('www.', '');
  const upgradeUrl = `${BASE_URL}/upgrade?url=${encodeURIComponent(websiteUrl)}&email=${encodeURIComponent(to)}`;

  const scoreLabel = overallScore >= 75 ? 'good foundations' :
    overallScore >= 55 ? 'several areas that need attention' :
    'significant issues that are likely costing you customers';

  const raw = buildRawMessage({
    to,
    subject: `Your FinnWorks Website Audit — ${domain}`,
    text: `Hi there,

Your free website audit for ${websiteUrl} is attached.

Your overall score is ${overallScore}/100 — your site has ${scoreLabel}.

The report covers 5 areas:
- Performance & Speed
- SEO Foundations
- Mobile Experience
- Content & Messaging
- Trust & Credibility

─────────────────────────────────
Want us to fix it for you?
─────────────────────────────────

We can send you a detailed Fix Guide — step-by-step instructions for every priority issue, with exact code snippets ready to hand to your developer (or follow yourself in WordPress/Squarespace).

Fix Guide — $97
✓ 6 priority fixes, fully detailed
✓ Numbered steps for each fix
✓ Copy-paste code snippets included
✓ Pro tips from our team
✓ Ready to hand to your web developer

Get your Fix Guide → ${upgradeUrl}

─────────────────────────────────

If you have any questions, just reply to this email.

— Finn
FinnWorks AI
https://finnworks.ai
`,
    pdfBuffer,
    pdfFilename: `finnworks-audit-${domain}.pdf`,
  });

  return sendRaw(raw);
}

// ─── Fix guide email (with Fix Guide PDF attached) ───────────────────────────

async function sendFixGuideEmail({ to, websiteUrl, pdfBuffer }) {
  const domain = new URL(websiteUrl).hostname.replace('www.', '');

  const raw = buildRawMessage({
    to,
    subject: `Your FinnWorks Fix Guide — ${domain}`,
    text: `Hi there,

Your Fix Guide for ${websiteUrl} is attached.

Inside you'll find:
- 6 priority fixes, ranked by impact
- Step-by-step numbered instructions for each
- Code snippets ready to copy-paste
- Pro tips for smooth implementation

Hand this to your web developer or follow the steps yourself — most fixes take less than an hour each.

Once your fixes are live, we recommend re-running your free audit at https://finnworks.ai to see your score improve.

If you have any questions, just reply to this email.

— Finn
FinnWorks AI
https://finnworks.ai
`,
    pdfBuffer,
    pdfFilename: `finnworks-fix-guide-${domain}.pdf`,
  });

  return sendRaw(raw);
}

module.exports = { sendAuditEmail, sendFixGuideEmail };
