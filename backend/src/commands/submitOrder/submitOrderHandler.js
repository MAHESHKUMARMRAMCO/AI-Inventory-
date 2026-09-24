const customerRepository = require('../../repositories/customerRepository');
const inventoryRepository = require('../../repositories/inventoryRepository');
const orderRepository = require('../../repositories/orderRepository');
const { selectWarehouse } = require('../../domain/fulfillment/selectWarehouse');
const { selectWarehousesForPriority } = require('../../domain/fulfillment/selectWarehousesForPriority');
const env = require('../../config/env');
const eventBus = require('../../events/eventBus');
const { ORDER_SUBMITTED, ORDER_RELEASED, ORDER_BLOCKED } = require('../../events/eventTypes');

const REASON = {
  CREDIT_HOLD: 'blocked-credithold',
  ELIGIBILITY_UNKNOWN: 'blocked-eligibilityunknown',
  NO_WAREHOUSE_AVAILABLE: 'blocked-nowarehouseavailable',
  BELOW_THRESHOLD: 'blocked-belowthreshold'
};

// Bounded retry: if the guarded inventory decrement loses a race against a
// concurrent order for the same warehouse/product, re-read inventory and
// re-run the decision once more before giving up and blocking.
const MAX_ALLOCATION_ATTEMPTS = 2;

async function submitOrder(orderInput) {
  const existing = await orderRepository.getById(orderInput.orderid);
  if (existing) {
    // Idempotent replay: same orderid resubmitted. Return the stored result
    // unchanged — never re-evaluate, never create a second allocation.
    return existing;
  }

  eventBus.emit(ORDER_SUBMITTED, { orderid: orderInput.orderid, ...orderInput });

  const customer = await customerRepository.getById(orderInput.customerid);
  if (!customer || customer.eligibilitystatus === 'Unknown') {
    return blockOrder(orderInput, REASON.ELIGIBILITY_UNKNOWN);
  }
  if (customer.eligibilitystatus === 'CreditHold') {
    return blockOrder(orderInput, REASON.CREDIT_HOLD);
  }

  if (orderInput.customertype === 'Priority') {
    return submitPriorityOrder(orderInput);
  }

  for (let attempt = 1; attempt <= MAX_ALLOCATION_ATTEMPTS; attempt += 1) {
    const inventoryRows = await inventoryRepository.getByProductId(orderInput.productid);
    const selection = selectWarehouse({
      quantity: orderInput.quantity,
      promiseddeliverydate: orderInput.promiseddeliverydate,
      inventoryRows
    });

    if (!selection) {
      return blockOrder(orderInput, REASON.NO_WAREHOUSE_AVAILABLE);
    }

    const released = await orderRepository.tryCreateReleased({
      ...orderInput,
      warehouseid: selection.warehouseid
    });

    if (released) {
      eventBus.emit(ORDER_RELEASED, released);
      return released;
    }
    // released === null: lost the race for that warehouse's stock between
    // the read above and the guarded write — loop and retry with fresh data.
  }

  return blockOrder(orderInput, REASON.NO_WAREHOUSE_AVAILABLE);
}

// CHANGE1: Priority orders may span WH-A -> WH-B -> WH-C, can partially
// release with a single backorder, and block below the configurable
// threshold instead of only when no single warehouse fits.
async function submitPriorityOrder(orderInput) {
  for (let attempt = 1; attempt <= MAX_ALLOCATION_ATTEMPTS; attempt += 1) {
    const inventoryRows = await inventoryRepository.getByProductId(orderInput.productid);
    const decision = selectWarehousesForPriority({
      quantity: orderInput.quantity,
      promiseddeliverydate: orderInput.promiseddeliverydate,
      inventoryRows,
      thresholdPercent: env.priorityPartialThresholdPercent
    });

    if (decision.status === 'Blocked') {
      // Spec: below-threshold block has backorderedquantity = 0 (no backorder created).
      return blockOrder(orderInput, REASON.BELOW_THRESHOLD, 0);
    }

    const result = await orderRepository.tryCreatePriorityOrder({
      ...orderInput,
      allocations: decision.allocations,
      releasedquantity: decision.releasedquantity,
      backorderedquantity: decision.backorderedquantity,
      status: decision.status
    });

    if (result) {
      eventBus.emit(ORDER_RELEASED, result);
      return result;
    }
    // result === null: lost a stock race on one of the allocations — retry with fresh data.
  }

  return blockOrder(orderInput, REASON.NO_WAREHOUSE_AVAILABLE);
}

async function blockOrder(orderInput, reason, backorderedquantity = orderInput.quantity) {
  const blocked = await orderRepository.createBlocked(orderInput, reason, backorderedquantity);
  eventBus.emit(ORDER_BLOCKED, blocked);
  return blocked;
}

module.exports = { submitOrder, REASON };
