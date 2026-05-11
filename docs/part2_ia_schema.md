---

## 4. INFORMATION ARCHITECTURE

### 4.1 Storefront Sitemap

```
/                                Home (hero, featured collections, top products)
/category/[slug]                 Category landing (with subcategories + filtered products)
/category/[slug]/[subslug]       Subcategory listing
/products                        All products (with filters)
/product/[slug]                  Product detail
/search?q=                       Search results
/cart                            Shopping cart
/checkout                        Single-page checkout (address → shipping → payment)
/checkout/confirmation/[orderId] Post-payment success / status page
/orders/track                    Public tracking page (order ID + email/phone)
/orders/[orderId]                Customer-authenticated order detail
/account                         Account dashboard (orders, addresses, returns)
/account/orders
/account/orders/[orderId]
/account/orders/[orderId]/return Initiate return
/account/returns
/account/addresses
/account/profile
/auth/login                      OTP-based login (phone or email)
/auth/verify
/policies/shipping
/policies/returns
/policies/privacy
/policies/terms
/contact                         Contact + WhatsApp deep link
```

### 4.2 Admin Sitemap

```
/admin                                       Dashboard home (KPIs, recent orders, alerts)
/admin/orders                                Orders list
/admin/orders/new                            Create order (staff)
/admin/orders/[id]                           Order detail
/admin/orders/[id]/edit
/admin/orders/[id]/payments                  Add/manage payments (split payment)
/admin/orders/[id]/return                    Initiate or manage return on this order
/admin/products                              Products list
/admin/products/new
/admin/products/[id]                         Product editor (drawer or full page)
/admin/products/categories                   Category tree manager
/admin/products/collections                  Collections manager
/admin/products/inventory                    Stock view (low stock, out of stock filters)
/admin/customers
/admin/customers/[id]
/admin/customers/[id]/orders
/admin/customers/[id]/notes
/admin/returns
/admin/returns/[id]
/admin/discounts                             Coupons + sale rules
/admin/discounts/new
/admin/discounts/[id]
/admin/shipping                              Shipping rules / zones
/admin/staff                                 Staff list
/admin/staff/new
/admin/staff/[id]                            Edit staff
/admin/staff/roles                           Role builder
/admin/staff/activity                        Activity log (audit)
/admin/reports
/admin/reports/revenue
/admin/reports/products
/admin/reports/sources
/admin/reports/staff
/admin/reports/returns
/admin/reports/customers
/admin/reports/discounts
/admin/reports/ai
/admin/reports/inventory
/admin/reports/payments                      Payment method breakdown, partial-paid orders
/admin/ai                                    AI agent control panel (knowledge base, settings)
/admin/ai/conversations                      Browse conversations
/admin/ai/conversations/[id]                 Inspect / take over
/admin/ai/handoffs                           Active handoff queue
/admin/whatsapp                              Channel status, templates
/admin/settings/business                     Business info (name, address, hours, contact)
/admin/settings/payments                     Nuqood keys, payment methods, partial-paid policy
/admin/settings/notifications                Email/SMS templates and triggers
/admin/settings/integrations                 Bumpa migration, courier APIs
/admin/settings/billing                      Super Admin only
```

### 4.3 Public Storefront Footer (always present)

Categories • All products • Shipping policy • Returns policy • Privacy • Terms • Contact • WhatsApp link • Social handles

---

## 5. CORE DOMAIN MODELS (DATABASE SCHEMA)

This is the canonical schema. The builder must implement every table and field. Field naming: snake_case for SQL, camelCase in TypeScript/Prisma. All money fields are integer kobo (`bigint` if values may exceed ~21M Naira, otherwise `int`). All timestamps are `timestamptz` with UTC server time. All IDs are UUIDs unless noted.

> Notation: PK = primary key, FK = foreign key, NN = NOT NULL, UQ = UNIQUE, IDX = indexed.

### 5.1 Identity & Access

**`users`** (admin / staff accounts; customers use `customers` table)
```
id                uuid PK
email             text UQ NN
phone             text
password_hash     text NN              # bcrypt/argon2
full_name         text NN
role_id           uuid FK roles.id NN
is_active         bool NN default true
two_factor_secret text
last_login_at     timestamptz
created_at, updated_at
```

**`roles`**
```
id                uuid PK
name              text UQ NN          # 'super_admin', 'manager', 'sales', 'inventory', 'support', or custom
display_name      text NN
is_system         bool NN default false   # system roles cannot be deleted
description       text
created_at, updated_at
```

**`role_permissions`** (granular permissions per role)
```
role_id           uuid FK roles.id NN
permission_key    text NN             # e.g. 'orders.create', 'products.edit_pricing'
allow             bool NN default true
PRIMARY KEY (role_id, permission_key)
```

The full permission key list lives in §14.

**`audit_logs`** (append-only)
```
id                uuid PK
actor_user_id     uuid FK users.id    # null for customer / system actions
actor_type        text NN             # 'user' | 'customer' | 'system' | 'ai_agent'
action            text NN             # 'order.create', 'product.price_change', etc.
entity_type       text NN
entity_id         uuid
before            jsonb
after             jsonb
metadata          jsonb               # e.g. {ip, user_agent, channel}
created_at        timestamptz NN default now()
INDEX on (entity_type, entity_id, created_at)
INDEX on (actor_user_id, created_at)
```

### 5.2 Customers

**`customers`**
```
id                uuid PK
phone             text UQ              # Nigerian-normalised, e164 (+234...). Primary identifier.
email             text UQ
full_name         text
created_at, updated_at
notes             text                 # internal staff notes (legacy field; prefer customer_notes table for multi-author)
lifetime_value_kobo  bigint NN default 0
order_count          int NN default 0
return_count         int NN default 0
last_order_at        timestamptz
source            text                 # how they were first acquired
is_blacklisted    bool NN default false
store_credit_kobo bigint NN default 0  # available store credit balance
```

**`customer_addresses`**
```
id                uuid PK
customer_id       uuid FK customers.id NN
label             text                 # 'Home', 'Office'
recipient_name    text NN
phone             text NN
state             text NN              # Nigerian state
city              text NN
lga               text                 # Local Government Area (optional but encouraged)
street_address    text NN
landmark          text
postal_code       text
is_default        bool NN default false
created_at, updated_at
```

**`customer_tags`** (many-to-many with `customers`)
```
id                uuid PK
name              text UQ NN           # 'VIP', 'Wholesale', 'Blacklisted', 'Loyal'
colour            text                 # hex for UI
created_at
```

**`customer_tag_assignments`**
```
customer_id       uuid FK customers.id NN
tag_id            uuid FK customer_tags.id NN
assigned_by       uuid FK users.id
assigned_at       timestamptz NN default now()
PRIMARY KEY (customer_id, tag_id)
```

**`customer_notes`** (audit-friendly notes, multiple authors)
```
id                uuid PK
customer_id       uuid FK customers.id NN
author_id         uuid FK users.id NN
body              text NN
created_at
```

### 5.3 Catalogue

**`categories`** (self-referencing tree)
```
id                uuid PK
parent_id         uuid FK categories.id NULL
name              text NN
slug              text UQ NN
description       text
image_url         text
sort_order        int NN default 0
is_active         bool NN default true
seo_title         text
seo_description   text
created_at, updated_at
```

**`products`**
```
id                uuid PK
sku               text UQ              # may be null for pre-order / generated
name              text NN
slug              text UQ NN
short_description text
long_description  text                 # rich text / markdown
category_id       uuid FK categories.id
status            text NN              # 'draft' | 'published' | 'hidden' | 'archived'
availability      text NN default 'available'  # 'available' | 'pre_order'
moq               int                  # minimum order quantity, required if availability = 'pre_order'
regular_price_kobo  int NN
sale_price_kobo     int                # nullable; if set + sale_active, takes precedence
sale_starts_at      timestamptz
sale_ends_at        timestamptz
sale_active         bool NN default false
discount_value     int                 # raw value
discount_type      text                # 'fixed_kobo' | 'percentage'
discount_active    bool NN default false
last_price_kobo    int                 # AI negotiation floor; null = AI may not negotiate
negotiation_enabled bool NN default false
weight_grams       int                 # for shipping calc
length_mm          int
width_mm           int
height_mm          int
seo_title          text
seo_description    text
sort_order         int NN default 0
created_at, updated_at
created_by_id      uuid FK users.id
updated_by_id      uuid FK users.id
```

> **Stock note:** stock for non-variant products lives in `product_stock_levels` (one row). For variant products, stock lives at the variant level. Pre-order products have **no** stock row at all.

**`product_images`**
```
id                uuid PK
product_id        uuid FK products.id NN ON DELETE CASCADE
variant_id        uuid FK product_variants.id   # null = applies to product as a whole
url               text NN
alt_text          text
is_primary        bool NN default false
sort_order        int NN default 0
width             int
height            int
size_bytes        int
created_at
```

**`product_attributes`** (defines variant axes per product)
```
id                uuid PK
product_id        uuid FK products.id NN ON DELETE CASCADE
name              text NN              # 'Size', 'Colour', 'Material'
sort_order        int NN default 0
```

**`product_attribute_values`**
```
id                uuid PK
attribute_id      uuid FK product_attributes.id NN ON DELETE CASCADE
value             text NN              # 'Small', 'Red', 'Cotton'
sort_order        int NN default 0
```

**`product_variants`** (cartesian product of attribute values for a product)
```
id                uuid PK
product_id        uuid FK products.id NN
sku               text UQ
regular_price_kobo  int                # nullable; falls back to product.regular_price_kobo
sale_price_kobo     int
last_price_kobo     int
status            text NN default 'active'  # 'active' | 'disabled' | 'out_of_stock'
sort_order        int NN default 0
created_at, updated_at
```

**`product_variant_values`** (links a variant to specific attribute values)
```
variant_id        uuid FK product_variants.id NN
attribute_value_id uuid FK product_attribute_values.id NN
PRIMARY KEY (variant_id, attribute_value_id)
```

**`product_bulk_tiers`**
```
id                uuid PK
product_id        uuid FK products.id NN ON DELETE CASCADE
variant_id        uuid FK product_variants.id   # null = applies across all variants of product
min_quantity      int NN
max_quantity      int                  # null = open-ended
discount_type     text NN              # 'fixed_kobo' | 'percentage'
discount_value    int NN
is_active         bool NN default true
created_at, updated_at
INDEX on (product_id, min_quantity)
```

**`product_collections`** (curated groups: "Featured", "New Arrivals")
```
id                uuid PK
name              text NN
slug              text UQ NN
description       text
image_url         text
is_featured       bool NN default false
sort_order        int NN default 0
created_at, updated_at
```

**`product_collection_items`**
```
collection_id     uuid FK product_collections.id NN
product_id        uuid FK products.id NN
sort_order        int NN default 0
PRIMARY KEY (collection_id, product_id)
```

**`product_tags`** + **`product_tag_assignments`** — same shape as `customer_tags`.

**`product_relations`** (manual "related products")
```
product_id        uuid FK products.id NN
related_product_id uuid FK products.id NN
sort_order        int NN default 0
PRIMARY KEY (product_id, related_product_id)
```

### 5.4 Inventory

**`product_stock_levels`** (one per product OR one per variant; never both for the same product)
```
id                uuid PK
product_id        uuid FK products.id NN
variant_id        uuid FK product_variants.id     # null for products without variants
on_hand           int NN default 0      # physical stock
reserved          int NN default 0      # held in active carts/reservations
low_stock_threshold int NN default 5
updated_at        timestamptz NN
UNIQUE (product_id, variant_id)
CHECK (on_hand >= 0 AND reserved >= 0)
```

> Available = `on_hand - reserved`. When a customer adds to cart and reaches checkout, increment `reserved`. When the order is paid, decrement both `on_hand` and `reserved`. When a reservation expires or the cart is abandoned past TTL, decrement `reserved` only.

**`stock_reservations`**
```
id                uuid PK
product_id        uuid FK products.id NN
variant_id        uuid FK product_variants.id
quantity          int NN
cart_id           uuid                 # or order_id once converted
expires_at        timestamptz NN
created_at        timestamptz NN default now()
status            text NN default 'active'   # 'active' | 'consumed' | 'expired' | 'released'
INDEX on (expires_at, status)
```

**`stock_movements`** (audit of every change)
```
id                uuid PK
product_id        uuid FK products.id NN
variant_id        uuid FK product_variants.id
delta             int NN                  # +5 = added, -3 = sold
reason            text NN                 # 'order_paid', 'return_received', 'manual_adjust', 'migration_import'
reference_type    text                    # 'order', 'return', 'adjustment'
reference_id      uuid
note              text
actor_user_id     uuid FK users.id
created_at        timestamptz NN default now()
```

### 5.5 Cart

**`carts`** (anonymous or customer-linked)
```
id                uuid PK
customer_id       uuid FK customers.id     # null = guest
session_token     text UQ                  # for guest carts
status            text NN default 'active' # 'active' | 'converted' | 'abandoned' | 'expired'
shipping_address_id  uuid FK customer_addresses.id
shipping_zone_id     uuid FK shipping_zones.id
applied_coupon_code  text
notes             text
expires_at        timestamptz
created_at, updated_at
```

**`cart_items`**
```
id                uuid PK
cart_id           uuid FK carts.id NN ON DELETE CASCADE
product_id        uuid FK products.id NN
variant_id        uuid FK product_variants.id
quantity          int NN
unit_price_kobo   int NN              # snapshotted at add time
applied_bulk_tier_id uuid FK product_bulk_tiers.id
notes             text
created_at, updated_at
```

### 5.6 Orders

**`orders`**
```
id                uuid PK
order_number      text UQ NN           # human-readable: AVM-2026-00012345
customer_id       uuid FK customers.id   # may be null until customer record created
status            text NN              # 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'return_requested' | 'returned' | 'refunded'
payment_status    text NN              # 'unpaid' | 'partially_paid' | 'paid' | 'refunded' | 'partially_refunded'
source            text NN              # 'website' | 'whatsapp' | 'instagram' | 'phone' | 'walk_in' | 'referral' | 'other'
source_other_text text                  # required if source = 'other'
channel_meta      jsonb                 # e.g. {whatsapp_msg_id, ai_conversation_id}
subtotal_kobo            int NN        # sum of line items at unit_price * qty
discounts_total_kobo     int NN default 0   # all discount lines applied
shipping_fee_kobo        int NN default 0
shipping_fee_overridden  bool NN default false
shipping_method          text                # 'flat' | 'zone' | 'free' | 'manual_override' | 'pickup'
total_kobo               int NN        # final amount due
amount_paid_kobo         int NN default 0
amount_outstanding_kobo  int NN default 0    # = total - amount_paid
shipping_address  jsonb NN              # snapshot of customer_addresses at time of order
billing_address   jsonb
internal_notes    text
created_by_id     uuid FK users.id      # null if customer self-served
last_modified_by_id uuid FK users.id
ai_conversation_id uuid FK ai_conversations.id
placed_at         timestamptz NN default now()
confirmed_at      timestamptz
shipped_at        timestamptz
delivered_at      timestamptz
cancelled_at      timestamptz
cancellation_reason text
created_at, updated_at
INDEX on (status, placed_at desc)
INDEX on (customer_id, placed_at desc)
INDEX on (order_number)
```

**`order_items`**
```
id                uuid PK
order_id          uuid FK orders.id NN ON DELETE CASCADE
product_id        uuid FK products.id NN
variant_id        uuid FK product_variants.id
product_name_snapshot  text NN          # snapshot in case product is later renamed
variant_label_snapshot text             # e.g. "Red / Large"
sku_snapshot           text
quantity          int NN
unit_price_kobo   int NN                # base unit price at the time
unit_discount_kobo int NN default 0     # per-unit discount applied (e.g. bulk)
line_total_kobo   int NN                # = (unit_price - unit_discount) * quantity
applied_bulk_tier_id uuid FK product_bulk_tiers.id
applied_negotiation_kobo int NN default 0  # AI-negotiated reduction per unit
is_pre_order      bool NN default false
notes             text
```

**`order_discounts`** (every discount on the order, fully audited)
```
id                uuid PK
order_id          uuid FK orders.id NN ON DELETE CASCADE
type              text NN              # 'coupon' | 'manual' | 'bulk_tier' | 'sale_price' | 'product_discount' | 'ai_negotiation'
description       text NN              # human-readable: "Coupon SUMMER10 (10% off)"
amount_kobo       int NN               # always positive, represents amount taken off
target            text NN              # 'order' | 'item:{order_item_id}'
coupon_code       text
applied_by_id     uuid FK users.id
created_at        timestamptz
```

**`order_status_history`**
```
id                uuid PK
order_id          uuid FK orders.id NN ON DELETE CASCADE
from_status       text
to_status         text NN
note              text
actor_user_id     uuid FK users.id
actor_type        text NN              # 'user' | 'customer' | 'system' | 'ai_agent'
created_at        timestamptz NN default now()
```

### 5.7 Payments

**`payments`** (every individual payment leg of every order)
```
id                uuid PK
order_id          uuid FK orders.id NN
method            text NN              # 'cash' | 'bank_transfer' | 'pos' | 'nuqood' | 'store_credit'
amount_kobo       int NN               # positive
status            text NN              # 'pending' | 'awaiting_confirmation' | 'completed' | 'failed' | 'refunded' | 'cancelled'
reference         text                  # transfer ref, POS receipt, Nuqood transaction ID
external_id       text                  # Nuqood payment link / transaction ID
external_status   text                  # raw status from provider
notes             text
recorded_by_id    uuid FK users.id      # null if customer self-paid via Nuqood
confirmed_by_id   uuid FK users.id      # who marked it received (for cash/transfer/POS)
confirmed_at      timestamptz
expires_at        timestamptz           # for Nuqood links
created_at        timestamptz NN default now()
INDEX on (order_id, status)
INDEX on (external_id)
```

**`payment_links`** (Nuqood links specifically; one order may have several over time)
```
id                uuid PK
order_id          uuid FK orders.id NN
payment_id        uuid FK payments.id
amount_kobo       int NN
url               text NN
external_id       text                   # Nuqood reference
status            text NN                # 'active' | 'paid' | 'expired' | 'cancelled'
expires_at        timestamptz
created_at        timestamptz NN default now()
created_by_id     uuid FK users.id
channel           text                    # 'website' | 'whatsapp' | 'admin'
```

**`refunds`**
```
id                uuid PK
order_id          uuid FK orders.id NN
return_id         uuid FK returns.id
amount_kobo       int NN
method            text NN                # 'store_credit' | 'bank_transfer' | 'nuqood'
status            text NN                # 'pending' | 'processed' | 'failed'
reference         text
processed_by_id   uuid FK users.id
processed_at      timestamptz
notes             text
created_at        timestamptz NN default now()
```

### 5.8 Returns

**`returns`**
```
id                uuid PK
return_number     text UQ NN             # AVM-RET-2026-00001
order_id          uuid FK orders.id NN
customer_id       uuid FK customers.id NN
status            text NN                # 'requested' | 'approved' | 'rejected' | 'item_received' | 'refund_processed'
reason            text NN                # 'wrong_item' | 'damaged' | 'changed_mind' | 'wrong_size' | 'not_as_described' | 'other'
reason_other_text text
resolution_note   text
refund_method     text                   # 'store_credit' | 'bank_transfer' | 'nuqood'
refund_total_kobo int                    # computed from approved items
initiated_by_type text NN                # 'customer' | 'staff' | 'ai_agent'
initiated_by_id   uuid                   # user_id or customer_id depending on type
approved_by_id    uuid FK users.id
approved_at       timestamptz
received_at       timestamptz
refunded_at       timestamptz
created_at, updated_at
```

**`return_items`**
```
id                uuid PK
return_id         uuid FK returns.id NN ON DELETE CASCADE
order_item_id     uuid FK order_items.id NN
quantity          int NN
unit_refund_kobo  int NN
condition_received text                  # 'new' | 'used' | 'damaged' (filled when item received)
restock           bool NN default true   # whether to add back to inventory
```

**`return_photos`**
```
id                uuid PK
return_id         uuid FK returns.id NN ON DELETE CASCADE
url               text NN
uploaded_by_type  text NN                # 'customer' | 'staff'
uploaded_by_id    uuid
created_at
```

### 5.9 Discounts & Coupons

**`coupons`**
```
id                uuid PK
code              text UQ NN              # case-insensitive, stored uppercase
description       text
type              text NN                 # 'fixed_kobo' | 'percentage'
value             int NN                  # kobo amount or percent (1–100)
usage_limit_total      int                # null = unlimited
usage_limit_per_customer int default 1
min_order_kobo         int default 0
applies_to_scope       text NN default 'all'   # 'all' | 'products' | 'categories' | 'collections'
starts_at              timestamptz
ends_at                timestamptz
is_active              bool NN default true
times_redeemed         int NN default 0
created_at, updated_at
created_by_id          uuid FK users.id
```

**`coupon_scopes`**
```
coupon_id         uuid FK coupons.id NN ON DELETE CASCADE
scope_type        text NN                 # 'product' | 'category' | 'collection'
scope_id          uuid NN
PRIMARY KEY (coupon_id, scope_type, scope_id)
```

**`coupon_redemptions`**
```
id                uuid PK
coupon_id         uuid FK coupons.id NN
order_id          uuid FK orders.id NN
customer_id       uuid FK customers.id
amount_applied_kobo int NN
created_at        timestamptz NN default now()
```

### 5.10 Shipping

**`shipping_zones`**
```
id                uuid PK
name              text NN                 # 'Lagos Mainland', 'South-West', 'North'
sort_order        int NN default 0
is_active         bool NN default true
fee_kobo          int NN
free_threshold_kobo  int                  # if order subtotal ≥ this, free shipping
estimated_days_min int
estimated_days_max int
created_at, updated_at
```

**`shipping_zone_locations`** (which states/cities map to a zone)
```
id                uuid PK
zone_id           uuid FK shipping_zones.id NN ON DELETE CASCADE
state             text NN
city              text                    # null = entire state
lga               text                    # optional, for fine-grained mapping
```

**`shipping_settings`** (singleton config row)
```
id                int PK default 1
flat_rate_kobo    int                     # used when no zones match
global_free_threshold_kobo int
default_courier   text
allow_pickup      bool NN default false
pickup_address    text
updated_at, updated_by_id
```

### 5.11 AI Agent

**`ai_conversations`**
```
id                uuid PK
customer_id       uuid FK customers.id
channel           text NN                 # 'whatsapp' | 'web_widget'
external_thread_id text                   # WhatsApp wa_id or web session
status            text NN                 # 'active' | 'closed' | 'handoff_pending' | 'handoff_active' | 'archived'
sentiment         text                    # 'positive' | 'neutral' | 'negative' | null
outcome           text                    # 'order_placed' | 'no_purchase' | 'handoff' | 'return_initiated' | etc.
order_id          uuid FK orders.id        # if conversation produced an order
return_id         uuid FK returns.id
language          text default 'en'
started_at        timestamptz NN default now()
last_message_at   timestamptz
closed_at         timestamptz
metadata          jsonb
INDEX on (customer_id, started_at desc)
INDEX on (status, last_message_at desc)
```

**`ai_messages`**
```
id                uuid PK
conversation_id   uuid FK ai_conversations.id NN ON DELETE CASCADE
role              text NN                 # 'customer' | 'agent' | 'staff' | 'system'
sender_id         uuid                    # customer.id or user.id depending on role
content           text                    # text body
content_type      text NN default 'text'  # 'text' | 'image' | 'document' | 'audio' | 'system_event'
media_url         text
tool_calls        jsonb                   # if AI invoked tools
tokens_in         int
tokens_out        int
external_message_id text                  # WhatsApp msg id
created_at        timestamptz NN default now()
INDEX on (conversation_id, created_at)
```

**`ai_handoffs`**
```
id                uuid PK
conversation_id   uuid FK ai_conversations.id NN
reason            text NN                 # 'customer_requested' | 'sentiment_negative' | 'beyond_capability' | 'manual_intervention'
status            text NN                 # 'pending' | 'claimed' | 'resolved' | 'cancelled'
claimed_by_id     uuid FK users.id
claimed_at        timestamptz
resolved_at       timestamptz
notes             text
created_at        timestamptz NN default now()
```

**`ai_knowledge_entries`** (FAQs, business info; embedded for retrieval)
```
id                uuid PK
title             text NN
body              text NN
category          text                    # 'shipping', 'returns', 'business_info', etc.
embedding         vector(1536)             # pgvector
is_active         bool NN default true
created_at, updated_at
created_by_id     uuid FK users.id
```

**`ai_settings`** (singleton)
```
id                int PK default 1
system_prompt          text
negotiation_enabled_default bool NN default false
handoff_threshold      text NN default 'sentiment_negative'   # config key
business_hours_only    bool NN default false
welcome_message_web    text
welcome_message_wa     text
out_of_hours_message   text
abandoned_cart_delay_minutes int NN default 60
abandoned_cart_template text
updated_at, updated_by_id
```

### 5.12 Channels & Notifications

**`whatsapp_channels`** (one row per WhatsApp number connected)
```
id                uuid PK
phone_number      text UQ NN
display_name      text NN
provider          text NN                 # 'meta_cloud' | 'baileys'
provider_account_id text
status            text NN                 # 'connecting' | 'active' | 'disconnected' | 'banned'
created_at, updated_at
```

**`notification_templates`**
```
id                uuid PK
key               text UQ NN              # 'order_confirmation', 'order_shipped', 'return_approved', etc.
channel           text NN                 # 'email' | 'sms' | 'whatsapp'
subject           text                    # email only
body              text NN                 # supports {{handlebars}} placeholders
is_active         bool NN default true
updated_at, updated_by_id
```

**`notifications_outbound`** (record of what was sent)
```
id                uuid PK
template_key      text NN
channel           text NN
recipient         text NN
order_id          uuid FK orders.id
customer_id       uuid FK customers.id
status            text NN                 # 'queued' | 'sent' | 'delivered' | 'failed' | 'bounced'
provider_id       text
error             text
sent_at           timestamptz
created_at        timestamptz NN default now()
```

### 5.13 Analytics Snapshots (optional, for fast dashboards)

**`daily_metrics`**
```
date              date PK
revenue_kobo      bigint NN
order_count       int NN
new_customer_count int NN
return_count      int NN
ai_conversations  int NN
ai_orders         int NN
average_order_kobo int NN
```

(Populated nightly by a job; dashboards can query this instead of recomputing from raw orders.)

### 5.14 Migration Provenance

**`bumpa_imports`**
```
id                uuid PK
entity_type       text NN                 # 'product' | 'customer' | 'order'
bumpa_external_id text NN
local_entity_id   uuid NN                 # the corresponding row's id
imported_at       timestamptz NN
import_batch_id   uuid NN
notes             text
UNIQUE (entity_type, bumpa_external_id)
```

This lets the team re-run migrations idempotently and know exactly which records came from Bumpa.
