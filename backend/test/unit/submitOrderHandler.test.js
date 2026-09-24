jest.mock('../../src/repositories/customerRepository');
jest.mock('../../src/repositories/inventoryRepository');
jest.mock('../../src/repositories/orderRepository');

const customerRepository = require('../../src/repositories/customerRepository');
const inventoryRepository = require('../../src/repositories/inventoryRepository');
const orderRepository = require('../../src/repositories/orderRepository');
const eventBus = require('../../src/events/eventBus');
const { ORDER_SUBMITTED, ORDER_RELEASED, ORDER_BLOCKED } = require('../../src/events/eventTypes');
const { submitOrder } = require('../../src/commands/submitOrder/submitOrderHandler');

const baseOrder = {
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

describe('submitOrder', () => {
  it('returns the stored result unchanged on idempotent resubmission, without touching customer/inventory', async () => {
    const storedResult = { orderid: 'ord1001', status: 'Released', reason: null, releasedquantity: 60, backorderedquantity: 0, allocations: [{ warehouseid: 'WH-B', allocatedquantity: 60 }] };
    orderRepository.getById.mockResolvedValue(storedResult);

    const result = await submitOrder(baseOrder);

    expect(result).toEqual(storedResult);
    expect(customerRepository.getById).not.toHaveBeenCalled();
    expect(inventoryRepository.getByProductId).not.toHaveBeenCalled();
    expect(orderRepository.tryCreateReleased).not.toHaveBeenCalled();
    expect(orderRepository.createBlocked).not.toHaveBeenCalled();
  });

  it('blocks with blocked-credithold for a CreditHold customer, without checking inventory', async () => {
    customerRepository.getById.mockResolvedValue({ customerid: 'cust001', eligibilitystatus: 'CreditHold' });
    orderRepository.createBlocked.mockResolvedValue({
      orderid: 'ord1001', status: 'Blocked', reason: 'blocked-credithold', releasedquantity: 0, backorderedquantity: 60, allocations: []
    });

    const result = await submitOrder(baseOrder);

    expect(result.status).toBe('Blocked');
    expect(result.reason).toBe('blocked-credithold');
    expect(inventoryRepository.getByProductId).not.toHaveBeenCalled();
    expect(orderRepository.createBlocked).toHaveBeenCalledWith(baseOrder, 'blocked-credithold', 60);
  });

  it('blocks with blocked-eligibilityunknown for an Unknown customer', async () => {
    customerRepository.getById.mockResolvedValue({ customerid: 'cust001', eligibilitystatus: 'Unknown' });
    orderRepository.createBlocked.mockResolvedValue({
      orderid: 'ord1001', status: 'Blocked', reason: 'blocked-eligibilityunknown', releasedquantity: 0, backorderedquantity: 60, allocations: []
    });

    const result = await submitOrder(baseOrder);

    expect(result.reason).toBe('blocked-eligibilityunknown');
  });

  it('blocks with blocked-eligibilityunknown when the customer does not exist at all', async () => {
    customerRepository.getById.mockResolvedValue(null);
    orderRepository.createBlocked.mockResolvedValue({
      orderid: 'ord1001', status: 'Blocked', reason: 'blocked-eligibilityunknown', releasedquantity: 0, backorderedquantity: 60, allocations: []
    });

    const result = await submitOrder(baseOrder);

    expect(result.reason).toBe('blocked-eligibilityunknown');
  });

  it('releases the order from the warehouse selectWarehouse picks, for an Eligible customer', async () => {
    customerRepository.getById.mockResolvedValue({ customerid: 'cust001', eligibilitystatus: 'Eligible' });
    inventoryRepository.getByProductId.mockResolvedValue([
      { warehouseid: 'WH-A', availablequantity: 10, earliestdispatchdate: '2026-09-01' },
      { warehouseid: 'WH-B', availablequantity: 100, earliestdispatchdate: '2026-09-01' }
    ]);
    const releasedResult = { orderid: 'ord1001', status: 'Released', reason: null, releasedquantity: 60, backorderedquantity: 0, allocations: [{ warehouseid: 'WH-B', allocatedquantity: 60 }] };
    orderRepository.tryCreateReleased.mockResolvedValue(releasedResult);

    const result = await submitOrder(baseOrder);

    expect(result).toEqual(releasedResult);
    expect(orderRepository.tryCreateReleased).toHaveBeenCalledWith({ ...baseOrder, warehouseid: 'WH-B' });
  });

  it('blocks with blocked-nowarehouseavailable when no warehouse satisfies quantity+date for an Eligible customer', async () => {
    customerRepository.getById.mockResolvedValue({ customerid: 'cust001', eligibilitystatus: 'Eligible' });
    inventoryRepository.getByProductId.mockResolvedValue([
      { warehouseid: 'WH-A', availablequantity: 1, earliestdispatchdate: '2026-09-01' }
    ]);
    orderRepository.createBlocked.mockResolvedValue({
      orderid: 'ord1001', status: 'Blocked', reason: 'blocked-nowarehouseavailable', releasedquantity: 0, backorderedquantity: 60, allocations: []
    });

    const result = await submitOrder(baseOrder);

    expect(result.reason).toBe('blocked-nowarehouseavailable');
  });

  it('retries the allocation once and succeeds when the first attempt loses a stock race', async () => {
    customerRepository.getById.mockResolvedValue({ customerid: 'cust001', eligibilitystatus: 'Eligible' });
    inventoryRepository.getByProductId.mockResolvedValue([
      { warehouseid: 'WH-A', availablequantity: 100, earliestdispatchdate: '2026-09-01' }
    ]);
    const releasedResult = { orderid: 'ord1001', status: 'Released', reason: null, releasedquantity: 60, backorderedquantity: 0, allocations: [{ warehouseid: 'WH-A', allocatedquantity: 60 }] };
    orderRepository.tryCreateReleased.mockResolvedValueOnce(null).mockResolvedValueOnce(releasedResult);

    const result = await submitOrder(baseOrder);

    expect(result).toEqual(releasedResult);
    expect(orderRepository.tryCreateReleased).toHaveBeenCalledTimes(2);
  });

  it('blocks with blocked-nowarehouseavailable after exhausting retries against a persistent race', async () => {
    customerRepository.getById.mockResolvedValue({ customerid: 'cust001', eligibilitystatus: 'Eligible' });
    inventoryRepository.getByProductId.mockResolvedValue([
      { warehouseid: 'WH-A', availablequantity: 100, earliestdispatchdate: '2026-09-01' }
    ]);
    orderRepository.tryCreateReleased.mockResolvedValue(null);
    orderRepository.createBlocked.mockResolvedValue({
      orderid: 'ord1001', status: 'Blocked', reason: 'blocked-nowarehouseavailable', releasedquantity: 0, backorderedquantity: 60, allocations: []
    });

    const result = await submitOrder(baseOrder);

    expect(result.reason).toBe('blocked-nowarehouseavailable');
    expect(orderRepository.tryCreateReleased).toHaveBeenCalledTimes(2);
  });

  it('emits OrderSubmitted then OrderReleased on the event bus for a released order', async () => {
    const emitted = [];
    const spy = jest.spyOn(eventBus, 'emit').mockImplementation((eventName) => emitted.push(eventName));

    customerRepository.getById.mockResolvedValue({ customerid: 'cust001', eligibilitystatus: 'Eligible' });
    inventoryRepository.getByProductId.mockResolvedValue([
      { warehouseid: 'WH-A', availablequantity: 100, earliestdispatchdate: '2026-09-01' }
    ]);
    orderRepository.tryCreateReleased.mockResolvedValue({ orderid: 'ord1001', status: 'Released', reason: null, releasedquantity: 60, backorderedquantity: 0, allocations: [] });

    await submitOrder(baseOrder);

    expect(emitted).toEqual([ORDER_SUBMITTED, ORDER_RELEASED]);
    spy.mockRestore();
  });

  it('emits OrderSubmitted then OrderBlocked on the event bus for a blocked order', async () => {
    const emitted = [];
    const spy = jest.spyOn(eventBus, 'emit').mockImplementation((eventName) => emitted.push(eventName));

    customerRepository.getById.mockResolvedValue({ customerid: 'cust001', eligibilitystatus: 'CreditHold' });
    orderRepository.createBlocked.mockResolvedValue({ orderid: 'ord1001', status: 'Blocked', reason: 'blocked-credithold', releasedquantity: 0, backorderedquantity: 60, allocations: [] });

    await submitOrder(baseOrder);

    expect(emitted).toEqual([ORDER_SUBMITTED, ORDER_BLOCKED]);
    spy.mockRestore();
  });

  it('does not emit OrderSubmitted on an idempotent replay', async () => {
    const spy = jest.spyOn(eventBus, 'emit');
    orderRepository.getById.mockResolvedValue({ orderid: 'ord1001', status: 'Released', reason: null, releasedquantity: 60, backorderedquantity: 0, allocations: [] });

    await submitOrder(baseOrder);

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
