const express = require('express');
const { listCustomers, createCustomer } = require('../controllers/customersController');

const router = express.Router();

router.get('/', listCustomers);
router.post('/', createCustomer);

module.exports = router;
