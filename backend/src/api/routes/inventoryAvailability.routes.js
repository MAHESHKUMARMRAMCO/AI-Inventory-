const express = require('express');
const { applyInventoryAvailability } = require('../controllers/inventoryAvailabilityController');
const validateRequest = require('../middleware/validateRequest');
const { inventoryAvailabilitySchema } = require('../validation/inventoryAvailabilitySchema');

const router = express.Router();

router.post('/', validateRequest(inventoryAvailabilitySchema), applyInventoryAvailability);

module.exports = router;
