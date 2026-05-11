---

## 6. API CONTRACTS

All APIs are JSON over HTTPS. Versioned under `/api/v1/`. Auth via session cookie for browser; bearer JWT for server-to-server (AI agent, webhooks). All money in **kobo (integer)**. All timestamps in ISO 8601 UTC.

Standard response shapes:

```jsonc
// Success
{ "data": <payload>, "meta": { ... } }

// Paginated
{ "data": [...], "meta": { "page": 1, "page_size": 25, "total": 421, "total_pages": 17 } }

// Error
{ "error": { "code": "STOCK_UNAVAILABLE", "message": "Only 3 left", "details": { ... } } }
```

Standard HTTP codes: 200 OK, 201 Created, 204 No Content, 400 Bad Request (validation), 401 Unauthorized, 403 Forbidden (authz), 404 Not Found, 409 Conflict (idempotency / state), 422 Unprocessable, 429 Too Many Requests, 500 Server Error.

### 6.1 Public Storefront API

```
GET    /api/v1/categories                              # tree
GET    /api/v1/categories/:slug
GET    /api/v1/products                                # ?category=, ?collection=, ?q=, ?tags=, ?min_price=, ?max_price=, ?sort=, ?page=, ?in_stock=true
GET    /api/v1/products/:slug                          # full detail with variants, images, bulk tiers
GET    /api/v1/products/:id/related
GET    /api/v1/collections
GET    /api/v1/collections/:slug

POST   /api/v1/cart                                    # create cart, returns {id, session_token}
GET    /api/v1/cart/:id
POST   /api/v1/cart/:id/items                          # {product_id, variant_id?, quantity}
PATCH  /api/v1/cart/:id/items/:itemId                  # {quantity}
DELETE /api/v1/cart/:id/items/:itemId
POST   /api/v1/cart/:id/coupon                         # {code}
DELETE /api/v1/cart/:id/coupon
POST   /api/v1/cart/:id/shipping                       # {address}, returns updated totals + zone match
POST   /api/v1/cart/:id/quote                          # idempotent recalc — returns full breakdown without committing

POST   /api/v1/checkout/:cartId                        # create order; reserves stock
GET    /api/v1/orders/:orderNumber/track               # public, requires {order_number, email_or_phone}
GET    /api/v1/orders/:id                              # authenticated customer

POST   /api/v1/auth/request-otp                        # {phone_or_email}
POST   /api/v1/auth/verify-otp                         # {phone_or_email, code}
POST   /api/v1/auth/logout

GET    /api/v1/me                                      # authed customer profile
GET    /api/v1/me/orders
GET    /api/v1/me/addresses
POST   /api/v1/me/addresses
PATCH  /api/v1/me/addresses/:id
DELETE /api/v1/me/addresses/:id

POST   /api/v1/me/orders/:id/return                    # initiate return
POST   /api/v1/returns/:id/photos
```

### 6.2 Admin API (all under `/api/v1/admin/...`)

```
# Orders
GET    /admin/orders                                   # filterable: status, payment_status, source, date range, customer, staff
POST   /admin/orders                                   # staff-create
GET    /admin/orders/:id
PATCH  /admin/orders/:id                               # status, notes, etc.
POST   /admin/orders/:id/items                         # add item to existing order
PATCH  /admin/orders/:id/items/:itemId
DELETE /admin/orders/:id/items/:itemId
POST   /admin/orders/:id/discounts                     # apply manual or coupon
DELETE /admin/orders/:id/discounts/:id
POST   /admin/orders/:id/payments                      # record a payment leg
PATCH  /admin/orders/:id/shipping                      # adjust/waive shipping
POST   /admin/orders/:id/payment-link                  # generate Nuqood link, optionally for partial amount
POST   /admin/orders/:id/cancel                        # {reason}
POST   /admin/orders/:id/transition                    # {to_status, note}

# Returns
GET    /admin/returns
POST   /admin/returns                                   # staff-initiated
GET    /admin/returns/:id
POST   /admin/returns/:id/approve
POST   /admin/returns/:id/reject                        # {note}
POST   /admin/returns/:id/receive                       # mark items received, set conditions
POST   /admin/returns/:id/refund                        # {method, amount_kobo}

# Products
GET    /admin/products
POST   /admin/products
GET    /admin/products/:id
PATCH  /admin/products/:id
DELETE /admin/products/:id                              # soft delete to archived
POST   /admin/products/:id/images
DELETE /admin/products/:id/images/:imageId
PATCH  /admin/products/:id/images/reorder
POST   /admin/products/:id/variants
PATCH  /admin/products/:id/variants/:variantId
DELETE /admin/products/:id/variants/:variantId
POST   /admin/products/:id/bulk-tiers
PATCH  /admin/products/:id/bulk-tiers/:tierId
DELETE /admin/products/:id/bulk-tiers/:tierId
POST   /admin/products/:id/stock-adjustment             # {variant_id, delta, reason, note}
POST   /admin/products/bulk                             # bulk-edit prices, status, etc.

# Categories & collections
GET    /admin/categories
POST   /admin/categories
PATCH  /admin/categories/:id
DELETE /admin/categories/:id
PATCH  /admin/categories/reorder

# Customers
GET    /admin/customers
POST   /admin/customers
GET    /admin/customers/:id
PATCH  /admin/customers/:id
POST   /admin/customers/:id/notes
POST   /admin/customers/:id/tags
DELETE /admin/customers/:id/tags/:tagId
POST   /admin/customers/:id/store-credit                 # {delta, reason}

# Discounts
GET    /admin/coupons
POST   /admin/coupons
PATCH  /admin/coupons/:id
DELETE /admin/coupons/:id
POST   /admin/coupons/:id/disable

# Shipping
GET    /admin/shipping/zones
POST   /admin/shipping/zones
PATCH  /admin/shipping/zones/:id
DELETE /admin/shipping/zones/:id
GET    /admin/shipping/settings
PATCH  /admin/shipping/settings

# Staff & roles
GET    /admin/staff
POST   /admin/staff
PATCH  /admin/staff/:id
POST   /admin/staff/:id/disable
POST   /admin/staff/:id/reset-password
GET    /admin/roles
POST   /admin/roles
PATCH  /admin/roles/:id
DELETE /admin/roles/:id
GET    /admin/activity                                   # audit log, filterable

# AI
GET    /admin/ai/settings
PATCH  /admin/ai/settings
GET    /admin/ai/knowledge
POST   /admin/ai/knowledge
PATCH  /admin/ai/knowledge/:id
DELETE /admin/ai/knowledge/:id
GET    /admin/ai/conversations                          # filter by status, channel, sentiment, date
GET    /admin/ai/conversations/:id
POST   /admin/ai/conversations/:id/handoff              # take over
POST   /admin/ai/conversations/:id/release              # release back to AI

# Reports
GET    /admin/reports/revenue?from=&to=&group=day|week|month
GET    /admin/reports/products?from=&to=&sort=units|revenue
GET    /admin/reports/sources?from=&to=
GET    /admin/reports/staff?from=&to=
GET    /admin/reports/returns?from=&to=
GET    /admin/reports/customers?from=&to=
GET    /admin/reports/discounts?from=&to=
GET    /admin/reports/ai?from=&to=
GET    /admin/reports/inventory
GET    /admin/reports/payments?from=&to=
POST   /admin/reports/export                            # async, returns job_id; downloadable when ready

# Settings
GET    /admin/settings/business
PATCH  /admin/settings/business
GET    /admin/settings/payments
PATCH  /admin/settings/payments
GET    /admin/settings/notifications
PATCH  /admin/settings/notifications/templates/:key
GET    /admin/settings/integrations

# Bumpa migration
POST   /admin/migration/bumpa/start                     # async; returns batch_id
GET    /admin/migration/bumpa/:batchId
POST   /admin/migration/bumpa/:batchId/retry
```

### 6.3 AI Agent Tool API (server-to-server, called by the LLM orchestrator)

```
POST   /api/v1/ai/tools/search-products            { query, limit }
POST   /api/v1/ai/tools/get-product                { id_or_slug }
POST   /api/v1/ai/tools/check-stock                { product_id, variant_id, quantity }
POST   /api/v1/ai/tools/get-bulk-pricing           { product_id, variant_id, quantity }
POST   /api/v1/ai/tools/quote-order                { items: [{product_id, variant_id, quantity}], address?, coupon_code? }
POST   /api/v1/ai/tools/upsert-customer            { phone, full_name?, email?, address? }
POST   /api/v1/ai/tools/create-order               { customer_id, items[], shipping_address, source, channel_meta, conversation_id }
POST   /api/v1/ai/tools/generate-payment-link      { order_id, amount_kobo? }   # full or partial
POST   /api/v1/ai/tools/get-order-status           { order_number, customer_phone }
POST   /api/v1/ai/tools/initiate-return            { order_id, items[], reason, photos_urls[] }
POST   /api/v1/ai/tools/negotiate-price            { product_id, variant_id, customer_offer_kobo, quantity }
                                                   # Returns: { acceptable: bool, counter_offer_kobo?, floor_kobo, message_hint }
POST   /api/v1/ai/tools/request-handoff            { conversation_id, reason }
POST   /api/v1/ai/tools/recommend-products         { customer_id?, current_product_id?, limit }
```

### 6.4 Webhooks (inbound)

```
POST   /api/v1/webhooks/nuqood                          # payment events; verify HMAC signature
POST   /api/v1/webhooks/whatsapp/:channelId             # incoming messages, status, delivery; verify Meta signature
POST   /api/v1/webhooks/courier/:provider               # delivery status updates (where supported)
```

### 6.5 Critical API Behaviours

**Idempotency.** Every POST that creates state must accept an `Idempotency-Key` header. Same key + same body = return original response. Different body with same key = 409 Conflict. Required on `/checkout`, `/orders/:id/payments`, `/payment-link`, all webhooks.

**Cart quoting.** `POST /cart/:id/quote` returns the full breakdown without modifying the cart. The storefront calls this after every change to show live totals. This is also what the AI agent calls before confirming an order.

```jsonc
// Quote response shape
{
  "data": {
    "subtotal_kobo": 4500000,
    "discounts": [
      { "type": "bulk_tier", "description": "Bulk 10+ (10% off)", "amount_kobo": 450000, "target": "item:abc..." },
      { "type": "coupon", "description": "SUMMER10 (10% off order)", "amount_kobo": 405000, "target": "order" }
    ],
    "discounts_total_kobo": 855000,
    "shipping": {
      "zone_id": "uuid", "zone_name": "Lagos Mainland",
      "fee_kobo": 200000, "estimated_days_min": 1, "estimated_days_max": 2,
      "free_threshold_met": false
    },
    "total_kobo": 3845000,
    "items": [
      { "id": "...", "quantity": 12, "unit_price_kobo": 375000, "unit_discount_kobo": 37500, "line_total_kobo": 4050000, "stock_ok": true }
    ],
    "warnings": [],   // e.g. "Item X dropped from 5 to 3 in stock; please review"
    "errors": []      // e.g. "Coupon expired"
  }
}
```

**Stock validation on checkout.** Server-side, atomic, transactional: SELECT FOR UPDATE on relevant `product_stock_levels` rows, verify `on_hand - reserved >= requested`, increment `reserved`, insert `stock_reservations`, all in a single transaction. If any item fails, fail the entire checkout with explicit per-item details so UI can surface "X is now out of stock".

**Order numbers.** Generated in form `AVM-{YYYY}-{8-digit-sequence}` from a Postgres sequence. Never expose internal UUIDs to customers.

**Field-level errors.** Validation errors return `details` keyed by field path:
```jsonc
{ "error": { "code": "VALIDATION", "message": "Some fields are invalid",
  "details": { "items[0].quantity": "Below minimum order quantity (10)", "shipping_address.state": "Required" } } }
```
