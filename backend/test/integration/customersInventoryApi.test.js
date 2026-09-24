process.env.INTERNAL_SHARED_SECRET = 'test-secret';

jest.mock('../../src/repositories/customerRepository');
jest.mock('../../src/repositories/inventoryRepository');

const request = require('supertest');
const createApp = require('../../src/app');
const customerRepository = require('../../src/repositories/customerRepository');
const inventoryRepository = require('../../src/repositories/inventoryRepository');

const app = createApp();
const TOKEN = 'test-secret';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /internal/customers', () => {
  it('requires the internal token', async () => {
    const res = await request(app).get('/internal/customers');
    expect(res.status).toBe(401);
  });

  it('returns the list of customers', async () => {
    customerRepository.list.mockResolvedValue([
      { customerid: 'cust001', eligibilitystatus: 'Eligible' },
      { customerid: 'cust002', eligibilitystatus: 'CreditHold' }
    ]);

    const res = await request(app).get('/internal/customers').set('X-Internal-Token', TOKEN);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { customerid: 'cust001', eligibilitystatus: 'Eligible' },
      { customerid: 'cust002', eligibilitystatus: 'CreditHold' }
    ]);
  });
});

describe('POST /internal/customers', () => {
  it('creates a customer and returns 201', async () => {
    customerRepository.upsert.mockResolvedValue();

    const res = await request(app)
      .post('/internal/customers')
      .set('X-Internal-Token', TOKEN)
      .send({ customerid: 'cust003', eligibilitystatus: 'Unknown' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ customerid: 'cust003', eligibilitystatus: 'Unknown' });
    expect(customerRepository.upsert).toHaveBeenCalledWith('cust003', 'Unknown');
  });

  it('returns 400 validation_error for an invalid eligibilitystatus', async () => {
    const res = await request(app)
      .post('/internal/customers')
      .set('X-Internal-Token', TOKEN)
      .send({ customerid: 'cust003', eligibilitystatus: 'Active' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });
});

describe('GET /internal/inventory', () => {
  it('returns the list of inventory rows with dates as YYYY-MM-DD strings', async () => {
    inventoryRepository.list.mockResolvedValue([
      { productid: 'prod01', warehouseid: 'WH-A', availablequantity: 10, earliestdispatchdate: new Date('2026-09-01T00:00:00.000Z') },
      { productid: 'prod01', warehouseid: 'WH-B', availablequantity: 100, earliestdispatchdate: '2026-09-01' }
    ]);

    const res = await request(app).get('/internal/inventory').set('X-Internal-Token', TOKEN);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { productid: 'prod01', warehouseid: 'WH-A', availablequantity: 10, earliestdispatchdate: '2026-09-01' },
      { productid: 'prod01', warehouseid: 'WH-B', availablequantity: 100, earliestdispatchdate: '2026-09-01' }
    ]);
  });
});

describe('POST /internal/inventory', () => {
  it('creates an inventory row and returns 201', async () => {
    inventoryRepository.upsert.mockResolvedValue();
    const payload = { productid: 'prod01', warehouseid: 'WH-A', availablequantity: 50, earliestdispatchdate: '2026-09-01' };

    const res = await request(app).post('/internal/inventory').set('X-Internal-Token', TOKEN).send(payload);

    expect(res.status).toBe(201);
    expect(res.body).toEqual(payload);
    expect(inventoryRepository.upsert).toHaveBeenCalledWith(payload);
  });

  it('returns 400 validation_error for a non-positive availablequantity', async () => {
    const res = await request(app)
      .post('/internal/inventory')
      .set('X-Internal-Token', TOKEN)
      .send({ productid: 'prod01', warehouseid: 'WH-A', availablequantity: 0, earliestdispatchdate: '2026-09-01' });

    expect(res.status).toBe(400);
  });

  it("returns 400 validation_error for a warehouseid that isn't WH-A/WH-B/WH-C", async () => {
    const res = await request(app)
      .post('/internal/inventory')
      .set('X-Internal-Token', TOKEN)
      .send({ productid: 'prod01', warehouseid: 'WH-D', availablequantity: 10, earliestdispatchdate: '2026-09-01' });

    expect(res.status).toBe(400);
  });
});
