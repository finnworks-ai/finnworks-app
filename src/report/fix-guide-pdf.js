/**
 * Fix Guide PDF generator — premium branded step-by-step fix guide.
 * Rendered with PDFKit.
 *
 * Layout:
 *   Page 1: Cover
 *   Pages 2+: One fix per page (priority 1-6)
 */

'use strict';

const PDFDocument = require('pdfkit');
const { URL } = require('url');

const BRAND = {
  primary: '#0f172a',
  accent:  '#6366f1',
  light:   '#f8fafc',
  border:  '#e2e8f0',
  text:    '#1e293b',
  muted:   '#64748b',
  white:   '#ffffff',
  green:   '#10b981',
  yellow:  '#f59e0b',
  red:     '#ef4444',
};

const EFFORT_COLORS = { Low: '#10b981', Medium: '#f59e0b', High: '#ef4444' };
const IMPACT_COLORS = { Low: '#94a3b8', Medium: '#6366f1', High: '#10b981' };

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;

function hex(c) { return c; }

function put(doc, text, x, y, opts) {
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

function drawCoverPage(doc, url, customerEmail, overallScore, totalFixes) {
  const domain = new URL(url).hostname.replace('www.', '');

  // Background
  doc.rect(0, 0, PAGE_W, PAGE_H).fill(BRAND.primary);

  // Accent bar
  doc.rect(0, 0, 6, PAGE_H).fill(BRAND.accent);

  // Logo area
  doc.fontSize(13).font('Helvetica-Bold').fillColor(BRAND.accent);
  put(doc, 'FINNWORKS AI', MARGIN, 52);

  // Tag line
  doc.fontSize(9).font('Helvetica').fillColor(BRAND.muted);
  put(doc, 'Website Fix Guide', MARGIN, 70);

  // Main heading
  doc.fontSize(34).font('Helvetica-Bold').fillColor(BRAND.white);
  put(doc, 'Your Website', MARGIN, 160);
  put(doc, 'Fix Guide', MARGIN, 200);

  // Accent underline
  doc.rect(MARGIN, 244, 60, 3).fill(BRAND.accent);

  // Domain badge
  doc.roundedRect(MARGIN, 270, CONTENT_W, 52, 8).fill('#1e293b');
  doc.fontSize(11).font('Helvetica').fillColor(BRAND.muted);
  put(doc, 'Prepared for:', MARGIN + 16, 282);
  doc.fontSize(14).font('Helvetica-Bold').fillColor(BRAND.white);
  put(doc, domain, MARGIN + 16, 300);

  // Score badge
  const scoreLabel = overallScore >= 75 ? 'Good' : overallScore >= 55 ? 'Fair' : 'Needs Work';
  const scoreColor = overallScore >= 75 ? BRAND.green : overallScore >= 55 ? BRAND.yellow : BRAND.red;
  doc.roundedRect(MARGIN, 350, 140, 80, 10).fill('#1e293b');
  doc.fontSize(11).font('Helvetica').fillColor(BRAND.muted);
  put(doc, 'Audit Score', MARGIN + 16, 366);
  doc.fontSize(28).font('Helvetica-Bold').fillColor(scoreColor);
  put(doc, `${overallScore}`, MARGIN + 16, 386);
  doc.fontSize(10).font('Helvetica').fillColor(BRAND.muted);
  put(doc, '/100  ' + scoreLabel, MARGIN + 54, 398);

  // Fixes count badge
  doc.roundedRect(MARGIN + 160, 350, 140, 80, 10).fill('#1e293b');
  doc.fontSize(11).font('Helvetica').fillColor(BRAND.muted);
  put(doc, 'Priority Fixes', MARGIN + 176, 366);
  doc.fontSize(28).font('Helvetica-Bold').fillColor(BRAND.accent);
  put(doc, `${totalFixes}`, MARGIN + 176, 386);
  doc.fontSize(10).font('Helvetica').fillColor(BRAND.muted);
  put(doc, 'step-by-step', MARGIN + 210, 398);

  // Description
  doc.fontSize(11).font('Helvetica').fillColor('#94a3b8');
  doc.text(
    'This guide contains prioritised, step-by-step instructions for every fix identified in your website audit. Each fix includes numbered steps, code snippets where relevant, and a pro tip from our team.',
    MARGIN, 464, { width: CONTENT_W, lineBreak: true }
  );

  // Footer
  const date = new Date().toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.fontSize(8).font('Helvetica').fillColor(BRAND.muted);
  put(doc, `Prepared for: ${customerEmail}`, MARGIN, PAGE_H - 40);
  put(doc, date, PAGE_W - MARGIN - 80, PAGE_H - 40);
  put(doc, 'finnworks.ai', MARGIN, PAGE_H - 24);
}

function drawFixPage(doc, fix, pageNum, totalPages) {
  // Background
  doc.rect(0, 0, PAGE_W, PAGE_H).fill(BRAND.white);

  // Accent bar
  doc.rect(0, 0, 6, PAGE_H).fill(BRAND.accent);

  // Header strip
  doc.rect(0, 0, PAGE_W, 56).fill(BRAND.primary);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(BRAND.accent);
  put(doc, 'FINNWORKS AI', MARGIN, 14);
  doc.fontSize(9).font('Helvetica').fillColor(BRAND.muted);
  put(doc, 'Website Fix Guide', MARGIN, 30);
  doc.fontSize(9).font('Helvetica').fillColor(BRAND.muted);
  put(doc, `Fix ${fix.priority} of ${totalPages}`, PAGE_W - MARGIN - 50, 22);

  // Priority badge
  const badgeColor = fix.impact === 'High' ? BRAND.green : fix.impact === 'Medium' ? BRAND.accent : BRAND.muted;
  doc.roundedRect(MARGIN, 72, 80, 22, 4).fill(badgeColor);
  doc.fontSize(9).font('Helvetica-Bold').fillColor(BRAND.white);
  put(doc, `PRIORITY ${fix.priority}`, MARGIN + 8, 79);

  // Effort badge
  const effortColor = EFFORT_COLORS[fix.effort] || BRAND.muted;
  doc.roundedRect(MARGIN + 90, 72, 80, 22, 4).fill(effortColor + '22');
  doc.fontSize(9).font('Helvetica').fillColor(effortColor);
  put(doc, `${fix.effort} effort`, MARGIN + 98, 79);

  // Impact badge
  const impactColor = IMPACT_COLORS[fix.impact] || BRAND.muted;
  doc.roundedRect(MARGIN + 180, 72, 80, 22, 4).fill(impactColor + '22');
  doc.fontSize(9).font('Helvetica').fillColor(impactColor);
  put(doc, `${fix.impact} impact`, MARGIN + 188, 79);

  // Fix title
  doc.fontSize(20).font('Helvetica-Bold').fillColor(BRAND.primary);
  doc.text(fix.title, MARGIN, 110, { width: CONTENT_W, lineBreak: true });

  // Summary
  const titleH = doc.y;
  doc.roundedRect(MARGIN, titleH + 8, CONTENT_W, 1, 0).fill(BRAND.border);
  doc.fontSize(11).font('Helvetica').fillColor(BRAND.text);
  doc.text(fix.summary, MARGIN, titleH + 18, { width: CONTENT_W, lineBreak: true });

  // Steps section
  let y = doc.y + 18;
  doc.fontSize(12).font('Helvetica-Bold').fillColor(BRAND.primary);
  put(doc, 'Step-by-Step Instructions', MARGIN, y);
  y += 20;

  const steps = fix.steps || [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepNum = `${i + 1}`;
    const stepText = step.replace(/^Step \d+:\s*/i, '');

    // Step number circle
    doc.circle(MARGIN + 10, y + 8, 10).fill(BRAND.accent);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(BRAND.white);
    put(doc, stepNum, MARGIN + 10 - (stepNum.length > 1 ? 5 : 3), y + 4);

    // Step text
    doc.fontSize(10).font('Helvetica').fillColor(BRAND.text);
    doc.text(stepText, MARGIN + 28, y, { width: CONTENT_W - 28, lineBreak: true });
    y = doc.y + 8;

    if (y > PAGE_H - 180) break; // Safety guard
  }

  // Code snippet
  if (fix.code && fix.code.trim()) {
    y = doc.y + 10;
    if (y < PAGE_H - 160) {
      doc.fontSize(10).font('Helvetica-Bold').fillColor(BRAND.primary);
      put(doc, 'Code Snippet', MARGIN, y);
      y += 16;

      const codeLines = fix.code.split('\n');
      const codeH = Math.min(codeLines.length * 14 + 16, 120);
      doc.roundedRect(MARGIN, y, CONTENT_W, codeH, 6).fill('#0f172a');

      doc.fontSize(8).font('Courier').fillColor('#94f06c');
      doc.text(fix.code.slice(0, 600), MARGIN + 10, y + 8, {
        width: CONTENT_W - 20,
        lineBreak: true,
        lineGap: 2,
      });
      y = doc.y + 10;
    }
  }

  // Pro tip
  y = doc.y + 8;
  if (y < PAGE_H - 80 && fix.proTip) {
    doc.roundedRect(MARGIN, y, CONTENT_W, 44, 6).fill(BRAND.accent + '11');
    doc.rect(MARGIN, y, 4, 44).fill(BRAND.accent);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(BRAND.accent);
    put(doc, '💡 Pro Tip', MARGIN + 12, y + 8);
    doc.fontSize(9).font('Helvetica').fillColor(BRAND.text);
    doc.text(fix.proTip, MARGIN + 12, y + 22, { width: CONTENT_W - 20, lineBreak: true });
  }

  // Footer
  doc.rect(0, PAGE_H - 32, PAGE_W, 32).fill(BRAND.primary);
  doc.fontSize(8).font('Helvetica').fillColor(BRAND.muted);
  put(doc, 'finnworks.ai', MARGIN, PAGE_H - 18);
  put(doc, `Fix ${fix.priority} of ${totalPages} — ${fix.title}`, PAGE_W / 2 - 80, PAGE_H - 18);
}

async function generateFixGuidePDF(fixGuide, customerEmail) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ autoFirstPage: false, size: 'A4', margin: 0 });

    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const { url, overallScore, fixes } = fixGuide;

    // Cover page
    doc.addPage({ size: 'A4', margin: 0 });
    drawCoverPage(doc, url, customerEmail, overallScore, fixes.length);

    // One page per fix
    for (const fix of fixes) {
      doc.addPage({ size: 'A4', margin: 0 });
      drawFixPage(doc, fix, fix.priority, fixes.length);
    }

    doc.end();
  });
}

module.exports = { generateFixGuidePDF };
