const { withBreaker } = require('../../src/repositories/db/withBreaker');
const { ServiceUnavailableError } = require('../../src/errors');

describe('withBreaker', () => {
  it('resolves with the wrapped function result on success', async () => {
    const fn = withBreaker('test.success', async (x) => x * 2);
    await expect(fn(21)).resolves.toBe(42);
  });

  it('throws ServiceUnavailableError once the breaker opens after repeated failures', async () => {
    const failing = jest.fn(async () => {
      throw new Error('db exploded');
    });
    const fn = withBreaker('test.failure', failing);

    // Drive enough failures to trip errorThresholdPercentage: 50 and open the breaker.
    for (let i = 0; i < 5; i += 1) {
      await expect(fn()).rejects.toThrow(ServiceUnavailableError);
    }

    const callsWhileOpen = failing.mock.calls.length;
    await expect(fn()).rejects.toThrow(ServiceUnavailableError);
    // Once open, the underlying function must not be invoked again.
    expect(failing.mock.calls.length).toBe(callsWhileOpen);
  });
});
