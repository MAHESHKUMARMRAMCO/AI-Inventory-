const { getRedisClient } = require('../config/redis');
const env = require('../config/env');

function cacheKey(orderid) {
  return `bff:order:${orderid}`;
}

/**
 * Cache-aside for GET /orders/:orderid. Only ever stores a successful
 * (Released or Blocked) decision — never a "not found" — because a decided
 * order's result is immutable (no cancel/reversal flow, idempotent
 * resubmission returns the same stored result), so a cache hit is always
 * correct regardless of TTL, and there is no invalidation to design around.
 */
async function getCachedOrder(orderid) {
  const redis = getRedisClient();
  const raw = await redis.get(cacheKey(orderid));
  return raw ? JSON.parse(raw) : null;
}

async function setCachedOrder(orderid, orderResult) {
  const redis = getRedisClient();
  await redis.set(cacheKey(orderid), JSON.stringify(orderResult), 'EX', env.orderCacheTtlSeconds);
}

module.exports = { getCachedOrder, setCachedOrder, cacheKey };
