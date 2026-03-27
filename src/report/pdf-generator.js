/**
 * PDF report generator — premium branded audit report.
 * Uses PDFKit. All layout is manual — no auto page-breaks.
 *
 * Layout: Cover | Analysis (2 pages, multi-section) | Action Plan
 * Total: 4 pages
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
};

const GRADE_COLORS = { A: '#10b981', B: '#34d399', C: '#f59e0b', D: '#f97316', F: '#ef4444' };
const EFFORT_COLORS = { Low: '#10b981', Medium: '#f59e0b', High: '#ef4444' };
const IMPACT_COLORS = { Low: '#94a3b8', Medium: '#6366f1', High: '#10b981' };

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
function gradeToNum(g) { return { A: 92, B: 80, C: 65, D: 45, F: 25 }[g] || 50; }

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

function put(doc, text, x, y, opts) {
  doc.text(String(text), x, y, Object.assign({ lineBreak: false }, opts));
}

function pill(doc, x, y, label, color) {
  doc.fontSize(7).font('Helvetica-Bold');
  const tw = doc.widthOfString(label) + 8;
  doc.rect(x, y, tw, 12).fill(color);
  doc.fillColor(BRAND.white);
  put(doc, label, x + 4, y + 2.5);
  return tw;
}

// Draw a compact section block. Returns new Y position after drawing.
function drawSection(doc, s, startY, W, M, maxY) {
  const g = s.grade || 'C';
  const score = s.score || gradeToNum(g);
  const gc = gradeColor(g);
  const name = SECTION_NAMES[s.section] || s.section;

  // Section header bar
  doc.rect(M, startY, W - M * 2, 28).fill(BRAND.primary);
  // Grade pill
  doc.rect(W - M - 34, startY, 34, 28).fill(gc);
  doc.fillColor(BRAND.white).fontSize(16).font('Helvetica-Bold');
  put(doc, g, W - M - 34, startY + 5, { width: 34, align: 'center' });
  // Section name
  doc.fillColor(BRAND.white).fontSize(11).font('Helvetica-Bold');
  put(doc, name, M + 8, startY + 8, { width: W - M * 2 - 50 });
  // Score bar (thin, inside header)
  const barY = startY + 23;
  doc.rect(M, barY, W - M * 2 - 34, 5).fill('#1e293b');
  doc.rect(M, barY, Math.round((W - M * 2 - 34) * score / 100), 5).fill(gc);

  let y = startY + 34;

  // Highlights row
  const highlights = (s.highlights || []).slice(0, 4);
  if (highlights.length > 0) {
    const hlW = (W - M * 2) / highlights.length;
    highlights.forEach((hl, hi) => {
      const hx = M + hi * hlW;
      const bg = hl.positive ? '#f0fdf4' : '#fff7ed';
      const dot = hl.positive ? '#10b981' : '#f97316';
      doc.rect(hx + 1, y, hlW - 2, 30).fill(bg);
      doc.circle(hx + 9, y + 9, 4).fill(dot);
      doc.fillColor(BRAND.muted).fontSize(6.5).font('Helvetica');
      put(doc, (hl.label || '').slice(0, 30), hx + 17, y + 4, { width: hlW - 18 });
      doc.fillColor(BRAND.text).fontSize(7.5).font('Helvetica-Bold');
      put(doc, (hl.value || '').slice(0, 42), hx + 6, y + 17, { width: hlW - 10 });
    });
    y += 36;
  }

  // Summary
  const sumLines = wrapLines(doc, s.summary || '', W - M * 2, 9);
  doc.fillColor(BRAND.text).fontSize(9).font('Helvetica');
  sumLines.slice(0, 5).forEach((line, li) => {
    if (y + li * 13 < maxY - 10) put(doc, line, M, y + li * 13);
  });
  y += Math.min(sumLines.length, 5) * 13 + 8;

  // Fixes
  (s.fixes || []).slice(0, 3).forEach((fix) => {
    if (y + 28 > maxY) return;
    const descLines = wrapLines(doc, fix.description || '', W - M * 2 - 155, 8.5);
    const descRows = Math.min(descLines.length, 3);
    const cardH = 22 + descRows * 11;
    if (y + cardH > maxY) return;

    doc.rect(M, y, W - M * 2, cardH).fill(BRAND.light);
    doc.rect(M, y, 2, cardH).fill(gc);

    doc.fillColor(BRAND.text).fontSize(9).font('Helvetica-Bold');
    put(doc, (fix.title || '').slice(0, 50), M + 10, y + 5, { width: W - M * 2 - 155 });

    const tx = W - M - 108;
    if (fix.effort) pill(doc, tx, y + 5, `Effort: ${fix.effort}`, EFFORT_COLORS[fix.effort] || BRAND.muted);
    if (fix.impact) pill(doc, tx, y + 19, `Impact: ${fix.impact}`, IMPACT_COLORS[fix.impact] || BRAND.muted);
    if (fix.quickWin) pill(doc, tx - 52, y + 5, 'Quick Win', BRAND.accent);

    doc.fillColor(BRAND.muted).fontSize(8.5).font('Helvetica');
    descLines.slice(0, descRows).forEach((line, li) => {
      put(doc, line, M + 10, y + 17 + li * 11);
    });

    y += cardH + 5;
  });

  return y + 8;
}

function pageFooter(doc, domain, pageNum, totalPages, W, H, FOOTER_H, M, customerEmail) {
  doc.rect(0, H - FOOTER_H, W, FOOTER_H).fill(BRAND.primary);
  doc.fillColor(BRAND.muted).fontSize(8).font('Helvetica');
  put(doc, `${domain}  |  finnworks.ai`, M, H - FOOTER_H + 14);
  put(doc, `${pageNum} / ${totalPages}`, W - M - 30, H - FOOTER_H + 14, { width: 30, align: 'right' });
}

function generatePDF(auditResult, url, customerEmail) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true, bufferPages: true });
    doc.continueOnNewPage = () => {};

    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = 595, H = 842, M = 36;
    const FOOTER_H = 34;
    const PAGE_BOTTOM = H - FOOTER_H;
    const TOTAL_PAGES = 4;

    let domain;
    try { domain = new URL(url).hostname.replace('www.', ''); }
    catch (_) { domain = url; }

    const { sections, actionPlan, overallScore, topWins } = auditResult;
    const sMap = Object.fromEntries(sections.map(s => [s.section, s]));
    const oGrade = scoreToGrade(overallScore);

    // ─── PAGE 1: COVER ───────────────────────────────────────────────
    doc.rect(0, 0, W, H).fill(BRAND.primary);
    doc.rect(0, 0, W, 5).fill(BRAND.accent);

    // Brand
    doc.fillColor(BRAND.accent).fontSize(12).font('Helvetica-Bold');
    put(doc, 'FINNWORKS', M, 26, { characterSpacing: 3 });
    doc.fillColor(BRAND.muted).fontSize(9).font('Helvetica');
    put(doc, 'AI Website Audit', M, 43);

    // Big score
    const cx = W - 90, cy = 150;
    doc.circle(cx, cy, 52).fill(gradeColor(oGrade));
    doc.fillColor(BRAND.white).fontSize(38).font('Helvetica-Bold');
    put(doc, oGrade, cx - 12, cy - 24, { width: 24, align: 'center' });
    doc.fillColor(BRAND.white).fontSize(11).font('Helvetica');
    put(doc, `${overallScore}/100`, cx - 22, cy + 17, { width: 44, align: 'center' });
    doc.fillColor(BRAND.white).fontSize(7.5);
    put(doc, 'HEALTH SCORE', cx - 28, cy + 32, { width: 56, align: 'center' });

    doc.fillColor(BRAND.white).fontSize(32).font('Helvetica-Bold');
    put(doc, 'Website Audit', M, 88);
    put(doc, 'Report', M, 126);
    doc.fillColor(BRAND.accent).fontSize(14).font('Helvetica');
    put(doc, domain, M, 170);
    doc.fillColor(BRAND.muted).fontSize(9);
    put(doc, new Date().toLocaleDateString('en-NZ', { dateStyle: 'long' }), M, 188);

    doc.rect(M, 212, W - M * 2, 1).fill('#334155');

    // Section score pills
    const colW = (W - M * 2) / 5;
    sections.forEach((s, i) => {
      const x = M + i * colW + colW / 2;
      const g = s.grade || scoreToGrade(s.score || 50);
      doc.circle(x, 248, 15).fill(gradeColor(g));
      doc.fillColor(BRAND.white).fontSize(13).font('Helvetica-Bold');
      put(doc, g, x - 6, 240, { width: 12, align: 'center' });
      doc.fillColor(BRAND.muted).fontSize(7).font('Helvetica');
      put(doc, SECTION_NAMES[s.section] || s.section, x - colW / 2 + 2, 268, { width: colW - 4, align: 'center' });
    });

    doc.rect(M, 286, W - M * 2, 1).fill('#334155');

    // Exec summary
    doc.rect(M, 300, W - M * 2, 220).fill('#1e293b');
    doc.rect(M, 300, 4, 220).fill(BRAND.accent);
    doc.fillColor(BRAND.white).fontSize(12).font('Helvetica-Bold');
    put(doc, 'Executive Summary', M + 14, 314);
    doc.fillColor(BRAND.muted).fontSize(7.5).font('Helvetica');
    put(doc, 'YOUR TOP 3 QUICK WINS', M + 14, 332, { characterSpacing: 0.8 });

    const wins = (topWins || []).slice(0, 3);
    wins.forEach((w, i) => {
      const wy = 348 + i * 54;
      doc.circle(M + 24, wy + 7, 8).fill(BRAND.accent);
      doc.fillColor(BRAND.white).fontSize(8.5).font('Helvetica-Bold');
      put(doc, String(i + 1), M + 20, wy + 2, { width: 8, align: 'center' });
      doc.fillColor(BRAND.white).fontSize(10).font('Helvetica-Bold');
      put(doc, (w.title || '').slice(0, 58), M + 38, wy, { width: W - M * 2 - 54 });
      const dl = wrapLines(doc, w.description || '', W - M * 2 - 54, 8.5);
      doc.fillColor('#94a3b8').fontSize(8.5).font('Helvetica');
      dl.slice(0, 2).forEach((l, li) => put(doc, l, M + 38, wy + 14 + li * 13, { width: W - M * 2 - 54 }));
    });

    // Score breakdown grid
    const sbY = 534;
    doc.fillColor(BRAND.muted).fontSize(7.5).font('Helvetica');
    put(doc, 'SECTION SCORES', M, sbY, { characterSpacing: 0.8 });

    const sbColW = (W - M * 2) / 5;
    sections.forEach((s, i) => {
      const sx = M + i * sbColW;
      const g = s.grade || scoreToGrade(s.score || 50);
      const sc = s.score || gradeToNum(g);
      const gc = gradeColor(g);
      const shortName = { performance: 'Perf', seo: 'SEO', mobile: 'Mobile', content: 'Content', trust: 'Trust' }[s.section] || s.section;

      doc.rect(sx + 2, sbY + 14, sbColW - 4, 58).fill('#1e293b');
      // Score bar inside box
      const maxBh = 34;
      const bh = Math.max(2, Math.round(maxBh * sc / 100));
      doc.rect(sx + 10, sbY + 14 + (maxBh - bh) + 4, sbColW - 20, bh).fill(gc);
      // Score number
      doc.fillColor(BRAND.white).fontSize(9).font('Helvetica-Bold');
      put(doc, `${sc}`, sx + 2, sbY + 54, { width: sbColW - 4, align: 'center' });
      // Label below box
      doc.fillColor(BRAND.muted).fontSize(7).font('Helvetica');
      put(doc, shortName, sx + 2, sbY + 76, { width: sbColW - 4, align: 'center' });
    });

    // What's inside
    const wiY = sbY + 92;
    doc.rect(M, wiY, W - M * 2, 54).fill('#1e293b');
    doc.rect(M, wiY, 4, 54).fill('#334155');
    doc.fillColor(BRAND.muted).fontSize(7.5).font('Helvetica');
    put(doc, "WHAT'S INSIDE THIS REPORT", M + 14, wiY + 10, { characterSpacing: 0.8 });
    doc.fillColor('#94a3b8').fontSize(9);
    const wil = wrapLines(doc, 'Performance  |  SEO  |  Mobile  |  Content  |  Trust & Credibility  |  Priority Action Plan', W - M * 2 - 28, 9);
    wil.slice(0, 1).forEach((l, li) => put(doc, l, M + 14, wiY + 26 + li * 13));
    doc.fillColor('#64748b').fontSize(8.5);
    put(doc, 'Each section is graded A-F with specific, prioritised fixes to implement.', M + 14, wiY + 40, { width: W - M * 2 - 28 });

    // Grading scale strip
    const gsY = wiY + 68;
    doc.rect(M, gsY, W - M * 2, 50).fill('#0f1f3d');
    doc.fillColor(BRAND.muted).fontSize(7.5).font('Helvetica');
    put(doc, 'GRADING SCALE', M + 14, gsY + 10, { characterSpacing: 0.8 });
    const grades = [
      { g: 'A', label: '90-100 · Excellent', color: '#10b981' },
      { g: 'B', label: '75-89 · Good', color: '#34d399' },
      { g: 'C', label: '60-74 · Average', color: '#f59e0b' },
      { g: 'D', label: '40-59 · Poor', color: '#f97316' },
      { g: 'F', label: '0-39 · Critical', color: '#ef4444' },
    ];
    const gpW = (W - M * 2) / 5;
    grades.forEach((gr, i) => {
      const gx = M + i * gpW;
      doc.circle(gx + 10, gsY + 34, 7).fill(gr.color);
      doc.fillColor(BRAND.white).fontSize(8).font('Helvetica-Bold');
      put(doc, gr.g, gx + 7, gsY + 29, { width: 6, align: 'center' });
      doc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica');
      put(doc, gr.label, gx + 20, gsY + 30, { width: gpW - 22 });
    });

    // Cover footer
    doc.rect(0, H - FOOTER_H, W, FOOTER_H).fill('#0a0f1e');
    doc.fillColor(BRAND.muted).fontSize(8).font('Helvetica');
    put(doc, `Prepared for ${customerEmail}  |  finnworks.ai`, M, H - FOOTER_H + 12, { width: W - M * 2, align: 'center' });

    // ─── PAGES 2–3: ANALYSIS (multi-section) ─────────────────────────
    const sectionOrder = ['performance', 'seo', 'mobile', 'content', 'trust'];
    const allSections = sectionOrder.map(k => sMap[k]).filter(Boolean);

    // Split: 2 sections page 2, 3 sections page 3
    const page2Sections = allSections.slice(0, 2);
    const page3Sections = allSections.slice(2);

    [page2Sections, page3Sections].forEach((pageSections, pi) => {
      if (pageSections.length === 0) return;
      doc.addPage({ margin: 0 });
      doc.y = 0;

      doc.rect(0, 0, W, H).fill(BRAND.white);
      doc.rect(0, 0, W, 4).fill(BRAND.accent);

      let y = 14;
      pageSections.forEach(s => {
        y = drawSection(doc, s, y, W, M, PAGE_BOTTOM - 10);
        y += 6;
      });

      pageFooter(doc, domain, pi + 2, TOTAL_PAGES, W, H, FOOTER_H, M, customerEmail);
    });

    // ─── PAGE 4: PRIORITY ACTION PLAN ────────────────────────────────
    doc.addPage({ margin: 0 });
    doc.y = 0;

    doc.rect(0, 0, W, H).fill(BRAND.white);
    doc.rect(0, 0, W, 70).fill(BRAND.accent);
    doc.rect(0, 0, W, 4).fill(BRAND.primary);

    doc.fillColor(BRAND.white).fontSize(20).font('Helvetica-Bold');
    put(doc, 'Priority Action Plan', M, 20);
    doc.fillColor('#c7d2fe').fontSize(9).font('Helvetica');
    put(doc, `Ranked by impact  |  ${domain}`, M, 48);

    const apFixes = ((actionPlan && actionPlan.fixes) || []).slice(0, 6);
    let apY = 80;
    const AP_MAX = PAGE_BOTTOM - 70;

    apFixes.forEach((fix, i) => {
      if (apY >= AP_MAX) return;
      const isTop = i === 0;
      const descWrapped = wrapLines(doc, fix.description || '', W - M * 2 - 165, 9);
      const descRows = Math.min(descWrapped.length, 3);
      const cardH = (isTop ? 14 : 0) + 28 + descRows * 12;
      if (apY + cardH > AP_MAX) return;

      doc.rect(M, apY, W - M * 2, cardH).fill(isTop ? '#eef2ff' : BRAND.light);
      doc.rect(M, apY, 3, cardH).fill(isTop ? BRAND.accent : BRAND.border);

      let cY = apY + 6;
      if (isTop) {
        doc.rect(M + 3, apY, 68, 12).fill(BRAND.accent);
        doc.fillColor(BRAND.white).fontSize(7).font('Helvetica-Bold');
        put(doc, 'START HERE', M + 7, apY + 2.5, { characterSpacing: 0.5 });
        cY = apY + 18;
      }

      doc.circle(M + 16, cY + 7, 9).fill(isTop ? BRAND.accent : BRAND.primary);
      doc.fillColor(BRAND.white).fontSize(8.5).font('Helvetica-Bold');
      put(doc, String(i + 1), M + 11, cY + 2, { width: 10, align: 'center' });

      doc.fillColor(BRAND.text).fontSize(10).font('Helvetica-Bold');
      put(doc, (fix.title || '').slice(0, 52), M + 32, cY, { width: W - M * 2 - 175 });

      const tx = W - M - 108;
      if (fix.effort) pill(doc, tx, cY, `Effort: ${fix.effort}`, EFFORT_COLORS[fix.effort] || BRAND.muted);
      if (fix.impact) pill(doc, tx, cY + 15, `Impact: ${fix.impact}`, IMPACT_COLORS[fix.impact] || BRAND.muted);
      if (fix.quickWin) pill(doc, tx - 50, cY, 'Quick Win', BRAND.accent);

      doc.fillColor(BRAND.muted).fontSize(9).font('Helvetica');
      descWrapped.slice(0, descRows).forEach((line, li) => {
        put(doc, line, M + 32, cY + 14 + li * 12);
      });

      apY += cardH + 5;
    });

    // CTA box
    if (apY + 52 < AP_MAX) {
      const ctaY = apY + 8;
      doc.rect(M, ctaY, W - M * 2, 52).fill('#eef2ff');
      doc.rect(M, ctaY, 3, 52).fill(BRAND.accent);
      doc.fillColor(BRAND.text).fontSize(10.5).font('Helvetica-Bold');
      put(doc, 'Need help implementing these fixes?', M + 12, ctaY + 10);
      doc.fillColor(BRAND.muted).fontSize(9).font('Helvetica');
      const cl = wrapLines(doc, "Reply to your report email and we'll point you in the right direction. Most quick wins take under an hour.", W - M * 2 - 24, 9);
      cl.slice(0, 2).forEach((l, li) => put(doc, l, M + 12, ctaY + 27 + li * 12));
      apY = ctaY + 60;
    }

    // Results summary strip — placed right after CTA with spacing, not anchored to bottom
    const sumStripY = apY + 12;
    if (sumStripY + 82 < PAGE_BOTTOM) {
      doc.rect(M, sumStripY, W - M * 2, 82).fill(BRAND.primary);
      doc.rect(M, sumStripY, 4, 82).fill(BRAND.accent);
      doc.fillColor(BRAND.white).fontSize(10).font('Helvetica-Bold');
      put(doc, 'Your Website Score Summary', M + 14, sumStripY + 12);
      doc.fillColor(BRAND.muted).fontSize(8).font('Helvetica');
      put(doc, `Overall Health: ${overallScore}/100 (${oGrade})`, M + 14, sumStripY + 28);
      const scoreStr = sections.map(s => {
        const n = SECTION_NAMES[s.section] || s.section;
        return `${n}: ${s.grade}`;
      }).join('   |   ');
      const scoreLines = wrapLines(doc, scoreStr, W - M * 2 - 28, 8);
      doc.fillColor('#475569').fontSize(8).font('Helvetica');
      scoreLines.slice(0, 2).forEach((l, li) => put(doc, l, M + 14, sumStripY + 44 + li * 13));
      doc.fillColor('#334155').fontSize(8).font('Helvetica');
      put(doc, `Report generated by FinnWorks AI  |  ${new Date().toLocaleDateString('en-NZ', { dateStyle: 'long' })}`, M + 14, sumStripY + 68, { width: W - M * 2 - 28 });
    }

    // Final footer
    doc.rect(0, PAGE_BOTTOM, W, FOOTER_H).fill(BRAND.primary);
    doc.fillColor(BRAND.muted).fontSize(8).font('Helvetica');
    put(doc, `Report delivered to ${customerEmail}  |  finnworks.ai  |  ${new Date().toLocaleDateString('en-NZ', { dateStyle: 'long' })}`,
      M, PAGE_BOTTOM + 12, { width: W - M * 2, align: 'center' });

    doc.end();
  });
}

module.exports = { generatePDF };
