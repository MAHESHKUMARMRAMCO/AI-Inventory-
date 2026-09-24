const createApp = require('./app');
const env = require('./config/env');
const persistEventLogHandler = require('./events/handlers/persistEventLogHandler');

persistEventLogHandler.register();

const app = createApp();

app.listen(env.port, () => {
  console.log(`[backend] M08945 order-fulfillment backend listening on port ${env.port}`);
});
