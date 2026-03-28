/**
 * PDF report generator — completely redesigned for clarity and readability.
 * Clean layout, proper spacing, centered elements, professional styling.
 *
 * Layout: Cover | Detailed Sections (2-3 pages) | Action Plan
 * Total: 4-5 pages
 */

'use strict';

const PDFDocument = require('pdfkit');
const { URL } = require('url');

const BRAND = {
  primary:   '#0f172a',
  accent:    '#6366f1',
  light:     '#f8fafc',
  border:    '#e2e8f0',
  text:      '#1e293b',
  muted:     '#64748b',
  white:     '#ffffff',
  darkBg:    '#f9fafb',
};

const GRADE_COLORS = {
  A: '#10b981', B: '#34d399', C: '#f59e0b', D: '#f97316', F: '#ef4444'
};

const SECTION_NAMES = {
  performance: 'Performance & Speed',
  seo:         'SEO Foundations',
  mobile:      'Mobile Experience',
  content:     'Content & Messaging',
  trust:       'Trust & Credibility',
};

function gradeColor(g) { return GRADE_COLORS[g] || BRAND.muted; }
function scoreToGrade(s) {
  if (s >= 90) return 'A'; if (s >= 75) return 'B';
  if (s >= 60) return 'C'; if (s >= 40) return 'D'; return 'F';
}

function wrapLines(doc, text, maxWidth, fontSize) {
  doc.fontSize(fontSize).font('Helvetica');
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

function put(doc, text, x, y, opts) {
  doc.text(String(text), x, y, Object.assign({ lineBreak: false }, opts));
}

function scoreCircle(doc, x, y, grade, color) {
  // Proper centered circle with centered text
  doc.circle(x, y, 28).fill(color);
  doc.fillColor(BRAND.white).fontSize(26).font('Helvetica-Bold');
  put(doc, grade, x - 13, y - 18, { width: 26, align: 'center' });
}

function pageHeader(doc, pageNum, W, M) {
  // Top bar
  doc.rect(0, 0, W, 3).fill(BRAND.accent);
}

function pageFooter(doc, domain, pageNum, W, H, M) {
  const footerY = H - 28;
  doc.rect(0, footerY, W, 28).fill(BRAND.primary);
  doc.fillColor(BRAND.muted).fontSize(7.5).font('Helvetica');
  put(doc, domain + ' · finnworks.ai', M, footerY + 10);
  put(doc, `Page ${pageNum}`, W - M - 20, footerY + 10, { width: 20, align: 'right' });
}

function generatePDF(auditResult, url, customerEmail) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = 595, H = 842, M = 48, FOOTER_H = 28;
    const CONTENT_WIDTH = W - M * 2;
    const PAGE_BOTTOM = H - FOOTER_H - 24;

    let domain;
    try { domain = new URL(url).hostname.replace('www.', ''); }
    catch (_) { domain = url; }

    const { sections, actionPlan, overallScore, topWins } = auditResult;
    const sMap = Object.fromEntries(sections.map(s => [s.section, s]));
    const oGrade = scoreToGrade(overallScore);
    let pageNum = 1;

    // ═══════════════════════════════════════════════════════════════
    // PAGE 1: COVER
    // ═══════════════════════════════════════════════════════════════
    doc.rect(0, 0, W, H).fill(BRAND.white);
    doc.rect(0, 0, W, 6).fill(BRAND.accent);

    // Logo/brand
    doc.fillColor(BRAND.accent).fontSize(10).font('Helvetica-Bold');
    put(doc, 'FINNWORKS AI', M, 28, { characterSpacing: 2 });
    doc.fillColor(BRAND.muted).fontSize(8).font('Helvetica');
    put(doc, 'Website Audit Report', M, 42);

    // Big centered score circle
    const cx = W / 2, cy = 130;
    scoreCircle(doc, cx, cy, oGrade, gradeColor(oGrade));
    doc.fillColor(BRAND.text).fontSize(11).font('Helvetica');
    put(doc, `${overallScore} / 100`, cx - 30, cy + 38, { width: 60, align: 'center' });
    doc.fillColor(BRAND.muted).fontSize(8).font('Helvetica');
    put(doc, 'OVERALL HEALTH SCORE', cx - 40, cy + 54, { width: 80, align: 'center' });

    // Domain & date
    doc.fillColor(BRAND.text).fontSize(18).font('Helvetica-Bold');
    put(doc, domain, M, 200);
    doc.fillColor(BRAND.muted).fontSize(9).font('Helvetica');
    put(doc, new Date().toLocaleDateString('en-NZ', { dateStyle: 'long' }), M, 225);

    // Section score pills (horizontal)
    let y = 260;
    doc.fillColor(BRAND.muted).fontSize(8).font('Helvetica-Bold');
    put(doc, 'SECTION SCORES', M, y, { characterSpacing: 1 });
    y += 18;

    const sectionOrder = ['performance', 'seo', 'mobile', 'content', 'trust'];
    const pillW = (CONTENT_WIDTH) / 5 - 4;
    sectionOrder.forEach((k, i) => {
      const s = sMap[k];
      if (!s) return;
      const g = s.grade || scoreToGrade(s.score || 50);
      const sx = M + i * (pillW + 4);
      const name = SECTION_NAMES[k];
      
      // Pill background
      doc.rect(sx, y, pillW, 60).fill(BRAND.darkBg).stroke({ color: BRAND.border, width: 1 });
      
      // Score circle inside pill
      doc.circle(sx + pillW / 2, y + 18, 14).fill(gradeColor(g));
      doc.fillColor(BRAND.white).fontSize(14).font('Helvetica-Bold');
      put(doc, g, sx + pillW / 2 - 7, y + 10, { width: 14, align: 'center' });
      
      // Label
      doc.fillColor(BRAND.text).fontSize(7.5).font('Helvetica-Bold');
      put(doc, name, sx + 2, y + 38, { width: pillW - 4, align: 'center' });
    });
    y += 80;

    // Executive summary
    y += 14;
    doc.fillColor(BRAND.muted).fontSize(8).font('Helvetica-Bold');
    put(doc, 'QUICK WINS', M, y, { characterSpacing: 1 });
    y += 16;

    const wins = (topWins || []).slice(0, 3);
    wins.forEach((w, i) => {
      doc.circle(M + 10, y + 8, 7).fill(BRAND.accent);
      doc.fillColor(BRAND.white).fontSize(8).font('Helvetica-Bold');
      put(doc, String(i + 1), M + 6, y + 4, { width: 8, align: 'center' });
      
      doc.fillColor(BRAND.text).fontSize(9.5).font('Helvetica-Bold');
      put(doc, (w.title || '').slice(0, 60), M + 28, y + 2);
      
      const dl = wrapLines(doc, w.description || '', CONTENT_WIDTH - 28, 8);
      doc.fillColor(BRAND.muted).fontSize(8.5).font('Helvetica');
      dl.slice(0, 2).forEach((line, li) => {
        put(doc, line, M + 28, y + 14 + li * 12);
      });
      y += 44;
    });

    // Footer
    pageFooter(doc, domain, pageNum++, W, H, M);

    // ═══════════════════════════════════════════════════════════════
    // PAGES 2-3+: DETAILED SECTIONS
    // ═══════════════════════════════════════════════════════════════

    sectionOrder.forEach((k, si) => {
      const s = sMap[k];
      if (!s) return;

      // New page for each section
      doc.addPage({ margin: 0 });
      pageHeader(doc, pageNum, W, M);

      let y = 24;
      const g = s.grade || scoreToGrade(s.score || 50);
      const name = SECTION_NAMES[k];

      // Section title with grade
      doc.fillColor(BRAND.text).fontSize(18).font('Helvetica-Bold');
      put(doc, name, M, y);
      
      doc.circle(W - M - 30, y + 8, 20).fill(gradeColor(g));
      doc.fillColor(BRAND.white).fontSize(18).font('Helvetica-Bold');
      put(doc, g, W - M - 38, y, { width: 20, align: 'center' });
      
      y += 40;

      // Summary paragraph
      const sumLines = wrapLines(doc, s.summary || '', CONTENT_WIDTH, 9.5);
      doc.fillColor(BRAND.text).fontSize(9.5).font('Helvetica');
      sumLines.slice(0, 4).forEach((line, li) => {
        put(doc, line, M, y + li * 14);
      });
      y += Math.min(sumLines.length, 4) * 14 + 16;

      // Metrics grid
      const highlights = (s.highlights || []).slice(0, 4);
      if (highlights.length > 0) {
        const metW = CONTENT_WIDTH / highlights.length - 4;
        highlights.forEach((hl, hi) => {
          const hx = M + hi * (metW + 4);
          const bg = hl.positive ? '#dbeafe' : '#fef3c7';
          const border = hl.positive ? '#0ea5e9' : '#fbbf24';
          
          doc.rect(hx, y, metW, 64).fill(bg).stroke({ color: border, width: 1.5 });
          
          doc.fillColor(BRAND.text).fontSize(7.5).font('Helvetica-Bold');
          put(doc, String(hl.label ?? '').slice(0, 40), hx + 8, y + 8, { width: metW - 16 });
          
          doc.fillColor(BRAND.accent).fontSize(13).font('Helvetica-Bold');
          put(doc, String(hl.value ?? '').slice(0, 30), hx + 8, y + 26, { width: metW - 16, align: 'left' });
          
          doc.fillColor(BRAND.muted).fontSize(7.5).font('Helvetica');
          put(doc, 'Metric', hx + 8, y + 50);
        });
        y += 72;
      }

      // Fixes section
      doc.fillColor(BRAND.muted).fontSize(8).font('Helvetica-Bold');
      put(doc, 'KEY FIXES', M, y, { characterSpacing: 1 });
      y += 16;

      (s.fixes || []).slice(0, 2).forEach((fix) => {
        if (y + 50 > PAGE_BOTTOM) return;

        // Fix card background
        doc.rect(M, y, CONTENT_WIDTH, 2).fill(gradeColor(g));
        
        // Title
        doc.fillColor(BRAND.text).fontSize(10.5).font('Helvetica-Bold');
        put(doc, (fix.title || '').slice(0, 60), M + 8, y + 10);

        // Description
        const descLines = wrapLines(doc, fix.description || '', CONTENT_WIDTH - 16, 8.5);
        doc.fillColor(BRAND.text).fontSize(8.5).font('Helvetica');
        descLines.slice(0, 3).forEach((line, li) => {
          put(doc, line, M + 8, y + 26 + li * 12);
        });

        // Pills
        let pillX = W - M - 140;
        if (fix.effort) {
          const effortColor = fix.effort === 'Low' ? '#10b981' : (fix.effort === 'Medium' ? '#f59e0b' : '#ef4444');
          doc.rect(pillX, y + 10, 58, 14).fill(effortColor);
          doc.fillColor(BRAND.white).fontSize(7).font('Helvetica-Bold');
          put(doc, `EFFORT: ${fix.effort}`, pillX + 4, y + 12.5);
          pillX -= 64;
        }
        if (fix.impact) {
          const impactColor = fix.impact === 'High' ? '#10b981' : (fix.impact === 'Medium' ? '#6366f1' : '#94a3b8');
          doc.rect(pillX, y + 10, 58, 14).fill(impactColor);
          doc.fillColor(BRAND.white).fontSize(7).font('Helvetica-Bold');
          put(doc, `IMPACT: ${fix.impact}`, pillX + 4, y + 12.5);
        }

        y += 56;
      });

      pageFooter(doc, domain, pageNum++, W, H, M);
    });

    // ═══════════════════════════════════════════════════════════════
    // FINAL PAGE: ACTION PLAN
    // ═══════════════════════════════════════════════════════════════
    doc.addPage({ margin: 0 });
    pageHeader(doc, pageNum, W, M);

    let apY = 24;
    doc.fillColor(BRAND.text).fontSize(18).font('Helvetica-Bold');
    put(doc, 'Priority Action Plan', M, apY);
    doc.fillColor(BRAND.muted).fontSize(9).font('Helvetica');
    put(doc, 'Ranked by impact. Start with Quick Wins.', M, apY + 22);
    apY += 50;

    const apFixes = ((actionPlan && actionPlan.fixes) || []).slice(0, 5);
    apFixes.forEach((fix, i) => {
      if (apY + 50 > PAGE_BOTTOM) return;

      const isFirst = i === 0;

      // Priority badge
      if (isFirst) {
        doc.rect(M, apY, 140, 16).fill(BRAND.accent);
        doc.fillColor(BRAND.white).fontSize(7).font('Helvetica-Bold');
        put(doc, '★ QUICK WIN — START HERE', M + 6, apY + 4);
        apY += 22;
      }

      // Card
      const cardBg = isFirst ? '#eef2ff' : BRAND.darkBg;
      doc.rect(M, apY, CONTENT_WIDTH, 2).fill(isFirst ? BRAND.accent : BRAND.border);

      // Number circle
      doc.circle(M + 16, apY + 14, 11).fill(BRAND.text);
      doc.fillColor(BRAND.white).fontSize(10).font('Helvetica-Bold');
      put(doc, String(i + 1), M + 10, apY + 8, { width: 12, align: 'center' });

      // Title
      doc.fillColor(BRAND.text).fontSize(11).font('Helvetica-Bold');
      put(doc, (fix.title || '').slice(0, 55), M + 40, apY + 6);

      // Description
      const descLines = wrapLines(doc, fix.description || '', CONTENT_WIDTH - 56, 8);
      doc.fillColor(BRAND.text).fontSize(8).font('Helvetica');
      descLines.slice(0, 2).forEach((line, li) => {
        put(doc, line, M + 40, apY + 20 + li * 11);
      });

      // Pills
      let pillX = W - M - 140;
      if (fix.effort) {
        const effortColor = fix.effort === 'Low' ? '#10b981' : (fix.effort === 'Medium' ? '#f59e0b' : '#ef4444');
        doc.rect(pillX, apY + 6, 58, 12).fill(effortColor);
        doc.fillColor(BRAND.white).fontSize(6.5).font('Helvetica-Bold');
        put(doc, `EFFORT: ${fix.effort}`, pillX + 3, apY + 7.5);
        pillX -= 64;
      }
      if (fix.impact) {
        const impactColor = fix.impact === 'High' ? '#10b981' : (fix.impact === 'Medium' ? '#6366f1' : '#94a3b8');
        doc.rect(pillX, apY + 6, 58, 12).fill(impactColor);
        doc.fillColor(BRAND.white).fontSize(6.5).font('Helvetica-Bold');
        put(doc, `IMPACT: ${fix.impact}`, pillX + 3, apY + 7.5);
      }

      apY += (isFirst ? 58 : 52);
    });

    // CTA
    apY += 12;
    if (apY + 40 < PAGE_BOTTOM) {
      doc.rect(M, apY, CONTENT_WIDTH, 1).fill(BRAND.accent);
      doc.fillColor(BRAND.text).fontSize(10).font('Helvetica-Bold');
      put(doc, 'Need Help?', M + 8, apY + 12);
      doc.fillColor(BRAND.muted).fontSize(8.5).font('Helvetica');
      doc.text("Reply to your report email and we'll point you in the right direction.", M + 8, apY + 26, {
        width: CONTENT_WIDTH - 16,
        height: 30
      });
    }

    pageFooter(doc, domain, pageNum, W, H, M);

    doc.end();
  });
}

module.exports = { generatePDF };
