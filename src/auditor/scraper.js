/**
 * HTML scraper — extracts SEO, trust, and all audit signals from a webpage.
 * Uses axios + cheerio (no headless browser needed for most pages).
 *
 * Returns signals for 9 audit categories:
 *   performance (data from PageSpeed — passthrough only)
 *   seo, mobile, content, trust  (original 5)
 *   geo, localSeo, conversion, accessibility  (new 4)
 */

const axios   = require('axios');
const cheerio = require('cheerio');
const https   = require('https');
const { URL } = require('url');

async function scrapeUrl(url) {
  const res = await axios.get(url, {
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; FinnWorksAuditBot/1.0; +https://finnworks.ai)',
    },
    maxRedirects: 5,
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  });

  const html   = res.data;
  const $      = cheerio.load(html);
  const parsed = new URL(url);

  // ── Meta & SEO ──────────────────────────────────────────────────────────
  const metaTitle       = $('title').first().text().trim();
  const metaDescription = $('meta[name="description"]').attr('content')?.trim() || '';
  const canonical       = $('link[rel="canonical"]').attr('href') || '';
  const robots          = $('meta[name="robots"]').attr('content') || '';
  const htmlLang        = $('html').attr('lang') || '';

  // ── Headings ─────────────────────────────────────────────────────────────
  const h1s = $('h1').map((_, el) => $(el).text().trim()).get();
  const h2s = $('h2').map((_, el) => $(el).text().trim()).get().slice(0, 10);
  const h3s = $('h3').map((_, el) => $(el).text().trim()).get().slice(0, 6);

  // ── Images ────────────────────────────────────────────────────────────────
  const images = $('img').map((_, el) => ({
    src: $(el).attr('src') || '',
    alt: $(el).attr('alt') || null,
  })).get();
  const imagesWithoutAlt = images.filter(i => !i.alt || i.alt.trim() === '');

  // ── Links ─────────────────────────────────────────────────────────────────
  const allLinks = $('a[href]').map((_, el) => ({
    href: $(el).attr('href') || '',
    text: $(el).text().trim().toLowerCase(),
  })).get();

  const internalLinks = allLinks
    .filter(l => l.href.startsWith('/') || l.href.includes(parsed.hostname))
    .length;

  // Non-descriptive link text
  const genericLinkTexts = ['click here', 'read more', 'here', 'more', 'learn more', 'link'];
  const nonDescriptiveLinkCount = allLinks.filter(l =>
    genericLinkTexts.some(g => l.text === g)
  ).length;

  // ── CTAs ──────────────────────────────────────────────────────────────────
  const ctaKeywords = ['get started', 'book', 'contact', 'buy', 'sign up', 'free', 'try', 'schedule', 'call', 'enquire', 'enquiry', 'quote'];
  const ctaButtons = $('a, button')
    .map((_, el) => $(el).text().toLowerCase().trim())
    .get()
    .filter(t => t.length > 0 && ctaKeywords.some(k => t.includes(k)));

  // ── Body text (for AI analysis) ──────────────────────────────────────────
  const rawBodyText = $('body').text().toLowerCase();

  // Strip nav/footer/script/style for clean visible text
  $('script, style, nav, footer, head').remove();
  const visibleText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 2000);

  // ── Trust signals ─────────────────────────────────────────────────────────
  const hasPrivacyPolicy  = $('a[href*="privacy"]').length > 0 || rawBodyText.includes('privacy policy');
  const hasTerms          = $('a[href*="terms"]').length > 0   || rawBodyText.includes('terms of service');
  const hasPhone          = /(\+\d[\d\s\-().]{7,}|0\d[\d\s\-().]{7,}|\(\d{3}\)\s*\d{3}[\s\-]\d{4})/.test($('body').text());
  const hasTestimonials   = rawBodyText.includes('testimonial') ||
                            rawBodyText.includes('review') ||
                            $('[class*="testimonial"], [class*="review"]').length > 0;
  const isHttps           = parsed.protocol === 'https:';
  const hasViewport       = $('meta[name="viewport"]').length > 0;

  // ── Structured data (JSON-LD) ─────────────────────────────────────────────
  const jsonLdBlocks = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const block = JSON.parse($(el).html() || '{}');
      if (block['@graph'] && Array.isArray(block['@graph'])) {
        jsonLdBlocks.push(...block['@graph']);
      } else {
        jsonLdBlocks.push(block);
      }
    } catch (_) { /* ignore malformed JSON-LD */ }
  });

  const schemaTypes = jsonLdBlocks
    .map(b => b['@type'])
    .flat()
    .filter(Boolean)
    .map(t => String(t));

  const hasSchemaType = (types) => types.some(t => schemaTypes.includes(t));

  // ── GEO / AEO signals ─────────────────────────────────────────────────────
  const hasFaqSchema        = hasSchemaType(['FAQPage', 'Question']);
  const hasHowToSchema      = hasSchemaType(['HowTo']);
  const hasOrgSchema        = hasSchemaType(['Organization', 'LocalBusiness', 'Corporation', 'ProfessionalService', 'Store']);
  const hasBreadcrumbSchema = hasSchemaType(['BreadcrumbList']);
  const hasArticleSchema    = hasSchemaType(['Article', 'BlogPosting', 'NewsArticle']);
  const allSchemaTypes      = [...new Set(schemaTypes)];

  const questionPrefixes  = /^(what|how|why|when|where|who|can|is|are|does|do)\b/i;
  const questionHeadings  = h2s.filter(h => questionPrefixes.test(h));

  const hasFaqSection = $('[class*="faq" i], [id*="faq" i]').length > 0 ||
                        rawBodyText.includes('frequently asked');

  const hasAboutPage = allLinks.some(l =>
    l.href.toLowerCase().includes('/about') || l.text === 'about us' || l.text === 'about'
  );

  // ── Local SEO signals ─────────────────────────────────────────────────────
  const localBizTypes = ['LocalBusiness', 'ProfessionalService', 'Store', 'Restaurant',
    'MedicalBusiness', 'HealthAndBeautyBusiness', 'HomeAndConstructionBusiness',
    'LodgingBusiness', 'SportsActivityLocation', 'TouristAttraction'];
  const hasLocalBusinessSchema = hasSchemaType(localBizTypes);

  const addressPattern = /\d{1,5}\s+\w[\w\s]{2,30}(street|st|road|rd|avenue|ave|drive|dr|lane|ln|way|place|pl|crescent|cres|terrace|tce|close|boulevard|blvd)\b/i;
  const hasAddressInBody = addressPattern.test($('body').text());

  const hasGoogleMapsEmbed = $('iframe[src*="maps.google"], iframe[src*="google.com/maps"]').length > 0;

  const hasGBPLink = allLinks.some(l =>
    l.href.includes('g.co/maps') ||
    l.href.includes('maps.google') ||
    l.href.includes('goo.gl/maps') ||
    l.href.includes('maps.app.goo.gl')
  );

  const locationRegex = /\b(auckland|wellington|christchurch|hamilton|tauranga|dunedin|palmerston north|napier|hastings|rotorua|whangarei|new plymouth|nelson|invercargill|whanganui|gisborne|blenheim|porirua|kapiti|upper hutt|lower hutt|north shore|manukau|waitakere|nz|new zealand)\b/i;
  const hasLocationMeta = locationRegex.test(metaTitle + ' ' + metaDescription);

  const footerText     = $('footer, [class*="footer" i], [id*="footer" i]').text();
  const footerHasPhone = /(\+\d[\d\s\-().]{7,}|0\d[\d\s\-().]{7,})/.test(footerText);
  const footerHasAddr  = addressPattern.test(footerText) ||
                         /\b(street|road|avenue|drive|lane|place|crescent)\b/i.test(footerText);
  const hasNapInFooter = footerHasPhone && footerHasAddr;

  // ── Conversion & UX signals ───────────────────────────────────────────────
  const hasForms = $('form').length > 0;
  const contactKeywords = ['message', 'enquir', 'inquiry', 'contact', 'send', 'name', 'subject'];
  const hasContactForm = $('form').filter((_, el) => {
    const formText = ($(el).text() + ($(el).attr('action') || '')).toLowerCase();
    return contactKeywords.some(k => formText.includes(k));
  }).length > 0;

  const headerNavText    = $('header, nav, .header, .nav, #header, #nav, [role="banner"], [role="navigation"]').text();
  const hasPhoneInHeader = /(\+\d[\d\s\-().]{7,}|0\d[\d\s\-().]{7,})/.test(headerNavText);

  const emailPattern    = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const hasEmailVisible = emailPattern.test($('body').text());

  const hasContactPage = allLinks.some(l =>
    l.href.toLowerCase().includes('/contact') || l.text === 'contact' || l.text === 'contact us'
  );

  const bookingKeywords = ['book online', 'book an appointment', 'book a call', 'schedule', 'make a booking'];
  const hasBookingWidget = bookingKeywords.some(k => rawBodyText.includes(k)) ||
    $('iframe[src*="calendly"], iframe[src*="acuityscheduling"], iframe[src*="bookeo"], iframe[src*="simplybook"], iframe[src*="setmore"]').length > 0;

  const hasChatWidget = rawBodyText.includes('chat with us') ||
    $('[class*="intercom" i], [class*="freshchat" i], [class*="tawk" i], [class*="livechat" i], [class*="tidio" i], [id*="chat-widget" i], [id*="crisp" i]').length > 0 ||
    html.includes('tawk.to') || html.includes('intercom.io') || html.includes('crisp.chat');

  const hasServicesPage = allLinks.some(l =>
    l.href.toLowerCase().includes('/service') ||
    l.href.toLowerCase().includes('/pricing') ||
    l.href.toLowerCase().includes('/packages') ||
    l.text === 'services' || l.text === 'pricing' || l.text === 'packages'
  );

  // ── Accessibility signals ──────────────────────────────────────────────────
  const hasH1 = h1s.length > 0;
  const hasH2 = $('h2').length > 0;
  const hasH3 = $('h3').length > 0;
  const headingHierarchyIssue = (hasH3 && !hasH2) || (hasH2 && !hasH1) || h1s.length > 1;

  const totalInputs = $('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select').length;
  const labelledInputs = $('label[for]').length + $('[aria-label]').length + $('[aria-labelledby]').length;
  const unlabelledInputs = Math.max(0, totalInputs - labelledInputs);

  const hasSkipNav = $('a[href="#main"], a[href="#content"], a[href="#maincontent"], a.skip-link, a[class*="skip"]').length > 0;

  const ariaMain   = $('[role="main"], main').length > 0;
  const ariaNave   = $('[role="navigation"], nav').length > 0;
  const ariaHeader = $('[role="banner"], header').length > 0;
  const ariaFooter = $('[role="contentinfo"], footer').length > 0;
  const ariaLandmarkCount = [ariaMain, ariaNave, ariaHeader, ariaFooter].filter(Boolean).length;

  // ── Return all signals ─────────────────────────────────────────────────────
  return {
    url,
    isHttps,
    htmlLang,
    metaTitle,
    metaDescription,
    canonical,
    robots,
    headings:   { h1s, h2s, h3s },
    images:     { total: images.length, missingAlt: imagesWithoutAlt.length },
    links:      { internalCount: internalLinks, nonDescriptiveLinkCount },
    ctas:       { found: ctaButtons.slice(0, 5), count: ctaButtons.length },
    trust:      { hasPrivacyPolicy, hasTerms, hasPhone, hasTestimonials },
    mobile:     { hasViewport },
    geo: {
      schemaTypes:          allSchemaTypes,
      hasFaqSchema,
      hasHowToSchema,
      hasOrgSchema,
      hasBreadcrumbSchema,
      hasArticleSchema,
      questionHeadings:     questionHeadings.slice(0, 5),
      questionHeadingCount: questionHeadings.length,
      hasFaqSection,
      hasAboutPage,
    },
    localSeo: {
      hasLocalBusinessSchema,
      hasAddressInBody,
      hasGoogleMapsEmbed,
      hasGBPLink,
      hasPhone,
      hasLocationMeta,
      hasNapInFooter,
      footerHasPhone,
      footerHasAddr,
    },
    conversion: {
      hasForms,
      hasContactForm,
      hasPhoneInHeader,
      hasEmailVisible,
      hasContactPage,
      hasBookingWidget,
      hasChatWidget,
      hasServicesPage,
      ctaCount:  ctaButtons.length,
      ctasFound: ctaButtons.slice(0, 5),
    },
    accessibility: {
      hasHtmlLang:           htmlLang.length > 0,
      imagesTotal:           images.length,
      imagesMissingAlt:      imagesWithoutAlt.length,
      altTextRatio:          images.length > 0 ? Math.round((1 - imagesWithoutAlt.length / images.length) * 100) : 100,
      totalInputs,
      unlabelledInputs,
      hasSkipNav,
      ariaLandmarkCount,
      ariaMain,
      ariaNave,
      ariaHeader,
      ariaFooter,
      headingHierarchyIssue,
      h1Count:               h1s.length,
      nonDescriptiveLinkCount,
    },
    visibleText,
  };
}

module.exports = { scrapeUrl };
