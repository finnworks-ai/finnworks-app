/**
 * PageSpeed Insights API wrapper
 * Uses Google's free PageSpeed API — no key required for basic use.
 * https://developers.google.com/speed/docs/insights/v5/get-started
 */

const axios = require('axios');

const PSI_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

async function fetchPageSpeed(url, strategy = 'mobile') {
  const params = { url, strategy, key: process.env.GOOGLE_API_KEY };
  const res = await axios.get(PSI_URL, { params, timeout: 60000 });
  const data = res.data;

  const cats = data.lighthouseResult?.categories || {};
  const audits = data.lighthouseResult?.audits || {};

  return {
    url,
    strategy,
    scores: {
      performance: Math.round((cats.performance?.score || 0) * 100),
      seo: Math.round((cats.seo?.score || 0) * 100),
      accessibility: Math.round((cats.accessibility?.score || 0) * 100),
      bestPractices: Math.round((cats['best-practices']?.score || 0) * 100),
    },
    metrics: {
      fcp: audits['first-contentful-paint']?.displayValue || 'N/A',
      lcp: audits['largest-contentful-paint']?.displayValue || 'N/A',
      tbt: audits['total-blocking-time']?.displayValue || 'N/A',
      cls: audits['cumulative-layout-shift']?.displayValue || 'N/A',
      speedIndex: audits['speed-index']?.displayValue || 'N/A',
    },
    opportunities: Object.values(audits)
      .filter(a => a.score !== null && a.score < 0.9 && a.details?.type === 'opportunity')
      .slice(0, 5)
      .map(a => ({ id: a.id, title: a.title, savings: a.details?.overallSavingsMs })),
  };
}

async function fetchBothStrategies(url) {
  const mobile = await fetchPageSpeed(url, 'mobile');
  await new Promise(r => setTimeout(r, 1500));
  const desktop = await fetchPageSpeed(url, 'desktop');
  return { mobile, desktop };
}

module.exports = { fetchPageSpeed, fetchBothStrategies };
