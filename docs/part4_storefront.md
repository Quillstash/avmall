---

## 7. STOREFRONT — SCREEN SPECIFICATIONS

Each screen is described as: **purpose**, **layout**, **states**, **interactions**, **edge cases**. The builder must implement every screen and every state.

### 7.1 Home (`/`)

**Purpose:** Convert first-time visitors and orient returning customers.

**Layout (mobile-first; desktop is a wider variant):**
1. Top nav (sticky): logo left, search bar centre (becomes a search icon on mobile), cart icon + account icon right. WhatsApp deep-link button on mobile only.
2. Hero band: headline, supporting line, primary CTA "Shop now". Secondary CTA "Chat with us on WhatsApp". Single curated image or rotating banner (max 3 slides, auto-advance 5s, swipe-able, respects reduced-motion).
3. Featured collections strip (3–4 collection cards, horizontal scroll on mobile).
4. "New arrivals" — 8 product cards in a 2-up (mobile) / 4-up (desktop) grid.
5. Featured categories grid (icons + labels, links to category pages).
6. "Best sellers" — 8 product cards.
7. Trust band: free-shipping threshold callout, returns policy link, secure checkout badge, WhatsApp support hours.
8. Footer.

**States:**
- Hero with no banners configured → fall back to a default hero with brand text and CTA to `/products`.
- Empty featured collections → hide the strip; do not show empty card placeholders.
- Slow network → render product cards as skeletons; never block the page on images.

**Edge cases:**
- All products in a featured collection are out of stock → still show the collection (with "Out of stock" badges); admin should see a warning in dashboard.
- A product in the home-page block becomes archived after page is rendered → next request silently drops it.

### 7.2 Category & Listing Pages (`/category/[slug]`, `/products`)

**Purpose:** Browse, filter, and find products.

**Layout:**
- Breadcrumb: Home › Category › Subcategory.
- H1 with category name + count of products.
- Filter rail (left desktop, drawer on mobile): subcategory list, price range slider (₦), in-stock toggle, tags (multi-select chips), variant attributes (size, colour) — these auto-derive from products in the current view.
- Sort dropdown: Featured (default) | Price: low to high | Price: high to low | Newest | Best selling.
- Product grid: 2-up mobile, 3-up tablet, 4-up desktop. Infinite scroll OR paginated (use paginated for crawlability, with a "Load more" button as a hybrid).
- Empty state if no matches: illustration + "Try adjusting your filters" + "Clear all filters" button.

**Product card:**
- Image (1:1, lazy-loaded, blurhash placeholder)
- Sale badge top-left if applicable; "Pre-order" badge top-right for pre-order
- "Out of stock" overlay if `available = 0` and not pre-order
- Product name (2-line clamp)
- Price block: regular price (struck through if sale), current price prominent, "From ₦X" if variants have different prices
- "10% off when you buy 10+" hint if any bulk tier exists
- Quick "Add to cart" button on hover (desktop) / always visible (mobile)
- Tap card → product detail page

**States:**
- Loading: 8 skeleton cards
- Empty: illustration + clear-filters CTA
- Filter applied: chip row above grid showing active filters with × to remove each
- Out-of-stock products shown by default with overlay, with toggle "Hide out of stock"

**Edge cases:**
- A filter combination yields zero results → empty state with "Clear filters". Do **not** silently widen the filter.
- A category with no products yet → friendly placeholder explaining new items are coming soon.
- User clicks "Add to cart" on a product with required variants → opens a mini variant selector modal/sheet, cannot add until variant selected.

### 7.3 Product Detail Page (`/product/[slug]`)

This is the highest-conversion page. Get it right.

**Layout:**
- Breadcrumb.
- Two-column on desktop: left = image gallery (main image + thumbnail rail; pinch-to-zoom on mobile, hover-to-zoom on desktop), right = info column. Single column on mobile.
- Info column:
  1. Product name (H1, `text-2xl` weight 700)
  2. Short description (`text-base`, muted)
  3. Price block — see below
  4. Variant selectors (one block per attribute)
  5. Quantity stepper with bulk pricing hint
  6. Stock state + delivery estimate
  7. Primary CTA: "Add to cart" (full width, lg)
  8. Secondary CTA: "Buy now" (skip cart, go to checkout) OR "Chat to negotiate" if `negotiation_enabled` (deep-links to AI agent on WhatsApp pre-filled with product reference)
  9. Pre-order notice if pre-order: "This is a pre-order. MOQ: 10 units. Estimated arrival: …"
  10. Trust mini-row: free returns, fast shipping, secure payment
- Long description tabs below: Description | Specifications | Reviews (future) | Shipping & returns
- Bulk pricing table (always visible if tiers exist)
- Related products carousel
- Sticky bottom bar on mobile: price + Add to cart button (always reachable)

**Price block logic (in priority order):**
1. If `sale_active && sale_price_kobo` and within sale window → show original struck-through, then sale price prominent, then "Save ₦X (Y%)" badge.
2. Else if `discount_active && discount_value` → apply to regular_price and show as discounted.
3. Else show regular price.
4. If variants have different prices, show "From ₦X" until variant selected, then update.
5. If quantity stepper crosses a bulk tier threshold, show inline: "10% off applied — saving ₦X" and update the totals.
6. Negotiation hint: if `negotiation_enabled`, show subtle "Negotiate this price on WhatsApp" link below price.

**States:**
- All variants out of stock → CTA becomes "Notify me when back" (collects email/phone, stored).
- Selected variant out of stock → CTA disabled with tooltip "Select an in-stock option".
- Pre-order: CTA reads "Pre-order now"; quantity input enforces MOQ.
- Loading: skeleton with image placeholder, name shimmer, price shimmer.
- Image fails to load → fallback placeholder, never broken icon.

**Edge cases:**
- Customer manipulates URL or quantity to below MOQ on pre-order → server rejects with field-level error.
- Customer adds variant that is in stock for self but reserved by another customer → on cart-add, may succeed (we don't reserve until checkout), but the cart re-quote will warn before checkout if stock has dropped below requested.
- Product becomes archived between page render and add-to-cart → API returns `404 PRODUCT_UNAVAILABLE`; UI shows toast "This product is no longer available" and refreshes the listing.
- Rapid click on Add to Cart → debounce client-side; idempotency-key on server prevents duplicates.

### 7.4 Cart (`/cart`)

**Layout:**
- H1 "Your cart" with item count
- Item rows (image, name, variant, unit price, quantity stepper, line total, remove × icon)
- Coupon code input + Apply button below items
- Order summary card (sticky on desktop): subtotal, applied discounts (each on its own line), shipping (with "Add address to calculate" hint until set), total, Checkout CTA
- Empty state: "Your cart is empty" + Browse products CTA

**Interactions:**
- Quantity changes auto-recalc with debounced quote API call (300ms)
- Bulk tier crossings show inline badge: "Just added: bulk discount kicks in"
- Stock warnings inline per row if availability drops while in cart
- Coupon validation: on Apply, call API; show success or error inline; show resulting discount in summary

**Edge cases:**
- Coupon expired or limit reached → inline error, coupon removed from cart.
- Item went out of stock entirely → row shows red banner, quantity locked to 0, total recomputes; checkout button disabled until removed.
- Customer leaves cart open for hours → on next interaction, refresh quote silently; if anything changed (price, stock, coupon validity) show a single toast "Some items in your cart have updated".
- Cart abandoned for >24h → cron job marks `status = 'abandoned'`, triggers AI follow-up if customer is identifiable.

### 7.5 Checkout (`/checkout`)

Single-page, three sections vertically. Each section collapses when complete; user can reopen any section to edit.

**Section 1 — Contact & Delivery:**
- Phone (with `+234` prefix component, normalised on submit)
- Email (optional but encouraged for receipts)
- Recipient name (defaults to phone holder)
- Address fields: state (select), city, LGA (select dependent on state), street address (textarea), landmark
- Save address checkbox (if logged in or post-checkout creates account)
- Returning customer? Login link → OTP flow

**Section 2 — Shipping:**
- Auto-detects zone from state + city; shows estimated days, fee
- Shows "Free shipping unlocked" if threshold met
- Pickup option if `allow_pickup` is enabled

**Section 3 — Payment:**
- For now (per brief): Nuqood payment link is the website default
- Show order summary card on the right (desktop) / collapsed top (mobile)
- "Place order" button — generates order in `pending` state, generates Nuqood link, redirects user to Nuqood payment page
- After payment: customer returns to `/checkout/confirmation/[orderId]`

**Confirmation page (`/checkout/confirmation/[orderId]`):**
- Big checkmark + "Thank you, your order is confirmed"
- Order number, summary, shipping address, estimated delivery
- "Track your order" CTA → `/orders/track`
- "Continue shopping" link
- If payment is still pending (e.g. Nuqood webhook not yet received), show "Payment processing — we'll update you as soon as it confirms" with a polling check every 5s for up to 60s.

**Edge cases — checkout (heavy list):**
- **Payment fails or times out:** order remains `pending` / `unpaid`; system sends payment-link reminder via WhatsApp/email after 30 min; customer can retry from the confirmation page.
- **Customer closes the tab during Nuqood:** order is in DB; return via email link or `/orders/track` works.
- **Webhook arrives before customer redirect:** confirmation page already shows paid state.
- **Webhook arrives twice:** idempotency key on the payment record prevents double-counting.
- **Stock disappears between cart and checkout:** server attempts to reserve in transaction; on failure, returns 409 with item details, UI shows "Sorry, X became unavailable. Adjust or remove?" and re-quotes.
- **Coupon hits its global usage limit at the moment of checkout:** transaction fails with explicit coupon error; UI removes coupon, recomputes.
- **Bulk tier threshold straddled by reservation:** the moment of order creation snapshots the actual applied tier; subsequent stock reservations don't change a placed order.
- **Customer enters a phone that already exists with a different name:** update the name only with explicit consent; otherwise keep the existing name and proceed.
- **Network blip between order creation and Nuqood link generation:** order exists with `payment_status = unpaid` and no payment record; admin can re-issue link, customer can retry from the order detail.
- **Pre-order item in the cart with regular items:** allowed; order ships in waves OR full-batch — admin policy decides; record per-item `is_pre_order = true`.
- **Customer attempts checkout with shipping address in an unsupported zone:** explicit error "We don't currently deliver to {state}. Please contact us via WhatsApp."
- **Browser language / RTL:** layout must not break with longer translated strings; product names with very long Yoruba/Igbo/Hausa words must wrap correctly.

### 7.6 Order Tracking (`/orders/track`)

**Layout:**
- Form: order number + email or phone (lookup must match both fields)
- On submit: shows full order with status timeline (Pending → Confirmed → Processing → Shipped → Delivered)
- Each step shows: filled (done), current (highlighted), upcoming (greyed)
- Tracking number / courier name where applicable
- Items, totals, payment status
- "Initiate return" button if delivered and within return window

**Edge cases:**
- Mismatched order + contact → generic error "We couldn't find an order matching those details" (don't reveal whether the order exists). Rate-limit attempts to prevent enumeration.
- Order in `cancelled` state → show clear "This order was cancelled" with reason if customer-facing.

### 7.7 Account (`/account/...`)

Standard pattern: side nav (Orders, Returns, Addresses, Profile) + main panel.
- Orders list with the same status pills as admin
- Order detail mirrors the public tracker but adds invoice download (PDF, generated server-side)
- Address book CRUD with default flag
- Profile: name, email, phone (changing phone requires re-OTP)
- Logout

**Edge cases:**
- Customer with no orders yet → friendly empty state with "Start shopping" CTA.
- Address marked default and then deleted → next-most-recent address auto-becomes default; if none, no default.

### 7.8 Returns Initiation (`/account/orders/[id]/return`)

**Layout:**
- Order summary at top
- Item picker: each line item has a checkbox + quantity stepper (max = ordered qty)
- Reason select per item (or one global reason for "all items same reason")
- Free-text "Other" field if reason = Other
- Photo upload zone (drag-drop or tap to upload, max 5 images, max 5MB each)
- Preferred refund method (store credit / bank transfer / Nuqood — depending on which methods admin enables)
- Bank details form if bank transfer chosen (account number, bank name, account name)
- Review and submit
- Confirmation: return number, "We'll review within 24 hours" message

**Edge cases:**
- Item already returned (full quantity) → not selectable, shown with "Already returned" badge.
- Order outside return window (configurable per business; default 14 days from delivery) → "This order is outside the return window. Contact support if you need help."
- Order not yet delivered → "You can only return delivered orders. Contact support for cancellation."
- Photo upload fails (network) → retain the form, show retry button per file, never lose the rest of the form data.

### 7.9 AI Chat Widget (every storefront page)

- Floating button bottom-right (bottom-left on mobile to avoid the WhatsApp default position if also present)
- Opens a chat panel: branded header, scrollable message area, input + send + "Talk to a human" button + WhatsApp deep-link
- Persists conversation in localStorage so refresh doesn't lose context
- On first message, prompts for phone number to enable order checks (optional but encouraged)
- All AI features in §15 are available here (search, quote, checkout-via-chat with payment link)
- Hand-off transitions: header colour and label change to "Connected to staff" when human takes over
- Out-of-hours behaviour configurable: either AI continues or customer is told a human will reply at X time

---
