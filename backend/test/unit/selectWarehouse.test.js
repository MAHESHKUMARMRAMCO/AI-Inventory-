const { selectWarehouse } = require('../../src/domain/fulfillment/selectWarehouse');

const PROMISED = '2026-09-25';

function row(warehouseid, availablequantity, earliestdispatchdate) {
  return { warehouseid, availablequantity, earliestdispatchdate };
}

describe('selectWarehouse', () => {
  it('selects WH-A when it alone satisfies quantity and date', () => {
    const inventoryRows = [
      row('WH-A', 100, '2026-09-20'),
      row('WH-B', 100, '2026-09-20'),
      row('WH-C', 100, '2026-09-20')
    ];
    const result = selectWarehouse({ quantity: 60, promiseddeliverydate: PROMISED, inventoryRows });
    expect(result.warehouseid).toBe('WH-A');
  });

  it('prefers WH-A over WH-B/WH-C even with identical stock and dates (tie-break by priority order)', () => {
    const inventoryRows = [
      row('WH-C', 200, '2026-09-01'),
      row('WH-B', 200, '2026-09-01'),
      row('WH-A', 200, '2026-09-01')
    ];
    const result = selectWarehouse({ quantity: 60, promiseddeliverydate: PROMISED, inventoryRows });
    expect(result.warehouseid).toBe('WH-A');
  });

  it('skips WH-A when it lacks quantity and picks WH-B', () => {
    const inventoryRows = [row('WH-A', 10, '2026-09-01'), row('WH-B', 60, '2026-09-01')];
    const result = selectWarehouse({ quantity: 60, promiseddeliverydate: PROMISED, inventoryRows });
    expect(result.warehouseid).toBe('WH-B');
  });

  it('skips WH-A when its dispatch date is after the promised date, even with enough stock', () => {
    const inventoryRows = [row('WH-A', 100, '2026-10-01'), row('WH-B', 100, '2026-09-01')];
    const result = selectWarehouse({ quantity: 60, promiseddeliverydate: PROMISED, inventoryRows });
    expect(result.warehouseid).toBe('WH-B');
  });

  it('treats earliestdispatchdate equal to promiseddeliverydate as satisfying the check (inclusive)', () => {
    const inventoryRows = [row('WH-A', 100, PROMISED)];
    const result = selectWarehouse({ quantity: 60, promiseddeliverydate: PROMISED, inventoryRows });
    expect(result.warehouseid).toBe('WH-A');
  });

  it('never combines warehouses: returns null when no single warehouse covers the quantity even though the sum does', () => {
    const inventoryRows = [row('WH-A', 30, '2026-09-01'), row('WH-B', 30, '2026-09-01'), row('WH-C', 30, '2026-09-01')];
    const result = selectWarehouse({ quantity: 60, promiseddeliverydate: PROMISED, inventoryRows });
    expect(result).toBeNull();
  });

  it('returns null when no warehouse satisfies both quantity and date', () => {
    const inventoryRows = [row('WH-A', 10, '2026-10-01'), row('WH-B', 5, '2026-10-01'), row('WH-C', 0, '2026-10-01')];
    const result = selectWarehouse({ quantity: 60, promiseddeliverydate: PROMISED, inventoryRows });
    expect(result).toBeNull();
  });

  it('returns null when the product has no inventory rows at all', () => {
    const result = selectWarehouse({ quantity: 60, promiseddeliverydate: PROMISED, inventoryRows: [] });
    expect(result).toBeNull();
  });
});
