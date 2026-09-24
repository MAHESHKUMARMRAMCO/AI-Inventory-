process.env.INTERNAL_SHARED_SECRET = 'test-secret';

jest.mock('../../src/repositories/customerRepository');
jest.mock('../../src/repositories/inventoryRepository');
jest.mock('../../src/repositories/orderRepository');
jest.mock('../../src/repositories/eventlogRepository');

const request = require('supertest');
const createApp = require('../../src/app');
const customerRepository = require('../../src/repositories/customerRepository');
const inventoryRepository = require('../../src/repositories/inventoryRepository');
const orderRepository = require('../../src/repositories/orderRepository');

const app = createApp();
const TOKEN = 'test-secret';

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
  orderRepository.getById.mockResolvedValue(null);
});

describe('auth', () => {
  it('rejects requests with no X-Internal-Token with 401', async () => {
    const res = await request(app).post('/internal/orders').send(validOrder);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'unauthorized' });
  });

  it('rejects requests with the wrong X-Internal-Token with 401', async () => {
    const res = await request(app).post('/internal/orders').set('X-Internal-Token', 'wrong').send(validOrder);
    expect(res.status).toBe(401);
  });
});

describe('POST /internal/orders', () => {
  it('returns 400 validation_error for a missing field', async () => {
    const { quantity: _omit, ...bad } = validOrder;
    const res = await request(app).post('/internal/orders').set('X-Internal-Token', TOKEN).send(bad);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
    expect(res.body.details.some((d) => d.field === 'quantity')).toBe(true);
  });

  it('returns 400 validation_error for an invalid customertype literal', async () => {
    const res = await request(app)
      .post('/internal/orders')
      .set('X-Internal-Token', TOKEN)
      .send({ ...validOrder, customertype: 'priority' });
    expect(res.status).toBe(400);
  });

  it('returns 200 with a Released result when a warehouse can cover the order', async () => {
    customerRepository.getById.mockResolvedValue({ customerid: 'cust001', eligibilitystatus: 'Eligible' });
    inventoryRepository.getByProductId.mockResolvedValue([
      { warehouseid: 'WH-B', availablequantity: 100, earliestdispatchdate: '2026-09-01' }
    ]);
    orderRepository.tryCreateReleased.mockResolvedValue({
      orderid: 'ord1001',
      status: 'Released',
      reason: null,
      releasedquantity: 60,
      backorderedquantity: 0,
      allocations: [{ warehouseid: 'WH-B', allocatedquantity: 60 }]
    });

    const res = await request(app).post('/internal/orders').set('X-Internal-Token', TOKEN).send(validOrder);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      orderid: 'ord1001',
      status: 'Released',
      reason: null,
      releasedquantity: 60,
      backorderedquantity: 0,
      allocations: [{ warehouseid: 'WH-B', allocatedquantity: 60 }]
    });
  });

  it('returns 200 with a Blocked result and blocked-credithold reason for a CreditHold customer', async () => {
    customerRepository.getById.mockResolvedValue({ customerid: 'cust001', eligibilitystatus: 'CreditHold' });
    orderRepository.createBlocked.mockResolvedValue({
      orderid: 'ord1003',
      status: 'Blocked',
      reason: 'blocked-credithold',
      releasedquantity: 0,
      backorderedquantity: 0,
      allocations: []
    });

    const res = await request(app)
      .post('/internal/orders')
      .set('X-Internal-Token', TOKEN)
      .send({ ...validOrder, orderid: 'ord1003' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      orderid: 'ord1003',
      status: 'Blocked',
      reason: 'blocked-credithold',
      releasedquantity: 0,
      backorderedquantity: 0,
      allocations: []
    });
  });
});

describe('GET /internal/orders/:orderid', () => {
  it('returns 404 with the exact shape for an unknown orderid', async () => {
    orderRepository.getById.mockResolvedValue(null);

    const res = await request(app).get('/internal/orders/ord9999').set('X-Internal-Token', TOKEN);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ orderid: 'ord9999', error: 'order not found' });
  });

  it('returns 200 with the stored fulfillment result for a known orderid', async () => {
    orderRepository.getById.mockResolvedValue({
      orderid: 'ord1001',
      status: 'Released',
      reason: null,
      releasedquantity: 60,
      backorderedquantity: 0,
      allocations: [{ warehouseid: 'WH-B', allocatedquantity: 60 }]
    });

    const res = await request(app).get('/internal/orders/ord1001').set('X-Internal-Token', TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Released');
  });
});
