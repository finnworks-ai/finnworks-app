/**
 * Report store — persists audit report JSON in Railway Redis by UUID.
 *
 * Key format: "report:{uuid}"
 * TTL: 14 days
 *
 * Used by:
 *   pipeline.js   → saveReport() after AI analysis
 *   server.js     → loadReport() on GET /report/:uuid
 */

'use strict';

const fs    = require('fs');
const path  = require('path');
const Redis = require('ioredis');

// Dev fixture — written whenever a report is saved locally (no Redis).
// Lets you iterate on the template without re-running the pipeline.
const DEV_FIXTURE = path.resolve('dev-report.json');

const KEY_PREFIX = 'report:';
const TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days

// In-memory fallback used when REDIS_URL is not set (local development).
// Reports survive for the lifetime of the Node process only.
const _memStore = new Map();

let _client = null;

function getClient() {
  if (!_client) {
    if (!process.env.REDIS_URL) return null; // signal: use in-memory fallback
    _client = new Redis(process.env.REDIS_URL);
    _client.on('error', err => console.error('[report-store] Redis error:', err.message));
  }
  return _client;
}

/**
 * Persist a report. reportData should contain:
 *   { uuid, websiteUrl, customerEmail, generatedAt, overallScore,
 *     sections, actionPlan, topWins }
 */
async function saveReport(uuid, reportData) {
  const client = getClient();
  if (!client) {
    const raw = JSON.stringify(reportData);
    _memStore.set(uuid, raw);
    fs.writeFileSync(DEV_FIXTURE, JSON.stringify(reportData, null, 2));
    console.warn(`[report-store] REDIS_URL not set — stored in memory and saved to ${DEV_FIXTURE}`);
    return;
  }
  await client.set(`${KEY_PREFIX}${uuid}`, JSON.stringify(reportData), 'EX', TTL_SECONDS);
}

/**
 * Load a report by UUID. Returns null if not found or expired.
 */
async function loadReport(uuid) {
  const client = getClient();
  if (!client) {
    const raw = _memStore.get(uuid);
    return raw ? JSON.parse(raw) : null;
  }
  const raw = await client.get(`${KEY_PREFIX}${uuid}`);
  return raw ? JSON.parse(raw) : null;
}

/**
 * Get remaining TTL in seconds for a report UUID.
 * Returns -1 when using the in-memory fallback (no expiry tracked).
 */
async function getReportTTL(uuid) {
  const client = getClient();
  if (!client) return _memStore.has(uuid) ? -1 : -2;
  return client.ttl(`${KEY_PREFIX}${uuid}`);
}

module.exports = { saveReport, loadReport, getReportTTL };
