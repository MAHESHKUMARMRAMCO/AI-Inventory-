const customerRepository = require('../../repositories/customerRepository');
const { customerSchema } = require('../validation/customerInventorySchemas');
const { ValidationError } = require('../../errors');

function parseOrThrow(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message
    }));
    throw new ValidationError(details);
  }
  return result.data;
}

async function listCustomers(req, res, next) {
  try {
    const customers = await customerRepository.list();
    res.status(200).json(customers);
  } catch (err) {
    next(err);
  }
}

async function createCustomer(req, res, next) {
  try {
    const data = parseOrThrow(customerSchema, req.body);
    await customerRepository.upsert(data.customerid, data.eligibilitystatus);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = { listCustomers, createCustomer };
