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

function buildRawMessage({ to, subject, html, text, pdfBuffer, pdfFilename }) {
  const boundaryMixed = `----=_FinnWorks_Mixed_${Date.now()}`;
  const boundaryAlt = `----=_FinnWorks_Alt_${Date.now()}`;
  const encodedPdf = pdfBuffer.toString('base64');
  // RFC 2047 encode subject for special characters
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`;

  const message = [
    `From: FinnWorks AI <${FROM_EMAIL}>`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundaryMixed}"`,
    ``,
    `--${boundaryMixed}`,
    `Content-Type: multipart/alternative; boundary="${boundaryAlt}"`,
    ``,
    `--${boundaryAlt}`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    text,
    ``,
    `--${boundaryAlt}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    Buffer.from(html).toString('base64'),
    ``,
    `--${boundaryAlt}--`,
    ``,
    `--${boundaryMixed}`,
    `Content-Type: application/pdf`,
    `Content-Transfer-Encoding: base64`,
    `Content-Disposition: attachment; filename="${pdfFilename}"`,
    ``,
    encodedPdf,
    ``,
    `--${boundaryMixed}--`,
  ].join('\r\n');

  return Buffer.from(message).toString('base64url');
}

function buildPlainMessage({ to, subject, html, text }) {
  // RFC 2047 encode subject for special characters
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`;
  const message = [
    `From: FinnWorks AI <${FROM_EMAIL}>`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; charset=UTF-8; boundary="${`----=_FinnWorks_${Date.now()}`}"`,
    ``,
    `------=_FinnWorks_${Date.now()}`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    text,
    ``,
    `------=_FinnWorks_${Date.now()}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    Buffer.from(html).toString('base64'),
    ``,
    `------=_FinnWorks_${Date.now()}--`,
  ].join('\r\n');
  return Buffer.from(message).toString('base64url');
}

// ─── Free audit email (with PDF attached + upsell CTA) ───────────────────────

async function sendAuditEmail({ to, websiteUrl, pdfBuffer, overallScore }) {
  const domain = new URL(websiteUrl).hostname.replace('www.', '');
  console.log(`[email] sendAuditEmail - websiteUrl: ${websiteUrl}, domain: ${domain}`);
  const upgradeUrl = `${BASE_URL}/upgrade?url=${encodeURIComponent(websiteUrl)}&email=${encodeURIComponent(to)}`;

  const scoreLabel = overallScore >= 75 ? 'good foundations' :
    overallScore >= 55 ? 'several areas that need attention' :
    'significant issues that are likely costing you customers';

  const scoreColor = overallScore >= 75 ? '#10b981' :
    overallScore >= 55 ? '#f59e0b' : '#ef4444';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1f2937; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 5px 0 0 0; font-size: 14px; opacity: 0.9; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .score-box { background: white; border-left: 4px solid ${scoreColor}; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .score-number { font-size: 36px; font-weight: bold; color: ${scoreColor}; }
    .score-label { font-size: 14px; color: #666; margin-top: 5px; }
    .section { margin: 25px 0; }
    .section h2 { font-size: 18px; color: #1f2937; margin: 0 0 12px 0; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
    .checklist { list-style: none; padding: 0; margin: 0; }
    .checklist li { padding: 8px 0; padding-left: 24px; position: relative; color: #555; }
    .checklist li:before { content: "✓"; position: absolute; left: 0; color: #10b981; font-weight: bold; }
    .cta-box { background: white; border: 2px solid #3b82f6; padding: 25px; border-radius: 8px; margin: 30px 0; text-align: center; }
    .cta-box h3 { margin: 0 0 15px 0; font-size: 20px; color: #1f2937; }
    .price { font-size: 32px; font-weight: bold; color: #3b82f6; margin: 15px 0; }
    .price-label { font-size: 14px; color: #666; }
    .btn { display: inline-block; background: #3b82f6; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 15px 0; }
    .btn:hover { background: #2563eb; }
    .features { margin: 20px 0; text-align: left; }
    .features li { list-style: none; padding: 8px 0; padding-left: 20px; position: relative; color: #555; font-size: 14px; }
    .features li:before { content: "✓"; position: absolute; left: 0; color: #10b981; font-weight: bold; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #999; }
    .footer a { color: #3b82f6; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Your Website Audit</h1>
      <p>Free performance analysis for ${domain}</p>
    </div>
    <div class="content">
      <p>Hi there,</p>
      <p>Your free website audit is attached to this email. Here's what we found:</p>

      <div class="score-box">
        <div class="score-number">${overallScore}</div>
        <div class="score-label">/100 — ${scoreLabel}</div>
        <p style="margin: 10px 0 0 0; font-size: 13px; color: #666;">We analyzed your site across 5 key areas</p>
      </div>

      <div class="section">
        <h2>What We Checked</h2>
        <ul class="checklist">
          <li>Performance & Speed</li>
          <li>SEO Foundations</li>
          <li>Mobile Experience</li>
          <li>Content & Messaging</li>
          <li>Trust & Credibility</li>
        </ul>
      </div>

      <div class="cta-box">
        <h3>Ready to Fix These Issues?</h3>
        <p style="color: #666; margin: 0 0 15px 0;">Get a detailed Fix Guide with step-by-step instructions</p>
        <div class="price">
          <span style="font-size: 18px; color: #999;">$</span>49
        </div>
        <div class="price-label">One-time purchase</div>
        
        <ul class="features">
          <li>6 priority fixes, ranked by impact</li>
          <li>Numbered steps for each fix</li>
          <li>Copy-paste code snippets</li>
          <li>Pro tips from our team</li>
          <li>Ready for your web developer</li>
        </ul>
        
        <a href="${upgradeUrl}" class="btn">Get Your Fix Guide</a>
        <p style="font-size: 12px; color: #999; margin: 15px 0 0 0;">Most fixes take less than an hour each</p>
      </div>

      <p style="color: #666;">Questions? Just reply to this email.</p>

      <div class="footer">
        <p style="margin: 0;">
          — Finn<br>
          FinnWorks AI<br>
          <a href="https://finnworks.ai">finnworks.ai</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;

  const plainText = `Your FinnWorks Website Audit — ${domain}

Hi there,

Your free website audit for ${websiteUrl} is attached.

Your overall score is ${overallScore}/100 — your site has ${scoreLabel}.

The report covers 5 areas:
- Performance & Speed
- SEO Foundations
- Mobile Experience
- Content & Messaging
- Trust & Credibility

Want us to fix it for you?

We can send you a detailed Fix Guide — step-by-step instructions for every priority issue, with exact code snippets.

Fix Guide — $49 (one-time)
✓ 6 priority fixes, fully detailed
✓ Numbered steps for each fix
✓ Copy-paste code snippets included
✓ Pro tips from our team
✓ Ready to hand to your web developer

Get your Fix Guide → ${upgradeUrl}

If you have any questions, just reply to this email.

— Finn
FinnWorks AI
https://finnworks.ai`;

  const raw = buildRawMessage({
    to,
    subject: `Your FinnWorks Website Audit — ${domain}`,
    html,
    text: plainText,
    pdfBuffer,
    pdfFilename: `finnworks-audit-${domain}.pdf`,
  });

  return sendRaw(raw);
}

// ─── Fix guide email (with Fix Guide PDF attached) ───────────────────────────

async function sendFixGuideEmail({ to, websiteUrl, pdfBuffer }) {
  const domain = new URL(websiteUrl).hostname.replace('www.', '');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1f2937; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 5px 0 0 0; font-size: 14px; opacity: 0.9; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .section { margin: 25px 0; }
    .section h2 { font-size: 18px; color: #1f2937; margin: 0 0 12px 0; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
    .checklist { list-style: none; padding: 0; margin: 0; }
    .checklist li { padding: 8px 0; padding-left: 24px; position: relative; color: #555; }
    .checklist li:before { content: "✓"; position: absolute; left: 0; color: #10b981; font-weight: bold; }
    .highlight { background: #fef3c7; padding: 15px; border-radius: 6px; margin: 15px 0; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #999; }
    .footer a { color: #3b82f6; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Your Fix Guide</h1>
      <p>Step-by-step instructions for ${domain}</p>
    </div>
    <div class="content">
      <p>Hi there,</p>
      <p>Your Fix Guide is attached — complete with step-by-step instructions and code snippets for every priority fix.</p>

      <div class="section">
        <h2>What's Inside</h2>
        <ul class="checklist">
          <li>6 priority fixes, ranked by impact</li>
          <li>Numbered steps for each fix</li>
          <li>Copy-paste code snippets</li>
          <li>Pro tips for smooth implementation</li>
        </ul>
      </div>

      <div class="highlight">
        <strong>💡 Pro Tip:</strong> Most fixes take less than an hour each. Hand this to your web developer or follow the steps yourself if you're comfortable with code.
      </div>

      <p>Once your fixes are live, we recommend re-running your free audit at <strong>finnworks.ai</strong> to see your score improve.</p>

      <p style="color: #666; margin-top: 25px;">Questions? Just reply to this email.</p>

      <div class="footer">
        <p style="margin: 0;">
          — Finn<br>
          FinnWorks AI<br>
          <a href="https://finnworks.ai">finnworks.ai</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;

  const plainText = `Your FinnWorks Fix Guide — ${domain}

Hi there,

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
https://finnworks.ai`;

  const raw = buildRawMessage({
    to,
    subject: `Your FinnWorks Fix Guide — ${domain}`,
    html,
    text: plainText,
    pdfBuffer,
    pdfFilename: `finnworks-fix-guide-${domain}.pdf`,
  });

  return sendRaw(raw);
}

module.exports = { sendAuditEmail, sendFixGuideEmail };
