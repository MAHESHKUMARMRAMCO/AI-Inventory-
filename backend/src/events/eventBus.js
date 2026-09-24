const { EventEmitter } = require('events');

// Single shared in-process event bus. OrderSubmitted / OrderReleased / OrderBlocked
// are emitted by commands/submitOrder and consumed by handlers registered in
// events/handlers (see registerHandlers.js), decoupling persistence of the
// decision (command side) from side effects like audit logging.
const eventBus = new EventEmitter();

module.exports = eventBus;
