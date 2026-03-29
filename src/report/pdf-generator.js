/**
 * PDF report generator — 9-category audit report.
 *
 * Layout: Cover | 9 Section pages | Action Plan + Upgrade CTA
 * Total: 11 pages
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
  orange:  '#f97316',
};

const GRADE_COLOR = { A: '#10b981', B: '#34d399', C: '#f59e0b', D: '#f97316', F: '#ef4444' };

const SECTION_NAMES = {
  performance:  'Performance & Speed',
  seo:          'SEO Foundations',
  mobile:       'Mobile Experience',
  content:      'Content & Messaging',
  trust:        'Trust & Credibility',
  geo:          'GEO / AEO',
  localSeo:     'Local SEO',
  conversion:   'Conversion & UX',
  accessibility:'Accessibility',
};

function gradeColor(g) { return GRADE_COLOR[g] || C.muted; }
function scoreToGrade(s) {
  if (s >= 90) return 'A'; if (s >= 75) return 'B';
  if (s >= 60) return 'C'; if (s >= 40) return 'D'; return 'F';
}

function put(doc, text, x, y, opts = {}) {
  doc.text(String(text), x, y, Object.assign({ lineBreak: false }, opts));
}

function wrapText(doc, text, maxWidth, fontSize, font) {
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

function pageHeader(doc, W) {
  doc.rect(0, 0, W, 4).fill(C.accent);
}

function pageFooter(doc, domain, pageNum, W, H) {
  const fY = H - 26;
  doc.rect(0, fY, W, 26).fill(C.dark);
  doc.fillColor('#334155').fontSize(7.5).font('Helvetica');
  put(doc, `${domain}  ·  finnworks.ai`, 48, fY + 9);
  put(doc, `Page ${pageNum}`, W - 80, fY + 9);
}

function effortColor(e) {
  return e === 'Low' ? C.green : e === 'Medium' ? C.amber : C.red;
}
function impactColor(i) {
  return i === 'High' ? C.green : i === 'Medium' ? C.accent : C.muted;
}

function scoreInterpretation(score) {
  if (score >= 75) return 'Good foundations — some fine-tuning will push you to excellent';
  if (score >= 60) return 'Solid in places — clear improvements available';
  if (score >= 45) return 'Several issues are likely costing you visitors and leads';
  return 'Significant issues found — these are likely driving visitors away';
}

// Draw a single section pill (for cover page grid)
function sectionPill(doc, x, y, pillW, pillH, key, s) {
  const g  = (s && s.grade) ? s.grade : scoreToGrade((s && s.score) || 50);
  const sc = (s && s.score) != null ? s.score : 50;
  const gc = gradeColor(g);
  const name = SECTION_NAMES[key] || key;

  doc.rect(x, y, pillW, pillH).fill(C.bg).stroke(C.border);
  doc.circle(x + pillW / 2, y + 18, 14).fill(gc);
  doc.fillColor(C.white).fontSize(13).font('Helvetica-Bold');
  put(doc, g, x + pillW / 2 - 7, y + 10, { width: 14, align: 'center' });
  doc.fillColor(gc).fontSize(8).font('Helvetica-Bold');
  put(doc, String(sc), x, y + 36, { width: pillW, align: 'center' });

  // Section name — may need two lines for longer names
  const shortName = name.length > 14 ? name.replace(' & ', '/') : name;
  doc.fillColor(C.muted).fontSize(6).font('Helvetica');
  put(doc, shortName, x + 2, y + 48, { width: pillW - 4, align: 'center' });
}

function generatePDF(auditResult, url, customerEmail) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = 595, H = 842, M = 48;
    const CW = W - M * 2;
    const PB = H - 26 - 16;

    let domain;
    try { domain = new URL(url).hostname.replace('www.', ''); }
    catch (_) { domain = url; }

    const { sections, actionPlan, overallScore, topWins } = auditResult;
    const sMap   = Object.fromEntries((sections || []).map(s => [s.section, s]));
    const oGrade = scoreToGrade(overallScore);
    const upgradeUrl = `https://finnworks.ai/upgrade?url=${encodeURIComponent(url)}`;
    let pageNum = 1;

    // Section order: 5 original + 4 new
    const row1 = ['performance', 'seo', 'mobile', 'content', 'trust'];
    const row2 = ['geo', 'localSeo', 'conversion', 'accessibility'];
    const sectionOrder = [...row1, ...row2];

    // ═══════════════════════════════════════════════════════
    // PAGE 1: COVER
    // ═══════════════════════════════════════════════════════
    doc.rect(0, 0, W, H).fill(C.white);
    doc.rect(0, 0, W, 4).fill(C.accent);

    // Brand bar
    doc.fillColor(C.accent).fontSize(10).font('Helvetica-Bold');
    put(doc, 'FINNWORKS AI', M, 24, { characterSpacing: 2 });
    doc.fillColor(C.muted).fontSize(8).font('Helvetica');
    put(doc, 'Website Audit Report', M, 38);
    const dateStr = new Date().toLocaleDateString('en-NZ', { dateStyle: 'long' });
    put(doc, dateStr, W - M - 120, 24, { width: 120, align: 'right' });
    put(doc, domain, W - M - 120, 38, { width: 120, align: 'right' });
    doc.rect(M, 54, CW, 1).fill(C.border);

    // Large score circle
    const cx = W / 2, cy = 126;
    const radius = 40;
    doc.circle(cx, cy, radius).fill(gradeColor(oGrade));
    doc.fillColor(C.white).fontSize(36).font('Helvetica-Bold');
    put(doc, oGrade, cx - 16, cy - 26, { width: 32, align: 'center' });
    doc.fillColor(C.text).fontSize(14).font('Helvetica-Bold');
    put(doc, `${overallScore} / 100`, cx - 32, cy + radius + 8, { width: 64, align: 'center' });
    doc.fillColor(C.muted).fontSize(7.5).font('Helvetica');
    put(doc, 'OVERALL HEALTH SCORE', cx - 52, cy + radius + 24, { width: 104, align: 'center' });

    // Score interpretation — personalised with domain
    const interp = `${domain} scored ${overallScore}/100 — ${scoreInterpretation(overallScore).toLowerCase()}`;
    doc.fillColor(C.muted).fontSize(9).font('Helvetica');
    put(doc, interp, M, cy + radius + 40, { width: CW, align: 'center' });

    // ── Section pills: 2 rows ──
    let y = cy + radius + 62;
    doc.fillColor(C.muted).fontSize(7.5).font('Helvetica-Bold');
    put(doc, 'SECTION SCORES', M, y, { characterSpacing: 1 });
    y += 14;

    const pillH  = 62;
    const gap    = 4;

    // Row 1 — 5 pills
    const r1W = (CW - gap * 4) / 5;
    row1.forEach((k, i) => {
      sectionPill(doc, M + i * (r1W + gap), y, r1W, pillH, k, sMap[k]);
    });
    y += pillH + gap + 2;

    // Row 2 — 4 pills
    const r2W = (CW - gap * 3) / 4;
    row2.forEach((k, i) => {
      sectionPill(doc, M + i * (r2W + gap), y, r2W, pillH, k, sMap[k]);
    });
    y += pillH + 14;

    // ── Quick Wins ──
    doc.fillColor(C.muted).fontSize(7.5).font('Helvetica-Bold');
    put(doc, 'PRIORITY QUICK WINS', M, y, { characterSpacing: 1 });
    y += 12;

    const wins = (topWins || []).slice(0, 3);
    wins.forEach((w, i) => {
      if (y + 46 > PB) return;
      doc.rect(M, y, CW, 44).fill(C.bg).stroke(C.border);
      doc.circle(M + 16, y + 22, 9).fill(C.accent);
      doc.fillColor(C.white).fontSize(8).font('Helvetica-Bold');
      put(doc, String(i + 1), M + 11, y + 17, { width: 10, align: 'center' });
      doc.fillColor(C.text).fontSize(9.5).font('Helvetica-Bold');
      put(doc, (w.title || '').slice(0, 65), M + 32, y + 8);
      const dLines = wrapText(doc, w.description || '', CW - 40, 8, 'Helvetica');
      doc.fillColor(C.muted).fontSize(8).font('Helvetica');
      dLines.slice(0, 2).forEach((line, li) => put(doc, line, M + 32, y + 20 + li * 11));
      y += 50;
    });

    pageFooter(doc, domain, pageNum++, W, H);

    // ═══════════════════════════════════════════════════════
    // PAGES 2-10: SECTION DETAIL PAGES (9 sections)
    // ═══════════════════════════════════════════════════════
    sectionOrder.forEach((k) => {
      const s = sMap[k];
      if (!s) return;

      doc.addPage({ margin: 0 });
      doc.text('', 0, 0); // reset cursor — prevents PDFKit auto-inserting a blank page
      doc.rect(0, 0, W, H).fill(C.white);
      doc.rect(0, 0, W, 4).fill(C.accent);

      const g    = s.grade || scoreToGrade(s.score || 50);
      const gc   = gradeColor(g);
      const name = SECTION_NAMES[k] || k;
      let y = 22;

      // Header bar
      doc.rect(M, y, CW, 50).fill(C.dark);
      doc.fillColor(C.white).fontSize(17).font('Helvetica-Bold');
      put(doc, name, M + 14, y + 14);
      doc.circle(W - M - 24, y + 25, 19).fill(gc);
      doc.fillColor(C.white).fontSize(17).font('Helvetica-Bold');
      put(doc, g, W - M - 31, y + 14, { width: 14, align: 'center' });
      doc.fillColor('#94a3b8').fontSize(8).font('Helvetica');
      put(doc, `Score: ${s.score || '—'}/100`, M + 14, y + 36);
      y += 64;

      // Summary
      const sumLines = wrapText(doc, s.summary || '', CW, 9.5, 'Helvetica');
      doc.fillColor(C.text).fontSize(9.5).font('Helvetica');
      sumLines.slice(0, 5).forEach((line, li) => put(doc, line, M, y + li * 14));
      y += Math.min(sumLines.length, 5) * 14 + 18;

      // Metrics grid
      const highlights = (s.highlights || []).slice(0, 4);
      if (highlights.length > 0) {
        doc.fillColor(C.muted).fontSize(7.5).font('Helvetica-Bold');
        put(doc, 'KEY METRICS', M, y, { characterSpacing: 1 });
        y += 13;

        const metW = (CW - (highlights.length - 1) * 6) / highlights.length;
        highlights.forEach((hl, hi) => {
          const hx     = M + hi * (metW + 6);
          const bg     = hl.positive ? '#ecfdf5' : '#fffbeb';
          const border = hl.positive ? '#6ee7b7' : '#fcd34d';

          doc.rect(hx, y, metW, 66).fill(bg).stroke(border);
          doc.fillColor(C.muted).fontSize(6.5).font('Helvetica-Bold');
          put(doc, String(hl.label ?? '').slice(0, 40), hx + 7, y + 8, { width: metW - 14 });
          doc.fillColor(hl.positive ? '#065f46' : '#92400e').fontSize(13).font('Helvetica-Bold');
          put(doc, String(hl.value ?? '').slice(0, 22), hx + 7, y + 22, { width: metW - 14 });
          doc.rect(hx + 7, y + 49, 4, 6).fill(hl.positive ? C.green : C.amber);
          doc.fillColor(hl.positive ? C.green : C.amber).fontSize(7).font('Helvetica');
          put(doc, hl.positive ? 'On track' : 'Needs work', hx + 14, y + 48);
        });
        y += 80;
      }

      // Fixes
      doc.fillColor(C.muted).fontSize(7.5).font('Helvetica-Bold');
      put(doc, `${name.toUpperCase()} — KEY FIXES`, M, y, { characterSpacing: 0.5 });
      y += 13;

      (s.fixes || []).slice(0, 3).forEach((fix) => {
        if (y + 70 > PB) return;

        doc.rect(M, y, CW, 3).fill(gc);
        doc.rect(M, y + 3, CW, 66).fill(C.bg).stroke(C.border);

        doc.fillColor(C.text).fontSize(10.5).font('Helvetica-Bold');
        put(doc, (fix.title || '').slice(0, 64), M + 10, y + 12);

        const dLines = wrapText(doc, fix.description || '', CW - 20, 8.5, 'Helvetica');
        doc.fillColor(C.muted).fontSize(8.5).font('Helvetica');
        dLines.slice(0, 3).forEach((line, li) => put(doc, line, M + 10, y + 25 + li * 12));

        // Impact pill
        if (fix.impact) {
          const ic = impactColor(fix.impact);
          const pw = doc.fontSize(7).font('Helvetica-Bold').widthOfString(`IMPACT: ${fix.impact}`) + 14;
          const px = W - M - pw - 4;
          doc.roundedRect(px, y + 12, pw, 13, 3).fill(ic);
          doc.fillColor(C.white).fontSize(7).font('Helvetica-Bold');
          put(doc, `IMPACT: ${fix.impact}`, px + 7, y + 15.5);
        }

        y += 76;
      });

      // Bottom upsell strip — only if content doesn't fill the page
      const stripY = H - 96;
      if (y < stripY - 10) {
        doc.rect(M, stripY, CW, 40).fill('#f1f5f9');
        doc.rect(M, stripY, CW, 1).fill(C.border);
        doc.fillColor(C.muted).fontSize(7.5).font('Helvetica');
        put(doc, 'Want step-by-step fix instructions for all 9 sections?', M + 12, stripY + 9, { width: CW - 24 });
        doc.fillColor(C.accent).fontSize(8.5).font('Helvetica-Bold');
        put(doc, 'Get the Fix Guide at finnworks.ai  —  $49 one-time', M + 12, stripY + 22, { width: CW - 24 });
      }

      pageFooter(doc, domain, pageNum++, W, H);
    });

    // ═══════════════════════════════════════════════════════
    // FINAL PAGE: ACTION PLAN
    // ═══════════════════════════════════════════════════════
    doc.addPage({ margin: 0 });
    doc.text('', 0, 0); // reset cursor
    doc.rect(0, 0, W, H).fill(C.white);
    doc.rect(0, 0, W, 4).fill(C.accent);

    let apY = 22;
    doc.rect(M, apY, CW, 48).fill(C.dark);
    doc.fillColor(C.white).fontSize(18).font('Helvetica-Bold');
    put(doc, 'Priority Action Plan', M + 14, apY + 12);
    doc.fillColor('#94a3b8').fontSize(8.5).font('Helvetica');
    put(doc, 'Ranked by impact. Start with Fix #1.', M + 14, apY + 32);
    apY += 62;

    const apFixes = ((actionPlan && actionPlan.fixes) || []).slice(0, 6);
    apFixes.forEach((fix, i) => {
      const isFirst = i === 0;
      if (apY + 62 > PB) return;

      if (isFirst) {
        doc.rect(M, apY, 160, 18).fill(C.accent);
        doc.fillColor(C.white).fontSize(7).font('Helvetica-Bold');
        put(doc, 'QUICK WIN — START HERE', M + 10, apY + 5.5, { characterSpacing: 0.5 });
        apY += 20;
      }

      const cardH = 56;
      doc.rect(M, apY, 4, cardH).fill(isFirst ? C.accent : C.border);
      doc.rect(M + 4, apY, CW - 4, cardH).fill(isFirst ? '#f5f3ff' : C.bg).stroke(C.border);

      doc.circle(M + 20, apY + 28, 12).fill(isFirst ? C.accent : C.dark);
      doc.fillColor(C.white).fontSize(11).font('Helvetica-Bold');
      put(doc, String(i + 1), M + 14, apY + 21, { width: 12, align: 'center' });

      doc.fillColor(C.text).fontSize(10.5).font('Helvetica-Bold');
      put(doc, (fix.title || '').slice(0, 58), M + 40, apY + 9);

      const dLines = wrapText(doc, fix.description || '', CW - 56, 8, 'Helvetica');
      doc.fillColor(C.muted).fontSize(8).font('Helvetica');
      dLines.slice(0, 2).forEach((line, li) => put(doc, line, M + 40, apY + 23 + li * 11));

      if (fix.effort) {
        const ec = effortColor(fix.effort);
        const pw = doc.fontSize(7).font('Helvetica-Bold').widthOfString(`EFFORT: ${fix.effort}`) + 14;
        const px = W - M - pw - 2;
        doc.roundedRect(px, apY + 8, pw, 13, 3).fill(ec);
        doc.fillColor(C.white).fontSize(7).font('Helvetica-Bold');
        put(doc, `EFFORT: ${fix.effort}`, px + 7, apY + 11);
      }

      apY += cardH + 8;
    });

    // Upgrade CTA
    apY += 8;
    if (apY + 62 < PB) {
      doc.rect(M, apY, CW, 58).fill('#1e1b4b').stroke(C.accent);
      doc.fillColor(C.aLight).fontSize(8).font('Helvetica-Bold');
      put(doc, 'WANT THE STEP-BY-STEP FIX INSTRUCTIONS?', M + 14, apY + 10, { characterSpacing: 0.5 });
      doc.fillColor(C.white).fontSize(11).font('Helvetica-Bold');
      put(doc, 'Get the Fix Guide — $49 one-time', M + 14, apY + 24);
      doc.fillColor('#94a3b8').fontSize(8.5).font('Helvetica');
      put(doc, 'Numbered steps + code snippets for every fix above, written specifically for your site.', M + 14, apY + 38, { width: CW - 28 });
      doc.fillColor(C.aLight).fontSize(8.5).font('Helvetica-Bold');
      put(doc, 'finnworks.ai/upgrade', M + 14, apY + 50);
    }

    pageFooter(doc, domain, pageNum, W, H);
    doc.end();
  });
}

module.exports = { generatePDF };
