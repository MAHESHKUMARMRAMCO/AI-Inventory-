# M08945 Order Fulfillment

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full business rules, service architecture, and API contract, and [PROGRESS.md](./PROGRESS.md) for live phase-by-phase build status.

Three services, each with its own `package.json`/`node_modules` — no shared workspace:

```
frontend/  → talks only to →  bff/  → talks only to →  backend/  → SQL Server
                                 ↕
                               Redis
```

## 1. Start infra (SQL Server + Redis)

```bash
cd infra
docker compose up -d
```

Then run the schema manually against the `sqlserver` container (this project never runs migrations automatically):

```bash
sqlcmd -S localhost -U sa -P "Ch@ngeMe123!" -Q "CREATE DATABASE M08945_orderfulfillment"
sqlcmd -S localhost -U sa -P "Ch@ngeMe123!" -d M08945_orderfulfillment -i db/sql/001_M08945_orderfulfillment_schema.sql
```

## 2. Backend (internal-only, port 4001)

```bash
cd backend
npm install
copy .env.example .env   # (Windows) or: cp .env.example .env
npm test                 # unit + integration tests, repositories mocked — no DB needed
npm start
```

## 3. BFF (public edge, port 4000)

```bash
cd bff
npm install
copy .env.example .env
npm test                 # unit + integration tests, backend/Redis mocked
npm start
```

`INTERNAL_SHARED_SECRET` in `bff/.env` must match the same value in `backend/.env`.

## 4. Frontend (port 3000)

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

## 5. Add customers/inventory

Either through the frontend's **Customer** and **Inventory** pages (they call the BFF), or directly via `curl`:

```bash
curl -X POST http://localhost:4000/customers -H "Content-Type: application/json" \
  -d "{\"customerid\":\"cust001\",\"eligibilitystatus\":\"Eligible\"}"

curl -X POST http://localhost:4000/inventory -H "Content-Type: application/json" \
  -d "{\"productid\":\"prod01\",\"warehouseid\":\"WH-B\",\"availablequantity\":100,\"earliestdispatchdate\":\"2026-09-01\"}"
```

Or directly against the backend, bypassing the BFF (useful for scripts — needs the shared secret):

```bash
curl -X POST http://localhost:4001/internal/customers \
  -H "Content-Type: application/json" -H "X-Internal-Token: <your secret>" \
  -d "{\"customerid\":\"cust001\",\"eligibilitystatus\":\"Eligible\"}"
```

## 6. Exercise the order API (through the BFF, port 4000)

```bash
curl -X POST http://localhost:4000/orders -H "Content-Type: application/json" \
  -d "{\"orderid\":\"ord1001\",\"customerid\":\"cust001\",\"customertype\":\"Standard\",\"productid\":\"prod01\",\"quantity\":60,\"promiseddeliverydate\":\"2026-09-25\"}"

curl http://localhost:4000/orders/ord1001
```

## 7. Frontend pages

- `/orders` — submit an order, look up a result by `orderid`.
- `/customers` — add a customer, see the list of all customers.
- `/inventory` — add an inventory row (per product+warehouse), see the list of all inventory.
