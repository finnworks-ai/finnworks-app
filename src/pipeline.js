/**
 * Main audit pipeline — orchestrates all steps end-to-end.
 * Called by the webhook handler after a successful Stripe payment,
 * and by POST /audit for the free audit.
 *
 * Flow:
 *  1. Fetch PageSpeed data (desktop + mobile)
 *  2. Scrape HTML for SEO + trust signals
 *  3. AI analysis → report sections
 *  4. Save report to Redis → get UUID
 *  5. Send email with report link
 */

const { fetchBothStrategies } = require('./auditor/pagespeed');
const { scrapeUrl } = require('./auditor/scraper');
const { generateFullReport } = require('./auditor/ai-analyzer');
const { saveReport } = require('./report/report-store');
const { sendAuditEmail } = require('./email/gmail');
const { incrementAuditCount } = require('./counter');

const crypto = require('crypto');
const BASE_URL = process.env.APP_BASE_URL || 'https://finnworks.ai';

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

  // Step 4: Save report to Redis (14-day TTL)
  console.log('[pipeline] Saving report to Redis...');
  const uuid = crypto.randomUUID();
  await saveReport(uuid, {
    uuid,
    websiteUrl,
    customerEmail,
    generatedAt: new Date().toISOString(),
    overallScore: auditResult.overallScore,
    sections: auditResult.sections,
    actionPlan: auditResult.actionPlan,
    topWins: auditResult.topWins,
  });
  const reportUrl = `${BASE_URL}/report/${uuid}`;
  console.log(`[pipeline] Report saved. URL: ${reportUrl}`);

  // Step 5: Send email with report link
  console.log(`[pipeline] Sending email... websiteUrl=${websiteUrl}`);
  const emailResult = await sendAuditEmail({
    to: customerEmail,
    websiteUrl,
    reportUrl,
    overallScore: auditResult.overallScore,
    actionPlan: auditResult.actionPlan,
  });
  console.log(`[pipeline] Email sent. Message ID: ${emailResult.messageId}`);

  // Increment persistent audit counter
  const count = await incrementAuditCount();
  console.log(`[pipeline] Audit count: ${count}`);

  return {
    success: true,
    websiteUrl,
    customerEmail,
    overallScore: auditResult.overallScore,
    reportUrl,
    messageId: emailResult.messageId,
  };
}

module.exports = { runAuditPipeline };
