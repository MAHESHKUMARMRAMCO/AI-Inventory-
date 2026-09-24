require('dotenv').config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const env = {
  port: Number(process.env.PORT ?? 4001),
  nodeEnv: process.env.NODE_ENV ?? 'development',

  db: {
    server: required('DB_SERVER', 'localhost'),
    port: Number(process.env.DB_PORT ?? 1433),
    database: required('DB_NAME', 'M08945_orderfulfillment'),
    user: required('DB_USER', 'sa'),
    password: required('DB_PASSWORD', 'changeme'),
    encrypt: (process.env.DB_ENCRYPT ?? 'true') === 'true',
    trustServerCertificate: (process.env.DB_TRUST_SERVER_CERTIFICATE ?? 'true') === 'true'
  },

  internalSharedSecret: required('INTERNAL_SHARED_SECRET', 'change-this-shared-secret'),

  // CHANGE1: Priority orders below this % of requested qty (summed, date-feasible
  // stock across WH-A/B/C) are Blocked instead of partially released.
  priorityPartialThresholdPercent: Number(process.env.PRIORITY_PARTIAL_THRESHOLD_PERCENT ?? 70)
};

module.exports = env;
