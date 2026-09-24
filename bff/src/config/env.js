require('dotenv').config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',

  backendBaseUrl: required('BACKEND_BASE_URL', 'http://localhost:4001'),
  internalSharedSecret: required('INTERNAL_SHARED_SECRET', 'change-this-shared-secret'),
  frontendOrigin: required('FRONTEND_ORIGIN', 'http://localhost:3000'),

  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD || undefined
  },

  rateLimit: {
    points: Number(process.env.RATE_LIMIT_POINTS ?? 20),
    durationSeconds: Number(process.env.RATE_LIMIT_DURATION_SECONDS ?? 1)
  },

  orderCacheTtlSeconds: Number(process.env.ORDER_CACHE_TTL_SECONDS ?? 300)
};

module.exports = env;
