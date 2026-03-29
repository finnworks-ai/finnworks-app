/**
 * Main audit pipeline — orchestrates all steps end-to-end.
 * Called by the webhook handler after a successful Stripe payment.
 *
 * Flow:
 *  1. Fetch PageSpeed data (desktop + mobile)
 *  2. Scrape HTML for SEO + trust signals
 *  3. AI analysis → report sections
 *  4. Generate PDF
 *  5. Send via Gmail
 */

const { fetchBothStrategies } = require('./auditor/pagespeed');
const { scrapeUrl } = require('./auditor/scraper');
const { generateFullReport } = require('./auditor/ai-analyzer');
const { generatePDF } = require('./report/pdf-generator');
const { sendAuditEmail } = require('./email/gmail');
const { incrementAuditCount } = require('./counter');

async function runAuditPipeline({ websiteUrl, customerEmail }) {
  console.log(`[pipeline] Starting audit for ${websiteUrl} → ${customerEmail}`);

  // Step 1: PageSpeed
  console.log('[pipeline] Fetching PageSpeed data...');
  const pagespeed = await fetchBothStrategies(websiteUrl);
  console.log(`[pipeline] PageSpeed done. Mobile perf: ${pagespeed.mobile.scores.performance}`);

  // Step 2: Scrape
  console.log('[pipeline] Scraping HTML...');
  const scraped = await scrapeUrl(websiteUrl);
  console.log(`[pipeline] Scrape done. Title: "${scraped.metaTitle}"`);

  // Step 3: AI analysis
  console.log('[pipeline] Running AI analysis...');
  const auditResult = await generateFullReport(websiteUrl, pagespeed, scraped);
  console.log(`[pipeline] AI done. Overall score: ${auditResult.overallScore}`);

  // Step 4: Generate PDF
  console.log('[pipeline] Generating PDF...');
  const pdfBuffer = await generatePDF(auditResult, websiteUrl, customerEmail);
  console.log(`[pipeline] PDF done. Size: ${(pdfBuffer.length / 1024).toFixed(1)} KB`);

  // Step 5: Send email
  console.log(`[pipeline] Sending email... websiteUrl=${websiteUrl}`);
  const emailResult = await sendAuditEmail({ to: customerEmail, websiteUrl, pdfBuffer, overallScore: auditResult.overallScore, actionPlan: auditResult.actionPlan });
  console.log(`[pipeline] Email sent. Message ID: ${emailResult.messageId}`);

  // Increment persistent audit counter
  const count = await incrementAuditCount();
  console.log(`[pipeline] Audit count: ${count}`);

  return {
    success: true,
    websiteUrl,
    customerEmail,
    overallScore: auditResult.overallScore,
    messageId: emailResult.messageId,
  };
}

module.exports = { runAuditPipeline };
