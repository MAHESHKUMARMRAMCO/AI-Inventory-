const { z } = require('zod');

const customerSchema = z.object({
  customerid: z.string({ required_error: 'is required' }).min(1),
  eligibilitystatus: z.enum(['Eligible', 'CreditHold', 'Unknown'], {
    errorMap: () => ({ message: "must be one of 'Eligible', 'CreditHold', 'Unknown'" })
  })
});

const inventorySchema = z.object({
  productid: z.string({ required_error: 'is required' }).min(1),
  warehouseid: z.enum(['WH-A', 'WH-B', 'WH-C'], {
    errorMap: () => ({ message: "must be one of 'WH-A', 'WH-B', 'WH-C'" })
  }),
  availablequantity: z
    .number({ required_error: 'is required', invalid_type_error: 'must be a number' })
    .int('must be an integer')
    .positive('must be greater than 0'),
  earliestdispatchdate: z
    .string({ required_error: 'is required' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'must match YYYY-MM-DD')
    .refine((val) => !Number.isNaN(Date.parse(val)), 'must be a valid calendar date')
});

module.exports = { customerSchema, inventorySchema };
