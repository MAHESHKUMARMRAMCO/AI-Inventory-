---
name: db
description: Database naming convention, schema reference, and exact enum values for the M08945 order-fulfillment SQL Server database. Load before writing or modifying anything under db/, or any backend repository/query code.
---

# M08945 Order Fulfillment — DB Skill

## Ground rules
- Every SQL object (table, constraint, index) is prefixed `M08945_orderfulfillment_`.
- The DDL lives in `db/sql/001_M08945_orderfulfillment_schema.sql` and is executed **manually** by the user — never run migrations automatically from application code or scripts.
- Column names are lowercase and match the API JSON field names exactly (no camelCase translation layer): `customerid, eligibilitystatus, productid, warehouseid, availablequantity, earliestdispatchdate, orderid, customertype, quantity, promiseddeliverydate, status, reason, releasedquantity, backorderedquantity, allocatedquantity`.
- Dates are SQL `DATE` columns (application layer parses/validates `YYYY-MM-DD` before binding).

## Tables
- `M08945_orderfulfillment_customer` — PK `customerid`; `eligibilitystatus` ∈ `Eligible`|`CreditHold`|`Unknown`.
- `M08945_orderfulfillment_inventory` — unique on `(productid, warehouseid)`; `warehouseid` ∈ `WH-A`|`WH-B`|`WH-C`; `availablequantity >= 0` (seeded > 0, may reach 0 once allocated).
- `M08945_orderfulfillment_order` — PK `orderid` (client-supplied string, not server-generated — this is what makes resubmission idempotent); `customertype` ∈ `Standard`|`Priority`; `status` ∈ `Released`|`Blocked`; `reason` NULL iff `status = 'Released'`, else one of `blocked-credithold`|`blocked-eligibilityunknown`|`blocked-nowarehouseavailable` (enforced by `CK_M08945_orderfulfillment_order_reason_required`).
- `M08945_orderfulfillment_allocation` — child of `order`; one row per warehouse actually used (in practice always ≤ 1 row per order, since fulfillment never combines warehouses); only present when the parent order is `Released`.
- `M08945_orderfulfillment_eventlog` — audit trail of `OrderSubmitted`/`OrderReleased`/`OrderBlocked` domain events, written by the backend's event handlers (not the dispatch mechanism itself — that's an in-process `EventEmitter`).

## Idempotent order submission
Because `orderid` is the primary key and is supplied by the client, the backend must check for an existing row **before** running the fulfillment decision. If found, return the stored order + allocation as the result and do not touch inventory or write a new allocation row.

## Full DDL
See `db/sql/001_M08945_orderfulfillment_schema.sql` for the authoritative, runnable schema (all `CREATE TABLE`/constraint definitions).
