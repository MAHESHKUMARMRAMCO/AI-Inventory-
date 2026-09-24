/* CHANGE2: fulfil open backorders from new inventory.
   Run against a DB already migrated with 001 + 002. */

-- Multiple allocation rows per (orderid, warehouseid) are now valid: a
-- backorder fulfilment adds an ADDITIONAL allocation without replacing
-- the original one, which may target the same warehouse.
ALTER TABLE M08945_orderfulfillment_allocation DROP CONSTRAINT UQ_M08945_orderfulfillment_allocation_order_wh;

-- Backorder can now be closed once fully fulfilled (remaining quantity reaches 0).
ALTER TABLE M08945_orderfulfillment_backorder DROP CONSTRAINT CK_M08945_orderfulfillment_backorder_status;
ALTER TABLE M08945_orderfulfillment_backorder DROP CONSTRAINT CK_M08945_orderfulfillment_backorder_qty;
ALTER TABLE M08945_orderfulfillment_backorder
    ADD CONSTRAINT CK_M08945_orderfulfillment_backorder_status CHECK (status IN ('Open','Closed'));
ALTER TABLE M08945_orderfulfillment_backorder
    ADD CONSTRAINT CK_M08945_orderfulfillment_backorder_qty CHECK (quantity >= 0);
GO
