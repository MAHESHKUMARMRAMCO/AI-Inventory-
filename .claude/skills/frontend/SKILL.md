---
name: frontend
description: Conventions and scope for the M08945 order-fulfillment frontend (React + Redux Toolkit + Tailwind). Load before writing or modifying any file under frontend/.
---

# M08945 Order Fulfillment — Frontend Skill

Keep this deliberately minimal — the business priority for this project is the backend; the frontend only needs to be *sufficient*, not polished. Don't add screens, styling polish, or state beyond what's listed here.

## Stack & constraints
- React + Redux Toolkit + Tailwind CSS + `react-router-dom` (real URL routes, not tab-switching state). `frontend/` has its own `package.json`/`node_modules`, never shared with `backend/`/`bff/`.
- No frontend automated tests are in scope for this project (backend/BFF carry all the unit/integration test coverage). Verify manually in a browser instead.
- Talks **only** to the BFF (`bff/`, default `http://localhost:4000`) — never to the backend directly. See `ARCHITECTURE.md` §3 for the exact contract.

## Scope — three pages, nothing else
Nav bar links to all three; `/` redirects to `/orders`.

1. **`/orders`** (`features/order/OrderPage.jsx`): **submit order** form (`orderid`, `customerid`, `customertype` `Standard`/`Priority` select, `productid`, `quantity`, `promiseddeliverydate` date input) → `POST /orders`, renders `status`/`reason`/`releasedquantity`/`backorderedquantity`/`allocations`. Plus **lookup order** (single `orderid` input) → `GET /orders/:orderid`, same result shape or a clear "order not found" message on 404.
2. **`/customers`** (`features/customer/CustomerPage.jsx`): add-customer form (`customerid`, `eligibilitystatus` `Eligible`/`CreditHold`/`Unknown` select) → `POST /customers`; a table below listing all customers from `GET /customers`, refreshed after every successful add.
3. **`/inventory`** (`features/inventory/InventoryPage.jsx`): add-inventory form (`productid`, `warehouseid` `WH-A`/`WH-B`/`WH-C` select, `availablequantity`, `earliestdispatchdate` date input) → `POST /inventory`; a table below listing all inventory rows from `GET /inventory`, refreshed after every successful add.

No delete/edit UI anywhere — `POST /customers` and `POST /inventory` are upserts (resubmitting the same key updates it), which covers correcting a mistake without a separate edit screen.

## Field names — use exactly as-is, no renaming/camelCasing
`orderid, customerid, customertype, productid, quantity, promiseddeliverydate, status, reason, releasedquantity, backorderedquantity, allocations, warehouseid, allocatedquantity, eligibilitystatus, availablequantity, earliestdispatchdate`. `customertype` is exactly `Standard` or `Priority`; `eligibilitystatus` is exactly `Eligible`/`CreditHold`/`Unknown`; `warehouseid` is exactly `WH-A`/`WH-B`/`WH-C`.

## Redux Toolkit usage
One slice per feature (`submitOrderSlice`, `lookupOrderSlice`, `customerSlice`, `inventorySlice`) holding request status (`idle|loading|succeeded|failed`) and the last result/error (plus, for customer/inventory, an `items` list and its own `listStatus`) — don't build a larger global domain store than that.

Every `createAsyncThunk` payload creator that rejects on a non-2xx response **must** use `rejectWithValue(body)`, not `return Promise.reject(body)` / `throw body`. Redux Toolkit only puts the rejection value into `action.payload` when `rejectWithValue` is used — a plain throw/reject goes into `action.error` (a serialized `{name, message, stack}`) instead, silently discarding the actual response body (e.g. the `{orderid, error: "order not found"}` shape) that the UI needs to render. This was caught live: the lookup view showed a generic `request_failed` instead of "Order not found" until fixed.

## Cross-origin note
The BFF has `cors` scoped to `FRONTEND_ORIGIN` (default `http://localhost:3000`) — if the frontend dev server ever runs on a different port, `bff/.env`'s `FRONTEND_ORIGIN` must be updated to match, or every fetch fails silently in the browser (caught live once already).
