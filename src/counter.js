/**
 * Audit counter — persisted in Railway Redis.
 *
 * Key: "audit_count"
 * Seeded to SEED_COUNT on first use so the real count continues
 * from a believable starting number.
 */

const Redis = require('ioredis');

const SEED_COUNT = 1247;
const KEY = 'audit_count';

let _client = null;

function getClient() {
  if (!_client) {
    if (!process.env.REDIS_URL) {
      throw new Error('REDIS_URL environment variable is not set');
    }
    _client = new Redis(process.env.REDIS_URL);
    _client.on('error', err => console.error('[counter] Redis error:', err.message));
  }
  return _client;
}

/**
 * Increment the audit counter by 1 and return the new value.
 * Seeds to SEED_COUNT if the key doesn't exist yet.
 */
async function incrementAuditCount() {
  const client = getClient();
  // SET key SEED_COUNT only if it doesn't exist, then INCR atomically
  await client.setnx(KEY, SEED_COUNT);
  const count = await client.incr(KEY);
  return count;
}

/**
 * Get the current audit count without incrementing.
 * Returns SEED_COUNT if the key hasn't been set yet.
 */
async function getAuditCount() {
  const client = getClient();
  const val = await client.get(KEY);
  return val ? parseInt(val, 10) : SEED_COUNT;
}

module.exports = { incrementAuditCount, getAuditCount };
