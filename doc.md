# FlashKart

Hands-on flash-sale backend. Redis is the allocation counter. Postgres is the system of record for users, carts, reservations, and orders.

## Run

```bash
brew services start postgresql@17
brew services start redis
npm install
npm run dev
```

The API listens on port 3000. `npm run verify` fires 50 concurrent reserves against a 20-unit product and checks that a repeated checkout key cannot create a second order.

`DATABASE_URL` uses the local Postgres socket (`host=/tmp`). Homebrew trusts socket connections and requires a password for TCP to `127.0.0.1`.

## Entity assumptions

- A user has at most one active reservation per product.
- `Product.stock` is units still available to sell. It decreases only when an order commits.
- Redis `flashkart:stock:{productId}` is the live counter. It decreases when a hold is taken and increases when that hold is released or expires.
- Money is `numeric(12,2)`. Status values are constrained strings, not a separate workflow engine.
- The demo shopper is `demo@flashkart.local`, sent by the client as `x-user-id`. Checkout requires `x-idempotency-key`.

## Reserve (`POST /cart/reserve`)

A Lua script reads the hold key and the stock counter, then writes the decrement, the reservation payload, the per-user hold, and the expiry score. Redis executes that script alone, so two requests cannot both observe the last unit and both decrement it.

The hold lasts 5 minutes. The same user and product returns the active hold instead of taking a second one. If the database insert fails, the script's decrement is reversed.

## Checkout (`POST /order/checkout`)

The order is written in one database transaction:

1. `SELECT ... FOR UPDATE` on the reservation, then on the product.
2. Reject a missing, closed, or expired hold. An expired or unfulfillable hold is marked, and its Redis stock is returned after the transaction commits.
3. Insert the order and line item, decrement `Product.stock`, and mark the reservation consumed.
4. After commit, delete the Redis hold without returning stock.

`UNIQUE (userId, idempotencyKey)` and `UNIQUE (reservationId)` make a duplicate insert fail. A repeat with the same key returns the original order. A second key for a consumed reservation is rejected. Refreshing the payment step cannot create a second order.

## Oversell incident

Stock 100 and 120 orders means the sale counter was not atomic. Two requests both read one unit left and both wrote an order. The fix is the Redis script above, plus a row lock and `stock >= 0` check at checkout so a drifted counter still cannot commit an order the database cannot cover.

## If Redis or Postgres fails

- Redis down: reserve and checkout stop. Confirmed orders remain in Postgres. No new holds are granted, so the failure undersells rather than oversells.
- Redis wiped: the next reserve rebuilds the counter as `product.stock - still-active holds`.
- Postgres down: nothing is confirmed. Redis holds expire and the sweeper returns stock once the database is back.
- Process crashes after the order commits and before the Redis deleted: the sweeper sees a consumed reservation and drops the hold without incrementing stock.

## 10k requests/sec

Put stateless Node instances behind a load balancer. Reservations stay on one Redis (or Redis Cluster sharded by product) so the script remains atomic. Postgres receives only successful checkouts, with a connection pool and the product row lock held for a short transaction. Read the product card from Redis. Scale the API horizontally; do not scale the stock counter by giving each instance its own copy.
