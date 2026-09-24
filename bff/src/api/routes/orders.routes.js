const express = require('express');
const { postOrder, getOrder } = require('../controllers/ordersController');
const validateRequest = require('../middleware/validateRequest');
const { submitOrderSchema } = require('../validation/orderSchemas');
const rateLimiter = require('../middleware/rateLimiter');

const router = express.Router();

router.use(rateLimiter);
router.post('/', validateRequest(submitOrderSchema), postOrder);
router.get('/:orderid', getOrder);

module.exports = router;
