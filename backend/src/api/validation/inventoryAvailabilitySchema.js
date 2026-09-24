const { z } = require('zod');

const inventoryAvailabilitySchema = z.object({
  productId: z.string({ required_error: 'is required' }).min(1),
  warehouseId: z.enum(['WH-A', 'WH-B', 'WH-C']),
  availableQuantity: z.number({ required_error: 'is required' }).int().positive()
});

module.exports = { inventoryAvailabilitySchema };
