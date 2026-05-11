## 8. ADMIN DASHBOARD — SCREEN SPECIFICATIONS

The admin must feel fast, dense without being cluttered, and unforgiving of misclicks (every destructive action confirms). Layout: collapsible left sidebar (260px expanded, 64px collapsed), top bar (search, notifications bell, user menu), main content with breadcrumbs.

### 8.1 Dashboard Home (`/admin`)

**Purpose:** At-a-glance ops view. Open this in the morning, see what needs attention.

**Layout:**
- KPI strip (4 cards): Today's revenue, Today's orders, Avg order value, Outstanding balances. Each shows comparison to yesterday/last week.
- Two-column row:
  - Left (2/3 width): Revenue chart (line, last 30 days), with toggle Day/Week/Month
  - Right (1/3 width): Order status distribution donut
- "Action needed" list: orders awaiting confirmation, payments awaiting confirmation, pending returns, low-stock items, AI handoff requests. Each is a clickable card with count.
- Recent orders table (last 10) with quick view drawer.
- Recent AI conversations strip (last 5) with "View all" link.

**Edge cases:**
- New install / no data → friendly empty state with onboarding checklist (set up payments, add products, configure shipping, etc.)
- Sales staff role: hide revenue numbers; show only their own performance widgets per role permissions.

### 8.2 Orders List (`/admin/orders`)

**Layout:**
- Filter bar: search (order number, customer name/phone), status multi-select, payment status, source, staff (created by), date range, "has outstanding balance" toggle, "is partially paid" toggle.
- Bulk action bar (appears when rows selected): mark as confirmed, mark as processing, mark as shipped, export, print packing slips.
- Table columns: checkbox, Order # (mono), Customer (name + phone, click → customer drawer), Items (count + thumbnail strip), Total (with payment-status pill underneath), Status pill, Source, Channel meta (e.g. WhatsApp icon if from WA), Created at (relative + absolute on hover), Created by, Actions (⋯ menu).
- Saved views: "Today's orders", "Awaiting confirmation", "Partially paid", "Outstanding balances", "Returns pending" — clickable preset filters.

**Interactions:**
- Click row → opens drawer with full order detail; "Open in full page" link inside.
- Right-click / ⋯ menu: View, Edit, Add payment, Generate payment link, Print, Cancel, Initiate return.
- Keyboard: arrow keys navigate rows, Enter opens drawer, Esc closes.

**Edge cases:**
- Search query matches partial order number or partial phone — both are valid.
- Long product list in "Items" column truncates to "+N more" with tooltip.
- Filter combination yields zero results → empty state with "Clear filters".

### 8.3 Order Detail / Edit (`/admin/orders/:id`)

The most operationally important admin screen. Designed so that on a single screen, staff can do everything: review, edit, take payment, ship, refund, return, message customer.

**Layout (desktop, three columns):**

**Left column (2/3 width) — order body:**
- Header: order number, status pill, payment status pill, source (with channel icon).
  - Action bar: Edit, Cancel, Print invoice, Print packing slip, Email/SMS customer, Open WhatsApp.
- Items table:
  - Each row: thumbnail, name, variant, SKU, qty, unit price, line discount, line total
  - Inline edit of qty (with stock check), remove item, add discount per line (manual)
  - "Add item" button at the bottom opens a product search combobox
- Discount summary: every applied discount as its own line (coupon, manual, bulk, AI negotiation). Each has a remove × if removable.
- Shipping section: shows zone, fee, has "Edit" → modal to change fee or method (e.g. "Manual override ₦X with reason note").
- Totals block (right-aligned): Subtotal, Discounts (each), Shipping, Total, Amount paid, **Outstanding balance** (highlighted if > 0).
- Status timeline: vertical, every status transition with actor + timestamp + note.
- Internal notes: rich-text area, autosave, every save creates a note entry with author + timestamp.
- Audit log section (collapsed by default): every change with before/after diff.

**Middle column (top to bottom) — payments & actions:**
- Payment ledger: every `payments` row chronologically with method, amount, status, reference, who recorded it.
- "Add payment" button → modal:
  - Method selector
  - Amount (auto-suggests outstanding amount)
  - Reference / note
  - For Nuqood: "Send link" auto-generates and emails/WhatsApps the customer
  - For cash/POS/transfer: confirmation by current user is implicit
- "Generate payment link" quick button (full or partial amount)
- Outstanding balance card with "Mark order as Paid in Full" override (Manager+ only, requires reason)
- Refund button if any payment is completed.

**Right column (1/3 width) — context:**
- Customer card: name, phone, email, total orders, lifetime value, tags, "View profile" link
- Shipping address (snapshot, with "Update for this order only" option that does not affect customer's saved address)
- AI conversation card if linked: snippet + "Open conversation" link
- Related: recent orders by this customer (last 3)

**Mobile / tablet:** stacks vertically: header → items → totals → payments → context. Bottom sticky bar with primary action depending on state ("Confirm payment", "Mark shipped", "Generate link").

**State-specific behaviour:**
- `pending` + `unpaid`: primary action = "Generate payment link" or "Record payment"
- `pending` + `partially_paid`: primary action = "Add payment" + show outstanding prominently
- `confirmed`: primary action = "Mark as processing"
- `processing`: primary action = "Mark as shipped"; opens modal for tracking number, courier, expected delivery
- `shipped`: primary action = "Mark as delivered"
- `delivered`: primary action = "Initiate return" (admin-side); also visible on customer side
- `cancelled`: most actions disabled; can refund any received payment
- Status transitions follow the strict state machine in §9; UI hides illegal transitions.

**Edge cases — order detail (heavy list):**
- **Adding items to an existing paid order:** allowed but requires explicit "this will add ₦X to the outstanding balance" confirmation; payment status drops back to partially_paid.
- **Removing items from a paid order:** allowed; converts overpayment to store credit OR triggers a refund decision modal; never silently keeps overpaid state.
- **Manual discount that exceeds total:** server caps at total; UI warns inline.
- **Bulk pricing recomputation when qty changes after order placed:** keep the originally applied tier (snapshotted) UNLESS staff explicitly clicks "Recompute from current pricing", in which case all discounts are recomputed transparently with a diff displayed before applying.
- **Editing variant after order is paid:** disallowed; staff must cancel and re-create.
- **Order with mixed pre-order + in-stock items:** clearly labelled per item; status timeline supports two parallel tracks ("Pre-order ETA: 2 weeks" inline on relevant items).
- **Customer is blacklisted but has a pending order:** order locked from further actions; alert banner at top; only Manager+ can override.
- **Negative outstanding (overpaid):** show as credit; offer to convert to store credit or initiate refund.
- **Partial-paid policy:** if `allow_fulfilment_when_partially_paid = false`, the "Mark as processing" action is disabled with tooltip "Order must be paid in full first." — overridable by Manager+ with mandatory reason.

### 8.4 Create Order (`/admin/orders/new`)

This screen is heavily used for walk-ins, WhatsApp orders, phone orders.

**Layout:** Single page, form sections in order:

1. **Customer:** searchable combobox by phone/name/email. Show recent matches as you type. "Create new customer" inline shortcut opens a mini form (name + phone required; email optional). Selected customer card shows tags, LTV, last order.
2. **Source:** required select with the seven source values + free-text if "Other".
3. **Items:**
   - Search products combobox. Selecting a product:
     - If has variants: open variant picker before adding
     - If pre-order: enforce MOQ
     - Default qty 1; quantity stepper
     - Bulk pricing applies live and shows the applied tier label
   - Each row: name, variant, qty stepper, unit price, applied discount, line total, remove ×.
   - Per-line discount option (fixed or percentage) — staff with permission `orders.apply_manual_discount`.
4. **Discounts:**
   - Coupon code input
   - Manual order discount (percentage or fixed)
5. **Shipping:**
   - Address (search existing customer addresses or enter new)
   - Auto-detect zone, show fee
   - Override fee field with reason note (permission-gated)
   - Or "Pickup" (no shipping)
6. **Notes:** internal notes (visible only to staff)
7. **Totals card** (sticky right column desktop / sticky bottom mobile)
8. **Payment section:**
   - Method picker (multi-select for split payments — see §11)
   - Per method: amount input + reference field
   - Real-time running balance
   - Or "Generate payment link and send" → creates Nuqood link and offers Send via Email/SMS/WhatsApp/Copy
9. **Save options:**
   - Save as draft (status `pending`, no payment recorded)
   - Save and email link
   - Save and record payment
   - Save and mark paid in full

**Edge cases:**
- Search picks a product that's gone out of stock between page load and click → inline error, item not added, suggest variants.
- Qty entered exceeds available + buffer → soft warning if pre-order, hard error otherwise.
- Coupon entered is restricted to a customer different from the one selected → coupon rejected with explicit reason.
- Network drops mid-create → autosave has been writing to local state; on reconnect, prompt "We saved a draft of this order — restore?".
- Staff lacks permission to apply manual discount but tries → field is read-only with tooltip "Requires Manager approval".

### 8.5 Products List (`/admin/products`)

**Layout:**
- Filter bar: search by name/SKU, category, status (Draft/Published/Hidden/Archived), availability (Available/Pre-Order), tags, low-stock-only toggle, has-variants toggle.
- Bulk actions: change status, change category, apply tag, archive, export.
- Table: thumbnail, name, SKU, category, regular price, sale price (if any), status pill, stock summary (e.g. "32 in stock" or "Variants: 4 — total 89"), last updated, ⋯ actions.
- "Add product" primary button top-right.

### 8.6 Product Editor

**Layout (drawer for inline editing, full page for new):**

Tab structure:
1. **General** — name, slug (auto-generated, editable), short desc, long desc (rich text), category, tags, collections.
2. **Pricing** —
   - Regular price
   - Sale price toggle (with start/end dates and active flag)
   - Discount (fixed/percentage, active flag)
   - Last price (with prominent helper: "AI agent floor — never visible to customers")
   - "Enable AI negotiation" toggle (greyed out if last price is empty; explanation tooltip)
3. **Inventory** —
   - Availability: Available | Pre-Order toggle
   - If Available + no variants: stock quantity + low-stock threshold
   - If Pre-Order: MOQ (required) + ETA (optional)
   - If variants: this tab redirects to Variants tab
4. **Variants** —
   - Define attributes (Size, Colour, etc.) and their values
   - Auto-generate variant grid (cartesian product) with checkbox column to enable/disable each
   - Per-variant: SKU, regular price override, sale price override, last price override, stock quantity, status pill
   - Bulk-edit: "Apply price to all selected", "Apply stock to all selected"
5. **Bulk pricing** —
   - List of tiers with min qty, max qty, discount type, value, active flag
   - "Add tier" button
   - Visual: example calculator showing what a customer pays at qty 1, 5, 10, 20, 50
6. **Media** —
   - Drag-drop image upload zone
   - Reorder via drag handles
   - "Set as primary" star icon
   - Per-image alt text
   - Per-variant image assignment
7. **SEO** — page title, meta description, custom slug; preview of how it renders in Google
8. **Status & visibility** — Draft/Published/Hidden/Archived, with explanation per state
9. **Related products** — manual list (search + add)
10. **Activity** — last 20 changes from audit log, filtered to this product

**Edge cases — product editor:**
- **Pre-order with stock entered:** form blocks save with "Pre-order products cannot have stock quantity. Either remove the stock or change availability to Available."
- **Variants enabled, then user tries to set product-level stock:** form blocks; product-level stock fields disabled with explanation.
- **Last price > regular price:** save blocked with "Last price must be less than or equal to regular price."
- **Last price empty + negotiation enabled:** save blocked.
- **Bulk tier overlap (e.g. tier1: 5–10, tier2: 8–15):** save blocked with explicit "Tiers cannot overlap" inline error showing which tiers conflict.
- **Bulk tier value > 100% (percentage):** rejected.
- **Sale price > regular price:** rejected with friendly error.
- **Sale start_at > end_at:** rejected.
- **Archiving a product currently in active orders:** allowed, but shows count of active orders containing this product as a confirmation.
- **Deleting a category that has products:** prompts to reassign or cancel; never orphans products.
- **Slug collision:** auto-suggests `-2`, `-3`, etc.
- **Image upload of unsupported format:** explicit error with accepted list (JPG, PNG, WebP).
- **Image >10MB:** rejected client-side before upload.
- **Stock adjustment (manual):** opens a separate modal with reason field (required) and writes to `stock_movements`.

### 8.7 Inventory View (`/admin/products/inventory`)

Specialised view for stock management.
- Filters: low stock, out of stock, by category
- Columns: product, variant, on hand, reserved, available, threshold, last movement, "Adjust" action
- Adjust modal: delta input (+ or −), reason select, free-text note, writes audit row
- Bulk adjust via CSV upload (template downloadable)

### 8.8 Customers List & Detail (`/admin/customers`, `/admin/customers/:id`)

**List:**
- Filter: search by name/phone/email, tags, has store credit, blacklisted, date range.
- Columns: name, phone, email, tags, total orders, lifetime value, last order, store credit balance.

**Detail:**
- Header: name, phone (click to call / WhatsApp), email, tags (editable), blacklist toggle (Manager+).
- Tabs: Profile, Orders, Returns, Notes, Addresses, Store credit history, AI conversations.
- Stats strip: total spend, order count, avg order, return rate, last order date.
- "Create order" CTA (deep-links to order creation pre-filled with this customer).
- "Open WhatsApp" / "Send email" quick actions.

**Edge cases:**
- Merging duplicate customers: dedicated tool — Manager+ — picks two records, shows diff, picks fields to keep, merges all order/return/conversation history into one. Audit log captures the merge.
- Blacklisted customer attempting to place a new order: blocked at API with explicit reason; admin can override per order.
- Store credit history shows every credit/debit with reason and order link.

### 8.9 Returns List & Detail (`/admin/returns`, `/admin/returns/:id`)

**List:**
- Filters: status, reason, refund method, date range.
- Columns: return number, order number, customer, items count, total refund, status pill, age (days since requested).
- Aging warnings: rows older than 48h in `requested` state highlighted yellow; 96h+ red.

**Detail:**
- Order summary at top
- Items being returned (with photos, condition select per item once received)
- Reason + customer/staff notes
- Photos gallery (uploaded by customer or staff)
- Action buttons by status:
  - Requested → Approve / Reject (with mandatory note on reject)
  - Approved → Mark items received (per-item condition recording)
  - Item received → Process refund (method picker, amount with breakdown of items × unit refund)
  - Reject / Refund processed → terminal states with audit trail
- Internal staff comments thread (collapsible)

**Edge cases:**
- Return for an order paid via split: refund flow lets staff allocate refund across original payment methods (e.g. ₦5K back to cash, ₦15K to bank), or to store credit, or any combination. Constraint: total refund amount must equal sum of method refunds.
- Item condition "damaged" + restock checkbox: defaults to off; admin can override.
- Partial restock: condition "used" → not restocked by default but a "restock" toggle is available.
- Refund processed but customer claims not received (Nuqood): show external_id and provide a "Re-process" / "Contact provider" workflow.
- Customer attempts to initiate return on item already partially returned: only remaining quantity is selectable.

### 8.10 Discounts (`/admin/discounts`)

**List:**
- Active coupons + sale rules combined view, filterable by type and status.
- Stat strip: active coupons count, total discount given (last 30d), top-redeemed code.

**Coupon editor:**
- Code (auto-uppercase, no spaces; suggest a code from name)
- Description (internal)
- Type: fixed / percentage
- Value
- Usage limits: total + per-customer
- Validity: starts/ends
- Min order value
- Applies to: All / specific products / categories / collections
- Active toggle
- Live preview of how it would render at checkout

**Edge cases:**
- Editing a coupon that's been redeemed: changes to value/scope are blocked; only validity / active flag / usage limit can be changed. Surfaces explanation.
- Two coupons applied (if allowed by policy): default policy is single coupon. If multi-coupon enabled, ordering: percentage first, then fixed. UI shows the order applied.
- Coupon for "specific products" where one of those products is archived: warning shown when editing.

### 8.11 Shipping (`/admin/shipping`)

- Settings card: flat rate fallback, global free threshold, allow pickup toggle, pickup address.
- Zones list: name, locations covered (state count + sample), fee, free threshold, estimated days, active toggle.
- Zone editor: name, fee, threshold, estimated days range, location picker (states with optional cities/LGAs).

**Edge cases:**
- Address that matches no zone: at checkout, returns the flat rate fallback IF set; else explicit error and prompt to contact business.
- Overlapping zones (same state in two zones): admin gets warned and must choose priority.

### 8.12 Staff & Roles (`/admin/staff`, `/admin/staff/roles`)

**Staff list:** name, email, role, status (active/disabled), last login, ⋯.
**Staff editor:** name, email, phone, role, custom permission overrides (toggle individual permissions on top of role).
**Reset password / disable / re-enable** as actions.

**Roles:**
- Default roles cannot be deleted (system flag) but can be modified.
- Custom role builder: name, description, permission grid (group by area: Orders, Products, Customers, Discounts, Shipping, Staff, Reports, AI, Settings, Billing).
- Each permission is a checkbox; a "select all in group" toggle exists.
- Cloning a role to create a custom one is supported.

**Activity log (`/admin/staff/activity`):**
- Filter: actor, action type, entity type, date range.
- Each entry: actor avatar/name, action, target entity (clickable), timestamp, ip, before/after JSON diff (in expandable view).

### 8.13 AI Control Panel (`/admin/ai`)

- Settings: system prompt, default negotiation flag, business hours behaviour, welcome messages per channel, abandoned-cart timing and template, handoff trigger config.
- Knowledge base CRUD with category, body (rich text), embedding regeneration on save.
- Conversation browser: list with sentiment colour coding, channel icon, outcome label, last message preview. Detail view shows full thread with tool calls visible (collapsed). "Take over" button triggers handoff and converts the AI's voice in the conversation to staff voice (header changes for customer).
- Handoff queue: oldest first, "Claim" button per row.
- Templates manager (per channel): WhatsApp template approval status surfaced (Meta business templates), test send.

### 8.14 Reports (`/admin/reports/*`)

Each report has a consistent structure:
- Title + date range picker (presets: Today, Yesterday, Last 7 days, Last 30 days, This month, Last month, This quarter, Custom)
- Filters specific to that report
- KPI strip
- Primary chart
- Drill-down table
- Export CSV/Excel/PDF (async job; emails when ready for large exports)

Required reports per brief:
- **Revenue:** total revenue, order count, AOV, refund rate; line chart of revenue; toggle paid-only vs all-orders.
- **Top products:** by units, by revenue; toggle scope (all/category).
- **Sources:** breakdown of orders by source, with revenue per source.
- **Staff performance:** orders per staff, AOV per staff, returns handled, payments confirmed, conversion rate (orders converted to paid).
- **Returns:** return rate per product, per category, by reason; cost-of-returns total.
- **Customers:** new vs returning chart, top customers list, cohort table (acquisitions per month, retention).
- **Discounts:** redemptions per coupon, total discount given, AOV with vs without coupon.
- **AI agent:** conversation count, conversion rate (conv → order), handoff rate, avg messages per conversation, top customer questions cluster.
- **Inventory:** stock value, low-stock list, out-of-stock list, dead stock (no movement in N days).
- **Payments:** revenue by method, partially-paid orders list with outstanding totals, payment failures.

### 8.15 Settings (`/admin/settings/*`)

**Business:** name, address, contact, hours, social handles, logo upload.
**Payments:** Nuqood credentials, enabled methods, partial-paid fulfilment policy, refund methods enabled.
**Notifications:** template editor per (key × channel), test send.
**Integrations:** Bumpa migration tool, courier API config, WhatsApp channel(s).
**Billing (Super Admin only):** subscription view, invoices, plan upgrade/downgrade.

### 8.16 Bumpa Migration Tool

A dedicated wizard:
1. Connect Bumpa (credentials)
2. Preview: count products, customers, orders to import; show field mapping with edit options
3. Dry run on 10 records → show diff/issues
4. Full migration in background; progress bar, error log per record
5. Post-migration: imported tags applied (`source: 'bumpa_migration'`), stock movements logged with reason `migration_import`
6. Re-run: idempotent via `bumpa_imports` provenance table; skips already-imported records, can selectively retry failures

**Edge cases — migration:**
- Bumpa SKU collisions with existing products: prompt to skip / overwrite / append suffix.
- Customers with same phone but different names: keep highest-LTV record's name; log conflict in import notes.
- Orders that reference products not yet imported: import in dependency order (categories → products → customers → orders).
- Time-zone differences in timestamps: normalise to UTC; preserve original in `metadata`.

---
