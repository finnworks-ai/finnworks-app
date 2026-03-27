/**
 * AI analysis — generates structured report sections using OpenAI GPT-4o.
 * Returns structured JSON per section for rich PDF rendering.
 */

'use strict';

const OpenAI = require('openai');

let client;
function getClient() {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

const SYSTEM_PROMPT = `You are a plain-English website strategist helping small business owners improve their websites.
Write for non-technical readers. Be specific, direct, and action-oriented. No jargon.
Use only the data provided — do not invent statistics.
Always respond with valid JSON only. No markdown, no explanation outside the JSON.`;

async function analyzeSection(sectionName, sectionPrompt, data) {
  const openai = getClient();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `${sectionPrompt}\n\nDATA:\n${JSON.stringify(data, null, 2)}\n\nRespond with JSON in this exact format:
{
  "grade": "A|B|C|D|F",
  "score": <number 0-100>,
  "summary": "<3-4 sentence plain English summary. Be specific about what you found and why it matters to the business owner.>",
  "highlights": [
    { "label": "<short label>", "value": "<value or status>", "positive": true|false }
  ],
  "fixes": [
    {
      "title": "<3-5 word fix title>",
      "description": "<2 specific sentences: what to do and why it matters>",
      "effort": "Low|Medium|High",
      "impact": "Low|Medium|High",
      "quickWin": true|false
    }
  ]
}
Notes:
- highlights: 3-4 key data points from this section (e.g. "Mobile Score: 52/100", "Meta Description: Missing", "HTTPS: Yes"). positive=true for good things, false for problems.
- fixes: exactly 3 fixes
- summary: 3-4 sentences, not 1`,
      },
    ],
    max_tokens: 1200,
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  let parsed;
  try {
    parsed = JSON.parse(response.choices[0].message.content.trim());
  } catch (e) {
    parsed = { grade: 'C', score: 50, summary: 'Analysis unavailable.', highlights: [], fixes: [] };
  }

  return { section: sectionName, ...parsed };
}

async function generateFullReport(url, pagespeed, scraped) {
  const sections = await Promise.all([
    analyzeSection(
      'performance',
      `Analyse the Performance & Speed of this website: ${url}.
Grade A=90+, B=75+, C=60+, D=40+, F=below 40. Score based on mobile performance primarily.
Give 3 specific fixes. Focus on business impact — slow sites lose customers.
For highlights include: mobile score, desktop score, LCP time, and whether there are image optimization opportunities.`,
      {
        mobilePerformance: pagespeed.mobile.scores.performance,
        desktopPerformance: pagespeed.desktop.scores.performance,
        mobileLCP: pagespeed.mobile.metrics.lcp,
        mobileFCP: pagespeed.mobile.metrics.fcp,
        mobileTBT: pagespeed.mobile.metrics.tbt,
        mobileCLS: pagespeed.mobile.metrics.cls,
        mobileSpeedIndex: pagespeed.mobile.metrics.speedIndex,
        opportunities: pagespeed.mobile.opportunities,
      }
    ),

    analyzeSection(
      'seo',
      `Analyse the SEO Foundations of this website: ${url}.
Grade it A/B/C/D/F. Give 3 concrete fixes — if meta title/description are weak, quote the actual text and suggest better alternatives.
For highlights include: meta title status, meta description status, H1 count, images missing alt text, internal link count.`,
      {
        metaTitle: scraped.metaTitle,
        metaDescription: scraped.metaDescription,
        h1s: scraped.headings.h1s,
        h2Count: scraped.headings.h2s.length,
        h2s: scraped.headings.h2s.slice(0, 3),
        imagesTotal: scraped.images.total,
        imagesMissingAlt: scraped.images.missingAlt,
        internalLinks: scraped.links.internalCount,
        canonical: scraped.canonical,
        seoScore: pagespeed.mobile.scores.seo,
      }
    ),

    analyzeSection(
      'mobile',
      `Analyse the Mobile Experience of this website: ${url}.
Grade it A/B/C/D/F. Give 3 fixes. Over 60% of web traffic is mobile — poor mobile experience directly costs sales.
For highlights include: mobile vs desktop score gap, LCP on mobile, viewport tag presence, layout shift score.`,
      {
        mobilePerformance: pagespeed.mobile.scores.performance,
        desktopPerformance: pagespeed.desktop.scores.performance,
        hasViewport: scraped.mobile.hasViewport,
        mobileLCP: pagespeed.mobile.metrics.lcp,
        mobileFCP: pagespeed.mobile.metrics.fcp,
        mobileTBT: pagespeed.mobile.metrics.tbt,
        mobileCLS: pagespeed.mobile.metrics.cls,
        mobileDiff: pagespeed.desktop.scores.performance - pagespeed.mobile.scores.performance,
      }
    ),

    analyzeSection(
      'content',
      `Analyse the Content & Messaging of this website: ${url}.
Does the homepage communicate what the business does within 5 seconds? Is there a strong CTA?
Grade it A/B/C/D/F. Give 3 specific improvements — if the H1 is weak, quote it and suggest a better version. If there's no CTA, suggest exact button text.
For highlights include: H1 text (truncated), CTA presence, number of CTAs found, whether value proposition is clear.`,
      {
        metaTitle: scraped.metaTitle,
        h1: scraped.headings.h1s[0] || '(none)',
        h2s: scraped.headings.h2s.slice(0, 4),
        ctasFound: scraped.ctas.found,
        visibleText: scraped.visibleText.slice(0, 800),
      }
    ),

    analyzeSection(
      'trust',
      `Analyse the Trust & Credibility Signals of this website: ${url}.
Grade it A/B/C/D/F. Give 3 specific improvements. Explain why each missing element costs them customers.
For highlights include: HTTPS status, privacy policy, phone number visible, testimonials present, terms of service.`,
      {
        isHttps: scraped.isHttps,
        hasPrivacyPolicy: scraped.trust.hasPrivacyPolicy,
        hasTerms: scraped.trust.hasTerms,
        hasPhone: scraped.trust.hasPhone,
        hasTestimonials: scraped.trust.hasTestimonials,
      }
    ),
  ]);

  // Overall health score
  const gradeToScore = { A: 90, B: 78, C: 63, D: 45, F: 25 };
  const sectionScores = sections.map(s => gradeToScore[s.grade] || s.score || 50);
  const overallScore = Math.round(sectionScores.reduce((a, b) => a + b, 0) / sectionScores.length);

  // Top 3 quick wins for executive summary
  const allFixes = sections.flatMap(s => s.fixes.map(f => ({ ...f, section: s.section })));
  const quickWins = allFixes.filter(f => f.quickWin && f.impact === 'High').slice(0, 3);
  const topWins = quickWins.length >= 3 ? quickWins :
    [...quickWins, ...allFixes.filter(f => f.impact === 'High' && !quickWins.includes(f))].slice(0, 3);

  // Priority action plan — force exactly 6 items
  const actionPlan = await analyzeSection(
    'actionPlan',
    `Write a Priority Action Plan for the owner of ${url}.
You MUST return exactly 6 fixes in the fixes array — no more, no fewer.
Rank them by impact (highest first). The first item should be the single most impactful change.
Reference the actual issues found in the data.
Each fix title: 3–5 words. Description: 2 specific sentences — what exactly to do and what improvement to expect.
Return a JSON object with ONLY a "fixes" array of exactly 6 items. The other fields (grade, score, summary, highlights) should be omitted or set to defaults.`,
    {
      sections: sections.map(s => ({
        section: s.section,
        grade: s.grade,
        fixes: s.fixes.map(f => ({ title: f.title, impact: f.impact, quickWin: f.quickWin })),
      })),
      overallScore,
    }
  );

  return { sections, actionPlan, overallScore, topWins };
}

module.exports = { generateFullReport };
