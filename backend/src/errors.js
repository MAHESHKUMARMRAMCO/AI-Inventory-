class AppError extends Error {
  constructor(statusCode, body) {
    super(body.error);
    this.statusCode = statusCode;
    this.body = body;
  }
}

class ValidationError extends AppError {
  constructor(details) {
    super(400, { error: 'validation_error', details });
  }
}

class UnauthorizedError extends AppError {
  constructor() {
    super(401, { error: 'unauthorized' });
  }
}

class OrderNotFoundError extends AppError {
  constructor(orderid) {
    super(404, { orderid, error: 'order not found' });
  }
}

class ServiceUnavailableError extends AppError {
  constructor() {
    super(503, { error: 'service_unavailable' });
  }
}

module.exports = {
  AppError,
  ValidationError,
  UnauthorizedError,
  OrderNotFoundError,
  ServiceUnavailableError
};
