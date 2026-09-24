jest.mock('../../src/config/redis');

const { getRedisClient } = require('../../src/config/redis');
const { getCachedOrder, setCachedOrder, cacheKey } = require('../../src/cache/orderCache');

describe('orderCache', () => {
  let store;

  beforeEach(() => {
    store = new Map();
    getRedisClient.mockReturnValue({
      get: jest.fn((key) => Promise.resolve(store.get(key) ?? null)),
      set: jest.fn((key, value) => {
        store.set(key, value);
        return Promise.resolve('OK');
      })
    });
  });

  it('builds the cache key with the bff:order: prefix', () => {
    expect(cacheKey('ord1001')).toBe('bff:order:ord1001');
  });

  it('returns null on a cache miss', async () => {
    const result = await getCachedOrder('ord9999');
    expect(result).toBeNull();
  });

  it('round-trips a cached order result', async () => {
    const order = {
      orderid: 'ord1001',
      status: 'Released',
      reason: null,
      releasedquantity: 60,
      backorderedquantity: 0,
      allocations: [{ warehouseid: 'WH-B', allocatedquantity: 60 }]
    };
    await setCachedOrder('ord1001', order);
    const result = await getCachedOrder('ord1001');
    expect(result).toEqual(order);
  });
});
