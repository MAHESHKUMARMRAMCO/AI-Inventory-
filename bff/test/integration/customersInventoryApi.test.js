jest.mock('../../src/client/backendClient');
jest.mock('../../src/api/middleware/rateLimiter', () => (req, res, next) => next());

const request = require('supertest');
const createApp = require('../../src/app');
const backendClient = require('../../src/client/backendClient');

const app = createApp();

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /customers', () => {
  it('proxies the list from the backend', async () => {
    backendClient.listCustomers.mockResolvedValue([{ customerid: 'cust001', eligibilitystatus: 'Eligible' }]);
    const res = await request(app).get('/customers');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ customerid: 'cust001', eligibilitystatus: 'Eligible' }]);
  });
});

describe('POST /customers', () => {
  it('returns 400 validation_error for an invalid eligibilitystatus, without calling the backend', async () => {
    const res = await request(app).post('/customers').send({ customerid: 'cust001', eligibilitystatus: 'Active' });
    expect(res.status).toBe(400);
    expect(backendClient.createCustomer).not.toHaveBeenCalled();
  });

  it('proxies a successful create with 201', async () => {
    const payload = { customerid: 'cust001', eligibilitystatus: 'Eligible' };
    backendClient.createCustomer.mockResolvedValue(payload);
    const res = await request(app).post('/customers').send(payload);
    expect(res.status).toBe(201);
    expect(res.body).toEqual(payload);
  });
});

describe('GET /inventory', () => {
  it('proxies the list from the backend', async () => {
    const rows = [{ productid: 'prod01', warehouseid: 'WH-A', availablequantity: 10, earliestdispatchdate: '2026-09-01' }];
    backendClient.listInventory.mockResolvedValue(rows);
    const res = await request(app).get('/inventory');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(rows);
  });
});

describe('POST /inventory', () => {
  it("returns 400 validation_error for a warehouseid that isn't WH-A/WH-B/WH-C", async () => {
    const res = await request(app)
      .post('/inventory')
      .send({ productid: 'prod01', warehouseid: 'WH-D', availablequantity: 10, earliestdispatchdate: '2026-09-01' });
    expect(res.status).toBe(400);
    expect(backendClient.createInventory).not.toHaveBeenCalled();
  });

  it('proxies a successful create with 201', async () => {
    const payload = { productid: 'prod01', warehouseid: 'WH-A', availablequantity: 10, earliestdispatchdate: '2026-09-01' };
    backendClient.createInventory.mockResolvedValue(payload);
    const res = await request(app).post('/inventory').send(payload);
    expect(res.status).toBe(201);
    expect(res.body).toEqual(payload);
  });
});
