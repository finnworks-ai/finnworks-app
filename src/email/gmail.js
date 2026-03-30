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

// ─── Free audit email (link to hosted report, no attachment) ─────────────────

async function sendAuditEmail({ to, websiteUrl, reportUrl, overallScore, actionPlan }) {
  const domain = new URL(websiteUrl).hostname.replace('www.', '');
  console.log(`[email] sendAuditEmail - websiteUrl: ${websiteUrl}, domain: ${domain}`);
  const upgradeUrl = `${BASE_URL}/upgrade?url=${encodeURIComponent(websiteUrl)}&email=${encodeURIComponent(to)}`;

  const scoreHeadline = overallScore >= 75
    ? `Good foundations — here's how to push to excellent`
    : overallScore >= 55
    ? `Your site has clear opportunities to convert more visitors`
    : `Your site is likely costing you customers every day`;

  const scoreColor = overallScore >= 75 ? '#10b981' : overallScore >= 55 ? '#f59e0b' : '#ef4444';
  const scoreGrade = overallScore >= 90 ? 'A' : overallScore >= 75 ? 'B' : overallScore >= 60 ? 'C' : overallScore >= 40 ? 'D' : 'F';

  // Top 3 action plan items — titles only as a teaser (full details on the report page)
  const topFixes = (actionPlan && actionPlan.fixes ? actionPlan.fixes : []).slice(0, 3);

  const findingsHtml = topFixes.length > 0
    ? topFixes.map((f, i) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:22px;height:22px;border-radius:50%;background:#6366f1;color:white;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${i + 1}</div>
              <div>
                <strong style="color:#1e293b;font-size:14px;">${f.title}</strong>
                <span style="display:block;margin-top:2px;font-size:12px;color:#64748b;">
                  Impact: <strong style="color:${f.impact === 'High' ? '#10b981' : '#f59e0b'};">${f.impact || '—'}</strong>
                  &nbsp;·&nbsp; Effort: ${f.effort || '—'}
                </span>
              </div>
            </div>
          </td>
        </tr>`).join('')
    : `<tr><td style="padding:10px 0;color:#64748b;">Full details are in your report.</td></tr>`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">

    <!-- Header -->
    <div style="background:#0f172a;border-radius:14px 14px 0 0;padding:28px 32px;text-align:center;">
      <div style="font-size:12px;font-weight:700;color:#818cf8;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px;">FINNWORKS AI</div>
      <h1 style="margin:0;font-size:22px;font-weight:800;color:white;line-height:1.2;">Your Audit Report is Ready</h1>
      <p style="margin:6px 0 0;font-size:14px;color:#94a3b8;">${domain}</p>
    </div>

    <!-- Score + View Report CTA -->
    <div style="background:white;padding:28px 32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">

      <!-- Score badge -->
      <div style="display:flex;align-items:center;gap:18px;padding:20px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;margin-bottom:24px;">
        <div style="width:64px;height:64px;border-radius:50%;background:${scoreColor};display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;text-align:center;">
          <div style="font-size:26px;font-weight:800;color:white;line-height:1;">${scoreGrade}</div>
        </div>
        <div>
          <div style="font-size:24px;font-weight:800;color:${scoreColor};line-height:1;">${overallScore}<span style="font-size:14px;color:#94a3b8;font-weight:400;">/100</span></div>
          <div style="font-size:14px;color:#1e293b;font-weight:600;margin-top:4px;">${scoreHeadline}</div>
          <div style="font-size:12px;color:#94a3b8;margin-top:2px;">9 categories · full breakdown in your report</div>
        </div>
      </div>

      <!-- Primary CTA -->
      <div style="text-align:center;margin-bottom:24px;">
        <a href="${reportUrl}" style="display:inline-block;background:#6366f1;color:white;padding:16px 40px;text-decoration:none;border-radius:10px;font-weight:700;font-size:16px;letter-spacing:0.01em;">View Your Full Report →</a>
        <div style="font-size:11px;color:#94a3b8;margin-top:10px;">Your report is available for 14 days · PDF download on the report page</div>
      </div>

      <!-- What we found teaser -->
      <h2 style="font-size:15px;font-weight:700;margin:0 0 4px;color:#1e293b;">Top priority issues Finn found</h2>
      <p style="font-size:13px;color:#64748b;margin:0 0 14px;">See every section in detail on your report page:</p>
      <table style="width:100%;border-collapse:collapse;">
        ${findingsHtml}
      </table>
      <p style="font-size:13px;color:#94a3b8;margin:12px 0 0;">Plus 5 more items in your full 8-point action plan.</p>
    </div>

    <!-- Upsell CTA -->
    <div style="background:#1e1b4b;padding:28px 32px;border:2px solid #6366f1;border-top:none;border-radius:0 0 14px 14px;">
      <div style="font-size:11px;font-weight:700;color:#818cf8;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px;">Want to fix all of this?</div>
      <h3 style="margin:0 0 12px;font-size:20px;font-weight:800;color:white;">Get the step-by-step Fix Guide</h3>
      <p style="font-size:14px;color:#c7d2fe;margin:0 0 18px;line-height:1.6;">The free audit shows you <em>what's wrong</em>. The Fix Guide shows you <em>exactly how to fix it</em> — numbered steps and copy-paste code snippets for every issue, written specifically for <strong>${domain}</strong>.</p>

      <ul style="list-style:none;padding:0;margin:0 0 20px;">
        <li style="padding:5px 0;font-size:14px;color:#c7d2fe;"><span style="color:#10b981;font-weight:700;margin-right:8px;">✓</span>6 priority fixes specific to your site</li>
        <li style="padding:5px 0;font-size:14px;color:#c7d2fe;"><span style="color:#10b981;font-weight:700;margin-right:8px;">✓</span>Numbered step-by-step instructions for each</li>
        <li style="padding:5px 0;font-size:14px;color:#c7d2fe;"><span style="color:#10b981;font-weight:700;margin-right:8px;">✓</span>Copy-paste code snippets included</li>
        <li style="padding:5px 0;font-size:14px;color:#c7d2fe;"><span style="color:#10b981;font-weight:700;margin-right:8px;">✓</span>Time estimate for each fix</li>
        <li style="padding:5px 0;font-size:14px;color:#c7d2fe;"><span style="color:#10b981;font-weight:700;margin-right:8px;">✓</span>Ready to hand to your web developer</li>
      </ul>

      <div style="text-align:center;margin-bottom:16px;">
        <div style="font-size:32px;font-weight:800;color:white;line-height:1;">$49 <span style="font-size:14px;color:#818cf8;font-weight:400;">USD · one-time</span></div>
        <div style="font-size:12px;color:#6366f1;margin-top:4px;">Generated fresh for ${domain} — not a generic template</div>
      </div>

      <div style="text-align:center;">
        <a href="${upgradeUrl}" style="display:inline-block;background:#10b981;color:white;padding:16px 36px;text-decoration:none;border-radius:10px;font-weight:700;font-size:16px;">Get my Fix Guide for ${domain} → $49</a>
      </div>
      <p style="text-align:center;font-size:12px;color:#6366f1;margin:12px 0 0;">One-time purchase · Instant email delivery · No subscription</p>
    </div>

    <!-- Footer -->
    <div style="text-align:center;margin-top:24px;font-size:13px;color:#94a3b8;">
      <p style="margin:0 0 6px;">Questions? Just reply to this email — I read every one.</p>
      <p style="margin:0;color:#64748b;">— Finn, your AI website analyst<br>
        <a href="https://finnworks.ai" style="color:#6366f1;text-decoration:none;">finnworks.ai</a>
      </p>
    </div>

  </div>
</body>
</html>`;

  const topFixesText = topFixes.map((f, i) =>
    `  ${i + 1}. ${f.title} — Impact: ${f.impact || '—'}, Effort: ${f.effort || '—'}`
  ).join('\n');

  const plainText = `Your FinnWorks Website Audit is Ready — ${domain}

Your overall score is ${overallScore}/100 — ${scoreHeadline}.

View your full report here:
${reportUrl}

Your report is available for 14 days. A PDF download button is on the report page.

---

TOP PRIORITY ISSUES FINN FOUND
${topFixes.length > 0 ? topFixesText : '(See your report for full details.)'}

Plus a full 8-point action plan on your report page.

---

WANT TO FIX ALL OF THIS?

Get the step-by-step Fix Guide — $49 USD (one-time)

The free audit shows you what's wrong. The Fix Guide shows you exactly how to fix it.

✓ 6 priority fixes specific to your site
✓ Numbered step-by-step instructions for each
✓ Copy-paste code snippets included
✓ Time estimate for each fix
✓ Ready to hand to your web developer

Get your Fix Guide → ${upgradeUrl}

One-time purchase. Instant email delivery.

---

Questions? Just reply to this email — I read every one.

— Finn, your AI website analyst
finnworks.ai`;

  const raw = buildPlainMessage({
    to,
    subject: `Your ${domain} audit is ready — ${overallScore}/100`,
    html,
    text: plainText,
  });

  return sendRaw(raw);
}

// ─── Fix guide email (with Fix Guide PDF attached) ───────────────────────────

async function sendFixGuideEmail({ to, websiteUrl, pdfBuffer, fixes }) {
  const domain = new URL(websiteUrl).hostname.replace('www.', '');

  // Build fix list rows from the passed fixes array
  const fixList = (fixes || []).slice(0, 6);

  const fixRowsHtml = fixList.map((f, i) => `
    <tr>
      <td style="padding: 10px 0; border-bottom: 1px solid #2d3748;">
        <div style="display:flex;align-items:flex-start;gap:12px;">
          <div style="width:24px;height:24px;border-radius:50%;background:#6366f1;color:white;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;">${i + 1}</div>
          <div>
            <div style="font-size:14px;font-weight:600;color:white;">${f.title}</div>
            <div style="font-size:12px;color:#64748b;margin-top:2px;">
              Impact: <strong style="color:${f.impact === 'High' ? '#10b981' : '#f59e0b'};">${f.impact || '—'}</strong>
              &nbsp;·&nbsp; Effort: ${f.effort || '—'}
            </div>
          </div>
        </div>
      </td>
    </tr>`).join('');

  const fixRowsText = fixList.map((f, i) =>
    `  ${i + 1}. ${f.title} (Impact: ${f.impact || '—'}, Effort: ${f.effort || '—'})`
  ).join('\n');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#f8fafc;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">

    <!-- Header -->
    <div style="background:#1e293b;border:1px solid #334155;border-radius:14px 14px 0 0;padding:32px;text-align:center;">
      <div style="font-size:12px;font-weight:700;color:#818cf8;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px;">FINNWORKS AI</div>
      <h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:white;">Your Fix Guide is ready</h1>
      <p style="margin:0;font-size:14px;color:#64748b;">Step-by-step instructions for <strong style="color:#94a3b8;">${domain}</strong></p>
    </div>

    <!-- Intro -->
    <div style="background:#1e293b;border-left:1px solid #334155;border-right:1px solid #334155;padding:24px 32px;">
      <p style="font-size:15px;color:#94a3b8;line-height:1.65;margin:0 0 20px;">You've made a smart investment. Your Fix Guide is attached to this email — it contains everything you need to improve your site's score, written in plain English.</p>

      <div style="background:#0f172a;border:1px solid #334155;border-radius:10px;padding:20px;margin-bottom:20px;">
        <div style="font-size:11px;font-weight:700;color:#6366f1;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:14px;">What's inside your guide</div>
        <table style="width:100%;border-collapse:collapse;">
          ${fixRowsHtml}
        </table>
      </div>

      <!-- What to do next -->
      <div style="background:#10b98115;border:1px solid #10b98140;border-radius:10px;padding:18px;margin-bottom:20px;">
        <div style="font-size:13px;font-weight:700;color:#10b981;margin-bottom:8px;">▶ Where to start</div>
        <p style="font-size:14px;color:#94a3b8;margin:0;line-height:1.6;">
          <strong style="color:#e2e8f0;">Start with Fix #1</strong> — it delivers the biggest improvement and typically takes under an hour. Work through the fixes in order for maximum impact.
        </p>
      </div>

      <!-- How to use -->
      <div style="font-size:14px;color:#64748b;line-height:1.65;margin-bottom:20px;">
        <strong style="color:#94a3b8;">Two ways to use this guide:</strong><br>
        1. <strong style="color:#94a3b8;">Hand the PDF to your web developer</strong> — each fix has everything they need to implement it.<br>
        2. <strong style="color:#94a3b8;">Follow the steps yourself</strong> — written in plain English, no technical background required.
      </div>

      <!-- Re-audit CTA -->
      <div style="background:#1e1b4b;border:1px solid #6366f1;border-radius:10px;padding:18px;text-align:center;">
        <div style="font-size:14px;color:#c7d2fe;margin-bottom:10px;">Once your fixes are live, re-run your free audit to see your score improve.</div>
        <a href="https://finnworks.ai" style="display:inline-block;background:#6366f1;color:white;padding:10px 24px;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Re-run my audit at finnworks.ai →</a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#1e293b;border:1px solid #334155;border-top:none;border-radius:0 0 14px 14px;padding:20px 32px;text-align:center;">
      <p style="font-size:13px;color:#475569;margin:0 0 6px;">Questions? Just reply to this email — I read every one.</p>
      <p style="font-size:13px;color:#334155;margin:0;">— Finn, your AI website analyst &nbsp;·&nbsp;
        <a href="https://finnworks.ai" style="color:#6366f1;text-decoration:none;">finnworks.ai</a>
      </p>
    </div>

  </div>
</body>
</html>`;

  const plainText = `Your FinnWorks Fix Guide — ${domain}

Your Fix Guide is attached. Here's what's inside:

${fixList.length > 0 ? fixRowsText : '6 priority fixes with step-by-step instructions.'}

WHERE TO START
Start with Fix #1 — it delivers the biggest improvement and typically takes under an hour.
Work through fixes in order for maximum impact.

HOW TO USE IT
1. Hand the PDF to your web developer — each fix has everything they need.
2. Follow the steps yourself — written in plain English, no technical background required.

Once your fixes are live, re-run your free audit at https://finnworks.ai to track your score improvement.

Questions? Just reply to this email — I read every one.

— Finn, your AI website analyst
finnworks.ai`;

  const raw = buildRawMessage({
    to,
    subject: `Your Fix Guide is ready — 6 steps to improve ${domain}`,
    html,
    text: plainText,
    pdfBuffer,
    pdfFilename: `finnworks-fix-guide-${domain}.pdf`,
  });

  return sendRaw(raw);
}

module.exports = { sendAuditEmail, sendFixGuideEmail };
