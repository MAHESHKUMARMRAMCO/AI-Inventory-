const { submitOrder } = require('../../commands/submitOrder/submitOrderHandler');
const { getOrderFulfillment } = require('../../queries/getOrderFulfillment/getOrderFulfillmentHandler');

async function postOrder(req, res, next) {
  try {
    const result = await submitOrder(req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function getOrder(req, res, next) {
  try {
    const result = await getOrderFulfillment(req.params.orderid);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { postOrder, getOrder };
