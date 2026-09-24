const mockHttp = { post: jest.fn(), get: jest.fn() };
jest.mock('axios', () => ({ create: jest.fn(() => mockHttp) }));

const backendClient = require('../../src/client/backendClient');
const { ServiceUnavailableError } = require('../../src/errors');

describe('backendClient circuit breaker (BFF -> backend)', () => {
  it('treats a 5xx from the backend as a failure and eventually opens, returning ServiceUnavailableError without calling the backend again', async () => {
    mockHttp.post.mockResolvedValue({ status: 500, data: { error: 'internal_error' } });

    for (let i = 0; i < 6; i += 1) {
      await expect(backendClient.submitOrder({ orderid: `ord-breaker-${i}` })).rejects.toThrow(
        ServiceUnavailableError
      );
    }

    const callsWhileOpen = mockHttp.post.mock.calls.length;
    await expect(backendClient.submitOrder({ orderid: 'ord-breaker-final' })).rejects.toThrow(
      ServiceUnavailableError
    );
    // Once open, the breaker must short-circuit without invoking the HTTP call again.
    expect(mockHttp.post.mock.calls.length).toBe(callsWhileOpen);
  });

  it('treats a network/timeout error the same way and opens the breaker', async () => {
    mockHttp.get.mockRejectedValue(new Error('ECONNREFUSED'));

    for (let i = 0; i < 6; i += 1) {
      await expect(backendClient.getOrder(`ord-breaker-net-${i}`)).rejects.toThrow(ServiceUnavailableError);
    }
  });
});
