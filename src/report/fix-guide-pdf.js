/**
 * Fix Guide PDF generator — premium branded step-by-step fix guide.
 *
 * Layout:
 *   Page 1:   Cover (with Table of Contents)
 *   Pages 2+: One fix per page (priority 1–6)
 *   Final:    Completion checklist
 */

'use strict';

const PDFDocument = require('pdfkit');
const { URL } = require('url');

const C = {
  dark:    '#0f172a',
  card:    '#1e293b',
  accent:  '#6366f1',
  aLight:  '#818cf8',
  text:    '#1e293b',
  muted:   '#64748b',
  border:  '#e2e8f0',
  bg:      '#f8fafc',
  white:   '#ffffff',
  green:   '#10b981',
  amber:   '#f59e0b',
  red:     '#ef4444',
  code:    '#0f172a',
  codeText:'#94f06c',
};

const EFFORT_COLOR = { Low: '#10b981', Medium: '#f59e0b', High: '#ef4444' };
const IMPACT_COLOR = { Low: '#94a3b8', Medium: '#6366f1', High: '#10b981' };

const W = 595, H = 842, M = 48, CW = W - M * 2;

function put(doc, text, x, y, opts = {}) {
  doc.text(String(text), x, y, Object.assign({ lineBreak: false }, opts));
}

function wrapLines(doc, text, maxWidth, fontSize, font) {
  doc.fontSize(fontSize).font(font || 'Helvetica');
  const words = (text || '').split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (doc.widthOfString(test) > maxWidth && cur) { lines.push(cur); cur = w; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

// Progress dots: ●●○○○○  (filled up to current, hollow for remaining)
function drawProgressDots(doc, x, y, current, total) {
  const dotR = 4, gap = 12;
  for (let i = 0; i < total; i++) {
    const dx = x + i * (dotR * 2 + gap);
    if (i < current) {
      doc.circle(dx, y, dotR).fill(C.accent);
    } else {
      doc.circle(dx, y, dotR).fill('none').stroke(C.accent);
    }
  }
}

// ──────────────────────────────────────────────────
// COVER PAGE
// ──────────────────────────────────────────────────
function drawCoverPage(doc, url, customerEmail, overallScore, fixes) {
  const domain = new URL(url).hostname.replace('www.', '');

  // Background
  doc.rect(0, 0, W, H).fill(C.dark);
  // Left accent bar
  doc.rect(0, 0, 6, H).fill(C.accent);

  // Brand
  doc.fontSize(13).font('Helvetica-Bold').fillColor(C.accent);
  put(doc, 'FINNWORKS AI', M, 48);
  doc.fontSize(9).font('Helvetica').fillColor(C.muted);
  put(doc, 'Website Fix Guide', M, 66);

  // Main title
  doc.fontSize(38).font('Helvetica-Bold').fillColor(C.white);
  put(doc, 'Your Website', M, 140);
  put(doc, 'Fix Guide', M, 184);
  doc.rect(M, 232, 64, 3).fill(C.accent);

  // Domain + score badges
  doc.roundedRect(M, 256, CW, 52, 8).fill(C.card);
  doc.fontSize(11).font('Helvetica').fillColor(C.muted);
  put(doc, 'Prepared for:', M + 16, 268);
  doc.fontSize(15).font('Helvetica-Bold').fillColor(C.white);
  put(doc, domain, M + 16, 284);

  const scoreLabel = overallScore >= 75 ? 'Good' : overallScore >= 55 ? 'Fair' : 'Needs Work';
  const scoreColor = overallScore >= 75 ? C.green : overallScore >= 55 ? C.amber : C.red;

  doc.roundedRect(M, 330, 130, 80, 8).fill(C.card);
  doc.fontSize(10).font('Helvetica').fillColor(C.muted);
  put(doc, 'Audit Score', M + 14, 346);
  doc.fontSize(30).font('Helvetica-Bold').fillColor(scoreColor);
  put(doc, String(overallScore), M + 14, 362);
  doc.fontSize(9).font('Helvetica').fillColor(C.muted);
  put(doc, '/100  ' + scoreLabel, M + 14 + 36, 376);

  doc.roundedRect(M + 146, 330, 130, 80, 8).fill(C.card);
  doc.fontSize(10).font('Helvetica').fillColor(C.muted);
  put(doc, 'Fixes Inside', M + 160, 346);
  doc.fontSize(30).font('Helvetica-Bold').fillColor(C.accent);
  put(doc, String(fixes.length), M + 160, 362);
  doc.fontSize(9).font('Helvetica').fillColor(C.muted);
  put(doc, 'step-by-step', M + 160, 376);

  // Table of Contents
  const tocY = 438;
  doc.fontSize(9).font('Helvetica-Bold').fillColor(C.muted);
  put(doc, 'WHAT\'S INSIDE', M, tocY, { characterSpacing: 1 });

  fixes.forEach((fix, i) => {
    const fy = tocY + 18 + i * 34;
    // Row
    doc.rect(M, fy, CW, 28).fill(C.card);
    doc.rect(M, fy, 4, 28).fill(C.accent);

    // Number
    doc.circle(M + 20, fy + 14, 10).fill(C.accent);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(C.white);
    put(doc, String(i + 1), M + 15, fy + 9, { width: 10, align: 'center' });

    // Title
    doc.fontSize(10).font('Helvetica-Bold').fillColor(C.white);
    put(doc, (fix.title || '').slice(0, 60), M + 38, fy + 5);

    // Effort / impact
    doc.fontSize(8).font('Helvetica').fillColor(C.muted);
    const ic = IMPACT_COLOR[fix.impact] || C.muted;
    put(doc, `Impact: `, M + 38, fy + 17);
    doc.fillColor(ic);
    put(doc, (fix.impact || '—'), M + 38 + 38, fy + 17);
    doc.fillColor(C.muted);
    put(doc, `  ·  Effort: ${fix.effort || '—'}`, M + 38 + 38 + doc.widthOfString(fix.impact || '—'), fy + 17);
  });

  // Footer
  const date = new Date().toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.fontSize(8).font('Helvetica').fillColor('#334155');
  put(doc, `Prepared for: ${customerEmail}`, M, H - 36);
  put(doc, date, W - M - 100, H - 36, { width: 100, align: 'right' });
  put(doc, 'finnworks.ai', M, H - 20);
}

// ──────────────────────────────────────────────────
// FIX PAGE
// ──────────────────────────────────────────────────
function drawFixPage(doc, fix, pageNum, totalFixes) {
  // White background
  doc.rect(0, 0, W, H).fill(C.white);

  // Left accent bar
  doc.rect(0, 0, 6, H).fill(C.accent);

  // Header strip
  doc.rect(0, 0, W, 56).fill(C.dark);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(C.accent);
  put(doc, 'FINNWORKS AI', M, 12);
  doc.fontSize(8.5).font('Helvetica').fillColor(C.muted);
  put(doc, 'Website Fix Guide', M, 26);

  // Progress dots
  drawProgressDots(doc, W / 2 - (totalFixes * 10 - 4), 28, fix.priority, totalFixes);

  // Fix counter
  doc.fontSize(9).font('Helvetica').fillColor(C.muted);
  put(doc, `Fix ${fix.priority} of ${totalFixes}`, W - M - 54, 22);

  // ── Badges row ──
  let bx = M;
  const by = 68;

  // Priority badge
  const priColor = fix.impact === 'High' ? C.green : fix.impact === 'Medium' ? C.accent : C.muted;
  doc.roundedRect(bx, by, 90, 24, 4).fill(priColor);
  doc.fontSize(9).font('Helvetica-Bold').fillColor(C.white);
  put(doc, `PRIORITY ${fix.priority}`, bx + 8, by + 7.5);
  bx += 98;

  // Effort badge
  const ec = EFFORT_COLOR[fix.effort] || C.muted;
  doc.roundedRect(bx, by, 90, 24, 4).fill(ec + '22');
  doc.fontSize(9).font('Helvetica').fillColor(ec);
  put(doc, `${fix.effort || '—'} effort`, bx + 10, by + 7.5);
  bx += 98;

  // Impact badge
  const ic = IMPACT_COLOR[fix.impact] || C.muted;
  doc.roundedRect(bx, by, 90, 24, 4).fill(ic + '22');
  doc.fontSize(9).font('Helvetica').fillColor(ic);
  put(doc, `${fix.impact || '—'} impact`, bx + 10, by + 7.5);
  bx += 98;

  // Time estimate badge
  const timeLabel = fix.effort === 'Low' ? '~30 min' : fix.effort === 'Medium' ? '~60 min' : '~2 hrs';
  doc.roundedRect(bx, by, 78, 24, 4).fill('#e0e7ff');
  doc.fontSize(9).font('Helvetica').fillColor(C.accent);
  put(doc, `⏱ ${timeLabel}`, bx + 10, by + 7.5);

  // ── Fix title ──
  doc.fontSize(20).font('Helvetica-Bold').fillColor(C.text);
  doc.text(fix.title, M, 108, { width: CW, lineBreak: true });

  // ── "What this achieves" box ──
  const achY = doc.y + 10;
  const summaryLines = wrapLines(doc, fix.summary || '', CW - 20, 10, 'Helvetica');
  const achH = summaryLines.length * 14 + 20;
  doc.roundedRect(M, achY, CW, Math.max(achH, 42), 6).fill('#f0f4ff');
  doc.rect(M, achY, 4, Math.max(achH, 42)).fill(C.accent);
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C.accent);
  put(doc, 'WHAT THIS ACHIEVES', M + 12, achY + 8, { characterSpacing: 0.5 });
  doc.fontSize(10).font('Helvetica').fillColor(C.text);
  summaryLines.slice(0, 3).forEach((line, i) => put(doc, line, M + 12, achY + 20 + i * 14));

  // ── Steps ──
  let y = doc.y + Math.max(achH, 42) + 16;
  if (y < achY + Math.max(achH, 42) + 16) y = achY + Math.max(achH, 42) + 16;

  doc.fontSize(12).font('Helvetica-Bold').fillColor(C.text);
  put(doc, 'Step-by-Step Instructions', M, y);
  y += 18;

  const steps = (fix.steps || []);
  for (let i = 0; i < steps.length; i++) {
    const stepText = steps[i].replace(/^Step \d+:\s*/i, '');
    const sLines = wrapLines(doc, stepText, CW - 44, 9.5, 'Helvetica');
    const sH = sLines.length * 14 + 20;

    if (y + sH > H - 120) break;

    // Step card
    doc.roundedRect(M, y, CW, sH, 5).fill(C.bg);
    doc.rect(M, y, 1, sH).fill(C.accent);

    // Number circle
    doc.circle(M + 20, y + sH / 2, 11).fill(C.accent);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(C.white);
    const sn = String(i + 1);
    put(doc, sn, M + 20 - (sn.length > 1 ? 5 : 3.5), y + sH / 2 - 6);

    // Step text
    doc.fontSize(9.5).font('Helvetica').fillColor(C.text);
    sLines.forEach((line, li) => put(doc, line, M + 38, y + 10 + li * 14));

    y += sH + 7;
  }

  // ── Code snippet ──
  if (fix.code && fix.code.trim() && y < H - 120) {
    y += 4;
    doc.fontSize(10).font('Helvetica-Bold').fillColor(C.text);
    put(doc, 'Code Snippet', M, y);
    y += 14;

    const codeSnippet = fix.code.slice(0, 700);
    const codeLines = codeSnippet.split('\n');
    const codeH = Math.min(codeLines.length * 13 + 18, 130);

    if (y + codeH < H - 80) {
      doc.roundedRect(M, y, CW, codeH, 6).fill(C.code);
      doc.fontSize(7.5).font('Courier').fillColor(C.codeText);
      doc.text(codeSnippet, M + 10, y + 9, { width: CW - 20, lineBreak: true, lineGap: 2 });
      y = doc.y + 10;
    }
  }

  // ── Pro Tip ──
  if (fix.proTip && y < H - 80) {
    const tipLines = wrapLines(doc, fix.proTip, CW - 24, 9, 'Helvetica');
    const tipH = tipLines.length * 13 + 28;
    doc.roundedRect(M, y, CW, tipH, 6).fill(C.accent + '11');
    doc.rect(M, y, 4, tipH).fill(C.accent);
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(C.accent);
    put(doc, '💡  Pro Tip', M + 12, y + 9);
    doc.fontSize(9).font('Helvetica').fillColor(C.text);
    tipLines.forEach((line, i) => put(doc, line, M + 12, y + 22 + i * 13));
  }

  // ── Footer ──
  doc.rect(0, H - 30, W, 30).fill(C.dark);
  doc.fontSize(7.5).font('Helvetica').fillColor('#334155');
  put(doc, 'finnworks.ai', M, H - 17);
  put(doc, `Fix ${fix.priority} of ${totalFixes} — ${(fix.title || '').slice(0, 50)}`, W / 2 - 90, H - 17);
}

// ──────────────────────────────────────────────────
// COMPLETION CHECKLIST PAGE
// ──────────────────────────────────────────────────
function drawChecklistPage(doc, fixes, domain) {
  doc.rect(0, 0, W, H).fill(C.white);
  doc.rect(0, 0, W, 4).fill(C.accent);
  doc.rect(0, 0, 6, H).fill(C.accent);

  // Header
  doc.rect(0, 0, W, 56).fill(C.dark);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(C.accent);
  put(doc, 'FINNWORKS AI', M, 12);
  doc.fontSize(8.5).font('Helvetica').fillColor(C.muted);
  put(doc, 'Website Fix Guide', M, 26);

  let y = 72;
  doc.fontSize(20).font('Helvetica-Bold').fillColor(C.text);
  put(doc, 'Your Completion Checklist', M, y);
  y += 14;
  doc.fontSize(10).font('Helvetica').fillColor(C.muted);
  put(doc, 'Tick each fix off as you go. Your score improves with every one you apply.', M, y + 2);
  y += 28;

  fixes.forEach((fix, i) => {
    if (y + 52 > H - 80) return;

    const ic = IMPACT_COLOR[fix.impact] || C.muted;

    // Card
    doc.rect(M, y, CW, 48).fill(C.bg).stroke(C.border);
    doc.rect(M, y, 4, 48).fill(C.accent);

    // Checkbox
    doc.rect(M + 14, y + 16, 16, 16).fill(C.white).stroke(C.border);

    // Number
    doc.fontSize(9).font('Helvetica-Bold').fillColor(C.muted);
    put(doc, String(i + 1), M + 38, y + 6);

    // Title
    doc.fontSize(10.5).font('Helvetica-Bold').fillColor(C.text);
    put(doc, (fix.title || '').slice(0, 62), M + 52, y + 6);

    // Meta
    doc.fontSize(8.5).font('Helvetica').fillColor(C.muted);
    put(doc, `Impact: `, M + 52, y + 22);
    doc.fillColor(ic);
    put(doc, (fix.impact || '—'), M + 52 + 38, y + 22);
    doc.fillColor(C.muted);
    const timeLabel = fix.effort === 'Low' ? '~30 min' : fix.effort === 'Medium' ? '~60 min' : '~2 hrs';
    put(doc, `  ·  Est. time: ${timeLabel}`, M + 52 + 38 + doc.widthOfString(fix.impact || '—'), y + 22);

    y += 54;
  });

  // Re-audit CTA
  y += 12;
  if (y + 72 < H - 30) {
    doc.roundedRect(M, y, CW, 68, 8).fill('#1e1b4b');
    doc.rect(M, y, 4, 68).fill(C.accent);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(C.aLight);
    put(doc, 'SEE YOUR SCORE IMPROVE', M + 14, y + 12, { characterSpacing: 0.5 });
    doc.fontSize(13).font('Helvetica-Bold').fillColor(C.white);
    put(doc, `Once your fixes are live, re-run your free audit`, M + 14, y + 28);
    doc.fontSize(10).font('Helvetica').fillColor(C.muted);
    put(doc, `finnworks.ai  ·  Enter the same URL to track your progress`, M + 14, y + 46);
  }

  // Footer
  doc.rect(0, H - 30, W, 30).fill(C.dark);
  doc.fontSize(7.5).font('Helvetica').fillColor('#334155');
  put(doc, 'finnworks.ai', M, H - 17);
  put(doc, `${domain} — Fix Guide`, W / 2 - 60, H - 17);
}

// ──────────────────────────────────────────────────
// MAIN EXPORT
// ──────────────────────────────────────────────────
async function generateFixGuidePDF(fixGuide, customerEmail) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ autoFirstPage: false, size: 'A4', margin: 0 });

    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const { url, overallScore, fixes } = fixGuide;

    let domain;
    try { domain = new URL(url).hostname.replace('www.', ''); }
    catch (_) { domain = url; }

    // Cover page
    doc.addPage({ size: 'A4', margin: 0 });
    drawCoverPage(doc, url, customerEmail, overallScore, fixes);

    // One page per fix
    for (const fix of fixes) {
      doc.addPage({ size: 'A4', margin: 0 });
      drawFixPage(doc, fix, fix.priority, fixes.length);
    }

    // Completion checklist
    doc.addPage({ size: 'A4', margin: 0 });
    drawChecklistPage(doc, fixes, domain);

    doc.end();
  });
}

module.exports = { generateFixGuidePDF };
