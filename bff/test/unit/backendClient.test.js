const mockHttp = { post: jest.fn(), get: jest.fn() };
jest.mock('axios', () => ({ create: jest.fn(() => mockHttp) }));

const backendClient = require('../../src/client/backendClient');
const { UpstreamResponseError } = require('../../src/errors');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('backendClient.submitOrder', () => {
  it('returns the body on a 200 response', async () => {
    mockHttp.post.mockResolvedValue({ status: 200, data: { orderid: 'ord1001', status: 'Released' } });
    const result = await backendClient.submitOrder({ orderid: 'ord1001' });
    expect(result).toEqual({ orderid: 'ord1001', status: 'Released' });
    expect(mockHttp.post).toHaveBeenCalledWith('/internal/orders', { orderid: 'ord1001' });
  });

  it('throws UpstreamResponseError carrying the exact status/body on a 400', async () => {
    mockHttp.post.mockResolvedValue({
      status: 400,
      data: { error: 'validation_error', details: [{ field: 'quantity', message: 'must be greater than 0' }] }
    });
    await expect(backendClient.submitOrder({})).rejects.toMatchObject({
      statusCode: 400,
      body: { error: 'validation_error', details: [{ field: 'quantity', message: 'must be greater than 0' }] }
    });
  });

  it('rejects with an UpstreamResponseError instance', async () => {
    mockHttp.post.mockResolvedValue({ status: 401, data: { error: 'unauthorized' } });
    await expect(backendClient.submitOrder({})).rejects.toBeInstanceOf(UpstreamResponseError);
  });
});

describe('backendClient.getOrder', () => {
  it('returns the body on a 200 response', async () => {
    mockHttp.get.mockResolvedValue({ status: 200, data: { orderid: 'ord1001', status: 'Blocked' } });
    const result = await backendClient.getOrder('ord1001');
    expect(result).toEqual({ orderid: 'ord1001', status: 'Blocked' });
    expect(mockHttp.get).toHaveBeenCalledWith('/internal/orders/ord1001');
  });

  it('throws UpstreamResponseError(404, ...) verbatim when the backend reports not found', async () => {
    mockHttp.get.mockResolvedValue({ status: 404, data: { orderid: 'ord9999', error: 'order not found' } });
    await expect(backendClient.getOrder('ord9999')).rejects.toMatchObject({
      statusCode: 404,
      body: { orderid: 'ord9999', error: 'order not found' }
    });
  });

  it('URL-encodes the orderid path segment', async () => {
    mockHttp.get.mockResolvedValue({ status: 200, data: {} });
    await backendClient.getOrder('ord 1001/x');
    expect(mockHttp.get).toHaveBeenCalledWith('/internal/orders/ord%201001%2Fx');
  });
});

describe('backendClient.listCustomers / createCustomer', () => {
  it('returns the array on a 200 response', async () => {
    mockHttp.get.mockResolvedValue({ status: 200, data: [{ customerid: 'cust001', eligibilitystatus: 'Eligible' }] });
    const result = await backendClient.listCustomers();
    expect(result).toEqual([{ customerid: 'cust001', eligibilitystatus: 'Eligible' }]);
    expect(mockHttp.get).toHaveBeenCalledWith('/internal/customers');
  });

  it('returns the body on a 201 create response', async () => {
    const payload = { customerid: 'cust001', eligibilitystatus: 'Eligible' };
    mockHttp.post.mockResolvedValue({ status: 201, data: payload });
    const result = await backendClient.createCustomer(payload);
    expect(result).toEqual(payload);
    expect(mockHttp.post).toHaveBeenCalledWith('/internal/customers', payload);
  });

  it('throws UpstreamResponseError on a validation_error 400 from createCustomer', async () => {
    mockHttp.post.mockResolvedValue({ status: 400, data: { error: 'validation_error', details: [] } });
    await expect(backendClient.createCustomer({})).rejects.toBeInstanceOf(UpstreamResponseError);
  });
});

describe('backendClient.listInventory / createInventory', () => {
  it('returns the array on a 200 response', async () => {
    const rows = [{ productid: 'prod01', warehouseid: 'WH-A', availablequantity: 10, earliestdispatchdate: '2026-09-01' }];
    mockHttp.get.mockResolvedValue({ status: 200, data: rows });
    const result = await backendClient.listInventory();
    expect(result).toEqual(rows);
    expect(mockHttp.get).toHaveBeenCalledWith('/internal/inventory');
  });

  it('returns the body on a 201 create response', async () => {
    const payload = { productid: 'prod01', warehouseid: 'WH-A', availablequantity: 10, earliestdispatchdate: '2026-09-01' };
    mockHttp.post.mockResolvedValue({ status: 201, data: payload });
    const result = await backendClient.createInventory(payload);
    expect(result).toEqual(payload);
    expect(mockHttp.post).toHaveBeenCalledWith('/internal/inventory', payload);
  });
});
