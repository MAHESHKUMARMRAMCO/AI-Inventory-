const express = require('express');
const { listInventory, createInventory } = require('../controllers/inventoryController');
const validateRequest = require('../middleware/validateRequest');
const { inventorySchema } = require('../validation/customerInventorySchemas');
const rateLimiter = require('../middleware/rateLimiter');

const router = express.Router();

router.use(rateLimiter);
router.get('/', listInventory);
router.post('/', validateRequest(inventorySchema), createInventory);

module.exports = router;
