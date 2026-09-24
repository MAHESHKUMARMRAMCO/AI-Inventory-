const CircuitBreaker = require('opossum');
const { ServiceUnavailableError } = require('../../errors');

const BREAKER_OPTIONS = {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 10000
};

/**
 * Wraps a single async DB-access function in its own opossum breaker
 * (one breaker per repository method, never one shared/global breaker).
 * On timeout, DB error, or an already-open circuit, throws
 * ServiceUnavailableError instead of the underlying error.
 */
function withBreaker(name, fn) {
  const breaker = new CircuitBreaker(fn, { ...BREAKER_OPTIONS, name });

  breaker.fallback(() => {
    throw new ServiceUnavailableError();
  });

  return (...args) => breaker.fire(...args);
}

module.exports = { withBreaker, BREAKER_OPTIONS };
