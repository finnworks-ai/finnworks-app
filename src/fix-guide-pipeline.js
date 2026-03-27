/**
 * Fix Guide Pipeline — runs after a successful $97 Stripe payment.
 *
 * Flow:
 *  1. Fetch PageSpeed data + scrape (same as free audit)
 *  2. AI analysis (same as free audit)
 *  3. AI expands top 6 fixes into step-by-step guide
 *  4. Generate Fix Guide PDF
 *  5. Send via Gmail
 */

const { fetchBothStrategies } = require('./auditor/pagespeed');
const { scrapeUrl } = require('./auditor/scraper');
const { generateFullReport } = require('./auditor/ai-analyzer');
const { generateFixGuide } = require('./auditor/fix-guide-generator');
const { generateFixGuidePDF } = require('./report/fix-guide-pdf');
const { sendFixGuideEmail } = require('./email/gmail');

async function runFixGuidePipeline({ websiteUrl, customerEmail }) {
  console.log(`[fix-pipeline] Starting fix guide for ${websiteUrl} → ${customerEmail}`);

  // Step 1: PageSpeed
  const pagespeed = await fetchBothStrategies(websiteUrl);
  console.log(`[fix-pipeline] PageSpeed done. Mobile: ${pagespeed.mobile.scores.performance}`);

  // Step 2: Scrape
  const scraped = await scrapeUrl(websiteUrl);
  console.log(`[fix-pipeline] Scrape done.`);

  // Step 3: AI audit analysis
  const auditResult = await generateFullReport(websiteUrl, pagespeed, scraped);
  console.log(`[fix-pipeline] Audit analysis done. Score: ${auditResult.overallScore}`);

  // Step 4: Expand to fix guide
  const fixGuide = await generateFixGuide(websiteUrl, auditResult);
  console.log(`[fix-pipeline] Fix guide generated. ${fixGuide.fixes.length} fixes.`);

  // Step 5: Generate PDF
  const pdfBuffer = await generateFixGuidePDF(fixGuide, customerEmail);
  console.log(`[fix-pipeline] PDF done. ${(pdfBuffer.length / 1024).toFixed(1)} KB`);

  // Step 6: Send email
  const emailResult = await sendFixGuideEmail({ to: customerEmail, websiteUrl, pdfBuffer });
  console.log(`[fix-pipeline] Email sent. ID: ${emailResult.messageId}`);

  return {
    success: true,
    websiteUrl,
    customerEmail,
    overallScore: auditResult.overallScore,
    fixCount: fixGuide.fixes.length,
    messageId: emailResult.messageId,
  };
}

module.exports = { runFixGuidePipeline };
