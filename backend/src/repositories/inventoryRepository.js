const { sql, getPool } = require('../config/db');
const { withBreaker } = require('./db/withBreaker');

async function _getByProductId(productid) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('productid', sql.VarChar(50), productid)
    .query(
      'SELECT warehouseid, availablequantity, earliestdispatchdate FROM M08945_orderfulfillment_inventory WHERE productid = @productid'
    );
  return result.recordset;
}
const getByProductId = withBreaker('inventoryRepository.getByProductId', _getByProductId);

async function _list() {
  const pool = await getPool();
  const result = await pool
    .request()
    .query(
      'SELECT productid, warehouseid, availablequantity, earliestdispatchdate FROM M08945_orderfulfillment_inventory ORDER BY productid, warehouseid'
    );
  return result.recordset;
}
const list = withBreaker('inventoryRepository.list', _list);

async function _upsert({ productid, warehouseid, availablequantity, earliestdispatchdate }) {
  const pool = await getPool();
  await pool
    .request()
    .input('productid', sql.VarChar(50), productid)
    .input('warehouseid', sql.VarChar(10), warehouseid)
    .input('availablequantity', sql.Int, availablequantity)
    .input('earliestdispatchdate', sql.Date, new Date(earliestdispatchdate))
    .query(`
      MERGE M08945_orderfulfillment_inventory AS target
      USING (SELECT @productid AS productid, @warehouseid AS warehouseid) AS source
      ON target.productid = source.productid AND target.warehouseid = source.warehouseid
      WHEN MATCHED THEN
        UPDATE SET availablequantity = @availablequantity, earliestdispatchdate = @earliestdispatchdate, updatedat = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (productid, warehouseid, availablequantity, earliestdispatchdate)
        VALUES (@productid, @warehouseid, @availablequantity, @earliestdispatchdate);
    `);
}
const upsert = withBreaker('inventoryRepository.upsert', _upsert);

module.exports = { getByProductId, list, upsert };
