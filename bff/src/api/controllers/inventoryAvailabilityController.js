const backendClient = require('../../client/backendClient');
const { UpstreamResponseError } = require('../../errors');

async function applyInventoryAvailability(req, res, next) {
  try {
    const result = await backendClient.applyInventoryAvailability(req.body);
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof UpstreamResponseError) {
      return res.status(err.statusCode).json(err.body);
    }
    next(err);
  }
}

module.exports = { applyInventoryAvailability };
