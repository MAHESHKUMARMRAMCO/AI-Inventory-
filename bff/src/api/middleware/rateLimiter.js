const { RateLimiterRedis, RateLimiterRes } = require('rate-limiter-flexible');
const { getRedisClient } = require('../../config/redis');
const env = require('../../config/env');
const { RateLimitedError } = require('../../errors');

let limiter = null;

function getLimiter() {
  if (!limiter) {
    limiter = new RateLimiterRedis({
      storeClient: getRedisClient(),
      keyPrefix: 'bff:ratelimit',
      points: env.rateLimit.points,
      duration: env.rateLimit.durationSeconds
    });
  }
  return limiter;
}

async function rateLimiter(req, res, next) {
  try {
    await getLimiter().consume(req.ip);
    return next();
  } catch (err) {
    if (err instanceof RateLimiterRes) {
      return next(new RateLimitedError());
    }
    // Redis itself is unavailable — fail open so a Redis outage doesn't take
    // down all traffic; the backend's own breaker still protects it.
    console.error('[rateLimiter] store error, failing open:', err.message);
    return next();
  }
}

module.exports = rateLimiter;
