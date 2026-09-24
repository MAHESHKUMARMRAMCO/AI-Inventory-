function loadRateLimiter(consumeImpl) {
  jest.resetModules();

  jest.doMock('rate-limiter-flexible', () => {
    class RateLimiterRes {}
    class RateLimiterRedis {
      // eslint-disable-next-line class-methods-use-this
      consume(...args) {
        return consumeImpl(...args);
      }
    }
    return { RateLimiterRedis, RateLimiterRes };
  });
  jest.doMock('../../src/config/redis', () => ({ getRedisClient: () => ({}) }));

  const rateLimiter = require('../../src/api/middleware/rateLimiter');
  const { RateLimiterRes } = require('rate-limiter-flexible');
  const { RateLimitedError } = require('../../src/errors');
  return { rateLimiter, RateLimiterRes, RateLimitedError };
}

afterEach(() => {
  jest.dontMock('rate-limiter-flexible');
  jest.dontMock('../../src/config/redis');
});

describe('rateLimiter middleware', () => {
  it('calls next() with no error when under the limit', async () => {
    const { rateLimiter } = loadRateLimiter(() => Promise.resolve({}));
    const next = jest.fn();
    await rateLimiter({ ip: '127.0.0.1' }, {}, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next(RateLimitedError) when the limit is exceeded', async () => {
    const { rateLimiter, RateLimiterRes, RateLimitedError } = loadRateLimiter(() =>
      Promise.reject(new RateLimiterRes())
    );
    const next = jest.fn();
    await rateLimiter({ ip: '127.0.0.1' }, {}, next);
    expect(next).toHaveBeenCalledWith(expect.any(RateLimitedError));
  });

  it('fails open (calls next() with no error) when the Redis store itself errors', async () => {
    const { rateLimiter } = loadRateLimiter(() => Promise.reject(new Error('redis down')));
    const next = jest.fn();
    await rateLimiter({ ip: '127.0.0.1' }, {}, next);
    expect(next).toHaveBeenCalledWith();
  });
});
