const Redis = require('ioredis');
const env = require('./env');

let client = null;

function getRedisClient() {
  if (!client) {
    client = new Redis({
      host: env.redis.host,
      port: env.redis.port,
      password: env.redis.password,
      maxRetriesPerRequest: 1,
      lazyConnect: false
    });
    client.on('error', (err) => {
      console.error('[redis] client error', err.message);
    });
  }
  return client;
}

module.exports = { getRedisClient };
