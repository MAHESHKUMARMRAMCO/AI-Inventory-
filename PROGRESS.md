# M08945 Order Fulfillment — Phase Tracker

Status values: `Not started` | `In progress` | `Done` | `Blocked`.
Each phase is only marked `Done` after its own unit/integration tests pass.

| # | Phase | Scope | Status | Notes |
|---|-------|-------|--------|-------|
| 0 | Project scaffolding | Folders, ARCHITECTURE.md, PROGRESS.md, DB DDL file, skills (backend/frontend/db/bff) | Done | BFF added to architecture + skills in this session |
| 1 | Backend foundation | Express skeleton, config, SQL Server pool, opossum circuit-breaker wrapper, internal-auth middleware, error-handling middleware, health check | Done | `backend/src/{app,server}.js`, `config/`, `errors.js`, `repositories/db/withBreaker.js`, `api/middleware/{internalAuth,errorHandler}.js`. Tests: `test/unit/health.test.js`, `test/unit/internalAuth.test.js`, `test/unit/withBreaker.test.js` |
| 2 | Customer & Inventory data access | Repositories (breaker-wrapped), input validation (zod) | Done | `repositories/{customerRepository,inventoryRepository}.js`. Originally exposed via seed-only endpoints; superseded by Phase 9's `/internal/customers` and `/internal/inventory` resource endpoints (same upsert logic, now also with `list()`) |
| 3 | Order submission (command side) | `selectWarehouse` pure decision function + unit tests; `submitOrderHandler` (idempotency → eligibility → warehouse selection → persist, with bounded retry on a stock-decrement race); domain events emitted | Done | `domain/fulfillment/selectWarehouse.js`, `commands/submitOrder/submitOrderHandler.js`, `repositories/orderRepository.js` (transactional `tryCreateReleased`/`createBlocked`), `events/`. Tests: `test/unit/selectWarehouse.test.js`, `test/unit/submitOrderHandler.test.js` |
| 4 | Order retrieval (query side) | `getOrderFulfillmentHandler`, backend `GET /internal/orders/:orderid`, 404 shape | Done | `queries/getOrderFulfillment/getOrderFulfillmentHandler.js`. Tests: `test/integration/ordersApi.test.js` (auth, validation, Released/Blocked/404 response shapes through the full Express pipeline, repositories mocked) |
| 5 | BFF service | Express BFF skeleton (own package.json/node_modules), breaker-wrapped backend client, request validation at the edge, proxy routes for `POST /orders` / `GET /orders/:orderid` | Done | `bff/src/{app,server}.js`, `config/`, `errors.js`, `client/backendClient.js` (opossum breaker per method, treats only 5xx/network errors as failures), `api/{routes,controllers,middleware,validation}` |
| 6 | BFF cross-cutting hardening | Redis-backed rate limiting (fail-open on Redis outage), Redis cache-aside on GET (only caches 200s, never 404), helmet, circuit-breaker-open → 503 tests, rate-limit → 429 tests | Done | `cache/orderCache.js`, `api/middleware/rateLimiter.js`. Tests: `test/unit/{backendClient,backendClientBreaker,rateLimiter,orderCache}.test.js`, `test/integration/ordersApi.test.js` |
| 7 | Frontend | React + Redux Toolkit + Tailwind: order submit form, order lookup view, talking only to the BFF | Done | `frontend/src/**`. No automated frontend tests (per scope) — verified manually in the Claude Code browser pane against the live BFF (see below) |
| 8 | Full regression | Run all unit + integration tests end-to-end (backend + BFF), manual smoke test via running app (frontend → BFF → backend → SQL Server/Redis) | Done | See "Live end-to-end verification" below |
| 9 | Backend: customer & inventory list endpoints | `GET /internal/customers`, `GET /internal/inventory` (list-all), consolidating the old seed-only routes into first-class `POST`/`GET` resource endpoints at `/internal/customers` and `/internal/inventory` | Done | Added `customerRepository.list()` / `inventoryRepository.list()`, `api/controllers/{customersController,inventoryController}.js`, `api/routes/{customers,inventory}.routes.js`; removed `seed.routes.js`/`seedController.js`/`seedSchemas.js`. Tests: `test/integration/customersInventoryApi.test.js`. Full suite: 8 suites / 54 tests passing |
| 10 | BFF: customer & inventory proxy routes | `GET`/`POST /customers`, `GET`/`POST /inventory` on the BFF (rate-limited, edge-validated, breaker-wrapped to the backend) | Done | `client/backendClient.js` refactored around a shared `createBreakerCall()` factory (was duplicated per-method); new `api/{routes,controllers,validation}` for customers/inventory. Tests: extended `test/unit/backendClient.test.js`, new `test/integration/customersInventoryApi.test.js`. Full suite: 6 suites / 35 tests passing |
| 11 | Frontend: 3-page restructure | react-router-dom with real routes: `/orders` (submit + lookup, existing), `/customers` (add form + list table), `/inventory` (add form + list table); simple nav bar | Done | `App.jsx`/`main.jsx` (BrowserRouter + Routes + NavLink nav), `features/order/OrderPage.jsx` (wraps existing submit+lookup), `features/customer/{customerSlice,CustomerPage}.jsx`, `features/inventory/{inventorySlice,InventoryPage}.jsx`, `api/client.js` extended with list/add customer/inventory calls |
| 12 | Full regression (post-restructure) | Backend + BFF automated tests, frontend build, live browser smoke test of all three pages | Done | 8 backend suites / 54 tests, 6 BFF suites / 35 tests, frontend `npm run build` clean. Live in the browser pane: Customer page listed pre-seeded `cust001`/`cust002`, adding `cust003` (Unknown) refreshed the table; Inventory page listed pre-seeded rows with correct post-decrement quantities (`WH-A: 2`, `WH-B: 40`), adding `prod02`/`WH-C` refreshed the table; Order page (moved to its own route) still released a new order (`ord3001`, `prod02`, `WH-C x 20`) end-to-end |

### Verification so far
- `cd backend && npm install && npm test` → 8 suites / 54 tests passing (Node v22.18.0). Repositories mocked — no live DB required for these tests.
- `cd bff && npm install && npm test` → 6 suites / 35 tests passing. Redis and the backend HTTP client are mocked — no live Redis/backend required for these tests.
- `cd frontend && npm run build` → builds cleanly with Vite.

### Live end-to-end verification (this session)
Ran real infra via `infra/docker-compose.yml` (SQL Server + Redis, both Docker containers), applied `db/sql/001_M08945_orderfulfillment_schema.sql` against a real `M08945_orderfulfillment` database, started the real `backend` and `bff` servers, and drove the frontend in a real browser (Claude Code's browser pane) — no mocks anywhere in this pass. Confirmed against the FRD's exact examples and edge cases:
- `POST /orders` for `ord1001` (60 units, `prod01`) → `Released` from `WH-B` (skipping `WH-A`, which only had 10 units) — matches the FRD's exact example response byte-for-byte.
- Resubmitting `ord1001` → identical result returned; verified in the DB that `WH-B` was decremented exactly once (100 → 40) and the event log has exactly one `OrderSubmitted`/`OrderReleased` pair — idempotency confirmed at the data level, not just the API response.
- `ord1003` for a `CreditHold` customer → `Blocked`, `blocked-credithold` — matches the FRD's exact example.
- An order quantity exceeding every warehouse → `Blocked`, `blocked-nowarehouseavailable`.
- Invalid `customertype` (`"priority"`) → `400 validation_error` naming the offending field.
- Direct call to the backend without `X-Internal-Token` → `401 unauthorized` (confirms the BFF-only access path is enforced).
- `GET /orders/ord9999` → `404 { "orderid": "ord9999", "error": "order not found" }`, exact shape.
- Rate limiting: 40 truly concurrent requests from a single Node process → exactly 20 `200`s and 20 `429`s, matching `RATE_LIMIT_POINTS=20`.
- Redis cache: confirmed `bff:order:ord1001` key present after a `GET`.
- Frontend, live in a browser against the real BFF: submit → Released card renders (`WH-A x 5`, etc.); lookup → Blocked card renders; lookup of an unknown order → "Order not found" message renders.

**Two real bugs were found and fixed during this live pass** (neither was caught by the mocked unit/integration tests, since both are cross-service integration concerns):
1. **Missing CORS on the BFF** — the frontend (`localhost:3000`) and BFF (`localhost:4000`) are different origins; without `cors` middleware the browser silently failed every fetch (surfaced as a generic `request_failed`, not an HTTP error). Fixed by adding the `cors` package, scoped to `FRONTEND_ORIGIN` env (see `bff/src/app.js`, `bff/src/config/env.js`).
2. **`createAsyncThunk` rejections not using `rejectWithValue`** — `return Promise.reject(body)` puts the value in `action.error` (a generic serialized error), not `action.payload`, so the UI never saw the real `{orderid, error}` body on a 4xx/404. Fixed in both `submitOrderSlice.js` and `lookupOrderSlice.js`. Documented in the `frontend` skill so future thunks don't repeat it.

## How this file is used
- The DB schema (`db/sql/001_M08945_orderfulfillment_schema.sql`) is executed manually by the user, not by any automated migration step.
- Each backend/BFF phase (1–6) includes writing its own unit tests (and integration tests where DB/Redis are touched) before being marked `Done`.
- This file is updated at the end of each phase, in the same session that completes it.
