const express = require('express');
const { postOrder, getOrder } = require('../controllers/ordersController');
const validateRequest = require('../middleware/validateRequest');
const { submitOrderSchema } = require('../validation/orderSchemas');

const router = express.Router();

router.post('/', validateRequest(submitOrderSchema), postOrder);
router.get('/:orderid', getOrder);

module.exports = router;
