process.env.INTERNAL_SHARED_SECRET = 'test-secret';

const internalAuth = require('../../src/api/middleware/internalAuth');
const { UnauthorizedError } = require('../../src/errors');

function mockReq(headers) {
  return { get: (name) => headers[name] };
}

describe('internalAuth middleware', () => {
  it('calls next() with no error when the token matches', () => {
    const req = mockReq({ 'X-Internal-Token': 'test-secret' });
    const next = jest.fn();
    internalAuth(req, {}, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next(UnauthorizedError) when the token is missing', () => {
    const req = mockReq({});
    const next = jest.fn();
    internalAuth(req, {}, next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('calls next(UnauthorizedError) when the token is wrong', () => {
    const req = mockReq({ 'X-Internal-Token': 'wrong' });
    const next = jest.fn();
    internalAuth(req, {}, next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });
});
