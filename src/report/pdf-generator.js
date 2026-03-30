/**
 * PDF generator — renders the report as a single continuous PDF page using
 * Puppeteer's page.pdf() with a custom height measured from the full content.
 *
 * Why a single continuous page instead of fixed A4 pages:
 *   Fixed A4 pages require every section to fit within exactly 1123px. When
 *   AI-generated descriptions are longer than expected, content is clipped.
 *   A single continuous page lets the browser lay out everything naturally —
 *   no clipping, no content limits, exactly what you see in the browser.
 *   Modern PDF readers (Preview, Acrobat, Chrome) scroll single-page PDFs
 *   just like any other document.
 *
 * Railway / Docker:
 *   --no-sandbox and --disable-dev-shm-usage are required for Chromium to
 *   run inside a container.
 */

'use strict';

const puppeteer = require('puppeteer');
const { generateReportHTML } = require('./report-template');

// Viewport width for rendering (A4 at 96dpi).
const VIEWPORT_WIDTH = 794;

async function generatePDF(reportData) {
  const html = generateReportHTML(reportData, { webView: false });

  const browser = await puppeteer.launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  try {
    const page = await browser.newPage();

    // Set viewport width to A4; height is generous — we measure the real
    // content height after rendering before generating the PDF.
    await page.setViewport({ width: VIEWPORT_WIDTH, height: 1080 });

    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Measure the full rendered content height so the PDF page matches it
    // exactly — no scrolling, no clipping.
    const contentHeight = await page.evaluate(
      () => document.documentElement.scrollHeight
    );

    const pdfBuffer = await page.pdf({
      width:           `${VIEWPORT_WIDTH}px`,
      height:          `${contentHeight + 2}px`, // +2px avoids sub-pixel rounding artifacts
      printBackground: true,
      margin:          { top: '0', right: '0', bottom: '0', left: '0' },
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

module.exports = { generatePDF };
