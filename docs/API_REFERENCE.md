# API reference

Local base: `http://127.0.0.1:3001`. These routes are for loopback development only; order routes have no authentication.

| Method | Route                     | Behavior                                                                                                                                                                                                                                                     |
| ------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/api/health`             | Liveness response.                                                                                                                                                                                                                                           |
| GET    | `/api/readiness`          | Database connectivity and PayPal credential configuration; returns 503 when the database is unavailable. This does not prove a PayPal transaction worked.                                                                                                    |
| GET    | `/api/orders`             | Latest 20 local orders with merchant and capture records.                                                                                                                                                                                                    |
| GET    | `/api/orders/:id`         | One local order with merchant and capture records.                                                                                                                                                                                                           |
| POST   | `/api/orders`             | Accepts integer `amountMinor` (1-1,000,000) and optional `itemName`; creates a local order and PayPal Sandbox order, then returns the approval URL. `itemName` is returned but not persisted.                                                                |
| POST   | `/api/orders/:id/capture` | Calls PayPal Sandbox capture using the stored order/request IDs. Validates the capture amount and currency, then stores the capture and updates the order in a database transaction. A previously completed capture is returned without another PayPal call. |

The local return and cancel URLs use `http://127.0.0.1:5173`. `GET /api/readiness` may report `paypal: configured_unverified` when credentials exist; this is a configuration state, not OAuth or checkout verification. `paymentFlow` remains `not_implemented` pending a successful end-to-end Sandbox check.
