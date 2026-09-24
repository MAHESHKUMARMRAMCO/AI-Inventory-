const { sql, getPool } = require('../config/db');
const { withBreaker } = require('./db/withBreaker');

async function _recordEvent(eventtype, orderid, payload) {
  const pool = await getPool();
  await pool
    .request()
    .input('eventtype', sql.VarChar(50), eventtype)
    .input('orderid', sql.VarChar(50), orderid)
    .input('payloadjson', sql.NVarChar(sql.MAX), JSON.stringify(payload))
    .query(
      'INSERT INTO M08945_orderfulfillment_eventlog (eventtype, orderid, payloadjson) VALUES (@eventtype, @orderid, @payloadjson)'
    );
}
const recordEvent = withBreaker('eventlogRepository.recordEvent', _recordEvent);

module.exports = { recordEvent };
