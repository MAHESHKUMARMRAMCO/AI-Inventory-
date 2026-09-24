const orderRepository = require('../../repositories/orderRepository');

async function applyInventoryAvailability(req, res, next) {
  try {
    const { productId, warehouseId, availableQuantity } = req.body;
    const result = await orderRepository.applyInventoryAvailability({
      productid: productId,
      warehouseid: warehouseId,
      availablequantity: availableQuantity
    });

    if (!result) {
      return res.status(200).json({
        orderId: null,
        backorderStatus: 'NoOpenBackorder',
        releasedQuantity: 0,
        backorderedQuantity: 0,
        allocation: null
      });
    }

    res.status(200).json({
      orderId: result.orderid,
      backorderStatus: result.backorderstatus,
      releasedQuantity: result.releasedquantity,
      backorderedQuantity: result.backorderedquantity,
      allocation: {
        warehouseId: result.allocation.warehouseid,
        allocatedQuantity: result.allocation.allocatedquantity
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { applyInventoryAvailability };
