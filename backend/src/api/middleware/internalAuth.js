const env = require('../../config/env');
const { UnauthorizedError } = require('../../errors');

function internalAuth(req, res, next) {
  const token = req.get('X-Internal-Token');
  if (!token || token !== env.internalSharedSecret) {
    return next(new UnauthorizedError());
  }
  next();
}

module.exports = internalAuth;
