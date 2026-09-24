const backendClient = require('../../client/backendClient');
const { UpstreamResponseError } = require('../../errors');

async function listInventory(req, res, next) {
  try {
    const result = await backendClient.listInventory();
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof UpstreamResponseError) {
      return res.status(err.statusCode).json(err.body);
    }
    next(err);
  }
}

async function createInventory(req, res, next) {
  try {
    const result = await backendClient.createInventory(req.body);
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof UpstreamResponseError) {
      return res.status(err.statusCode).json(err.body);
    }
    next(err);
  }
}

module.exports = { listInventory, createInventory };
