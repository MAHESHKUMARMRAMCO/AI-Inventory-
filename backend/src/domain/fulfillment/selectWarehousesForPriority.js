const WAREHOUSE_PRIORITY = ['WH-A', 'WH-B', 'WH-C'];

/**
 * CHANGE1 — pure decision function for Priority customers, no I/O.
 * Sums date-feasible stock (earliestdispatchdate <= promiseddeliverydate)
 * across WH-A, WH-B, WH-C. If below thresholdPercent% of requested qty,
 * blocks with no allocation. Otherwise allocates greedily WH-A -> WH-B ->
 * WH-C, capped so total allocation never exceeds the requested quantity;
 * any shortfall becomes the backorder quantity.
 */
function selectWarehousesForPriority({ quantity, promiseddeliverydate, inventoryRows, thresholdPercent }) {
  const byWarehouse = new Map(inventoryRows.map((row) => [row.warehouseid, row]));
  const promised = new Date(promiseddeliverydate);

  const feasible = WAREHOUSE_PRIORITY.map((warehouseid) => {
    const row = byWarehouse.get(warehouseid);
    if (!row) return { warehouseid, availablequantity: 0 };
    const dispatch = new Date(row.earliestdispatchdate);
    return { warehouseid, availablequantity: dispatch <= promised ? row.availablequantity : 0 };
  });

  const totalAvailable = feasible.reduce((sum, w) => sum + w.availablequantity, 0);
  const requiredMinimum = (quantity * thresholdPercent) / 100;

  if (totalAvailable < requiredMinimum) {
    return { status: 'Blocked', allocations: [], releasedquantity: 0, backorderedquantity: 0 };
  }

  let remaining = quantity;
  const allocations = [];
  for (const w of feasible) {
    if (remaining <= 0) break;
    if (w.availablequantity <= 0) continue;
    const take = Math.min(w.availablequantity, remaining);
    allocations.push({ warehouseid: w.warehouseid, allocatedquantity: take });
    remaining -= take;
  }

  const releasedquantity = quantity - remaining;
  const backorderedquantity = remaining;
  const status = backorderedquantity > 0 ? 'Partially Released' : 'Released';

  return { status, allocations, releasedquantity, backorderedquantity };
}

module.exports = { selectWarehousesForPriority };
