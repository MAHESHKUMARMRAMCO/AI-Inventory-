const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const env = require('./config/env');
const errorHandler = require('./api/middleware/errorHandler');
const ordersRouter = require('./api/routes/orders.routes');
const customersRouter = require('./api/routes/customers.routes');
const inventoryRouter = require('./api/routes/inventory.routes');
const inventoryAvailabilityRouter = require('./api/routes/inventoryAvailability.routes');

function createApp() {
  const app = express();

  app.set('trust proxy', true);
  app.use(helmet());
  // The frontend (a different origin: its own dev server/host) is the only
  // browser client allowed to call this BFF cross-origin.
  app.use(cors({ origin: env.frontendOrigin }));
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/orders', ordersRouter);
  app.use('/customers', customersRouter);
  app.use('/inventory', inventoryRouter);
  app.use('/inventory-availability', inventoryAvailabilityRouter);

  app.use((req, res) => {
    res.status(404).json({ error: 'not_found' });
  });

  app.use(errorHandler);

  return app;
}

module.exports = createApp;
