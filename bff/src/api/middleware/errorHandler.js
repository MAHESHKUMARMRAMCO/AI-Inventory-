const { AppError } = require('../../errors');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(err.body);
  }

  console.error(err);
  return res.status(500).json({ error: 'internal_error' });
}

module.exports = errorHandler;
