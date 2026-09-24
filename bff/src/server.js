const createApp = require('./app');
const env = require('./config/env');

const app = createApp();

app.listen(env.port, () => {
  console.log(`[bff] M08945 order-fulfillment BFF listening on port ${env.port}`);
});
