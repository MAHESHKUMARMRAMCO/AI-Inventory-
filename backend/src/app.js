const express = require('express');
const helmet = require('helmet');
const internalAuth = require('./api/middleware/internalAuth');
const errorHandler = require('./api/middleware/errorHandler');
const ordersRouter = require('./api/routes/orders.routes');
const customersRouter = require('./api/routes/customers.routes');
const inventoryRouter = require('./api/routes/inventory.routes');
const inventoryAvailabilityRouter = require('./api/routes/inventoryAvailability.routes');

function createApp() {
  const app = express();

  app.use(helmet());
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/internal/orders', internalAuth, ordersRouter);
  app.use('/internal/customers', internalAuth, customersRouter);
  app.use('/internal/inventory', internalAuth, inventoryRouter);
  app.use('/internal/inventory-availability', internalAuth, inventoryAvailabilityRouter);

  app.use((req, res) => {
    res.status(404).json({ error: 'not_found' });
  });

  app.use(errorHandler);

  return app;
}

module.exports = createApp;
