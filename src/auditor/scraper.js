/**
 * HTML scraper — extracts SEO and trust signals from a webpage.
 * Uses axios + cheerio (no headless browser needed for most pages).
 */

const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');
const { URL } = require('url');

async function scrapeUrl(url) {
  const res = await axios.get(url, {
    timeout: 15000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; FinnWorksAuditBot/1.0; +https://finnworks.ai)',
    },
    maxRedirects: 5,
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  });

  const $ = cheerio.load(res.data);
  const parsed = new URL(url);

  // ── Meta & SEO ──────────────────────────────────────────────────────────
  const metaTitle = $('title').first().text().trim();
  const metaDescription =
    $('meta[name="description"]').attr('content')?.trim() || '';
  const canonical = $('link[rel="canonical"]').attr('href') || '';
  const robots = $('meta[name="robots"]').attr('content') || '';

  // ── Headings ─────────────────────────────────────────────────────────────
  const h1s = $('h1').map((_, el) => $(el).text().trim()).get();
  const h2s = $('h2').map((_, el) => $(el).text().trim()).get().slice(0, 10);

  // ── Images ────────────────────────────────────────────────────────────────
  const images = $('img').map((_, el) => ({
    src: $(el).attr('src') || '',
    alt: $(el).attr('alt') || null,
  })).get();
  const imagesWithoutAlt = images.filter(i => !i.alt || i.alt.trim() === '');

  // ── Links ─────────────────────────────────────────────────────────────────
  const internalLinks = $('a[href]')
    .map((_, el) => $(el).attr('href'))
    .get()
    .filter(href => href.startsWith('/') || href.includes(parsed.hostname))
    .length;

  // ── CTAs ──────────────────────────────────────────────────────────────────
  const ctaKeywords = ['get started', 'book', 'contact', 'buy', 'sign up', 'free', 'try', 'schedule', 'call'];
  const ctaButtons = $('a, button')
    .map((_, el) => $(el).text().toLowerCase().trim())
    .get()
    .filter(t => ctaKeywords.some(k => t.includes(k)));

  // ── Trust signals ─────────────────────────────────────────────────────────
  const bodyText = $('body').text().toLowerCase();
  const hasPrivacyPolicy =
    $('a[href*="privacy"]').length > 0 || bodyText.includes('privacy policy');
  const hasTerms =
    $('a[href*="terms"]').length > 0 || bodyText.includes('terms of service');
  const hasPhone = /(\+\d[\d\s\-().]{7,}|\(\d{3}\)\s*\d{3}[\s\-]\d{4})/.test(
    $('body').text()
  );
  const hasTestimonials =
    bodyText.includes('testimonial') ||
    bodyText.includes('review') ||
    $('[class*="testimonial"], [class*="review"]').length > 0;

  // ── SSL ───────────────────────────────────────────────────────────────────
  const isHttps = parsed.protocol === 'https:';

  // ── Viewport / mobile ─────────────────────────────────────────────────────
  const hasViewport = $('meta[name="viewport"]').length > 0;

  // ── Homepage body text (for AI messaging analysis) ──────────────────────
  // Grab first ~2000 chars of visible text
  $('script, style, nav, footer, head').remove();
  const visibleText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 2000);

  return {
    url,
    isHttps,
    metaTitle,
    metaDescription,
    canonical,
    robots,
    headings: { h1s, h2s },
    images: {
      total: images.length,
      missingAlt: imagesWithoutAlt.length,
    },
    links: { internalCount: internalLinks },
    ctas: { found: ctaButtons.slice(0, 5) },
    trust: {
      hasPrivacyPolicy,
      hasTerms,
      hasPhone,
      hasTestimonials,
    },
    mobile: { hasViewport },
    visibleText,
  };
}

module.exports = { scrapeUrl };
