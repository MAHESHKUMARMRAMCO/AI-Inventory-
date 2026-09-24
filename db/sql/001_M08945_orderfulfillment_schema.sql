/* =====================================================================
   M08945 Order Fulfillment - Schema DDL
   Target: SQL Server
   Naming convention: every object is prefixed M08945_orderfulfillment_
   This file is authored for manual execution by the DBA/developer.
   It is NOT run automatically by the application or by any migration
   tool in this project.
   ===================================================================== */

-- Run inside the target database (create it first if it does not exist):
-- CREATE DATABASE M08945_orderfulfillment;
-- GO
-- USE M08945_orderfulfillment;
-- GO

/* ---------------------------------------------------------------------
   Customer
   Field names match the FRD exactly (lowercase, no separators) so that
   API request/response bodies can map 1:1 onto column names.
   --------------------------------------------------------------------- */
CREATE TABLE M08945_orderfulfillment_customer (
    customerid          VARCHAR(50)   NOT NULL
        CONSTRAINT PK_M08945_orderfulfillment_customer PRIMARY KEY,
    eligibilitystatus    VARCHAR(20)  NOT NULL
        CONSTRAINT CK_M08945_orderfulfillment_customer_eligibility
        CHECK (eligibilitystatus IN ('Eligible','CreditHold','Unknown')),
    createdat            DATETIME2(3) NOT NULL
        CONSTRAINT DF_M08945_orderfulfillment_customer_createdat DEFAULT SYSUTCDATETIME(),
    updatedat            DATETIME2(3) NOT NULL
        CONSTRAINT DF_M08945_orderfulfillment_customer_updatedat DEFAULT SYSUTCDATETIME()
);
GO

/* ---------------------------------------------------------------------
   Inventory
   One row per (productid, warehouseid) combination.
   availablequantity is allowed to reach 0 once fully allocated, even
   though inventory is only ever *seeded* with a value > 0 (enforced at
   the application layer on insert, not by this CHECK, since a valid
   in-flight row must be able to decrement down to zero).
   --------------------------------------------------------------------- */
CREATE TABLE M08945_orderfulfillment_inventory (
    inventoryid          BIGINT IDENTITY(1,1) NOT NULL
        CONSTRAINT PK_M08945_orderfulfillment_inventory PRIMARY KEY,
    productid            VARCHAR(50)  NOT NULL,
    warehouseid          VARCHAR(10)  NOT NULL
        CONSTRAINT CK_M08945_orderfulfillment_inventory_warehouseid
        CHECK (warehouseid IN ('WH-A','WH-B','WH-C')),
    availablequantity    INT          NOT NULL
        CONSTRAINT CK_M08945_orderfulfillment_inventory_qty CHECK (availablequantity >= 0),
    earliestdispatchdate DATE         NOT NULL,
    updatedat            DATETIME2(3) NOT NULL
        CONSTRAINT DF_M08945_orderfulfillment_inventory_updatedat DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_M08945_orderfulfillment_inventory_product_wh UNIQUE (productid, warehouseid)
);
CREATE INDEX IX_M08945_orderfulfillment_inventory_productid
    ON M08945_orderfulfillment_inventory (productid);
GO

/* ---------------------------------------------------------------------
   Order
   orderid is CLIENT-SUPPLIED (not server-generated) because resubmitting
   the same orderid must be idempotent: the command handler checks for an
   existing row before evaluating fulfillment and, if found, returns the
   stored result unchanged instead of recomputing/reallocating.
   status is binary: 'Released' or 'Blocked'. A release always covers the
   full requested quantity from exactly one warehouse (no combining, no
   partial release), so releasedquantity/backorderedquantity are simple
   mirrors of that binary outcome (quantity/0 or 0/quantity).
   --------------------------------------------------------------------- */
CREATE TABLE M08945_orderfulfillment_order (
    orderid               VARCHAR(50)  NOT NULL
        CONSTRAINT PK_M08945_orderfulfillment_order PRIMARY KEY,
    customerid            VARCHAR(50)  NOT NULL
        CONSTRAINT FK_M08945_orderfulfillment_order_customer
        REFERENCES M08945_orderfulfillment_customer (customerid),
    customertype          VARCHAR(20)  NOT NULL
        CONSTRAINT CK_M08945_orderfulfillment_order_customertype
        CHECK (customertype IN ('Standard','Priority')),
    productid             VARCHAR(50)  NOT NULL,
    quantity              INT          NOT NULL
        CONSTRAINT CK_M08945_orderfulfillment_order_qty CHECK (quantity > 0),
    promiseddeliverydate  DATE         NOT NULL,
    status                VARCHAR(20)  NOT NULL
        CONSTRAINT CK_M08945_orderfulfillment_order_status
        CHECK (status IN ('Released','Partially Released','Blocked')),
    reason                VARCHAR(50)  NULL,
        -- NULL unless status = 'Blocked'. Standard values used by the app:
        -- 'blocked-credithold', 'blocked-eligibilityunknown',
        -- 'blocked-nowarehouseavailable', 'blocked-belowthreshold'
    releasedquantity      INT          NOT NULL
        CONSTRAINT DF_M08945_orderfulfillment_order_releasedqty DEFAULT 0,
    backorderedquantity   INT          NOT NULL
        CONSTRAINT DF_M08945_orderfulfillment_order_backorderedqty DEFAULT 0,
    submittedat            DATETIME2(3) NOT NULL
        CONSTRAINT DF_M08945_orderfulfillment_order_submittedat DEFAULT SYSUTCDATETIME(),
    decidedat              DATETIME2(3) NULL,
    CONSTRAINT CK_M08945_orderfulfillment_order_reason_required
        CHECK ((status = 'Blocked' AND reason IS NOT NULL) OR (status IN ('Released','Partially Released') AND reason IS NULL))
);
CREATE INDEX IX_M08945_orderfulfillment_order_customerid
    ON M08945_orderfulfillment_order (customerid);
GO

/* ---------------------------------------------------------------------
   Order Allocation
   Populated only when the order's status = 'Released'. Because a
   release only ever comes from a single warehouse, this table will
   have at most one row per orderid under current business rules, but
   is modeled as a child table (rather than columns on Order) so the
   API's "allocations" array shape and any future multi-row need are
   both naturally supported without a schema change.
   --------------------------------------------------------------------- */
CREATE TABLE M08945_orderfulfillment_allocation (
    allocationid       BIGINT IDENTITY(1,1) NOT NULL
        CONSTRAINT PK_M08945_orderfulfillment_allocation PRIMARY KEY,
    orderid            VARCHAR(50)  NOT NULL
        CONSTRAINT FK_M08945_orderfulfillment_allocation_order
        REFERENCES M08945_orderfulfillment_order (orderid),
    warehouseid        VARCHAR(10)  NOT NULL
        CONSTRAINT CK_M08945_orderfulfillment_allocation_warehouseid
        CHECK (warehouseid IN ('WH-A','WH-B','WH-C')),
    allocatedquantity  INT          NOT NULL
        CONSTRAINT CK_M08945_orderfulfillment_allocation_qty CHECK (allocatedquantity > 0),
    createdat           DATETIME2(3) NOT NULL
        CONSTRAINT DF_M08945_orderfulfillment_allocation_createdat DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_M08945_orderfulfillment_allocation_order_wh UNIQUE (orderid, warehouseid)
);
CREATE INDEX IX_M08945_orderfulfillment_allocation_orderid
    ON M08945_orderfulfillment_allocation (orderid);
GO

/* ---------------------------------------------------------------------
   Backorder (CHANGE1)
   One row per Partially Released Priority order, holding the shortfall.
   --------------------------------------------------------------------- */
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

/* ---------------------------------------------------------------------
   Event Log (CQRS domain events, audit trail)
   The in-process EventEmitter is the dispatch mechanism; this table is
   the durable side effect written by each event handler.
   --------------------------------------------------------------------- */
CREATE TABLE M08945_orderfulfillment_eventlog (
    eventid        BIGINT IDENTITY(1,1) NOT NULL
        CONSTRAINT PK_M08945_orderfulfillment_eventlog PRIMARY KEY,
    eventtype      VARCHAR(50)   NOT NULL
        CONSTRAINT CK_M08945_orderfulfillment_eventlog_type
        CHECK (eventtype IN ('OrderSubmitted','OrderReleased','OrderBlocked')),
    orderid        VARCHAR(50)   NOT NULL,
    payloadjson    NVARCHAR(MAX) NOT NULL,
    occurredat     DATETIME2(3)  NOT NULL
        CONSTRAINT DF_M08945_orderfulfillment_eventlog_occurredat DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_M08945_orderfulfillment_eventlog_orderid
    ON M08945_orderfulfillment_eventlog (orderid);
GO
