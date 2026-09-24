const BFF_BASE_URL = import.meta.env.VITE_BFF_BASE_URL ?? 'http://localhost:4000';

async function parseJsonSafely(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function getJson(path) {
  const response = await fetch(`${BFF_BASE_URL}${path}`);
  const body = await parseJsonSafely(response);
  return { status: response.status, body };
}

async function postJson(path, payload) {
  const response = await fetch(`${BFF_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await parseJsonSafely(response);
  return { status: response.status, body };
}

export const submitOrder = (order) => postJson('/orders', order);
export const getOrder = (orderid) => getJson(`/orders/${encodeURIComponent(orderid)}`);
export const listCustomers = () => getJson('/customers');
export const addCustomer = (customer) => postJson('/customers', customer);
export const listInventory = () => getJson('/inventory');
export const addInventory = (inventory) => postJson('/inventory', inventory);
