/**
 * AI analysis — generates structured report sections using OpenAI GPT-4o.
 * Returns structured JSON per section for rich report rendering.
 *
 * 9 sections: performance, seo, mobile, content, trust, geo, localSeo, conversion, accessibility
 */

'use strict';

const OpenAI = require('openai');

let client;
function getClient() {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

const SYSTEM_PROMPT = `You are a plain-English website strategist helping business owners and website managers improve their websites.
Write for non-technical readers. Be specific, direct, and action-oriented. No jargon.
Use only the data provided — do not invent statistics or claim metrics you haven't been given.
When data is available, quote it directly (e.g. "Your LCP is 4.2s"). When it isn't, speak in general terms.
Always respond with valid JSON only. No markdown, no explanation outside the JSON.`;

// JSON schema comment shown to GPT-4o in each prompt
const OUTPUT_FORMAT = `Respond with JSON in this exact format:
{
  "grade": "A|B|C|D|F",
  "score": <number 0-100>,
  "summary": "<4-6 sentence plain English summary. Start with what was found. Explain why it matters commercially. Give one specific example from the data. End with the single most important thing to do.>",
  "highlights": [
    {
      "label": "<short metric name, max 5 words>",
      "value": "<the actual value or status — be specific>",
      "benchmark": "<context e.g. 'Target: under 2.5s' or 'Good practice: always present'>",
      "positive": true|false
    }
  ],
  "fixes": [
    {
      "title": "<3-5 word fix title>",
      "description": "<2 specific sentences: exactly what to change and where, then what improvement to expect>",
      "impact_estimate": "<one phrase quantifying the expected outcome e.g. 'Could reduce bounce rate 10-15%'>",
      "effort": "Low|Medium|High",
      "impact": "Low|Medium|High",
      "quickWin": true|false
    }
  ]
}
Notes:
- highlights: 3-4 data points. positive=true for good, false for problems.
- fixes: 4-5 fixes ordered by impact (highest first). quickWin=true only if Low effort AND High impact.
- summary: must be 4-6 sentences. Not 1.
- Never use placeholder text. Every field must have real content based on the data provided.`;

async function analyzeSection(sectionName, sectionPrompt, data) {
  const openai = getClient();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `${sectionPrompt}\n\nDATA:\n${JSON.stringify(data, null, 2)}\n\n${OUTPUT_FORMAT}`,
      },
    ],
    max_tokens: 2500,
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

    // ── 1. Performance & Speed ──────────────────────────────────────────────
    analyzeSection(
      'performance',
      `Analyse the Performance & Speed of this website: ${url}.

Grade on mobile performance primarily (A=90+, B=75+, C=60+, D=40+, F=<40).
Every extra second of load time reduces conversions by 4-7% on average — make the business impact clear.

Industry benchmarks to reference:
- LCP (Largest Contentful Paint): Good <2.5s, Needs Improvement 2.5–4s, Poor >4s
- FCP (First Contentful Paint): Good <1.8s, Poor >3s
- TBT (Total Blocking Time): Good <200ms, Poor >600ms
- CLS (Cumulative Layout Shift): Good <0.1, Poor >0.25
- Performance score: Good 90+, Needs Improvement 50–89, Poor <50

For highlights, include: mobile performance score, desktop performance score, LCP value + benchmark, and the most costly opportunity from the data.
For fixes: be specific about what to compress, defer, or optimise. Name the types of files or third-party scripts where data supports it. Give 4-5 fixes.`,
      {
        mobilePerformance:  pagespeed.mobile.scores.performance,
        desktopPerformance: pagespeed.desktop.scores.performance,
        mobileLCP:          pagespeed.mobile.metrics.lcp,
        mobileFCP:          pagespeed.mobile.metrics.fcp,
        mobileTBT:          pagespeed.mobile.metrics.tbt,
        mobileCLS:          pagespeed.mobile.metrics.cls,
        mobileSpeedIndex:   pagespeed.mobile.metrics.speedIndex,
        opportunities:      pagespeed.mobile.opportunities,
      }
    ),

    // ── 2. SEO Foundations ──────────────────────────────────────────────────
    analyzeSection(
      'seo',
      `Analyse the SEO Foundations of this website: ${url}.

Grade it A/B/C/D/F. If the meta title or description are present in the data, quote them verbatim in the summary, evaluate them honestly, and in the fixes suggest a specific rewrite that is more compelling and keyword-rich.
If H1 is present, quote it and rate its effectiveness.
For highlights: meta title present/quality, meta description present/quality, H1 count, images missing alt text count.
For fixes: give exactly what to change with specific example text. Give 4-5 fixes.`,
      {
        metaTitle:        scraped.metaTitle,
        metaDescription:  scraped.metaDescription,
        h1s:              scraped.headings.h1s,
        h2Count:          scraped.headings.h2s.length,
        h2s:              scraped.headings.h2s.slice(0, 5),
        imagesTotal:      scraped.images.total,
        imagesMissingAlt: scraped.images.missingAlt,
        internalLinks:    scraped.links.internalCount,
        canonical:        scraped.canonical,
        seoScore:         pagespeed.mobile.scores.seo,
        robots:           scraped.robots,
      }
    ),

    // ── 3. Mobile Experience ────────────────────────────────────────────────
    analyzeSection(
      'mobile',
      `Analyse the Mobile Experience of this website: ${url}.

Grade it A/B/C/D/F. Over 60% of web traffic is now on mobile devices — a poor mobile experience directly costs sales and enquiries.
A gap >20 points between desktop and mobile performance is a significant red flag.
For highlights: mobile vs desktop score gap, LCP on mobile, CLS (layout stability), viewport tag present.
For fixes: be specific — mention touch target sizes, font size requirements, content reflow. Give 4-5 fixes.`,
      {
        mobilePerformance:  pagespeed.mobile.scores.performance,
        desktopPerformance: pagespeed.desktop.scores.performance,
        mobileLCP:          pagespeed.mobile.metrics.lcp,
        mobileFCP:          pagespeed.mobile.metrics.fcp,
        mobileTBT:          pagespeed.mobile.metrics.tbt,
        mobileCLS:          pagespeed.mobile.metrics.cls,
        hasViewport:        scraped.mobile.hasViewport,
        mobileVsDesktopGap: pagespeed.desktop.scores.performance - pagespeed.mobile.scores.performance,
        opportunities:      pagespeed.mobile.opportunities,
      }
    ),

    // ── 4. Content & Messaging ──────────────────────────────────────────────
    analyzeSection(
      'content',
      `Analyse the Content & Messaging of this website: ${url}.

Grade it A/B/C/D/F. A visitor should understand what this business does and why to choose them within 5 seconds.
If the H1 is in the data, quote it directly. Rate it: does it communicate a clear value proposition and outcome, or is it vague?
For fixes: suggest specific copy rewrites — quote the existing H1 and propose an improved version. Suggest specific CTA button text. Give 4-5 fixes.`,
      {
        metaTitle:   scraped.metaTitle,
        h1:          scraped.headings.h1s[0] || '(none found)',
        h2s:         scraped.headings.h2s.slice(0, 5),
        ctasFound:   scraped.ctas.found,
        ctaCount:    scraped.ctas.count,
        visibleText: scraped.visibleText.slice(0, 1000),
      }
    ),

    // ── 5. Trust & Credibility ──────────────────────────────────────────────
    analyzeSection(
      'trust',
      `Analyse the Trust & Credibility signals of this website: ${url}.

Grade it A/B/C/D/F. Trust signals are the difference between a visitor enquiring and hitting the back button.
Missing signals are particularly costly for service businesses where people are handing over money for something they can't see first.
For each missing element, explain exactly what the business loses by not having it — be direct about the commercial consequence.
Name specific tools and platforms they should use (e.g. Trustpilot, Google Business Profile, Clutch.co for agencies).
For highlights: HTTPS, privacy policy, phone number, testimonials/reviews, terms of service.
For fixes: give 4-5 actionable improvements with specific platform recommendations.`,
      {
        isHttps:          scraped.isHttps,
        hasPrivacyPolicy: scraped.trust.hasPrivacyPolicy,
        hasTerms:         scraped.trust.hasTerms,
        hasPhone:         scraped.trust.hasPhone,
        hasTestimonials:  scraped.trust.hasTestimonials,
      }
    ),

    // ── 6. GEO / AEO ────────────────────────────────────────────────────────
    analyzeSection(
      'geo',
      `Analyse how well this website is optimised for AI-powered and answer-engine search (GEO/AEO): ${url}.

AI search engines — Google AI Overviews, ChatGPT Search, Perplexity, and Bing Copilot — pull answers from websites that are structured clearly with FAQ content, schema markup, and explicit business descriptions.
A website that isn't optimised for AI search is invisible to an increasingly large share of search traffic.
Grade it A/B/C/D/F. Explain the specific AI search platforms affected by each missing signal.
For highlights: FAQ schema present, Organisation schema present, question-format heading count, FAQ section detected.
For fixes: give 4-5 specific structured data improvements with JSON-LD examples where possible.`,
      {
        schemaTypes:          scraped.geo.schemaTypes,
        hasFaqSchema:         scraped.geo.hasFaqSchema,
        hasHowToSchema:       scraped.geo.hasHowToSchema,
        hasOrgSchema:         scraped.geo.hasOrgSchema,
        hasBreadcrumbSchema:  scraped.geo.hasBreadcrumbSchema,
        questionHeadingCount: scraped.geo.questionHeadingCount,
        questionHeadings:     scraped.geo.questionHeadings,
        hasFaqSection:        scraped.geo.hasFaqSection,
        hasAboutPage:         scraped.geo.hasAboutPage,
        visibleTextSample:    scraped.visibleText.slice(0, 800),
      }
    ),

    // ── 7. Local SEO ────────────────────────────────────────────────────────
    analyzeSection(
      'localSeo',
      `Analyse the Local SEO signals on this website: ${url}.

Local SEO determines whether this business appears when people search for services in their area — "plumber near me", "accountant [city]", etc. These are often the highest-intent searches with the best conversion rates.
Even if the site appears to serve a national or global audience, grade it on local signal presence. Local signals also help with trust and relevance.
For highlights: LocalBusiness schema, physical address on page, Google Maps embed, Google Business Profile link, location in meta.
For fixes: be specific about NAP consistency, Google Business Profile optimisation, LocalBusiness schema implementation. Give 4-5 fixes.`,
      {
        hasLocalBusinessSchema: scraped.localSeo.hasLocalBusinessSchema,
        hasAddressInBody:       scraped.localSeo.hasAddressInBody,
        hasGoogleMapsEmbed:     scraped.localSeo.hasGoogleMapsEmbed,
        hasGBPLink:             scraped.localSeo.hasGBPLink,
        hasPhone:               scraped.localSeo.hasPhone,
        hasLocationMeta:        scraped.localSeo.hasLocationMeta,
        hasNapInFooter:         scraped.localSeo.hasNapInFooter,
        metaTitle:              scraped.metaTitle,
        metaDescription:        scraped.metaDescription,
      }
    ),

    // ── 8. Conversion & UX ──────────────────────────────────────────────────
    analyzeSection(
      'conversion',
      `Analyse how well this website converts visitors into customers or enquiries: ${url}.

A site can rank well and load fast — but still lose business if visitors can't easily figure out how to get in touch, book, or buy.
Conversion rate optimisation (CRO) is often the highest-ROI improvement a business website can make.
For highlights: contact form present, phone in header, email visible, contact page exists, booking widget.
For fixes: suggest exact button text, specific page improvements, and placement changes. Give 4-5 fixes.`,
      {
        hasForms:         scraped.conversion.hasForms,
        hasContactForm:   scraped.conversion.hasContactForm,
        hasPhoneInHeader: scraped.conversion.hasPhoneInHeader,
        hasEmailVisible:  scraped.conversion.hasEmailVisible,
        hasContactPage:   scraped.conversion.hasContactPage,
        hasBookingWidget: scraped.conversion.hasBookingWidget,
        hasChatWidget:    scraped.conversion.hasChatWidget,
        hasServicesPage:  scraped.conversion.hasServicesPage,
        ctaCount:         scraped.ctas.count,
        ctasFound:        scraped.ctas.found,
      }
    ),

    // ── 9. Accessibility ────────────────────────────────────────────────────
    analyzeSection(
      'accessibility',
      `Analyse the web accessibility of this website: ${url}.

Accessibility affects all visitors — not just those with disabilities. Missing alt text hurts screen reader users and SEO. Poor heading structure confuses everyone. Unlabelled form inputs prevent people with assistive technology from filling them in.
In many countries accessibility is a legal requirement for public-facing websites.
For highlights: HTML lang attribute, alt text coverage percentage, unlabelled inputs, ARIA landmark count.
For fixes: be specific — name the exact elements or patterns to fix. Give 4-5 fixes ordered by impact.`,
      {
        hasHtmlLang:             scraped.accessibility.hasHtmlLang,
        htmlLang:                scraped.htmlLang,
        imagesMissingAlt:        scraped.accessibility.imagesMissingAlt,
        imagesTotal:             scraped.accessibility.imagesTotal,
        altTextRatio:            scraped.accessibility.altTextRatio,
        totalInputs:             scraped.accessibility.totalInputs,
        unlabelledInputs:        scraped.accessibility.unlabelledInputs,
        hasSkipNav:              scraped.accessibility.hasSkipNav,
        ariaLandmarkCount:       scraped.accessibility.ariaLandmarkCount,
        headingHierarchyIssue:   scraped.accessibility.headingHierarchyIssue,
        h1Count:                 scraped.accessibility.h1Count,
        nonDescriptiveLinkCount: scraped.accessibility.nonDescriptiveLinkCount,
      }
    ),

  ]);

  // Overall health score — use the AI's own score for each section
  // (more accurate than mapping grades to fixed values)
  const sectionScores = sections.map(s => s.score || 50);
  const overallScore  = Math.round(sectionScores.reduce((a, b) => a + b, 0) / sectionScores.length);

  // Top quick wins across all 9 sections
  const allFixes  = sections.flatMap(s => (s.fixes || []).map(f => ({ ...f, section: s.section })));
  const quickWins = allFixes.filter(f => f.quickWin && f.impact === 'High').slice(0, 3);
  const topWins   = quickWins.length >= 3 ? quickWins :
    [...quickWins, ...allFixes.filter(f => f.impact === 'High' && !quickWins.includes(f))].slice(0, 3);

  // Priority action plan — 8 ranked items from across all 9 sections
  const actionPlan = await analyzeSection(
    'actionPlan',
    `Write a Priority Action Plan for the owner of ${url}.

You MUST return exactly 8 fixes in the fixes array — no more, no fewer.
Rank them by impact (highest first). Fix #1 should be the single most impactful change available.
Draw from any of the 9 audit sections. Choose the 8 highest-value improvements across the whole site.

For each fix:
- title: 3-5 words
- description: 2 specific sentences — what exactly to do and what measurable improvement to expect
- impact_estimate: one phrase e.g. "Could lift organic traffic 20-30%" or "Likely to reduce bounce rate"
- effort: Low | Medium | High
- impact: Low | Medium | High
- time_estimate: realistic time to implement e.g. "~30 min", "~2 hrs", "~1 day"
- section: the audit section this fix belongs to (e.g. "performance", "seo", "conversion")
- quickWin: true only if Low effort AND High impact

Return a JSON object with ONLY a "fixes" array of exactly 8 items.`,
    {
      sections: sections.map(s => ({
        section: s.section,
        grade:   s.grade,
        score:   s.score,
        fixes:   (s.fixes || []).map(f => ({ title: f.title, impact: f.impact, effort: f.effort, quickWin: f.quickWin, impact_estimate: f.impact_estimate })),
      })),
      overallScore,
    }
  );

  return { sections, actionPlan, overallScore, topWins };
}

module.exports = { generateFullReport };
