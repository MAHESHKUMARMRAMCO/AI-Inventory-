const express = require('express');
const { listCustomers, createCustomer } = require('../controllers/customersController');
const validateRequest = require('../middleware/validateRequest');
const { customerSchema } = require('../validation/customerInventorySchemas');
const rateLimiter = require('../middleware/rateLimiter');

const router = express.Router();

router.use(rateLimiter);
router.get('/', listCustomers);
router.post('/', validateRequest(customerSchema), createCustomer);

module.exports = router;
