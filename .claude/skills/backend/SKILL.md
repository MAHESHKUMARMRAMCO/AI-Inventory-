---
name: backend
description: Conventions, exact business rules, and file layout for the M08945 order-fulfillment backend (Express API). Load before writing or modifying any file under backend/.
---

# M08945 Order Fulfillment — Backend Skill

Full architecture context lives in `ARCHITECTURE.md` and phase status in `PROGRESS.md` at the repo root — read both before starting a phase. This skill is the condensed, backend-specific reference.

## Stack & non-negotiable constraints
- Node.js + Express. `backend/` has its own `package.json` and `node_modules` — never shared with `frontend/` or `bff/`.
- **Internal-only service.** The backend is never called directly by the frontend — only by the BFF (`bff/`, see the `bff` skill) and by scripts/tests. Every route requires the `X-Internal-Token` header (checked by `api/middleware/internalAuth.js` against `INTERNAL_SHARED_SECRET` from env); missing/wrong token → `401 { "error": "unauthorized" }`.
- SQL Server as the only datastore, accessed via the `mssql` package. No ORM — hand-written parameterized queries only (never string-concatenate SQL).
- `opossum` for circuit breakers around every SQL Server call. No Redis and no rate limiting here — those live in the BFF, which is the public edge.
- Routes are prefixed `/internal/` (e.g. `/internal/orders`) to make the internal-only nature obvious in logs/routing.
- Tests: Jest + Supertest. Every phase must ship its own passing unit tests (and integration tests where DB is touched) before `PROGRESS.md` is updated to `Done`.

## Exact field names and literal values (do not deviate)
Request/response JSON fields and DB columns are the *same* lowercase names — no camelCase translation layer:
`orderid, customerid, customertype, productid, quantity, promiseddeliverydate, warehouseid, availablequantity, earliestdispatchdate, eligibilitystatus, status, reason, releasedquantity, backorderedquantity, allocations, allocatedquantity`.

| Field | Values |
|---|---|
| `eligibilitystatus` | `Eligible`, `CreditHold`, `Unknown` |
| `customertype` | `Standard`, `Priority` |
| `warehouseid` | `WH-A`, `WH-B`, `WH-C` (normalize input case-insensitively to uppercase) |
| `status` | `Released`, `Blocked` (never "Partially released" — no rule produces a partial fulfillment) |
| `reason` | `null` when Released; else exactly one of `blocked-credithold`, `blocked-eligibilityunknown`, `blocked-nowarehouseavailable` |

## The fulfillment algorithm (implement as a pure function, no I/O)
`domain/fulfillment/selectWarehouse.js` — inputs: `quantity`, `promiseddeliverydate`, and the three inventory rows for the product (`warehouseid`, `availablequantity`, `earliestdispatchdate`). Logic:
1. Evaluate in fixed order `WH-A`, `WH-B`, `WH-C`.
2. First warehouse where `availablequantity >= quantity` **and** `earliestdispatchdate <= promiseddeliverydate` wins — this order is also the tie-breaker when multiple qualify, even with identical stock/dates.
3. No combining across warehouses, ever. If none qualify, the caller blocks with `blocked-nowarehouseavailable`.

Order of checks in `commands/submitOrder/submitOrderHandler.js`:
1. If `orderid` already exists in `M08945_orderfulfillment_order` → return the stored result unchanged (idempotent replay; never recompute or create a second allocation row).
2. Load customer; `CreditHold` → block `blocked-credithold`; `Unknown` → block `blocked-eligibilityunknown`; else continue.
3. Load inventory for `productid`, run `selectWarehouse`.
4. Released: in one transaction — decrement the selected warehouse's `availablequantity`, insert the order row, insert one allocation row.
5. Blocked: insert the order row only, no allocation row.
6. Emit `OrderSubmitted` then (`OrderReleased` | `OrderBlocked`) on the shared `EventEmitter` (`events/eventBus.js`) after the transaction commits.

## Circuit breaker pattern
`repositories/db/withBreaker.js` wraps each repository method individually (one breaker per method, not one global breaker) with `opossum` (`timeout: 3000`, `errorThresholdPercentage: 50`, `resetTimeout: 10000`). Open-circuit → throw a typed error the controller maps to `503 { "error": "service_unavailable" }`.

## `GET /internal/orders/:orderid` (query side)
Reads directly from `M08945_orderfulfillment_order` + `M08945_orderfulfillment_allocation` (breaker-wrapped) and assembles the response. No caching here — the BFF owns the read-model cache in front of this endpoint (see the `bff` skill); the backend always returns the current source-of-truth row.

## Customer & inventory resource endpoints
`/internal/customers` and `/internal/inventory` each support `GET` (list all, `customerRepository.list()` / `inventoryRepository.list()`, ordered by primary key) and `POST` (upsert one row — same `customerSchema`/`inventorySchema` validation and `customerRepository.upsert()` / `inventoryRepository.upsert()` used elsewhere). These back the frontend's Customer and Inventory pages via the BFF; there is no separate "seed" endpoint namespace — this **is** how test data gets created now, whether from a script (`curl` with `X-Internal-Token`, bypassing the BFF) or from the UI (through the BFF). `inventoryRepository.list()` returns `earliestdispatchdate` as a JS `Date` (mssql's `DATE` column mapping) — the controller (`api/controllers/inventoryController.js`) formats it back to `YYYY-MM-DD` before responding; don't let a raw `Date` leak into a JSON response elsewhere either.

## API error conventions
- `400 { "error": "validation_error", "details": [{ "field": ..., "message": ... }] }` — any missing/mistyped field, quantity/availablequantity not a positive integer, date not `YYYY-MM-DD`, invalid enum value.
- `401 { "error": "unauthorized" }` — missing/invalid `X-Internal-Token`.
- `404 { "orderid": "<id>", "error": "order not found" }` — exact shape, only for `GET /internal/orders/:orderid` on an unknown id.
- `503 { "error": "service_unavailable" }` — circuit breaker open.

## Folder layout
See `ARCHITECTURE.md` §4 for the full tree. Key files: `domain/fulfillment/selectWarehouse.js`, `commands/submitOrder/submitOrderHandler.js`, `queries/getOrderFulfillment/getOrderFulfillmentHandler.js`, `events/eventBus.js`, `repositories/db/withBreaker.js`, `api/middleware/internalAuth.js`.
