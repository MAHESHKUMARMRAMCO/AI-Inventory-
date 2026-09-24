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

class RateLimitedError extends AppError {
  constructor() {
    super(429, { error: 'rate_limited' });
  }
}

class ServiceUnavailableError extends AppError {
  constructor() {
    super(503, { error: 'service_unavailable' });
  }
}

/** Wraps a backend HTTP response so the controller can proxy its exact status/body. */
class UpstreamResponseError extends Error {
  constructor(statusCode, body) {
    super('upstream_response');
    this.statusCode = statusCode;
    this.body = body;
  }
}

module.exports = {
  AppError,
  ValidationError,
  RateLimitedError,
  ServiceUnavailableError,
  UpstreamResponseError
};
