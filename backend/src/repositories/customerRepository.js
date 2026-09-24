const { sql, getPool } = require('../config/db');
const { withBreaker } = require('./db/withBreaker');

async function _getById(customerid) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('customerid', sql.VarChar(50), customerid)
    .query(
      'SELECT customerid, eligibilitystatus FROM M08945_orderfulfillment_customer WHERE customerid = @customerid'
    );
  return result.recordset[0] ?? null;
}
const getById = withBreaker('customerRepository.getById', _getById);

async function _list() {
  const pool = await getPool();
  const result = await pool
    .request()
    .query('SELECT customerid, eligibilitystatus FROM M08945_orderfulfillment_customer ORDER BY customerid');
  return result.recordset;
}
const list = withBreaker('customerRepository.list', _list);

async function _upsert(customerid, eligibilitystatus) {
  const pool = await getPool();
  await pool
    .request()
    .input('customerid', sql.VarChar(50), customerid)
    .input('eligibilitystatus', sql.VarChar(20), eligibilitystatus)
    .query(`
      MERGE M08945_orderfulfillment_customer AS target
      USING (SELECT @customerid AS customerid) AS source
      ON target.customerid = source.customerid
      WHEN MATCHED THEN
        UPDATE SET eligibilitystatus = @eligibilitystatus, updatedat = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (customerid, eligibilitystatus) VALUES (@customerid, @eligibilitystatus);
    `);
}
const upsert = withBreaker('customerRepository.upsert', _upsert);

module.exports = { getById, list, upsert };
