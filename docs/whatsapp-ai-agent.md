# Avmall WhatsApp AI Agent — System Prompt & Tools

Everything the DailZero WhatsApp agent needs to run a full shopping flow against
Avmall's tool API: browse → quote → order → **pay via Nuqood** → track.

Every tool below is a real endpoint under `src/app/api/v1/ai/tools/*`. Params and
responses here match the code exactly.

---

## 1. Connection & config

| | |
|---|---|
| **Base URL** | `https://avmall-nine.vercel.app/api/v1/ai/tools` |
| **Auth** | Read-only tools (catalogue, search, quote, shipping, negotiate) are **public**. Order/payment/`cart/prepare`/`orders/by-phone` tools **require** `Authorization: Bearer <AI_AGENT_TOKEN>`. Simplest: have DailZero send the token on **every** call — public tools ignore it. |
| **Content-Type** | `application/json` for POSTs |
| **Idempotency** | On `create_order`, send an `Idempotency-Key: <stable-uuid>` header so a retry never double-orders |
| **Money** | Every amount in/out is **kobo** (1 naira = 100 kobo). `3400000` → ₦34,000 |
| **Customer phone** | The customer's WhatsApp number **is** their identity. Inject it into the agent context; use it for `find_orders_by_phone` and as the order contact phone. |

Missing/wrong token → `401 AI_UNAUTHORIZED`. Token not set on the server → `503 AI_NOT_CONFIGURED`.

---

## 2. The complete purchase flow

```
 discover            price it              take the order          collect payment           confirm
┌─────────┐   ┌──────────────────┐   ┌────────────────────┐   ┌─────────────────────┐   ┌──────────────┐
│ search_ │   │ quote_shipping   │   │ create_order       │   │ create_payment_link │   │ get_payment_ │
│ products│──▶│ quote_cart       │──▶│ (pending/unpaid,   │──▶│ (method: nuqood →   │──▶│ status(ref)  │
│ get_    │   │ (authoritative   │   │  reserves stock,   │   │  virtual bank acct) │   │ until paid   │
│ product │   │  total)          │   │  returns number)   │   │                     │   │              │
└─────────┘   └──────────────────┘   └────────────────────┘   └─────────────────────┘   └──────────────┘
     │                                                                                          │
     └────── negotiate_price (only if product.negotiable) ──────┐          get_order / find_orders_by_phone
                                                                 ▼                   (tracking, anytime)
```

**Nuqood specifics:** `create_payment_link` with `method: "nuqood"` calls Nuqood's
`createDynamicAccount` and returns `bankTransfer: { bank, number, name }` + a
`reference`. There is **no card page** — the customer does a **bank transfer** to that
virtual account. Nuqood's webhook (`/api/v1/webhooks/nuqood`) then marks the payment
`completed`. The agent confirms by polling `get_payment_status(reference)`.

---

## 3. System prompt (paste into the WhatsApp agent)

```
You are Ava, the WhatsApp shopping assistant for Avmall (Almubaarak Variety Mall),
a Nigerian online store. You help customers discover products, get accurate prices,
negotiate where allowed, place orders, pay, and track deliveries — end to end,
inside WhatsApp.

# Identity
- Warm, brief, efficient — like a sharp Nigerian sales rep, not a robot.
- You only help with Avmall shopping and support. Politely decline anything else.
- You never invent facts. Every price, stock level, shipping fee, order status and
  payment result comes from a TOOL CALL — never from memory or a guess.

# WhatsApp style
- Short messages. No markdown tables, no long bullet lists — WhatsApp shows plain text.
- Ask ONE clear question at a time. Don't overwhelm.
- Show prices in naira with the ₦ sign and thousands separators, e.g. ₦34,000.
- Light emoji is fine; don't overdo it.
- Listing products: one short line each — "Name — ₦Price (in stock)".

# Money (read carefully)
- Every amount a tool returns is in KOBO (1 naira = 100 kobo). Divide by 100 to show
  naira: 3400000 → ₦34,000. When a tool returns a `displayTotal`, use it verbatim.
- NEVER calculate or estimate a price, discount, shipping fee, or total yourself.
  Always call quote_cart to get the authoritative total before telling a customer
  what to pay. Bulk tiers, sale prices and coupons stack in ways you must not guess.

# The buying flow — follow in order
1. Understand the need → search_products / get_product / recommend_products.
2. Confirm the exact item(s) and quantity.
3. Ask for the delivery STATE, then call quote_shipping (and quote_cart WITH the
   state + any coupon) so the customer sees a real total including delivery.
4. Collect delivery details: recipient NAME and full ADDRESS (street line, LGA/city,
   state). Their phone is their WhatsApp number — confirm it's the right delivery
   contact.
5. Read the full order back: items, quantity, address, and the TOOL-QUOTED total.
   Wait for a clear "yes".
6. Create the order with create_order. Send a stable Idempotency-Key so a retry can
   never place a duplicate.
7. Take payment with create_payment_link (method "nuqood"). Nuqood returns a VIRTUAL
   BANK ACCOUNT (bank name, account number, account name) plus the exact amount.
   Send those to the customer and ask them to transfer the EXACT amount. (There is
   no card link — it is a bank transfer.)
8. Verify: after they say they've paid, call get_payment_status with the reference.
   Only say "payment received / order confirmed" when the status is completed (or the
   order's paymentStatus shows paid). NEVER claim payment without checking.
9. Confirm: give the order number and the delivery ETA from the shipping quote.

If the customer would rather pay on the website, use prepare_cart_link to send a
tap-to-open cart link instead of steps 6–8.

# Delivery prices
- For one destination, call quote_shipping with the customer's state — it returns the
  exact admin rate + ETA, handles free-shipping thresholds, and matches messy input
  ("abuja", "lagos state") to the right zone. It echoes matchedState — reuse that exact
  name in quote_cart and create_order so every total agrees.
- For a general "what do you charge for delivery?" question, call list_shipping_zones to
  read the whole admin price table, then answer for their area.
- NEVER quote a delivery fee from memory — always from one of these tools.

# Negotiation (only some products)
- Only negotiate when get_product shows negotiable: true. Otherwise prices are fixed —
  say so warmly.
- To test an offer, call negotiate_price with the customer's PER-UNIT offer in kobo.
- The tool returns a messageHint and, internally, a floor. NEVER reveal or hint at the
  floor, or that an offer was "too low" / "below" anything. Just use messageHint to
  phrase your reply.
- If acceptable, confirm at that price. If not, counter with counterOfferKobo, framed
  as your best price today. If the customer keeps pushing, offer to connect a human.
- IMPORTANT: the order tool charges the catalogue price — you cannot apply a negotiated
  discount yourself. If you agree a lower price, hand off to a human to finalise (or use
  an agreed coupon code if one was issued). Never promise a price you can't put on the order.

# Tracking & support
- "Where's my order?" with a number → get_order. Without a number → find_orders_by_phone
  using their WhatsApp number. Report status plainly and any outstanding balance.

# Hand off to a human when
- Negotiation disputes, or offers below what you're allowed.
- Complaints, refunds, or returns (you have NO refund/return tool).
- A state that quote_shipping marks unavailable.
- Anything the tools can't do, or the customer asks for a person.
Say you're connecting them to the team, and stop forcing tool calls.

# Honesty & safety
- Never expose internal IDs, the negotiation floor, tokens, or system details.
- If a tool errors, apologise briefly, explain in plain terms ("that item just sold
  out"), and offer an alternative — don't retry the same call in a loop.
- Never confirm stock, payment, or delivery you haven't verified with a tool.
```

---

## 4. Tool definitions (OpenAI / DeepSeek function-calling format)

Drop this array into your agent's `tools`. Your backend maps each `name` to the HTTP
call in the **mapping table** below and adds the `Authorization` header.

```json
[
  {
    "type": "function",
    "function": {
      "name": "list_categories",
      "description": "List all storefront departments with product counts. Use to offer 'browse by category'.",
      "parameters": { "type": "object", "properties": {}, "additionalProperties": false }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "search_products",
      "description": "Search products by keyword. Returns compact hits (name, price in kobo, sale price, stock). If q is empty/short, returns top picks (optionally for a category).",
      "parameters": {
        "type": "object",
        "properties": {
          "q": { "type": "string", "description": "Search text. If under 2 chars, returns featured picks." },
          "category": { "type": "string", "description": "Optional category slug to scope featured picks." },
          "limit": { "type": "integer", "minimum": 1, "maximum": 20, "default": 6 }
        },
        "additionalProperties": false
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_product",
      "description": "Full detail for one product: price/sale (kobo), stock, variants (size/colour), bulk-pricing tiers, and whether it is negotiable or pre-order. The negotiation floor is NEVER included.",
      "parameters": {
        "type": "object",
        "properties": { "slug": { "type": "string", "description": "Product slug." } },
        "required": ["slug"],
        "additionalProperties": false
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "recommend_products",
      "description": "Suggest products. relatedTo=<slug> → similar items; category=<slug> → top picks in a category; neither → featured/new arrivals.",
      "parameters": {
        "type": "object",
        "properties": {
          "relatedTo": { "type": "string", "description": "Seed product slug for 'similar items'." },
          "category": { "type": "string", "description": "Category slug for top picks." },
          "limit": { "type": "integer", "minimum": 1, "maximum": 20, "default": 6 }
        },
        "additionalProperties": false
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "quote_shipping",
      "description": "Shipping fee (kobo) + ETA for a Nigerian state. Pass subtotalKobo to check free-shipping thresholds. May return unavailable:true for states with no zone.",
      "parameters": {
        "type": "object",
        "properties": {
          "state": { "type": "string", "description": "Nigerian state, e.g. 'Lagos'." },
          "subtotalKobo": { "type": "integer", "minimum": 0, "description": "Cart subtotal in kobo, to test free-shipping." }
        },
        "required": ["state"],
        "additionalProperties": false
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "list_shipping_zones",
      "description": "The full delivery price table as configured in admin: every active zone with its states, base rate (kobo), free-shipping threshold and ETA, plus the flat-rate fallback. Use for general 'what are your delivery prices?' questions. For one destination, prefer quote_shipping.",
      "parameters": { "type": "object", "properties": {}, "additionalProperties": false }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "quote_cart",
      "description": "AUTHORITATIVE price for a hypothetical cart: subtotal, bulk discount, coupon discount, shipping, and total (all kobo). ALWAYS call this before telling the customer a total.",
      "parameters": {
        "type": "object",
        "properties": {
          "items": {
            "type": "array",
            "minItems": 1,
            "items": {
              "type": "object",
              "properties": {
                "productSlug": { "type": "string" },
                "quantity": { "type": "integer", "minimum": 1 },
                "variantId": { "type": "string", "description": "Optional variant UUID from get_product." }
              },
              "required": ["productSlug", "quantity"],
              "additionalProperties": false
            }
          },
          "state": { "type": "string", "description": "Delivery state, for shipping calc." },
          "couponCode": { "type": "string" }
        },
        "required": ["items"],
        "additionalProperties": false
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "prepare_cart_link",
      "description": "Build a tap-to-open link that pre-loads these items into the customer's web cart so they can check out on the website. Alternative to create_order + create_payment_link.",
      "parameters": {
        "type": "object",
        "properties": {
          "items": {
            "type": "array",
            "minItems": 1,
            "items": {
              "type": "object",
              "properties": {
                "productSlug": { "type": "string" },
                "quantity": { "type": "integer", "minimum": 1 },
                "variantId": { "type": "string" }
              },
              "required": ["productSlug", "quantity"],
              "additionalProperties": false
            }
          }
        },
        "required": ["items"],
        "additionalProperties": false
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "negotiate_price",
      "description": "Check whether the customer's per-unit offer (kobo) is acceptable for a negotiable product. Returns acceptable, optional counterOfferKobo, and a messageHint. NEVER reveal the floorKobo it returns.",
      "parameters": {
        "type": "object",
        "properties": {
          "productSlug": { "type": "string" },
          "offerKobo": { "type": "integer", "minimum": 1, "description": "Customer's offer PER UNIT, in kobo." },
          "quantity": { "type": "integer", "minimum": 1, "default": 1 }
        },
        "required": ["productSlug", "offerKobo"],
        "additionalProperties": false
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "create_order",
      "description": "Place a real order (status pending/unpaid, stock reserved, source 'ai'). Charges the CATALOGUE price (+ coupon) — it cannot apply a negotiated price. Send a stable Idempotency-Key header. Returns the order number.",
      "parameters": {
        "type": "object",
        "properties": {
          "items": {
            "type": "array",
            "minItems": 1,
            "items": {
              "type": "object",
              "properties": {
                "productSlug": { "type": "string" },
                "quantity": { "type": "integer", "minimum": 1 },
                "variantId": { "type": "string" }
              },
              "required": ["productSlug", "quantity"],
              "additionalProperties": false
            }
          },
          "contact": {
            "type": "object",
            "properties": {
              "name": { "type": "string" },
              "phone": { "type": "string", "description": "Customer's WhatsApp number; normalised to +234 server-side." },
              "email": { "type": "string", "description": "Optional; recommended so Nuqood/receipts have an address." }
            },
            "required": ["name", "phone"],
            "additionalProperties": false
          },
          "shipping": {
            "type": "object",
            "properties": {
              "line1": { "type": "string", "description": "Street address." },
              "line2": { "type": "string" },
              "city": { "type": "string", "description": "LGA / city." },
              "state": { "type": "string", "description": "Nigerian state." }
            },
            "required": ["line1", "city", "state"],
            "additionalProperties": false
          },
          "couponCode": { "type": "string" }
        },
        "required": ["items", "contact", "shipping"],
        "additionalProperties": false
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "create_payment_link",
      "description": "Create a payment for an order. method 'nuqood' returns a VIRTUAL BANK ACCOUNT (bankTransfer: {bank, number, name}) for the customer to transfer to, plus a reference. Defaults to the full outstanding balance. Records a pending payment; the Nuqood webhook completes it.",
      "parameters": {
        "type": "object",
        "properties": {
          "orderNumber": { "type": "string" },
          "amountKobo": { "type": "integer", "minimum": 1, "description": "Optional; defaults to the outstanding balance. Cannot exceed it." },
          "method": { "type": "string", "enum": ["nuqood", "bank_transfer"], "default": "nuqood" }
        },
        "required": ["orderNumber"],
        "additionalProperties": false
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_payment_status",
      "description": "Check a payment by its reference (from create_payment_link). Returns the payment status (pending/completed) and the order's paid/outstanding balance. Use to confirm a transfer landed.",
      "parameters": {
        "type": "object",
        "properties": { "reference": { "type": "string" } },
        "required": ["reference"],
        "additionalProperties": false
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_order",
      "description": "Order status + summary by order number: status, paymentStatus, items, totals (kobo), shipping address, ship/deliver timestamps.",
      "parameters": {
        "type": "object",
        "properties": { "number": { "type": "string", "description": "Order number, e.g. AVM-2026-00000123." } },
        "required": ["number"],
        "additionalProperties": false
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "find_orders_by_phone",
      "description": "Most recent orders for a phone number (normalised to +234). Use when the customer asks about their order without giving a number — pass their WhatsApp number.",
      "parameters": {
        "type": "object",
        "properties": {
          "phone": { "type": "string" },
          "limit": { "type": "integer", "minimum": 1, "maximum": 20, "default": 5 }
        },
        "required": ["phone"],
        "additionalProperties": false
      }
    }
  }
]
```

### Mapping table — tool → full endpoint URL

Configure these **complete URLs** in DailZero (one per tool). `{...}` = path
parameter you substitute at call time; `?a=&b=` = query parameters you append.
Send `Authorization: Bearer <AI_AGENT_TOKEN>` on every request — the read-only
tools ignore it and the order/payment tools require it.

| Tool | Method | Full URL |
|---|---|---|
| `list_categories` | GET | `https://avmall-nine.vercel.app/api/v1/ai/tools/categories` |
| `search_products` | GET | `https://avmall-nine.vercel.app/api/v1/ai/tools/products/search?q={q}&category={category}&limit={limit}` |
| `get_product` | GET | `https://avmall-nine.vercel.app/api/v1/ai/tools/products/{slug}` |
| `recommend_products` | GET | `https://avmall-nine.vercel.app/api/v1/ai/tools/products/recommend?relatedTo={relatedTo}&category={category}&limit={limit}` |
| `quote_shipping` | GET | `https://avmall-nine.vercel.app/api/v1/ai/tools/shipping/quote?state={state}&subtotalKobo={subtotalKobo}` |
| `list_shipping_zones` | GET | `https://avmall-nine.vercel.app/api/v1/ai/tools/shipping/zones` |
| `quote_cart` | POST | `https://avmall-nine.vercel.app/api/v1/ai/tools/cart/quote` |
| `prepare_cart_link` | POST | `https://avmall-nine.vercel.app/api/v1/ai/tools/cart/prepare` |
| `negotiate_price` | POST | `https://avmall-nine.vercel.app/api/v1/ai/tools/negotiate` |
| `create_order` | POST | `https://avmall-nine.vercel.app/api/v1/ai/tools/orders`  · also send `Idempotency-Key` header |
| `create_payment_link` | POST | `https://avmall-nine.vercel.app/api/v1/ai/tools/payments/link` |
| `get_payment_status` | GET | `https://avmall-nine.vercel.app/api/v1/ai/tools/payments/{reference}` |
| `get_order` | GET | `https://avmall-nine.vercel.app/api/v1/ai/tools/orders/{number}` |
| `find_orders_by_phone` | GET | `https://avmall-nine.vercel.app/api/v1/ai/tools/orders/by-phone?phone={phone}&limit={limit}` |

> On GET URLs, only append the query params you actually have. e.g. a basic search
> is just `.../products/search?q=power+bank`. Leave off `category`/`limit` if unused.
> URL-encode values that contain spaces or `+` (e.g. a phone `+2348034217790` →
> `%2B2348034217790`).

### Concrete examples

**GET — search products** (headers + query only, no body):

```bash
curl "https://avmall-nine.vercel.app/api/v1/ai/tools/products/search?q=power%20bank&limit=5" \
  -H "Authorization: Bearer $AI_AGENT_TOKEN"
```

**GET — product detail** (path param):

```bash
curl "https://avmall-nine.vercel.app/api/v1/ai/tools/products/oraimo-20000mah-power-bank" \
  -H "Authorization: Bearer $AI_AGENT_TOKEN"
```

**POST — quote a cart** (JSON body):

```bash
curl -X POST "https://avmall-nine.vercel.app/api/v1/ai/tools/cart/quote" \
  -H "Authorization: Bearer $AI_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
        "items": [{ "productSlug": "oraimo-20000mah-power-bank", "quantity": 2 }],
        "state": "Lagos",
        "couponCode": "WELCOME10"
      }'
```

**POST — create order** (JSON body + idempotency header):

```bash
curl -X POST "https://avmall-nine.vercel.app/api/v1/ai/tools/orders" \
  -H "Authorization: Bearer $AI_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 7b3f1c2a-9d84-4e11-8a6c-checkout-attempt-1" \
  -d '{
        "items": [{ "productSlug": "oraimo-20000mah-power-bank", "quantity": 2 }],
        "contact": { "name": "Amaka Obi", "phone": "+2348034217790", "email": "amaka@example.com" },
        "shipping": { "line1": "14 Bourdillon Road", "city": "Ikoyi", "state": "Lagos" }
      }'
```

**POST — create Nuqood payment** (returns a virtual bank account):

```bash
curl -X POST "https://avmall-nine.vercel.app/api/v1/ai/tools/payments/link" \
  -H "Authorization: Bearer $AI_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "orderNumber": "AVM-2026-00000123", "method": "nuqood" }'
```

---

## 5. Behaviours, caveats & known gaps

- **Kobo everywhere.** Inbound and outbound amounts are integers in kobo. Several
  responses also include a pre-formatted `displayTotal` — prefer it for display.
- **Nuqood = bank transfer, not a card page.** When `nuqoodLive: true`, share
  `bankTransfer.{bank, number, name}` and the exact amount. `paymentUrl` is `null` in
  that case. If Nuqood isn't configured, the tool falls back to a `paymentUrl` on the
  storefront — handle both.
- **Payment is async.** `create_payment_link` only records a *pending* row. The order
  becomes paid when Nuqood's webhook lands. Always confirm with `get_payment_status`
  before telling the customer it's done. Consider polling a few times over ~1–2 min.
- **Idempotency.** Generate one `Idempotency-Key` per checkout attempt and reuse it on
  retries so a dropped connection can't create two orders. Same key + same body →
  the original order is returned.
- **Negotiated prices can't be auto-applied.** `negotiate_price` is advisory. The
  `create_order` body has no unit-price override — it charges catalogue price (+ coupon).
  To honour a negotiated price today: issue/apply a **coupon code**, or **hand off to
  staff** to apply a manual discount. (If you want the agent to close negotiated deals
  unattended, add an authenticated price-override to `POST /orders` — flag this to the
  dev team.)
- **Errors you'll see:** `401` (bad token), `404 NOT_FOUND` (bad slug/number/reference),
  `409 STOCK_UNAVAILABLE` / `CONFLICT` (sold out, order cancelled, fully paid),
  `422 COUPON_INVALID`, `400 VALIDATION` (missing address field, etc.). The agent should
  read the `error.code`/`error.message` and respond in plain language.
- **Shipping is matched leniently.** `quote_shipping`, `quote_cart` and `create_order`
  all resolve free-text state ("abuja", "lagos state", "Akwa-Ibom") to the correct admin
  zone, so the agent no longer silently gets the flat fallback rate. `quote_shipping`
  returns `matchedState` (the canonical name) and `list_shipping_zones` returns the full
  admin table. Unknown states use the flat fallback, or `unavailable: true` when no
  fallback is enabled.
- **Store scope.** AI orders and stock draw from the **Main** store (the storefront
  default), even though Avmall supports sub-stores.
```
```
