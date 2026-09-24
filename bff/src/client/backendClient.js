const axios = require('axios');
const CircuitBreaker = require('opossum');
const env = require('../config/env');
const { ServiceUnavailableError, UpstreamResponseError } = require('../errors');

const BREAKER_OPTIONS = {
  timeout: 5000,
  errorThresholdPercentage: 50,
  resetTimeout: 15000
};

const http = axios.create({
  baseURL: env.backendBaseUrl,
  timeout: 4500,
  // Let 4xx/5xx through as normal resolved responses so this client (not
  // axios) decides what counts as a circuit-breaker failure vs. a
  // legitimate business result (validation_error, order not found, etc).
  validateStatus: () => true,
  headers: { 'X-Internal-Token': env.internalSharedSecret }
});

function makeBreaker(name, actionFn) {
  const breaker = new CircuitBreaker(actionFn, { ...BREAKER_OPTIONS, name });
  breaker.fallback(() => {
    throw new ServiceUnavailableError();
  });
  return breaker;
}

/**
 * Wraps one backend HTTP call in its own opossum breaker (one breaker per
 * method, never a shared/global breaker). Only a 5xx or a thrown
 * network/timeout error counts as a backend failure for the breaker — any
 * other status (2xx, 4xx) is a legitimate business result and is returned
 * as-is by the breaker, then checked against `expectedStatus` here; a
 * mismatch throws UpstreamResponseError so the controller can proxy the
 * backend's exact status/body verbatim.
 */
function createBreakerCall(name, requestFn, expectedStatus) {
  async function raw(...args) {
    const response = await requestFn(...args);
    if (response.status >= 500) {
      throw new Error(`backend responded ${response.status}`);
    }
    return response;
  }
  const breaker = makeBreaker(name, raw);

  return async (...args) => {
    const response = await breaker.fire(...args);
    if (response.status !== expectedStatus) {
      throw new UpstreamResponseError(response.status, response.data);
    }
    return response.data;
  };
}

const submitOrder = createBreakerCall('backendClient.submitOrder', (payload) => http.post('/internal/orders', payload), 200);

const getOrder = createBreakerCall(
  'backendClient.getOrder',
  (orderid) => http.get(`/internal/orders/${encodeURIComponent(orderid)}`),
  200
);

const listCustomers = createBreakerCall('backendClient.listCustomers', () => http.get('/internal/customers'), 200);

const createCustomer = createBreakerCall(
  'backendClient.createCustomer',
  (payload) => http.post('/internal/customers', payload),
  201
);

const listInventory = createBreakerCall('backendClient.listInventory', () => http.get('/internal/inventory'), 200);

const createInventory = createBreakerCall(
  'backendClient.createInventory',
  (payload) => http.post('/internal/inventory', payload),
  201
);

module.exports = { submitOrder, getOrder, listCustomers, createCustomer, listInventory, createInventory };
