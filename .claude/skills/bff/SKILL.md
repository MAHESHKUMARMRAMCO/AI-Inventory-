---
name: bff
description: Conventions, cross-cutting responsibilities, and file layout for the M08945 order-fulfillment BFF (Backend-For-Frontend Express service). Load before writing or modifying any file under bff/.
---

# M08945 Order Fulfillment — BFF Skill

Full architecture context lives in `ARCHITECTURE.md` and phase status in `PROGRESS.md` at the repo root — read both before starting a phase. This skill is the condensed, BFF-specific reference.

## Role
The BFF is the **only public entry point**. The frontend talks only to it; it never talks to the backend directly, and the backend never talks to the frontend directly. The BFF owns every cross-cutting HTTP concern (rate limiting, response caching, request validation, resilience to a failing backend) so the backend can stay a pure internal domain/CQRS service.

## Stack & non-negotiable constraints
- Node.js + Express. `bff/` has its own `package.json` and `node_modules` — never shared with `backend/` or `frontend/`.
- Redis (`ioredis` + `rate-limiter-flexible`) for rate limiting and the order-lookup response cache.
- `opossum` for a circuit breaker around every call to the backend.
- `axios` (or `node-fetch`) for the HTTP client to the backend, sending the shared-secret header `X-Internal-Token` (value from `INTERNAL_SHARED_SECRET` env, same value the backend checks).
- `helmet` for HTTP security headers; `cors` restricted to `FRONTEND_ORIGIN` (the frontend is a different origin/port, so this is required — a live browser smoke test caught its absence as a silent failed-fetch, not a clean HTTP error); `zod` for request validation at the edge — reject bad requests here before ever calling the backend.
- Tests: Jest + Supertest. Every phase must ship its own passing unit tests (and integration tests where Redis/backend calls are touched) before `PROGRESS.md` is updated to `Done`.

## Exact field names and literal values (do not deviate)
Same as the backend/db skills — the BFF passes these through byte-for-byte, no renaming:
`orderid, customerid, customertype, productid, quantity, promiseddeliverydate, status, reason, releasedquantity, backorderedquantity, allocations, warehouseid, allocatedquantity`.
`customertype` ∈ `Standard`|`Priority`; `warehouseid` ∈ `WH-A`|`WH-B`|`WH-C`; `status` ∈ `Released`|`Blocked`; `reason` null unless `Blocked`.

## Routes (public contract — see `ARCHITECTURE.md` §3)
- `POST /orders` → validate body (zod) → `backendClient.submitOrder(body)` → return backend's response verbatim with backend's status code.
- `GET /orders/:orderid` → check cache (`cache/orderCache.js`) → hit: return cached body with `200`. Miss → `backendClient.getOrder(orderid)` → backend `200`: cache it, return `200`. Backend `404`: return `404` verbatim, **do not cache**.

## Circuit breaker (BFF → backend)
`client/backendClient.js` wraps both calls with one `opossum` breaker per method (`timeout: 5000`, `errorThresholdPercentage: 50`, `resetTimeout: 15000`) — longer timeout/reset than the backend's own DB breaker, since this hop already includes the backend's own DB round trip. Open-circuit or timeout → throw a typed error the controller maps to `503 { "error": "service_unavailable" }`, without ever making the HTTP call.

## Redis cache-aside for `GET /orders/:orderid`
Key: `bff:order:{orderid}`. **Only cache a successful (200) result** — a decided order (`Released` or `Blocked`) is immutable (no cancel/reversal flow, idempotent resubmission returns the same result), so there is no invalidation problem and no staleness risk at any TTL. **Never cache a 404** — the order may not exist *yet* (e.g. a `GET` racing an in-flight `POST`), and that absence is not a durable fact. TTL: 5 minutes, chosen only to bound memory.

## Rate limiting
`rate-limiter-flexible`'s `RateLimiterRedis`, keyed by client IP, applied as middleware in front of both `/orders` routes. Exceeded → `429 { "error": "rate_limited" }` before validation or any backend call.

## API error conventions (BFF-added, on top of what it proxies from the backend)
- `400 { "error": "validation_error", "details": [...] }` — edge validation failure (same shape as backend's, so the frontend doesn't need to branch).
- `429 { "error": "rate_limited" }` — rate limit exceeded.
- `503 { "error": "service_unavailable" }` — breaker open (backend unreachable/slow).
- Everything else (`200`/`404` with order/allocation bodies) is proxied verbatim from the backend.

## Folder layout
See `ARCHITECTURE.md` §4 for the full tree. Key files: `client/backendClient.js`, `cache/orderCache.js`, `api/middleware/rateLimiter.js`, `api/middleware/validateRequest.js`, `api/controllers/ordersController.js`.
