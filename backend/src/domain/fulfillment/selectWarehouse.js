const WAREHOUSE_PRIORITY = ['WH-A', 'WH-B', 'WH-C'];

/**
 * Pure decision function — no I/O.
 * Picks the single warehouse that fully covers `quantity` with
 * earliestdispatchdate <= promiseddeliverydate, evaluating WH-A, WH-B,
 * WH-C in that fixed order. That same order is the final tie-breaker
 * when more than one warehouse qualifies (even with identical stock
 * and/or dispatch dates). Inventory across warehouses is never combined.
 * Returns the winning inventory row, or null if none qualifies.
 */
function selectWarehouse({ quantity, promiseddeliverydate, inventoryRows }) {
  const byWarehouse = new Map(inventoryRows.map((row) => [row.warehouseid, row]));
  const promised = new Date(promiseddeliverydate);

  for (const warehouseid of WAREHOUSE_PRIORITY) {
    const row = byWarehouse.get(warehouseid);
    if (!row) continue;

    const dispatch = new Date(row.earliestdispatchdate);
    if (row.availablequantity >= quantity && dispatch <= promised) {
      return {
        warehouseid,
        availablequantity: row.availablequantity,
        earliestdispatchdate: row.earliestdispatchdate
      };
    }
  }

  return null;
}

module.exports = { selectWarehouse, WAREHOUSE_PRIORITY };
