const express = require('express');
const { listInventory, createInventory } = require('../controllers/inventoryController');

const router = express.Router();

router.get('/', listInventory);
router.post('/', createInventory);

module.exports = router;
