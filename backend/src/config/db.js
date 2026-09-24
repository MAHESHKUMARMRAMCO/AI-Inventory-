const sql = require('mssql');
const env = require('./env');

let poolPromise = null;

function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool({
      server: env.db.server,
      port: env.db.port,
      database: env.db.database,
      user: env.db.user,
      password: env.db.password,
      options: {
        encrypt: env.db.encrypt,
        trustServerCertificate: env.db.trustServerCertificate
      },
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
      }
    })
      .connect()
      .catch((err) => {
        poolPromise = null;
        throw err;
      });
  }
  return poolPromise;
}

async function closePool() {
  if (poolPromise) {
    const pool = await poolPromise.catch(() => null);
    if (pool) await pool.close();
    poolPromise = null;
  }
}

module.exports = { sql, getPool, closePool };
