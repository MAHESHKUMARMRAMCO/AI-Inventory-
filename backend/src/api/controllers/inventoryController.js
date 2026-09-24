const inventoryRepository = require('../../repositories/inventoryRepository');
const { inventorySchema } = require('../validation/customerInventorySchemas');
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

// mssql returns a DATE column as a JS Date — serialize back to YYYY-MM-DD for the API contract.
function toDateOnlyString(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

async function listInventory(req, res, next) {
  try {
    const rows = await inventoryRepository.list();
    res.status(200).json(
      rows.map((row) => ({
        ...row,
        earliestdispatchdate: toDateOnlyString(row.earliestdispatchdate)
      }))
    );
  } catch (err) {
    next(err);
  }
}

async function createInventory(req, res, next) {
  try {
    const data = parseOrThrow(inventorySchema, req.body);
    await inventoryRepository.upsert(data);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = { listInventory, createInventory };
