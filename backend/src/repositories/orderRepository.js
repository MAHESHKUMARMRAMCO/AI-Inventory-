const { sql, getPool } = require('../config/db');
const { withBreaker } = require('./db/withBreaker');

async function _getById(orderid) {
  const pool = await getPool();
  const orderResult = await pool
    .request()
    .input('orderid', sql.VarChar(50), orderid)
    .query(
      'SELECT orderid, status, reason, releasedquantity, backorderedquantity FROM M08945_orderfulfillment_order WHERE orderid = @orderid'
    );

  const orderRow = orderResult.recordset[0];
  if (!orderRow) return null;

  const allocationResult = await pool
    .request()
    .input('orderid', sql.VarChar(50), orderid)
    .query(
      'SELECT warehouseid, allocatedquantity FROM M08945_orderfulfillment_allocation WHERE orderid = @orderid ORDER BY warehouseid'
    );

  const backorderResult = await pool
    .request()
    .input('orderid', sql.VarChar(50), orderid)
    .query('SELECT quantity, status FROM M08945_orderfulfillment_backorder WHERE orderid = @orderid');
  const backorderRow = backorderResult.recordset[0];

  return {
    orderid: orderRow.orderid,
    status: orderRow.status,
    reason: orderRow.reason,
    releasedquantity: orderRow.releasedquantity,
    backorderedquantity: orderRow.backorderedquantity,
    allocations: allocationResult.recordset.map((row) => ({
      warehouseid: row.warehouseid,
      allocatedquantity: row.allocatedquantity
    })),
    backorder: backorderRow ? { orderid: orderRow.orderid, quantity: backorderRow.quantity, status: backorderRow.status } : null
  };
}
const getById = withBreaker('orderRepository.getById', _getById);

/**
 * Atomically decrements the selected warehouse's stock and persists the
 * Released order + its single allocation row in one transaction. The
 * inventory decrement is guarded (`availablequantity >= @quantity` in the
 * WHERE clause) so a concurrent order racing for the same stock can never
 * push it negative. If the guard finds insufficient stock at write time
 * (lost the race since the read that chose this warehouse), the
 * transaction is rolled back and this returns null so the caller can
 * re-evaluate with fresh inventory data instead of corrupting state.
 */
async function _tryCreateReleased({
  orderid,
  customerid,
  customertype,
  productid,
  quantity,
  promiseddeliverydate,
  warehouseid
}) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const decrementResult = await new sql.Request(transaction)
      .input('productid', sql.VarChar(50), productid)
      .input('warehouseid', sql.VarChar(10), warehouseid)
      .input('quantity', sql.Int, quantity)
      .query(`
        UPDATE M08945_orderfulfillment_inventory
        SET availablequantity = availablequantity - @quantity, updatedat = SYSUTCDATETIME()
        WHERE productid = @productid AND warehouseid = @warehouseid AND availablequantity >= @quantity
      `);

    if (decrementResult.rowsAffected[0] === 0) {
      await transaction.rollback();
      return null;
    }

    await new sql.Request(transaction)
      .input('orderid', sql.VarChar(50), orderid)
      .input('customerid', sql.VarChar(50), customerid)
      .input('customertype', sql.VarChar(20), customertype)
      .input('productid', sql.VarChar(50), productid)
      .input('quantity', sql.Int, quantity)
      .input('promiseddeliverydate', sql.Date, new Date(promiseddeliverydate))
      .input('releasedquantity', sql.Int, quantity)
      .query(`
        INSERT INTO M08945_orderfulfillment_order
          (orderid, customerid, customertype, productid, quantity, promiseddeliverydate,
           status, reason, releasedquantity, backorderedquantity, decidedat)
        VALUES
          (@orderid, @customerid, @customertype, @productid, @quantity, @promiseddeliverydate,
           'Released', NULL, @releasedquantity, 0, SYSUTCDATETIME())
      `);

    await new sql.Request(transaction)
      .input('orderid', sql.VarChar(50), orderid)
      .input('warehouseid', sql.VarChar(10), warehouseid)
      .input('allocatedquantity', sql.Int, quantity)
      .query(`
        INSERT INTO M08945_orderfulfillment_allocation (orderid, warehouseid, allocatedquantity)
        VALUES (@orderid, @warehouseid, @allocatedquantity)
      `);

    await transaction.commit();

    return {
      orderid,
      status: 'Released',
      reason: null,
      releasedquantity: quantity,
      backorderedquantity: 0,
      allocations: [{ warehouseid, allocatedquantity: quantity }],
      backorder: null
    };
  } catch (err) {
    await transaction.rollback().catch(() => {});
    throw err;
  }
}
const tryCreateReleased = withBreaker('orderRepository.tryCreateReleased', _tryCreateReleased);

/**
 * CHANGE1 — Priority path: allocates across one or more warehouses
 * (guarded decrement per warehouse, same race-safe pattern as
 * tryCreateReleased), persists the order as Released/Partially Released,
 * one allocation row per warehouse used, and — if backorderedquantity > 0 —
 * exactly one backorder row. Returns null (caller retries) if any
 * warehouse's guarded decrement loses a stock race.
 */
async function _tryCreatePriorityOrder({
  orderid,
  customerid,
  customertype,
  productid,
  quantity,
  promiseddeliverydate,
  allocations,
  releasedquantity,
  backorderedquantity,
  status
}) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    for (const alloc of allocations) {
      const decrementResult = await new sql.Request(transaction)
        .input('productid', sql.VarChar(50), productid)
        .input('warehouseid', sql.VarChar(10), alloc.warehouseid)
        .input('quantity', sql.Int, alloc.allocatedquantity)
        .query(`
          UPDATE M08945_orderfulfillment_inventory
          SET availablequantity = availablequantity - @quantity, updatedat = SYSUTCDATETIME()
          WHERE productid = @productid AND warehouseid = @warehouseid AND availablequantity >= @quantity
        `);

      if (decrementResult.rowsAffected[0] === 0) {
        await transaction.rollback();
        return null;
      }
    }

    await new sql.Request(transaction)
      .input('orderid', sql.VarChar(50), orderid)
      .input('customerid', sql.VarChar(50), customerid)
      .input('customertype', sql.VarChar(20), customertype)
      .input('productid', sql.VarChar(50), productid)
      .input('quantity', sql.Int, quantity)
      .input('promiseddeliverydate', sql.Date, new Date(promiseddeliverydate))
      .input('status', sql.VarChar(20), status)
      .input('releasedquantity', sql.Int, releasedquantity)
      .input('backorderedquantity', sql.Int, backorderedquantity)
      .query(`
        INSERT INTO M08945_orderfulfillment_order
          (orderid, customerid, customertype, productid, quantity, promiseddeliverydate,
           status, reason, releasedquantity, backorderedquantity, decidedat)
        VALUES
          (@orderid, @customerid, @customertype, @productid, @quantity, @promiseddeliverydate,
           @status, NULL, @releasedquantity, @backorderedquantity, SYSUTCDATETIME())
      `);

    for (const alloc of allocations) {
      // eslint-disable-next-line no-await-in-loop
      await new sql.Request(transaction)
        .input('orderid', sql.VarChar(50), orderid)
        .input('warehouseid', sql.VarChar(10), alloc.warehouseid)
        .input('allocatedquantity', sql.Int, alloc.allocatedquantity)
        .query(`
          INSERT INTO M08945_orderfulfillment_allocation (orderid, warehouseid, allocatedquantity)
          VALUES (@orderid, @warehouseid, @allocatedquantity)
        `);
    }

    let backorder = null;
    if (backorderedquantity > 0) {
      await new sql.Request(transaction)
        .input('orderid', sql.VarChar(50), orderid)
        .input('quantity', sql.Int, backorderedquantity)
        .query(`
          INSERT INTO M08945_orderfulfillment_backorder (orderid, quantity, status)
          VALUES (@orderid, @quantity, 'Open')
        `);
      backorder = { orderid, quantity: backorderedquantity, status: 'Open' };
    }

    await transaction.commit();

    return { orderid, status, reason: null, releasedquantity, backorderedquantity, allocations, backorder };
  } catch (err) {
    await transaction.rollback().catch(() => {});
    throw err;
  }
}
const tryCreatePriorityOrder = withBreaker('orderRepository.tryCreatePriorityOrder', _tryCreatePriorityOrder);

async function _createBlocked(
  { orderid, customerid, customertype, productid, quantity, promiseddeliverydate },
  reason,
  backorderedquantity = quantity
) {
  const pool = await getPool();
  await pool
    .request()
    .input('orderid', sql.VarChar(50), orderid)
    .input('customerid', sql.VarChar(50), customerid)
    .input('customertype', sql.VarChar(20), customertype)
    .input('productid', sql.VarChar(50), productid)
    .input('quantity', sql.Int, quantity)
    .input('promiseddeliverydate', sql.Date, new Date(promiseddeliverydate))
    .input('reason', sql.VarChar(50), reason)
    .input('backorderedquantity', sql.Int, backorderedquantity)
    .query(`
      INSERT INTO M08945_orderfulfillment_order
        (orderid, customerid, customertype, productid, quantity, promiseddeliverydate,
         status, reason, releasedquantity, backorderedquantity, decidedat)
      VALUES
        (@orderid, @customerid, @customertype, @productid, @quantity, @promiseddeliverydate,
         'Blocked', @reason, 0, @backorderedquantity, SYSUTCDATETIME())
    `);

  return {
    orderid,
    status: 'Blocked',
    reason,
    releasedquantity: 0,
    backorderedquantity,
    allocations: [],
    backorder: null
  };
}
const createBlocked = withBreaker('orderRepository.createBlocked', _createBlocked);

/**
 * CHANGE2 — applies newly available inventory to the oldest Open backorder
 * for a product (createdat ASC, orderid ASC tie-break). Creates an
 * additional allocation row (existing allocations are never touched),
 * bumps released/reduces backordered on the order, and closes the
 * backorder when its remaining quantity reaches 0. Returns null if there
 * is no Open backorder for the product (caller responds NoOpenBackorder).
 */
async function _applyInventoryAvailability({ productid, warehouseid, availablequantity }) {
  const pool = await getPool();

  const found = await pool
    .request()
    .input('productid', sql.VarChar(50), productid)
    .query(`
      SELECT TOP 1 b.orderid, b.quantity AS backorderedquantity, o.releasedquantity
      FROM M08945_orderfulfillment_backorder b
      JOIN M08945_orderfulfillment_order o ON o.orderid = b.orderid
      WHERE b.status = 'Open' AND o.productid = @productid
      ORDER BY b.createdat ASC, b.orderid ASC
    `);

  const row = found.recordset[0];
  if (!row) return null;

  const allocatedquantity = Math.min(availablequantity, row.backorderedquantity);
  const newBackordered = row.backorderedquantity - allocatedquantity;
  const newReleased = row.releasedquantity + allocatedquantity;
  const newStatus = newBackordered === 0 ? 'Closed' : 'Open';

  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    await new sql.Request(transaction)
      .input('orderid', sql.VarChar(50), row.orderid)
      .input('warehouseid', sql.VarChar(10), warehouseid)
      .input('allocatedquantity', sql.Int, allocatedquantity)
      .query(`
        INSERT INTO M08945_orderfulfillment_allocation (orderid, warehouseid, allocatedquantity)
        VALUES (@orderid, @warehouseid, @allocatedquantity)
      `);

    await new sql.Request(transaction)
      .input('orderid', sql.VarChar(50), row.orderid)
      .input('releasedquantity', sql.Int, newReleased)
      .input('backorderedquantity', sql.Int, newBackordered)
      .query(`
        UPDATE M08945_orderfulfillment_order
        SET releasedquantity = @releasedquantity, backorderedquantity = @backorderedquantity
        WHERE orderid = @orderid
      `);

    await new sql.Request(transaction)
      .input('orderid', sql.VarChar(50), row.orderid)
      .input('quantity', sql.Int, newBackordered)
      .input('status', sql.VarChar(20), newStatus)
      .query(`
        UPDATE M08945_orderfulfillment_backorder
        SET quantity = @quantity, status = @status
        WHERE orderid = @orderid
      `);

    await transaction.commit();
  } catch (err) {
    await transaction.rollback().catch(() => {});
    throw err;
  }

  return {
    orderid: row.orderid,
    backorderstatus: newStatus,
    releasedquantity: newReleased,
    backorderedquantity: newBackordered,
    allocation: { warehouseid, allocatedquantity }
  };
}
const applyInventoryAvailability = withBreaker('orderRepository.applyInventoryAvailability', _applyInventoryAvailability);

module.exports = { getById, tryCreateReleased, tryCreatePriorityOrder, createBlocked, applyInventoryAvailability };
