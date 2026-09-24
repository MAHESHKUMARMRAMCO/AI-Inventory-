const backendClient = require('../../client/backendClient');
const { UpstreamResponseError } = require('../../errors');

async function listCustomers(req, res, next) {
  try {
    const result = await backendClient.listCustomers();
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof UpstreamResponseError) {
      return res.status(err.statusCode).json(err.body);
    }
    next(err);
  }
}

async function createCustomer(req, res, next) {
  try {
    const result = await backendClient.createCustomer(req.body);
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof UpstreamResponseError) {
      return res.status(err.statusCode).json(err.body);
    }
    next(err);
  }
}

module.exports = { listCustomers, createCustomer };
