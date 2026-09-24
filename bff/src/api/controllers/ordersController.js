const backendClient = require('../../client/backendClient');
const orderCache = require('../../cache/orderCache');
const { UpstreamResponseError } = require('../../errors');

async function postOrder(req, res, next) {
  try {
    const result = await backendClient.submitOrder(req.body);
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof UpstreamResponseError) {
      return res.status(err.statusCode).json(err.body);
    }
    next(err);
  }
}

async function getOrder(req, res, next) {
  const { orderid } = req.params;

  try {
    const cached = await orderCache.getCachedOrder(orderid);
    if (cached) {
      return res.status(200).json(cached);
    }
  } catch (err) {
    console.error('[orderCache] read failed, falling back to backend:', err.message);
  }

  try {
    const result = await backendClient.getOrder(orderid);
    orderCache.setCachedOrder(orderid, result).catch((err) => {
      console.error('[orderCache] write failed:', err.message);
    });
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof UpstreamResponseError) {
      // Never cache a 404 — the order may just not exist yet.
      return res.status(err.statusCode).json(err.body);
    }
    next(err);
  }
}

module.exports = { postOrder, getOrder };
