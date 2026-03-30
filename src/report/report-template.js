/**
 * Report HTML template — generates the full audit report as an HTML string.
 *
 * generateReportHTML(reportData, { webView })
 *   webView: true  → browser view (sticky nav, download button, share button)
 *   webView: false → clean print/PDF view (no interactive chrome)
 *
 * Used by:
 *   server.js         → GET /report/:uuid  (webView: true)
 *   pdf-generator.js  → Puppeteer render   (webView: false)
 */

'use strict';

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
  teal:    '#34d399',
};

const GRADE_COLOR = { A: '#10b981', B: '#34d399', C: '#f59e0b', D: '#f97316', F: '#ef4444' };
const GRADE_BG    = { A: '#ecfdf5', B: '#f0fdf4', C: '#fffbeb', D: '#fff7ed', F: '#fef2f2' };

const SECTION_NAMES = {
  performance:   'Performance & Speed',
  seo:           'SEO Foundations',
  mobile:        'Mobile Experience',
  content:       'Content & Messaging',
  trust:         'Trust & Credibility',
  geo:           'GEO / AEO',
  localSeo:      'Local SEO',
  conversion:    'Conversion & UX',
  accessibility: 'Accessibility',
};

const SECTION_ICONS = {
  performance:   '⚡',
  seo:           '🔍',
  mobile:        '📱',
  content:       '✍️',
  trust:         '🛡️',
  geo:           '🤖',
  localSeo:      '📍',
  conversion:    '🎯',
  accessibility: '♿',
};

const SECTION_ORDER = ['performance', 'seo', 'mobile', 'content', 'trust', 'geo', 'localSeo', 'conversion', 'accessibility'];

function gradeColor(g) { return GRADE_COLOR[g] || C.muted; }
function gradeBg(g)    { return GRADE_BG[g]    || C.bg; }
function scoreToGrade(s) {
  if (s >= 90) return 'A'; if (s >= 75) return 'B';
  if (s >= 60) return 'C'; if (s >= 40) return 'D'; return 'F';
}
function effortColor(e) { return e === 'Low' ? C.green : e === 'Medium' ? C.amber : C.red; }
function impactColor(i) { return i === 'High' ? C.green : i === 'Medium' ? C.accent : C.muted; }
function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function scoreInterpretation(score) {
  if (score >= 80) return 'Strong foundations — a few targeted improvements will make this site exceptional.';
  if (score >= 65) return 'Solid in several areas, with clear opportunities that could meaningfully grow enquiries and traffic.';
  if (score >= 50) return 'Several issues are likely costing you visitors, rankings, and leads each week.';
  return 'Significant issues found across multiple categories — these are actively driving potential customers away.';
}

// ─── CSS ─────────────────────────────────────────────────────────────────────

function getCSS(webView) {
  return `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: ${C.bg};
  color: ${C.text};
  line-height: 1.6;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* ── Web nav bar ── */
.web-nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  background: ${C.dark}; border-bottom: 1px solid #1e293b;
  height: 52px; display: flex; align-items: center;
  padding: 0 24px; gap: 16px;
}
.web-nav .brand { color: ${C.accent}; font-weight: 700; font-size: 14px; letter-spacing: 0.08em; flex: 1; }
.web-nav .expiry { color: #64748b; font-size: 12px; }
.nav-btn {
  padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600;
  cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 6px;
  border: none;
}
.nav-btn-primary { background: ${C.accent}; color: white; }
.nav-btn-secondary { background: #1e293b; color: #94a3b8; border: 1px solid #334155; }
.nav-spacer { height: 52px; }

/* ── Report wrapper ── */
.report-wrapper { max-width: 860px; margin: 0 auto; }
${webView ? '.report-wrapper { padding: 24px 16px 64px; }' : `
/* PDF mode: single continuous scroll — no fixed page heights, no clipping. */
body { background: white; }
.report-wrapper { width: 794px; margin: 0; padding: 0; max-width: none; }
`}

/* ── Page ── */
.page {
  background: white;
  ${webView
    ? 'margin-bottom: 32px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.06); overflow: visible;'
    : 'width: 794px; margin: 0; border-radius: 0; box-shadow: none; border-bottom: 3px solid #e2e8f0;'
  }
}
.page:last-child { margin-bottom: 0; ${!webView ? 'border-bottom: none;' : ''} }

/* ── Accent bar ── */
.accent-bar { height: 5px; background: ${C.accent}; }
.accent-bar-grade { height: 5px; }

/* ── Page inner ── */
.page-inner { padding: 36px 48px 32px; }

/* ── Page footer (hidden in continuous PDF — page numbers are meaningless) ── */
${!webView ? '.page-footer { display: none; }' : ''}

/* ── Cover ── */
.cover-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 36px; }
.cover-brand { color: ${C.accent}; font-size: 12px; font-weight: 700; letter-spacing: 0.1em; }
.cover-brand-sub { color: ${C.muted}; font-size: 11px; margin-top: 2px; }
.cover-meta { text-align: right; color: ${C.muted}; font-size: 12px; line-height: 1.5; }
.cover-meta .domain { color: ${C.text}; font-weight: 600; font-size: 13px; }

.cover-score-block {
  text-align: center; padding: 40px 0 36px;
  border-bottom: 1px solid ${C.border};
  margin-bottom: 36px;
}
.cover-score-domain { font-size: 22px; font-weight: 700; color: ${C.text}; margin-bottom: 28px; }
.score-ring-wrap { display: flex; justify-content: center; margin-bottom: 20px; }
.score-ring {
  width: 120px; height: 120px; border-radius: 50%;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  color: white; box-shadow: 0 4px 24px rgba(0,0,0,0.18);
}
.score-ring .grade-letter { font-size: 52px; font-weight: 800; line-height: 1; }
.score-ring .grade-num   { font-size: 15px; font-weight: 600; opacity: 0.9; margin-top: 2px; }
.cover-score-label  { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; color: ${C.muted}; text-transform: uppercase; margin-bottom: 10px; }
.cover-score-interp { font-size: 13px; color: ${C.muted}; max-width: 480px; margin: 0 auto; }

/* ── Section pill grid ── */
.pill-section-label {
  font-size: 11px; font-weight: 700; letter-spacing: 0.08em; color: ${C.muted};
  text-transform: uppercase; margin-bottom: 14px;
}
.pill-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  margin-bottom: 36px;
}
.pill-grid-row2 { grid-template-columns: repeat(4, 1fr); }
.pill {
  border: 1px solid ${C.border};
  border-radius: 10px;
  padding: 14px 8px 12px;
  text-align: center;
  background: ${C.bg};
}
.pill .pill-grade {
  width: 44px; height: 44px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; font-weight: 800; color: white;
  margin: 0 auto 6px;
}
.pill .pill-score { font-size: 12px; font-weight: 700; margin-bottom: 4px; }
.pill .pill-name  { font-size: 9px; color: ${C.muted}; line-height: 1.3; }

/* ── Quick wins ── */
.section-label {
  font-size: 11px; font-weight: 700; letter-spacing: 0.08em; color: ${C.muted};
  text-transform: uppercase; margin-bottom: 12px;
}
.win-card {
  display: flex; align-items: flex-start; gap: 14px;
  padding: 14px 16px; border: 1px solid ${C.border};
  border-radius: 8px; background: ${C.bg}; margin-bottom: 8px;
}
.win-num {
  width: 28px; height: 28px; border-radius: 50%;
  background: ${C.accent}; color: white;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 700; flex-shrink: 0;
}
.win-body .win-title { font-size: 13px; font-weight: 600; color: ${C.text}; margin-bottom: 3px; }
.win-body .win-desc  { font-size: 12px; color: ${C.muted}; line-height: 1.5; }

/* ── Section page ── */
.section-header {
  display: flex; align-items: center; justify-content: space-between;
  background: ${C.dark}; padding: 20px 28px; margin: 0 0 0 0;
}
.section-header-left .section-icon { font-size: 18px; margin-bottom: 2px; }
.section-header-left .section-name { font-size: 21px; font-weight: 700; color: white; }
.section-header-left .section-score { font-size: 12px; color: #94a3b8; margin-top: 2px; }
.section-grade-circle {
  width: 64px; height: 64px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 30px; font-weight: 800; color: white; flex-shrink: 0;
  box-shadow: 0 2px 12px rgba(0,0,0,0.25);
}

/* ── Summary ── */
.summary-text {
  font-size: 13.5px; line-height: 1.75; color: #334155;
  margin: 24px 0;
}

/* ── Metrics grid ── */
.metrics-grid {
  display: grid; grid-template-columns: repeat(2, 1fr);
  gap: 10px; margin-bottom: 28px;
}
.metric-card {
  border-radius: 8px; padding: 16px 18px; border: 1px solid;
}
.metric-card.positive { background: #ecfdf5; border-color: #6ee7b7; }
.metric-card.negative { background: #fffbeb; border-color: #fcd34d; }
.metric-card .metric-label { font-size: 10px; font-weight: 700; letter-spacing: 0.06em; color: ${C.muted}; text-transform: uppercase; margin-bottom: 6px; }
.metric-card .metric-value { font-size: 22px; font-weight: 800; line-height: 1.1; margin-bottom: 4px; }
.metric-card.positive .metric-value { color: #065f46; }
.metric-card.negative .metric-value { color: #92400e; }
.metric-card .metric-benchmark { font-size: 10.5px; color: ${C.muted}; margin-bottom: 8px; }
.metric-card .metric-status { display: flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 600; }
.metric-card.positive .metric-status { color: ${C.green}; }
.metric-card.negative .metric-status { color: ${C.amber}; }
.status-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }

/* ── Fix cards ── */
.fixes-label { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; color: ${C.muted}; text-transform: uppercase; margin-bottom: 12px; }
.fix-card {
  display: flex; gap: 0;
  border: 1px solid ${C.border}; border-radius: 8px;
  overflow: hidden; margin-bottom: 10px; background: ${C.bg};
}
.fix-card-accent { width: 5px; flex-shrink: 0; }
.fix-card-body { flex: 1; padding: 14px 16px; }
.fix-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.fix-num-title { display: flex; align-items: center; gap: 10px; }
.fix-num {
  width: 24px; height: 24px; border-radius: 50%;
  background: ${C.dark}; color: white;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; flex-shrink: 0;
}
.fix-title { font-size: 13px; font-weight: 700; color: ${C.text}; }
.fix-badges { display: flex; gap: 5px; flex-shrink: 0; }
.badge {
  padding: 2px 8px; border-radius: 4px; font-size: 10px;
  font-weight: 700; color: white; white-space: nowrap;
}
.fix-desc { font-size: 12px; color: #475569; line-height: 1.6; margin-bottom: 6px; }
.fix-impact-est { font-size: 11.5px; color: ${C.green}; font-style: italic; }

/* ── Action plan page ── */
.action-header {
  background: ${C.dark}; padding: 28px 48px 24px;
}
.action-header h2 { font-size: 24px; font-weight: 800; color: white; margin-bottom: 4px; }
.action-header .action-sub { font-size: 13px; color: #94a3b8; }

.action-cards { padding: 28px 48px 0; }
.action-card {
  display: flex; gap: 0; border-radius: 8px;
  overflow: hidden; margin-bottom: 10px; border: 1px solid ${C.border};
  background: white;
}
.action-card.first { border-color: ${C.accent}; }
.action-card-bar { width: 5px; flex-shrink: 0; }
.action-card.first .action-card-bar { background: ${C.accent}; }
.action-card-body { flex: 1; padding: 14px 16px; }
.action-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 7px; }
.action-num-title { display: flex; align-items: center; gap: 10px; }
.action-num {
  width: 30px; height: 30px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 800; color: white; flex-shrink: 0;
}
.action-card.first .action-num { background: ${C.accent}; }
.action-card:not(.first) .action-num { background: ${C.card}; }
.action-title { font-size: 14px; font-weight: 700; color: ${C.text}; }
.action-card.first .action-title { color: ${C.accent}; }
.start-here-badge {
  background: ${C.accent}; color: white; font-size: 10px;
  font-weight: 700; padding: 3px 8px; border-radius: 4px;
  letter-spacing: 0.04em; white-space: nowrap; flex-shrink: 0;
}
.action-desc { font-size: 12.5px; color: #475569; line-height: 1.6; margin-bottom: 5px; }
.action-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.action-time { font-size: 11px; color: ${C.muted}; }
.action-section { font-size: 11px; color: ${C.accent}; font-weight: 600; }

/* ── Upsell strip ── */
.upsell-strip {
  margin: 20px 48px 36px;
  background: #1e1b4b; border: 1px solid ${C.accent};
  border-radius: 10px; padding: 24px 28px;
  display: flex; align-items: center; justify-content: space-between; gap: 24px;
}
.upsell-copy .upsell-eyebrow { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; color: ${C.aLight}; text-transform: uppercase; margin-bottom: 6px; }
.upsell-copy .upsell-heading { font-size: 18px; font-weight: 800; color: white; margin-bottom: 6px; }
.upsell-copy .upsell-body { font-size: 12.5px; color: #94a3b8; line-height: 1.5; }
.upsell-cta { flex-shrink: 0; text-align: center; }
.upsell-price { font-size: 28px; font-weight: 800; color: white; margin-bottom: 4px; }
.upsell-price-sub { font-size: 11px; color: #94a3b8; margin-bottom: 10px; }
.upsell-btn {
  display: block; background: ${C.accent}; color: white;
  padding: 10px 20px; border-radius: 7px; font-size: 13px;
  font-weight: 700; text-decoration: none; text-align: center;
}

/* ── Page footer ── */
.page-footer {
  background: ${C.dark}; padding: 10px 48px;
  display: flex; justify-content: space-between; align-items: center;
}
.page-footer span { font-size: 10.5px; color: #475569; }
.page-footer .brand-mark { color: #334155; font-weight: 600; }

/* ── Print / PDF ── */
@media print {
  body { background: white; }
  .web-nav, .nav-spacer, .upsell-web-only { display: none !important; }
  .page { margin: 0; border-radius: 0; box-shadow: none; page-break-after: ${webView ? 'always' : 'auto'}; }
  .page:last-child { page-break-after: avoid; }
  .page-inner { padding: 32px 48px 28px; }
  .report-wrapper { padding: 0; max-width: 100%; }
  .metrics-grid { grid-template-columns: repeat(2, 1fr); }
}
`;
}

// ─── Cover page ───────────────────────────────────────────────────────────────

function renderCover(report, domain, webView) {
  const { overallScore, topWins, sections } = report;
  const grade = scoreToGrade(overallScore);
  const gc    = gradeColor(grade);
  const sMap  = Object.fromEntries((sections || []).map(s => [s.section, s]));

  const dateStr = new Date(report.generatedAt || Date.now())
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  // Section pills
  const row1Keys = ['performance', 'seo', 'mobile', 'content', 'trust'];
  const row2Keys = ['geo', 'localSeo', 'conversion', 'accessibility'];

  function pillHtml(key) {
    const s  = sMap[key];
    const g  = (s && s.grade) ? s.grade : scoreToGrade((s && s.score) || 50);
    const sc = (s && s.score) != null ? s.score : 50;
    const name = SECTION_NAMES[key] || key;
    return `
      <div class="pill">
        <div class="pill-grade" style="background:${gradeColor(g)}">${esc(g)}</div>
        <div class="pill-score" style="color:${gradeColor(g)}">${sc}</div>
        <div class="pill-name">${esc(name)}</div>
      </div>`;
  }

  const wins = (topWins || []).slice(0, 3);

  return `
  <div class="page">
    <div class="accent-bar"></div>
    <div class="page-inner">
      <div class="cover-header">
        <div>
          <div class="cover-brand">FINNWORKS AI</div>
          <div class="cover-brand-sub">Website Audit Report</div>
        </div>
        <div class="cover-meta">
          <div class="domain">${esc(domain)}</div>
          <div>${esc(dateStr)}</div>
        </div>
      </div>

      <div class="cover-score-block">
        <div class="cover-score-domain">${esc(domain)}</div>
        <div class="score-ring-wrap">
          <div class="score-ring" style="background:${gc}">
            <span class="grade-letter">${esc(grade)}</span>
            <span class="grade-num">${overallScore}/100</span>
          </div>
        </div>
        <div class="cover-score-label">Overall Health Score</div>
        <div class="cover-score-interp">${esc(scoreInterpretation(overallScore))}</div>
      </div>

      <div class="pill-section-label">Section Scores</div>
      <div class="pill-grid">${row1Keys.map(pillHtml).join('')}</div>
      <div class="pill-grid pill-grid-row2" style="margin-top:-4px;">${row2Keys.map(pillHtml).join('')}</div>

      ${wins.length > 0 ? `
      <div class="section-label" style="margin-top:28px;">Priority Quick Wins</div>
      ${wins.map((w, i) => `
        <div class="win-card">
          <div class="win-num">${i + 1}</div>
          <div class="win-body">
            <div class="win-title">${esc(w.title || '')}</div>
            <div class="win-desc">${esc(w.description || '')}</div>
          </div>
        </div>`).join('')}
      ` : ''}
    </div>
    <div class="page-footer">
      <span>${esc(domain)} · Website Audit Report</span>
      <span class="brand-mark">finnworks.ai</span>
      <span>Page 1</span>
    </div>
  </div>`;
}

// ─── Section page ─────────────────────────────────────────────────────────────

function renderSection(s, pageNum, domain, upgradeUrl, webView) {
  const key  = s.section;
  const name = SECTION_NAMES[key] || key;
  const icon = SECTION_ICONS[key] || '📊';
  const grade = s.grade || scoreToGrade(s.score || 50);
  const gc    = gradeColor(grade);
  const accentStyle = `background:${gc}`;

  // Metrics (up to 4, displayed in 2×2 grid)
  const highlights = (s.highlights || []).slice(0, 4);
  const metricsHtml = highlights.length > 0 ? `
    <div class="section-label">Key Metrics</div>
    <div class="metrics-grid">
      ${highlights.map(h => `
        <div class="metric-card ${h.positive ? 'positive' : 'negative'}">
          <div class="metric-label">${esc(h.label || '')}</div>
          <div class="metric-value">${esc(h.value || '—')}</div>
          ${h.benchmark ? `<div class="metric-benchmark">${esc(h.benchmark)}</div>` : ''}
          <div class="metric-status">
            <span class="status-dot" style="background:${h.positive ? C.green : C.amber}"></span>
            ${h.positive ? 'On track' : 'Needs attention'}
          </div>
        </div>`).join('')}
    </div>` : '';

  const fixes = (s.fixes || []).slice(0, 5);
  const fixesHtml = fixes.length > 0 ? `
    <div class="fixes-label">${esc(name)} — Key Fixes</div>
    ${fixes.map((fix, i) => `
      <div class="fix-card">
        <div class="fix-card-accent" style="${accentStyle}"></div>
        <div class="fix-card-body">
          <div class="fix-header">
            <div class="fix-num-title">
              <div class="fix-num">${i + 1}</div>
              <div class="fix-title">${esc(fix.title || '')}</div>
            </div>
            <div class="fix-badges">
              ${fix.effort ? `<span class="badge" style="background:${effortColor(fix.effort)}">${esc(fix.effort)} effort</span>` : ''}
              ${fix.impact ? `<span class="badge" style="background:${impactColor(fix.impact)}">${esc(fix.impact)} impact</span>` : ''}
            </div>
          </div>
          <div class="fix-desc">${esc(fix.description || '')}</div>
          ${fix.impact_estimate ? `<div class="fix-impact-est">→ ${esc(fix.impact_estimate)}</div>` : ''}
        </div>
      </div>`).join('')}
  ` : '';

  return `
  <div class="page">
    <div class="accent-bar-grade" style="${accentStyle}"></div>
    <div class="section-header">
      <div class="section-header-left">
        <div class="section-icon">${icon}</div>
        <div class="section-name">${esc(name)}</div>
        <div class="section-score">Score: ${s.score || '—'} / 100</div>
      </div>
      <div class="section-grade-circle" style="background:${gc}">${esc(grade)}</div>
    </div>
    <div class="page-inner">
      <div class="summary-text">${esc(s.summary || '')}</div>
      ${metricsHtml}
      ${fixesHtml}
    </div>
    <div class="page-footer">
      <span>${esc(domain)}</span>
      <span class="brand-mark">finnworks.ai</span>
      <span>Page ${pageNum}</span>
    </div>
  </div>`;
}

// ─── Action plan page ─────────────────────────────────────────────────────────

function renderActionPlan(report, pageNum, domain, upgradeUrl, webView) {
  const { actionPlan, websiteUrl } = report;
  const fixes = ((actionPlan && actionPlan.fixes) || []).slice(0, 8);

  const sectionLabel = (key) => SECTION_NAMES[key] || '';

  return `
  <div class="page">
    <div class="accent-bar"></div>
    <div class="action-header">
      <h2>Priority Action Plan</h2>
      <div class="action-sub">Ranked by impact. Start with Fix #1 — it will deliver the biggest return.</div>
    </div>
    <div class="action-cards">
      ${fixes.map((fix, i) => {
        const isFirst = i === 0;
        const barColor = isFirst ? C.accent : C.border;
        return `
        <div class="action-card${isFirst ? ' first' : ''}">
          <div class="action-card-bar" style="background:${barColor}"></div>
          <div class="action-card-body">
            <div class="action-card-head">
              <div class="action-num-title">
                <div class="action-num">${i + 1}</div>
                <div class="action-title">${esc(fix.title || '')}</div>
              </div>
              ${isFirst ? '<span class="start-here-badge">START HERE</span>' : ''}
            </div>
            <div class="action-desc">${esc(fix.description || '')}</div>
            <div class="action-meta">
              ${fix.effort ? `<span class="badge" style="background:${effortColor(fix.effort)}">${esc(fix.effort)} effort</span>` : ''}
              ${fix.impact ? `<span class="badge" style="background:${impactColor(fix.impact)}">${esc(fix.impact)} impact</span>` : ''}
              ${fix.time_estimate ? `<span class="action-time">⏱ ${esc(fix.time_estimate)}</span>` : ''}
              ${fix.section ? `<span class="action-section">${esc(sectionLabel(fix.section))}</span>` : ''}
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>
    <div class="upsell-strip">
      <div class="upsell-copy">
        <div class="upsell-eyebrow">Want the step-by-step instructions?</div>
        <div class="upsell-heading">Get the Fix Guide</div>
        <div class="upsell-body">
          Numbered steps, code snippets, and tool recommendations — written specifically for ${esc(domain)}.
          Hand it to your developer or follow it yourself.
        </div>
      </div>
      <div class="upsell-cta">
        <div class="upsell-price">$49</div>
        <div class="upsell-price-sub">one-time</div>
        <a class="upsell-btn" href="${esc(upgradeUrl)}">Get Fix Guide →</a>
      </div>
    </div>
    <div class="page-footer">
      <span>${esc(domain)}</span>
      <span class="brand-mark">finnworks.ai</span>
      <span>Page ${pageNum}</span>
    </div>
  </div>`;
}

// ─── Web-only nav bar ─────────────────────────────────────────────────────────

function renderWebNav(report, domain, pdfUrl) {
  const expiresAt = new Date((new Date(report.generatedAt || Date.now())).getTime() + 14 * 24 * 60 * 60 * 1000);
  const expiryStr = expiresAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return `
  <nav class="web-nav">
    <div class="brand">FINNWORKS AI</div>
    <span class="expiry">Expires ${esc(expiryStr)}</span>
    <button class="nav-btn nav-btn-secondary" onclick="navigator.clipboard.writeText(window.location.href).then(()=>this.textContent='Copied!')">
      📋 Copy link
    </button>
    <a class="nav-btn nav-btn-primary" href="${esc(pdfUrl)}">⬇ Download PDF</a>
  </nav>
  <div class="nav-spacer"></div>`;
}

// ─── Main export ──────────────────────────────────────────────────────────────

function generateReportHTML(reportData, { webView = true, upgradeUrl: upgradeUrlOverride = null } = {}) {
  const { websiteUrl, uuid } = reportData;

  let domain;
  try { domain = new URL(websiteUrl).hostname.replace('www.', ''); }
  catch (_) { domain = websiteUrl || 'your site'; }

  const BASE_URL   = process.env.APP_BASE_URL || 'https://finnworks.ai';
  const upgradeUrl = upgradeUrlOverride || `${BASE_URL}/upgrade?url=${encodeURIComponent(websiteUrl)}&email=${encodeURIComponent(reportData.customerEmail || '')}`;
  const pdfUrl     = uuid ? `${BASE_URL}/report/${uuid}/pdf` : '#';

  const sectionOrder = (reportData.sections || []).sort((a, b) => {
    return SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section);
  });

  let pageNum = 2; // cover = page 1
  const sectionPages = sectionOrder.map(s => {
    const html = renderSection(s, pageNum, domain, upgradeUrl, webView);
    pageNum++;
    return html;
  });

  const pages = [
    renderCover(reportData, domain, webView),
    ...sectionPages,
    renderActionPlan(reportData, pageNum, domain, upgradeUrl, webView),
  ].join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FinnWorks Audit — ${esc(domain)}</title>
  <style>${getCSS(webView)}</style>
</head>
<body>
  ${webView ? renderWebNav(reportData, domain, pdfUrl) : ''}
  <div class="report-wrapper">
    ${pages}
  </div>
</body>
</html>`;
}

module.exports = { generateReportHTML };
