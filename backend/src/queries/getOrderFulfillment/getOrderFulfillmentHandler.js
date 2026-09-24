const orderRepository = require('../../repositories/orderRepository');
const { OrderNotFoundError } = require('../../errors');

async function getOrderFulfillment(orderid) {
  const order = await orderRepository.getById(orderid);
  if (!order) {
    throw new OrderNotFoundError(orderid);
  }
  return order;
}

module.exports = { getOrderFulfillment };
