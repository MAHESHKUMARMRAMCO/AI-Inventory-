# M08945 Order Fulfillment — Architecture

## 1. Business Rules (source of truth)

- **Customer**: `customerid` (string), `eligibilitystatus` ∈ `Eligible` | `CreditHold` | `Unknown`.
- **Inventory**: `productid` (string), `warehouseid` ∈ `WH-A` | `WH-B` | `WH-C`, `availablequantity` (integer, seeded > 0, may reach 0 as it is allocated), `earliestdispatchdate` (`YYYY-MM-DD`).
- **Order**: `orderid` (string, client-supplied), `customerid` (string), `customertype` ∈ `Standard` | `Priority`, `productid` (string), `quantity` (integer > 0), `promiseddeliverydate` (`YYYY-MM-DD`). All fields mandatory.

### Fulfillment decision (evaluated once, at submission)
1. **Idempotency**: if `orderid` already exists, return the stored result as-is. Never re-evaluate, never create a second allocation.
2. **Eligibility check**:
   - `CreditHold` → `Blocked`, reason `blocked-credithold`.
   - `Unknown` → `Blocked`, reason `blocked-eligibilityunknown`.
   - `Eligible` → continue.
3. **Warehouse selection** (single warehouse only — inventory across warehouses is never combined): evaluate `WH-A`, then `WH-B`, then `WH-C`, in that fixed priority order. The first warehouse where `availablequantity >= quantity` **and** `earliestdispatchdate <= promiseddeliverydate` is selected. This priority order is also the final tie-breaker when more than one warehouse qualifies, even if they have identical stock and/or dispatch dates.
4. **Release**: decrement the selected warehouse's `availablequantity` by `quantity`, persist one allocation row (`warehouseid`, `allocatedquantity` = `quantity`), set `status = Released`, `releasedquantity = quantity`, `backorderedquantity = 0`, `reason = null`.
5. **Block**: if no warehouse satisfies both conditions, set `status = Blocked`, `reason = blocked-nowarehouseavailable`, `releasedquantity = 0`, `backorderedquantity = quantity`, create no allocation row.
6. Persist the order and its decision (and allocation, if released) durably; for blocked orders only the order + decision are persisted (no allocation row).

There is no partial release and no "Partially released" status: a release is always the full requested quantity from exactly one warehouse, or the order is blocked outright.

### Exact literal values (confirmed with the business owner — matches the FRD's intent, not every literal typo in the raw text)
| Field | Allowed values |
|---|---|
| `eligibilitystatus` | `Eligible`, `CreditHold`, `Unknown` |
| `customertype` | `Standard`, `Priority` |
| `warehouseid` | `WH-A`, `WH-B`, `WH-C` (uppercase; input normalized case-insensitively) |
| `status` | `Released`, `Blocked` |
| `reason` | `null` (Released) or one of: `blocked-credithold`, `blocked-eligibilityunknown`, `blocked-nowarehouseavailable` |

## 2. Services & Architecture Patterns

Four independent codebases, each with its **own** `package.json`/`node_modules` (no shared workspace):

```
bff/        Express BFF — the ONLY public entry point. Rate limiting, response cache, request validation, proxies to backend.
backend/    Express API (internal-only) — owns Customer/Inventory/Order domain logic + SQL Server. Reached only by the BFF and by seed scripts/tests.
frontend/   React + Redux Toolkit + Tailwind — order submit form + order lookup view. Talks only to the BFF.
db/sql/     Hand-run DDL (no ORM migrations) — user executes these manually
```

The frontend never talks to the backend directly — every request goes through the BFF, which is a real separate process/service (its own port, package.json, node_modules). This is the standard BFF role: it is the edge that owns cross-cutting HTTP concerns, while the backend stays a pure, internal domain/CQRS service. Patterns:

- **CQRS** (backend): `commands/submitOrder` (write path: validates, decides, persists, emits events) is fully separated from `queries/getOrderFulfillment` (read path: reads the denormalized result only). They never share code paths.
- **Circuit Breaker** — two independent instances, each protecting a different hop:
  - Backend → SQL Server: every DB call wrapped with `opossum` (per-repository-method breakers: `timeout=3000ms`, `errorThresholdPercentage=50`, `resetTimeout=10000ms`). Open breaker → backend returns `503 { error: "service_unavailable" }`.
  - BFF → backend: every proxied call wrapped with its own `opossum` breaker (`timeout=5000ms`, `errorThresholdPercentage=50`, `resetTimeout=15000ms`) so a slow/down backend can't cascade into hung BFF requests. Open breaker → BFF returns `503 { error: "service_unavailable" }` without calling the backend.
- **Rate Limiting** (BFF only): Redis-backed (`rate-limiter-flexible`) middleware in front of all `/orders` routes, keyed by client IP. The backend, being internal-only and reached only through the BFF, does not rate-limit itself.
- **Event-driven (in-process, backend)**: a single `EventEmitter` carries `OrderSubmitted`, `OrderReleased`, `OrderBlocked`. Handler: persist to `M08945_orderfulfillment_eventlog`.
- **Redis cache (BFF only)**: `GET /orders/:orderid` is cache-aside at the BFF, key `bff:order:{orderid}`. Only a **successful** result (`Released` or `Blocked`, i.e. an order that exists) is cached — a `404` is never cached. Because a decided order's result is immutable (no cancel/reversal flow, and idempotent resubmission returns the same stored result), a cached hit is always correct for any TTL, so there is no invalidation race to design around. TTL is a generous 5 minutes purely to bound memory, not for correctness.
- **Security**: `helmet` on both the BFF and backend. The BFF also applies `cors`, restricted to the frontend's origin (`FRONTEND_ORIGIN` env, default `http://localhost:3000`) — required because the frontend and BFF are different origins/ports; the backend needs no CORS config since it is never called from a browser. Input validation (`zod`) at the BFF edge (fail fast, exact field names/types/enums below) and re-validated inside the backend domain layer (defense in depth — the backend must never trust a caller, even an internal one). Parameterized queries only (no string-built SQL) to prevent injection. A shared-secret header (`X-Internal-Token`) is required by the backend on every request, so it rejects anything not sent by the BFF (or a seed script that knows the secret). TLS assumed at the deployment/reverse-proxy layer; `customerid`/`productid` values are candidates for SQL Server column-level encryption (Always Encrypted) — noted as a deployment config concern, not implemented in application code.

## 3. API Contract

Public contract below is served by the **BFF** (`http://localhost:4000`). The BFF proxies to the **backend**'s internal API (`http://localhost:4001/internal/orders`, `http://localhost:4001/internal/orders/:orderid`), which has the identical request/response shape plus the required `X-Internal-Token` header. The frontend and any external client only ever call the BFF.

### `POST /orders`
Request:
```json
{
  "orderid": "ord1001",
  "customerid": "cust001",
  "customertype": "Standard",
  "productid": "prod01",
  "quantity": 60,
  "promiseddeliverydate": "2026-09-25"
}
```
Released response (`200`):
```json
{
  "orderid": "ord1001",
  "status": "Released",
  "reason": null,
  "releasedquantity": 60,
  "backorderedquantity": 0,
  "allocations": [{ "warehouseid": "WH-B", "allocatedquantity": 60 }]
}
```
Blocked response (`200`):
```json
{
  "orderid": "ord1003",
  "status": "Blocked",
  "reason": "blocked-credithold",
  "releasedquantity": 0,
  "backorderedquantity": 0,
  "allocations": []
}
```
Validation error (`400`):
```json
{ "error": "validation_error", "details": [{ "field": "quantity", "message": "must be an integer greater than 0" }] }
```

### `GET /orders/:orderid`
`200` → same shape as the `POST` response (current stored result).
`404`:
```json
{ "orderid": "ord9999", "error": "order not found" }
```

### Cross-cutting error responses (both `POST` and `GET`, added by the BFF)
- `429 { "error": "rate_limited" }` — too many requests from this client.
- `503 { "error": "service_unavailable" }` — circuit breaker open (BFF→backend, or backend→SQL Server).

### `GET /customers` / `POST /customers`
Backing data for the frontend's Customer page. `GET` → `200` array of `{ customerid, eligibilitystatus }`. `POST` body `{ customerid, eligibilitystatus }` → `201` with the same body (upsert — resubmitting the same `customerid` updates its `eligibilitystatus` rather than erroring). `400 validation_error` for a bad/missing field, same shape as the orders validation error.

### `GET /inventory` / `POST /inventory`
Backing data for the frontend's Inventory page. `GET` → `200` array of `{ productid, warehouseid, availablequantity, earliestdispatchdate }` (one row per product+warehouse, `earliestdispatchdate` as `YYYY-MM-DD`). `POST` body `{ productid, warehouseid, availablequantity, earliestdispatchdate }` → `201` with the same body (upsert — resubmitting the same `productid`+`warehouseid` replaces its quantity/date). `400 validation_error` for a bad/missing field.

These four endpoints are proxied by the BFF to the backend's `/internal/customers` and `/internal/inventory` (identical shapes, plus `X-Internal-Token`) exactly like `/orders` — same rate limiting and edge validation, no response caching (unlike order lookup, these aren't immutable).

## 4. Repo Layout
```
ai native invetory/
  ARCHITECTURE.md          <- this file
  PROGRESS.md               <- phase tracker, updated as each phase completes
  db/sql/001_M08945_orderfulfillment_schema.sql
  bff/
    package.json (own node_modules)
    src/
      app.js, server.js
      config/ (env.js, redis.js, circuitBreaker.js)
      api/ (routes/orders.routes.js, controllers/ordersController.js, middleware/ [rateLimiter.js, validateRequest.js, errorHandler.js])
      cache/orderCache.js
      client/backendClient.js      <- breaker-wrapped HTTP client to the backend
    test/ (unit/, integration/)
  backend/
    package.json  (own node_modules)
    src/
      app.js, server.js
      config/ (env.js, db.js, circuitBreaker.js)
      domain/fulfillment/selectWarehouse.js      <- pure decision function
      commands/submitOrder/submitOrderHandler.js
      queries/getOrderFulfillment/getOrderFulfillmentHandler.js
      events/ (eventBus.js, handlers/)
      repositories/ (customerRepository.js, inventoryRepository.js, orderRepository.js, db/withBreaker.js)
      api/ (routes/ [orders, customers, inventory], controllers/, middleware/ [internalAuth.js, validateRequest.js, errorHandler.js])
    test/ (unit/, integration/)
  frontend/
    package.json (own node_modules)
    src/ (submitOrder feature, lookupOrder feature, Redux store, Tailwind config)
  .claude/skills/
    backend/SKILL.md
    bff/SKILL.md
    frontend/SKILL.md
    db/SKILL.md
```

## 5. Phases
See `PROGRESS.md` for the authoritative, live-updated phase list and status.
