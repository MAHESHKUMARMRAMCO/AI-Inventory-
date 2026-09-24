const eventBus = require('../eventBus');
const eventlogRepository = require('../../repositories/eventlogRepository');
const { ORDER_SUBMITTED, ORDER_RELEASED, ORDER_BLOCKED } = require('../eventTypes');

function persist(eventtype) {
  return (payload) => {
    eventlogRepository.recordEvent(eventtype, payload.orderid, payload).catch((err) => {
      console.error(`[eventlog] failed to persist ${eventtype} for order ${payload.orderid}`, err);
    });
  };
}

function register() {
  eventBus.on(ORDER_SUBMITTED, persist(ORDER_SUBMITTED));
  eventBus.on(ORDER_RELEASED, persist(ORDER_RELEASED));
  eventBus.on(ORDER_BLOCKED, persist(ORDER_BLOCKED));
}

module.exports = { register };
