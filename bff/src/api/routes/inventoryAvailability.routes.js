const express = require('express');
const { applyInventoryAvailability } = require('../controllers/inventoryAvailabilityController');
const validateRequest = require('../middleware/validateRequest');
const { inventoryAvailabilitySchema } = require('../validation/inventoryAvailabilitySchema');
const rateLimiter = require('../middleware/rateLimiter');

const router = express.Router();

router.use(rateLimiter);
router.post('/', validateRequest(inventoryAvailabilitySchema), applyInventoryAvailability);

module.exports = router;
