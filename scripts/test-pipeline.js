/**
 * End-to-end pipeline test (no Stripe webhook needed).
 * Usage: node scripts/test-pipeline.js <url> <email>
 * Example: node scripts/test-pipeline.js https://example.com test@example.com
 *
 * Requires: OPENAI_API_KEY in .env (or environment)
 * Gmail steps are skipped if token.json is missing (PDF saved locally instead).
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { fetchBothStrategies } = require('../src/auditor/pagespeed');
const { scrapeUrl } = require('../src/auditor/scraper');
const { generateFullReport } = require('../src/auditor/ai-analyzer');
const { generatePDF } = require('../src/report/pdf-generator');

const url = process.argv[2] || 'https://example.com';
const email = process.argv[3] || 'test@finnworks.ai';

(async () => {
  try {
    console.log(`\n🔍 Testing pipeline for: ${url}\n`);

    console.log('1/4 Fetching PageSpeed data...');
    const pagespeed = await fetchBothStrategies(url);
    console.log(`    Mobile: ${pagespeed.mobile.scores.performance} perf, ${pagespeed.mobile.scores.seo} SEO`);
    console.log(`    Desktop: ${pagespeed.desktop.scores.performance} perf, ${pagespeed.desktop.scores.seo} SEO`);

    console.log('2/4 Scraping HTML...');
    const scraped = await scrapeUrl(url);
    console.log(`    Title: "${scraped.metaTitle}"`);
    console.log(`    H1s: ${scraped.headings.h1s.join(', ') || '(none)'}`);
    console.log(`    HTTPS: ${scraped.isHttps}, Viewport: ${scraped.mobile.hasViewport}`);

    console.log('3/4 Running AI analysis...');
    const auditResult = await generateFullReport(url, pagespeed, scraped);
    console.log(`    Overall score: ${auditResult.overallScore}/100`);
    auditResult.sections.forEach(s => console.log(`    [${s.section}] Grade: ${s.grade} — ${(s.summary || '').slice(0, 60)}...`));

    console.log('4/4 Generating PDF...');
    const pdfBuffer = await generatePDF(auditResult, url, email);
    const outPath = path.join(__dirname, `../test-report-${Date.now()}.pdf`);
    fs.writeFileSync(outPath, pdfBuffer);
    console.log(`    PDF saved: ${outPath} (${(pdfBuffer.length / 1024).toFixed(1)} KB)\n`);

    console.log('✅ Pipeline test complete. Open the PDF to review the report.\n');
  } catch (err) {
    console.error('\n❌ Pipeline error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
