jest.mock('../../src/client/backendClient');
jest.mock('../../src/cache/orderCache');
jest.mock('../../src/api/middleware/rateLimiter', () => (req, res, next) => next());

const request = require('supertest');
const createApp = require('../../src/app');
const backendClient = require('../../src/client/backendClient');
const orderCache = require('../../src/cache/orderCache');
const { UpstreamResponseError, ServiceUnavailableError } = require('../../src/errors');

const app = createApp();

const validOrder = {
  orderid: 'ord1001',
  customerid: 'cust001',
  customertype: 'Standard',
  productid: 'prod01',
  quantity: 60,
  promiseddeliverydate: '2026-09-25'
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CORS', () => {
  it('allows cross-origin requests from the configured frontend origin', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://localhost:3000');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });
});

describe('POST /orders', () => {
  it('returns 400 validation_error for an invalid customertype literal, without calling the backend', async () => {
    const res = await request(app).post('/orders').send({ ...validOrder, customertype: 'priority' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
    expect(backendClient.submitOrder).not.toHaveBeenCalled();
  });

  it('returns 400 validation_error for a missing field, without calling the backend', async () => {
    const { quantity: _omit, ...bad } = validOrder;
    const res = await request(app).post('/orders').send(bad);
    expect(res.status).toBe(400);
    expect(backendClient.submitOrder).not.toHaveBeenCalled();
  });

  it('proxies a Released 200 result from the backend verbatim', async () => {
    const backendResult = {
      orderid: 'ord1001',
      status: 'Released',
      reason: null,
      releasedquantity: 60,
      backorderedquantity: 0,
      allocations: [{ warehouseid: 'WH-B', allocatedquantity: 60 }]
    };
    backendClient.submitOrder.mockResolvedValue(backendResult);

    const res = await request(app).post('/orders').send(validOrder);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(backendResult);
  });

  it('proxies a Blocked 200 result from the backend verbatim', async () => {
    const backendResult = {
      orderid: 'ord1003',
      status: 'Blocked',
      reason: 'blocked-credithold',
      releasedquantity: 0,
      backorderedquantity: 0,
      allocations: []
    };
    backendClient.submitOrder.mockResolvedValue(backendResult);

    const res = await request(app).post('/orders').send({ ...validOrder, orderid: 'ord1003' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(backendResult);
  });

  it('returns 503 service_unavailable when the backend circuit breaker is open', async () => {
    backendClient.submitOrder.mockRejectedValue(new ServiceUnavailableError());

    const res = await request(app).post('/orders').send(validOrder);

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: 'service_unavailable' });
  });
});

describe('GET /orders/:orderid', () => {
  it('returns a cached result with 200 and never calls the backend on a cache hit', async () => {
    orderCache.getCachedOrder.mockResolvedValue({
      orderid: 'ord1001',
      status: 'Released',
      reason: null,
      releasedquantity: 60,
      backorderedquantity: 0,
      allocations: []
    });

    const res = await request(app).get('/orders/ord1001');

    expect(res.status).toBe(200);
    expect(backendClient.getOrder).not.toHaveBeenCalled();
  });

  it('falls through to the backend on a cache miss and populates the cache', async () => {
    orderCache.getCachedOrder.mockResolvedValue(null);
    const backendResult = {
      orderid: 'ord1001',
      status: 'Released',
      reason: null,
      releasedquantity: 60,
      backorderedquantity: 0,
      allocations: []
    };
    backendClient.getOrder.mockResolvedValue(backendResult);
    orderCache.setCachedOrder.mockResolvedValue();

    const res = await request(app).get('/orders/ord1001');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(backendResult);
    expect(orderCache.setCachedOrder).toHaveBeenCalledWith('ord1001', backendResult);
  });

  it('returns 404 verbatim and never caches it, when the backend reports order not found', async () => {
    orderCache.getCachedOrder.mockResolvedValue(null);
    backendClient.getOrder.mockRejectedValue(
      new UpstreamResponseError(404, { orderid: 'ord9999', error: 'order not found' })
    );

    const res = await request(app).get('/orders/ord9999');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ orderid: 'ord9999', error: 'order not found' });
    expect(orderCache.setCachedOrder).not.toHaveBeenCalled();
  });

  it('returns 503 when the backend circuit breaker is open', async () => {
    orderCache.getCachedOrder.mockResolvedValue(null);
    backendClient.getOrder.mockRejectedValue(new ServiceUnavailableError());

    const res = await request(app).get('/orders/ord1001');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: 'service_unavailable' });
  });
});
