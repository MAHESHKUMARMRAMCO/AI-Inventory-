/* CHANGE1: Priority multi-warehouse partial fulfilment + backorder.
   Run against a DB already created from 001_M08945_orderfulfillment_schema.sql. */

ALTER TABLE M08945_orderfulfillment_order DROP CONSTRAINT CK_M08945_orderfulfillment_order_status;
ALTER TABLE M08945_orderfulfillment_order DROP CONSTRAINT CK_M08945_orderfulfillment_order_reason_required;

ALTER TABLE M08945_orderfulfillment_order
    ADD CONSTRAINT CK_M08945_orderfulfillment_order_status
    CHECK (status IN ('Released','Partially Released','Blocked'));

ALTER TABLE M08945_orderfulfillment_order
    ADD CONSTRAINT CK_M08945_orderfulfillment_order_reason_required
    CHECK ((status = 'Blocked' AND reason IS NOT NULL) OR (status IN ('Released','Partially Released') AND reason IS NULL));
GO

CREATE TABLE M08945_orderfulfillment_backorder (
    backorderid        BIGINT IDENTITY(1,1) NOT NULL
        CONSTRAINT PK_M08945_orderfulfillment_backorder PRIMARY KEY,
    orderid            VARCHAR(50)  NOT NULL
        CONSTRAINT FK_M08945_orderfulfillment_backorder_order
        REFERENCES M08945_orderfulfillment_order (orderid),
    quantity           INT          NOT NULL
        CONSTRAINT CK_M08945_orderfulfillment_backorder_qty CHECK (quantity > 0),
    status             VARCHAR(20)  NOT NULL
        CONSTRAINT CK_M08945_orderfulfillment_backorder_status CHECK (status IN ('Open')),
    createdat           DATETIME2(3) NOT NULL
        CONSTRAINT DF_M08945_orderfulfillment_backorder_createdat DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_M08945_orderfulfillment_backorder_orderid UNIQUE (orderid)
);
GO
