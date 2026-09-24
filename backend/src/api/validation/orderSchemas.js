const { z } = require('zod');

const dateYYYYMMDD = z
  .string({ required_error: 'is required', invalid_type_error: 'must be a string' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must match YYYY-MM-DD')
  .refine((val) => !Number.isNaN(Date.parse(val)), 'must be a valid calendar date');

const submitOrderSchema = z.object({
  orderid: z.string({ required_error: 'is required' }).min(1, 'must not be empty'),
  customerid: z.string({ required_error: 'is required' }).min(1, 'must not be empty'),
  customertype: z.enum(['Standard', 'Priority'], {
    errorMap: () => ({ message: "must be exactly 'Standard' or 'Priority'" })
  }),
  productid: z.string({ required_error: 'is required' }).min(1, 'must not be empty'),
  quantity: z
    .number({ required_error: 'is required', invalid_type_error: 'must be a number' })
    .int('must be an integer')
    .positive('must be greater than 0'),
  promiseddeliverydate: dateYYYYMMDD
});

module.exports = { submitOrderSchema };
