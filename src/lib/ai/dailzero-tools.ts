/**
 * The Avmall agent's webhook tools, as code.
 *
 * Dailzero agents call our /api/v1/ai/tools/* endpoints mid-conversation. The
 * tool list used to be typed into the Dailzero dashboard by hand, so it drifted
 * from the endpoints (wrong host, kobo-vs-Naira descriptions, missing params).
 * This file is now the single source: `pnpm ai:sync-tools` pushes it to every
 * agent with PUT /api/v1/agents/{id}/tools, replacing whatever is there.
 *
 * When you change a tool endpoint, change its entry here and re-sync.
 *
 * How Dailzero runs a tool: `{param}` placeholders in `url` are filled from the
 * model's arguments; on GET the remaining arguments become query params, on
 * POST they become the JSON body. The response body is handed to the model as
 * is, and the `description` is what steers it — so it says exactly what comes
 * back and what to do with it.
 *
 * Plain module — no "server-only" — so the sync script can import it under
 * tsx. It holds no secrets; the token is passed in.
 */

/** All Dailzero accepts — no arrays or objects. Line items therefore go as a
 *  JSON string and an order's contact/address as flat fields (see
 *  lib/ai/tool-input, which the endpoints parse them with). */
export type DailzeroParamType = "string" | "integer" | "number" | "boolean";

export interface DailzeroToolParam {
  name: string;
  type: DailzeroParamType;
  description: string;
  required?: boolean;
  enum?: string[];
}

export interface DailzeroTool {
  name: string;
  displayName: string;
  description: string;
  url: string;
  method: "GET" | "POST";
  parameters: DailzeroToolParam[];
  headers?: Record<string, string>;
}

/** Which channel an agent serves, from its Dailzero name ("Avmall Ltd Widget"
 *  is the website chat; anything else is WhatsApp). */
export function channelForAgent(businessName: string): DailzeroChannel {
  return /widget|web/i.test(businessName) ? "web" : "whatsapp";
}

/** Hard limit on Dailzero's side. */
export const DAILZERO_MAX_TOOLS = 50;

// ── Shared description fragments ─────────────────────────────────────────────

const MONEY_NOTE =
  "All prices come back as Naira strings (e.g. \"₦4,500\") — quote them exactly as given, never multiply or convert. `price` is ALWAYS what the customer pays today; `regularPrice` appears only when on sale and is the old, higher price (write it as \"₦8,400, was ₦12,500\").";

/** Where the agent talks to customers. The website chat has no live staff
 *  hand-over; WhatsApp does (Dailzero's own), and the customer is already there. */
export type DailzeroChannel = "web" | "whatsapp";

/** Website-only: there is no one to hand over to, so send them to WhatsApp. */
const WEB_HELP_NOTE =
  "If no order is found, or they say they paid and nothing came, don't promise that someone will help or ask them to wait: give them the support.whatsappLink from the response (or from get_store_info) exactly as given, so staff can check. Never build a wa.me link yourself, and never from the customer's own number.";

const TBC_NOTE =
  "When shipping is 'To be confirmed' (deliveryFeeConfirmedByStaff: true) we have no delivery price for that address: never quote, estimate or calculate one — tell the customer a member of our team will confirm the delivery fee with them.";

const FACTS_NOTE =
  "Only state facts the tool returned. Never invent colours, sizes, specs, battery life, warranty, or whether something is 'original' — if the data doesn't say, say you don't have that detail and offer the product link.";

const LINK_NOTE =
  "Each product has a productUrl: share that link so the customer can view it. Never paste imageUrl and never try to send images.";

const STOCK_NOTE =
  "Only call a product available when inStock is true. Out of stock is out of stock, even if the product is listed.";

const ITEMS_SHAPE =
  'The items as a JSON array written as text, each {"productSlug": "<slug exactly as a product tool returned it>", "quantity": <whole number ≥ 1>, "variantId": "<only for products with variants: the variants[].id from get_product>"}. Example: [{"productSlug":"oraimo-20000mah-power-bank","quantity":2}]';

// ── The tools ────────────────────────────────────────────────────────────────

/**
 * Build the full tool list.
 *
 * @param baseUrl Public site origin, e.g. https://www.avmall.com.ng (no trailing slash).
 * @param token   AI_AGENT_TOKEN, sent as a Bearer header on every call.
 * @param channel Where this agent chats — a few rules differ (see DailzeroChannel).
 */
export function buildAvmallTools(
  baseUrl: string,
  token: string,
  channel: DailzeroChannel = "whatsapp",
): DailzeroTool[] {
  const api = `${baseUrl.replace(/\/+$/, "")}/api/v1/ai/tools`;
  const headers = { Authorization: `Bearer ${token}` };

  const tools: Omit<DailzeroTool, "headers">[] = [
    // ── Catalogue ──
    {
      name: "search_products",
      displayName: "Search products",
      method: "GET",
      url: `${api}/products/search`,
      description: [
        "Search the live Avmall catalogue. Matches product name, brand, category, description and common synonyms (e.g. 'power bank' finds 'portable charger'), and tolerates brand typos ('orimo' → Oraimo). In-stock items rank first.",
        "ALWAYS call this before saying whether we sell something — never answer from memory.",
        "Returns found, count, inStockCount and products[] (name, brand, categoryName, description, price, regularPrice, status, inStock, stock, productUrl, slug). If found is false, we do NOT stock it: say so. If exactMatch is false, no product matches every word: notFound lists the words nothing mentions (e.g. 'bass', 'pepper') — say so honestly and never claim the products have them. Name each product's real brand; never describe one brand's product as another's. If a message field is present, follow it.",
        STOCK_NOTE,
        MONEY_NOTE,
        FACTS_NOTE,
        LINK_NOTE,
      ].join(" "),
      parameters: [
        {
          name: "q",
          type: "string",
          description:
            "What the customer is looking for, in their words: product type, brand or both (e.g. 'oraimo power bank', 'iphone 13 case'). Under 2 characters returns featured picks instead.",
          required: true,
        },
        {
          name: "category",
          type: "string",
          description:
            "Optional category slug from list_categories. Only used when q is empty, to get top picks in that category.",
        },
        { name: "limit", type: "integer", description: "How many results, 1-20. Default 6." },
      ],
    },
    {
      name: "get_product",
      displayName: "Product details",
      method: "GET",
      url: `${api}/products/{slug}`,
      description: [
        "Full live detail for ONE product: price, regularPrice, inStock and stock, variants (each with id, label, stock and its own price if different), bulkTiers (quantity discounts), negotiable, preorder, moq and eta.",
        "Call it before quoting a specific product's price, stock or options, and to get variant ids for cart and order tools. A 404 means the product does not exist or is no longer sold.",
        STOCK_NOTE,
        MONEY_NOTE,
        FACTS_NOTE,
        LINK_NOTE,
      ].join(" "),
      parameters: [
        {
          name: "slug",
          type: "string",
          description: "The product's slug, exactly as search_products or recommend_products returned it.",
          required: true,
        },
      ],
    },
    {
      name: "recommend_products",
      displayName: "Recommend products",
      method: "GET",
      url: `${api}/products/recommend`,
      description: [
        "Suggest products. relatedTo=<slug> gives items similar to that product (use it when something is out of stock or the customer wants alternatives). category=<slug> gives top picks in a category. Neither gives featured and new arrivals.",
        "Returns found, count and products[]. If found is false, do not invent suggestions.",
        STOCK_NOTE,
        MONEY_NOTE,
        FACTS_NOTE,
        LINK_NOTE,
      ].join(" "),
      parameters: [
        { name: "relatedTo", type: "string", description: "Slug of the product to find alternatives for." },
        { name: "category", type: "string", description: "Category slug from list_categories." },
        { name: "limit", type: "integer", description: "How many results, 1-20. Default 6." },
      ],
    },
    {
      name: "list_categories",
      displayName: "List categories",
      method: "GET",
      url: `${api}/categories`,
      description:
        "All store departments with their slug, name and productCount. Use when the customer wants to browse, or to get a category slug for search_products / recommend_products.",
      parameters: [],
    },

    {
      name: "get_store_info",
      displayName: "Shop details",
      method: "GET",
      url: `${api}/store`,
      description: [
        "Avmall's shop address, phone, WhatsApp (with a tap-to-chat whatsappLink) and email, live from the store's settings.",
        "Call it when the customer asks where the shop is, how to call or reach someone, or wants a human / staff / manager: give them the whatsappLink.",
        ...(channel === "web"
          ? [
              "In the website chat nobody can join the conversation: NEVER say 'one moment', 'let me sort this out', 'a member of our team will be with you shortly', or that you are transferring them — give the whatsappLink instead.",
            ]
          : []),
        "It doesn't list opening hours or pickup: never guess those, point them to WhatsApp.",
      ].join(" "),
      parameters: [],
    },

    // ── Delivery ──
    {
      name: "quote_shipping",
      displayName: "Delivery fee for a location",
      method: "GET",
      url: `${api}/shipping/quote`,
      description: [
        "Delivery fee and delivery time to one Nigerian state, optionally a specific LGA/area within it (some areas, e.g. parts of Kaduna, are priced differently from the rest of the state — pass lga whenever the customer names one).",
        "Accepts messy state names ('abuja', 'lagos state', 'Akwa-Ibom') and returns matchedState: reuse that EXACT value as state in quote_cart and create_order so the totals agree.",
        TBC_NOTE,
        "If areaMatched is false, the fee is the state's general rate, not a price for that area: follow areaMessage.",
        MONEY_NOTE,
      ].join(" "),
      parameters: [
        { name: "state", type: "string", description: "Nigerian state, e.g. 'Lagos', 'FCT', 'Kaduna'.", required: true },
        { name: "lga", type: "string", description: "Optional LGA or area within the state, e.g. 'Ikeja', 'Kawo'." },
        {
          name: "subtotal",
          type: "number",
          description: "Optional cart subtotal in NAIRA (e.g. 45000 for ₦45,000), to check whether delivery is free.",
        },
      ],
    },
    {
      name: "list_shipping_zones",
      displayName: "Delivery price table",
      method: "GET",
      url: `${api}/shipping/zones`,
      description: [
        "The full delivery price table: every zone with its states/areas, fee, free-delivery threshold and delivery time, plus the fallback rate.",
        "Use for GENERAL questions ('how much is delivery?', 'do you deliver to the North?'). For one customer's actual total use quote_shipping or quote_cart instead.",
        MONEY_NOTE,
      ].join(" "),
      parameters: [],
    },

    // ── Cart & checkout ──
    {
      name: "quote_cart",
      displayName: "Price a cart",
      method: "POST",
      url: `${api}/cart/quote`,
      description: [
        "The AUTHORITATIVE total for a set of items: subtotal, bulk discount, coupon discount, delivery and total, using live prices and stock.",
        "ALWAYS call this before telling the customer a total; never add prices up yourself. Pass the matchedState from quote_shipping as state.",
        "Only price what the customer actually chose. If they are still comparing options, ask which one first: never add alternatives together into one total.",
        TBC_NOTE,
        "It prices items but does NOT check stock, so confirm inStock with search_products or get_product first. An error naming a product means that slug does not exist.",
        MONEY_NOTE,
      ].join(" "),
      parameters: [
        { name: "items", type: "string", description: ITEMS_SHAPE, required: true },
        { name: "state", type: "string", description: "Delivery state (the matchedState from quote_shipping)." },
        { name: "lga", type: "string", description: "Delivery LGA/area, when the customer gave one." },
        { name: "couponCode", type: "string", description: "Coupon code, only if the customer gave one." },
      ],
    },
    {
      name: "prepare_cart_link",
      displayName: "Checkout link",
      method: "POST",
      url: `${api}/cart/prepare`,
      description:
        "Build a link that opens the website with these items already in the customer's cart, so they can check out and pay themselves. The simplest way to close a sale: prefer it over create_order unless the customer wants you to place the order for them. Returns cartUrl: share it exactly as returned. Use it whenever they say 'add to cart', 'send me the link' or 'how do I buy/pay' for a product they've picked — with quantity 1 unless they said otherwise, instead of asking again.",
      parameters: [{ name: "items", type: "string", description: ITEMS_SHAPE, required: true }],
    },
    {
      name: "negotiate_price",
      displayName: "Check a price offer",
      method: "POST",
      url: `${api}/negotiate`,
      description: [
        "When a customer offers a lower price for a product, check whether we can accept it. Returns acceptable, settlePrice (the price to charge when accepted), counterOffer (when we can meet them part-way) and messageHint: follow messageHint closely.",
        "Never call any price our 'floor' or 'minimum', and never go below counterOffer. Note create_order charges the normal catalogue price — an agreed lower price has to be finished by staff, so offer to connect them.",
        MONEY_NOTE,
      ].join(" "),
      parameters: [
        { name: "productSlug", type: "string", description: "The product's slug.", required: true },
        {
          name: "offer",
          type: "number",
          description: "The customer's offer PER UNIT in NAIRA (e.g. 4000 for ₦4,000). Not kobo.",
          required: true,
        },
        { name: "quantity", type: "integer", description: "How many units. Default 1." },
      ],
    },
    {
      name: "create_order",
      displayName: "Place an order",
      method: "POST",
      url: `${api}/orders`,
      description: [
        "Place a REAL order (unpaid, stock held for the customer). Only call after the customer has clearly confirmed the items, the delivery address and the total you got from quote_cart. Charges catalogue prices plus any coupon.",
        "Returns the order number (AVM-…) and total. Then call create_payment_link to collect payment.",
        "If the order comes back with delivery 'To be confirmed', its total is for the items only: tell the customer a member of our team will confirm the delivery fee with them.",
        "Pass the same idempotencyKey if you retry, so the customer is never charged for two orders.",
        MONEY_NOTE,
      ].join(" "),
      parameters: [
        { name: "items", type: "string", description: ITEMS_SHAPE, required: true },
        { name: "customerName", type: "string", description: "Buyer's full name.", required: true },
        {
          name: "customerPhone",
          type: "string",
          description: "Buyer's Nigerian phone number, any format (0803…, +234803…).",
          required: true,
        },
        { name: "customerEmail", type: "string", description: "Buyer's email, only if they gave one." },
        { name: "addressLine1", type: "string", description: "Street address for delivery.", required: true },
        { name: "addressLine2", type: "string", description: "Landmark or extra directions, if given." },
        { name: "city", type: "string", description: "LGA or area, e.g. 'Ikeja', 'Kawo'.", required: true },
        {
          name: "state",
          type: "string",
          description: "Delivery state: the matchedState from quote_shipping.",
          required: true,
        },
        { name: "couponCode", type: "string", description: "Coupon code, only if the customer gave one." },
        {
          name: "idempotencyKey",
          type: "string",
          description:
            "A unique id for this order attempt (e.g. the customer's phone plus the time). Reuse the SAME value if you retry.",
        },
      ],
    },

    // ── Payments ──
    {
      name: "create_payment_link",
      displayName: "Get payment details",
      method: "POST",
      url: `${api}/payments/link`,
      description: [
        "Create a payment for an existing order. method 'nuqood' (default) returns a bank account (bank, number, name) for the customer to transfer to, plus a reference — give the customer the account details exactly as returned.",
        "Leave amount empty to collect the full outstanding balance.",
        MONEY_NOTE,
      ].join(" "),
      parameters: [
        { name: "orderNumber", type: "string", description: "The order number, e.g. AVM-2026-00000123.", required: true },
        {
          name: "amount",
          type: "number",
          description: "Optional part-payment in NAIRA. Leave empty to collect the full balance.",
        },
        { name: "method", type: "string", description: "How the customer will pay.", enum: ["nuqood", "bank_transfer"] },
      ],
    },
    {
      name: "get_payment_status",
      displayName: "Check a payment",
      method: "GET",
      url: `${api}/payments/{reference}`,
      description:
        "Check whether a transfer has arrived, using the reference from create_payment_link. Returns the payment status (pending/completed) and what is paid and still outstanding on the order. Never tell the customer a payment arrived unless this says completed.",
      parameters: [
        {
          name: "reference",
          type: "string",
          description: "The payment reference from create_payment_link.",
          required: true,
        },
      ],
    },

    // ── After-sale ──
    {
      name: "get_order",
      displayName: "Order status",
      method: "GET",
      url: `${api}/orders/{number}`,
      description: [
        "Status of one order by its number: order status, payment status, items, totals, delivery address and shipped/delivered dates.",
        ...(channel === "web" ? [WEB_HELP_NOTE] : []),
        MONEY_NOTE,
      ].join(" "),
      parameters: [
        {
          name: "number",
          type: "string",
          description: "Order number, e.g. AVM-2026-00000123.",
          required: true,
        },
      ],
    },
    {
      name: "find_orders_by_phone",
      displayName: "Find a customer's orders",
      method: "GET",
      url: `${api}/orders/by-phone`,
      description: [
        "The customer's most recent orders, when they ask about an order but don't have the number. On WhatsApp use their WhatsApp number; on the website, ask for the phone number they ordered with.",
        ...(channel === "web" ? [WEB_HELP_NOTE] : []),
        MONEY_NOTE,
      ].join(" "),
      parameters: [
        { name: "phone", type: "string", description: "Phone number the order was placed with, any Nigerian format.", required: true },
        { name: "limit", type: "integer", description: "How many orders, 1-20. Default 5." },
      ],
    },
  ];

  return tools.map((t) => ({ ...t, headers }));
}
