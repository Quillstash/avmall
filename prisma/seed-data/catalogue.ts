/**
 * Seed catalogue — Avmall's real Bumpa export (~120 SKUs).
 *
 * Lives under prisma/ because it exists ONLY to populate the database via
 * `prisma db seed`. The running app never imports this file; it reads products
 * and categories from the database exclusively. Shared view types come from the
 * app's catalogue type module.
 *
 * Money is integer kobo throughout. The compact `mp(...)` helper expands each
 * row into a fully-typed Product with a default variant + theme.
 */

import type {
  BulkTier,
  Category,
  Product,
  ProductCategoryId,
} from "../../src/lib/mock-data";

const CATEGORY_BG: Record<ProductCategoryId, string> = {
  phones: "linear-gradient(135deg, #d6e4ff 0%, #4263eb 100%)",
  audio: "linear-gradient(135deg, #ffe0c2 0%, #d97757 100%)",
  power: "linear-gradient(135deg, #d4ede0 0%, #1f6f4a 100%)",
  fans: "linear-gradient(135deg, #d8eef7 0%, #2b8cb8 100%)",
  home: "linear-gradient(135deg, #ece4d4 0%, #c4a87a 100%)",
};

export const CATEGORIES: readonly Category[] = [
  { id: "phones", name: "Phones & Tablets", count: 22 },
  { id: "audio", name: "Audio", count: 26 },
  { id: "power", name: "Power", count: 25 },
  { id: "fans", name: "Fans", count: 24 },
  { id: "home", name: "Home & Kitchen", count: 25 },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────

const CDN = "https://dodptt9f4zk9h.cloudfront.net/stores/114586/products";

/** Compact factory — every row becomes a full Product. */
function mp(input: {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: ProductCategoryId;
  /** Bumpa CDN image hash (filename without the `tn-` thumbnail prefix). */
  img: string;
  /** Display price in Naira. */
  price: number;
  /** Sale price in Naira (if currently discounted). */
  sale?: number;
  /** Cost of goods in Naira. Defaults to 70 % of retail when omitted — these
   *  are placeholders for the client demo, not real cost data. */
  cost?: number;
  /** Units on hand. */
  stock?: number;
  short?: string;
  rating?: number;
  reviews?: number;
  bulk?: BulkTier[];
  negotiate?: boolean;
}): Product {
  const stock = input.stock ?? 10;
  const priceKobo = input.price * 100;
  const costKobo =
    input.cost != null ? input.cost * 100 : Math.floor(priceKobo * 0.7);
  return {
    id: input.id,
    slug: input.slug,
    name: input.name,
    // Seed fixtures carry a fixed placeholder timestamp; real rows get their
    // createdAt/updatedAt from the DB at insert time.
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    brand: input.brand,
    short: input.short ?? `${input.brand} · ${input.name}`,
    mark: input.brand.charAt(0).toUpperCase(),
    category: input.category,
    imageUrl: `${CDN}/${input.img}.jpeg`,
    bg: CATEGORY_BG[input.category],
    price: priceKobo,
    cost: costKobo,
    ...(input.sale != null && {
      sale: input.sale * 100,
      saleActive: true,
    }),
    stock,
    rating: input.rating ?? 4.7,
    reviews: input.reviews ?? 24,
    bulk: input.bulk ?? [],
    variants: [
      {
        id: `${input.id}-v1`,
        label: "Default",
        stock,
        price: null,
      },
    ],
    ...(input.negotiate && { negotiate: true }),
  };
}

// ─── Catalogue ────────────────────────────────────────────────────────────

export const PRODUCTS: readonly Product[] = [
  // ── PHONES & TABLETS ────────────────────────────────────────────────────
  mp({ id: "p4411733", slug: "samsung-a16-4gb64gb", name: "Samsung A16 4GB / 64GB", brand: "Samsung", category: "phones", img: "b3ea24c913fe86987703aae05401eb1fb0ea9201", price: 250000, sale: 230000, stock: 2, short: "Quad-core Galaxy A16 with 64GB storage — official warranty." }),
  mp({ id: "p4411728", slug: "samsung-a05s-4128gb", name: "Samsung A05s 4 / 128GB", brand: "Samsung", category: "phones", img: "42a7733a9f2ff4ea7e0b226a20b860bb3f669c6a", price: 230000, sale: 210000, stock: 2 }),
  mp({ id: "p4411741", slug: "samsung-galaxy-tab-a9", name: "Samsung Galaxy Tab A9", brand: "Samsung", category: "phones", img: "95698e9fd6c1d6708bfa5d769f23a8ed5d3b575b", price: 205000, sale: 192000, stock: 1 }),
  mp({ id: "p4411805", slug: "tecno-pop-9-364gb", name: "Tecno POP 9 3/64GB", brand: "Tecno", category: "phones", img: "178ec12d68ed883bfde648c6793990d86fb02a0b", price: 130000, sale: 115000, stock: 1 }),
  mp({ id: "p4411721", slug: "tecno-pop-8", name: "Tecno POP 8", brand: "Tecno", category: "phones", img: "a75d1f287700b8105a1f8cb18ae75d3a9f076ae8", price: 120000, sale: 110000, stock: 2 }),
  mp({ id: "p4411797", slug: "tecno-spark-30c-4128gb", name: "Tecno Spark 30c 4 / 128GB", brand: "Tecno", category: "phones", img: "59fd90239a9797496542b178ab37ab3c039ab82a", price: 160000, sale: 142000, stock: 2 }),
  mp({ id: "p4411794", slug: "tecno-spark-30c-6128gb", name: "Tecno Spark 30c 6 / 128GB", brand: "Tecno", category: "phones", img: "546c25b92a3fd7dcdb21660d8b0582bfb11696b3", price: 180000, sale: 162000, stock: 2 }),
  mp({ id: "p4411706", slug: "tecno-camon-30s-6gb128gb", name: "Tecno Camon 30s 6/128GB", brand: "Tecno", category: "phones", img: "5b0518d0f9e02f2fccd8ec73f659356da6d44d40", price: 295000, sale: 265000, stock: 1 }),
  mp({ id: "p4411673", slug: "infinix-smart-9-3128gb", name: "Infinix Smart 9 3/128GB", brand: "Infinix", category: "phones", img: "3a5cde271a1698b76d416e2ff0c481b6d8bd107d", price: 150000, sale: 135000, stock: 2 }),
  mp({ id: "p4411658", slug: "infinix-smart-9hd", name: "Infinix Smart 9 HD", brand: "Infinix", category: "phones", img: "f1c6ab28564067ef31a1729c4a67e218f4fd96e4", price: 130000, sale: 115000, stock: 2 }),
  mp({ id: "p4411655", slug: "infinix-hot-50-phone-8gb128gb", name: "Infinix Hot 50 8/128GB", brand: "Infinix", category: "phones", img: "8b73602c7bd72cf9e442d3dfee7901d46f228173", price: 230000, sale: 210000, stock: 1 }),
  mp({ id: "p4411650", slug: "itel-s25-ultra-8256gb", name: "Itel S25 Ultra 8/256GB", brand: "Itel", category: "phones", img: "8dc9d106167bc1312852cf2b7557cfb1bf20b65d", price: 260000, sale: 240000, stock: 2 }),
  mp({ id: "p4411625", slug: "itel-a18-2024-phone", name: "Itel A18 (2024)", brand: "Itel", category: "phones", img: "eee98d0bd80478408c5d0dcb3dd5cf428a323f23", price: 65000, sale: 62000, stock: 4 }),
  mp({ id: "p4411630", slug: "itel-a18s-2gb32gb-phone", name: "Itel A18s 2/32GB", brand: "Itel", category: "phones", img: "50cf15c2c734ccde71b262b9e7d04855563c0267", price: 75000, sale: 63000, stock: 1 }),
  mp({ id: "p4355287", slug: "itel-5606-phone", name: "Itel 5606 Feature Phone", brand: "Itel", category: "phones", img: "ba492897fd807c0ce3a6aa35ae6dc4f00cecf3ef", price: 17500, sale: 15000, stock: 15 }),
  mp({ id: "p4411881", slug: "atouch-kd53-childrens-tablet", name: "Atouch KD53 Kids Tablet", brand: "Atouch", category: "phones", img: "cd43cc4990efbd7c5a5dbb8dfb5910294523f823", price: 85000, sale: 75000, stock: 1 }),
  mp({ id: "p4411869", slug: "atouch-kt36-5g-childrens-tablet", name: "Atouch KT36 5G Kids Tablet", brand: "Atouch", category: "phones", img: "f7c348f22ebbddb58787ee85295f3fa97cf93907", price: 125000, sale: 110000, stock: 2 }),
  mp({ id: "p4411873", slug: "bebe-tab-b77s-childrens-tablet", name: "Bebe Tab B77s+ Kids Tablet", brand: "Bebe", category: "phones", img: "7407b4cdf08c9c683752f1934bfc91ea6a92749b", price: 85000, sale: 75000, stock: 1 }),
  mp({ id: "p4411862", slug: "oteeto-tab-10-kids-childrens-tablet", name: "Oteeto Tab 10 Kids", brand: "Oteeto", category: "phones", img: "a3ce08fd56de7a263142ca900359354c1641efee", price: 115000, sale: 108000, stock: 1 }),
  mp({ id: "p4411856", slug: "lenosed-tab-a76-childrens-tab", name: "Lenosed Tab A76 Kids", brand: "Lenosed", category: "phones", img: "e406a4fab4642f61c163940744eca6a3fccf5262", price: 85000, sale: 75000, stock: 1 }),
  mp({ id: "p4411746", slug: "redmi-tab-se-87-inches", name: "Redmi Pad SE 8.7\"", brand: "Redmi", category: "phones", img: "be35c02a866e7899973ea113ac5668079d872886", price: 185000, sale: 170000, stock: 1 }),
  mp({ id: "p4411888", slug: "c-idea-tablet", name: "C Idea Tablet (Free Bundle)", brand: "C Idea", category: "phones", img: "1688ab476372a32e1cc1d6adc6db7a593934d006", price: 125000, sale: 98000, stock: 3, short: "Tablet bundle: pouch, screen guard, 8000mAh power bank, watch, airpods, charger — all included." }),

  // ── AUDIO & WEARABLES ───────────────────────────────────────────────────
  mp({ id: "p4522498", slug: "apple-airpod", name: "Apple AirPods", brand: "Apple", category: "audio", img: "1f6a2754617aa53d6279091ae730ced6b9d29283", price: 19500, sale: 15000, stock: 2 }),
  mp({ id: "p4522491", slug: "wisme-t52-wireless-earbud", name: "Wisme T52 Wireless Earbud", brand: "Wisme", category: "audio", img: "0e4eb54544cbad024eb9b39a793ce240a64e38ce", price: 17500, sale: 12500, stock: 5 }),
  mp({ id: "p4522474", slug: "modio-reno-8-wireless-bluetooth", name: "Modio Reno 8 Wireless", brand: "Modio", category: "audio", img: "5d1a04fedb7fa573d976d09261be88ed327a7fdd", price: 16500, sale: 12500, stock: 3 }),
  mp({ id: "p4422228", slug: "jamax-tws-earbud", name: "Jamax TWS Earbud", brand: "Jamax", category: "audio", img: "8e815aa3c32ccc9226ada39ca807011a4ae98b9c", price: 5500, sale: 4000, stock: 53 }),
  mp({ id: "p4422160", slug: "itel-buds-air-5i", name: "Itel Buds Air 5i", brand: "Itel", category: "audio", img: "3eb4b18a499814bba349f39a49cabc118c706ffe", price: 17000, sale: 13800, stock: 10 }),
  mp({ id: "p4422155", slug: "itel-buds-air-5", name: "Itel Buds Air 5", brand: "Itel", category: "audio", img: "ad9238d228229b6ba69a783653eae5771b6b591a", price: 17500, sale: 14000, stock: 10 }),
  mp({ id: "p4308492", slug: "itel-buds-neo-almubaarak-variety-mall", name: "Itel Buds Neo", brand: "Itel", category: "audio", img: "0504253ca4925396377f9288069523c4c1b97f6e", price: 9800, stock: 8 }),
  mp({ id: "p4308494", slug: "itel-budsneo-3", name: "Itel Buds Neo 3", brand: "Itel", category: "audio", img: "baaa8dacb5a735b6976c9408e05bebba1c1feac8", price: 18500, sale: 15000, stock: 5 }),
  mp({ id: "p4308877", slug: "p47-headset", name: "P47 Wireless Headset", brand: "P47", category: "audio", img: "525c5317d9ecd2aa514b6dd4e2e8e675310fbcce", price: 4500, sale: 3050, stock: 32 }),
  mp({ id: "p4308220", slug: "tune-jb33-almubaarak-variety-mall", name: "Tune JB33 Headset", brand: "Tune", category: "audio", img: "ae02fa510d90dcf47ea44910a346fe42a74fdfbf", price: 9500, stock: 1 }),
  mp({ id: "p4308613", slug: "live-jb93-almubaarak-variety-mall", name: "Live JB93 Headset", brand: "Live", category: "audio", img: "0d99301525f1fb037a4e4f2d041f8d2535bb54d3", price: 11000, stock: 2 }),
  mp({ id: "p4308521", slug: "jb-7700-almubaarak-variety-mall", name: "JB 7700 Headset", brand: "JBL", category: "audio", img: "3cd11df40c206ad0cce218cb557dcd9b1a75844f", price: 9800, stock: 1 }),
  mp({ id: "p4308851", slug: "oraimo-headset-boompop2s-almubaarak-variety-mall", name: "Oraimo BoomPop2s Headset", brand: "Oraimo", category: "audio", img: "759b25802fb80ff080c2d19f864761b23c16a2d4", price: 40000, stock: 3 }),
  mp({ id: "p4308828", slug: "oraimo-airbud-3-e11d-almubaarak-variety-mall", name: "Oraimo Airbud 3 E11D", brand: "Oraimo", category: "audio", img: "d489adf61a81775a17da719ce4ff4ca2b0c6255e", price: 24750, stock: 2 }),
  mp({ id: "p4308860", slug: "oraimo-spacebuds-pro", name: "Oraimo Spacebuds Pro", brand: "Oraimo", category: "audio", img: "e8a2ed721d5fdf48d9d8be3eae03e15eed3687a5", price: 115000, stock: 2 }),
  mp({ id: "p4309327", slug: "zealot-s38-bluetooth-speaker", name: "Zealot S38 Bluetooth Speaker", brand: "Zealot", category: "audio", img: "b648d085c3de78cd526b13a44047d59723b88d18", price: 36000, stock: 1, short: "Loud, durable party speaker — Bluetooth 5.3, FM radio, 12-hour playback." }),
  mp({ id: "p4309328", slug: "zealot-s8-bluetooth-speaker", name: "Zealot S8 Bluetooth Speaker", brand: "Zealot", category: "audio", img: "514bb788973457945ab707bd32e5ca2573c0fa72", price: 27600, stock: 4 }),
  mp({ id: "p4308431", slug: "hm908-bluetooth-speaker", name: "HM908 Bluetooth Speaker", brand: "HM", category: "audio", img: "35978bc9ab921d1630859ace167f11c5b0f98847", price: 26500, stock: 5 }),
  mp({ id: "p4309151", slug: "starry-sky-projector-with-speaker", name: "Starry Sky Projector Speaker", brand: "Avmall", category: "audio", img: "942a20ec3af3af2643bd39ef8181d27edadb10a3", price: 16000, stock: 1, short: "Bluetooth speaker with starlight projector — ambient lighting + music in one." }),
  mp({ id: "p4308759", slug: "muslim-quran-speakers-wireless-bluetooth-speakers-night-light-3d-moon-with-app-control-islam-speaker-quran-touch-lamp-player", name: "3D Moon Quran Lamp Speaker", brand: "Avmall", category: "audio", img: "0bcebe777811362bdbb6edbce7585206951519a6", price: 26000, stock: 3, short: "App-controlled Bluetooth speaker with Quran library + warm moon-night light." }),
  mp({ id: "p4617566", slug: "q8-magnetic-wireless-microphone", name: "Q8 Magnetic Wireless Microphone", brand: "Avmall", category: "audio", img: "9f17de20133c740da586c1c4715401f48a94bfe9", price: 25000, sale: 16500, stock: 10 }),
  mp({ id: "p4351978", slug: "wireless-microphone-2in1", name: "2-in-1 Wireless Microphone", brand: "Avmall", category: "audio", img: "fd8ce0ca1da85e25a5097b69abec68fe84f63528", price: 17500, sale: 12000, stock: 11 }),
  mp({ id: "p4573217", slug: "neepho-m03-rgb-ai-desktop-microphone", name: "Neepho M03 RGB AI Microphone", brand: "Neepho", category: "audio", img: "738e42207c6808c489e58b69b29d487d84b5af99", price: 54500, sale: 32000, stock: 3 }),
  mp({ id: "p4522604", slug: "kw23-ultra-3-smartwatch", name: "Keqiwear KW23 Ultra 3 Smartwatch", brand: "Keqiwear", category: "audio", img: "475b3f530f1f9e77deb401abde35c0b0ef683655", price: 12500, sale: 8400, stock: 6 }),
  mp({ id: "p4522615", slug: "keqiwear-kw72-mini-smartwatch-female-fashion-accessories", name: "Keqiwear KW72 Smartwatch Set", brand: "Keqiwear", category: "audio", img: "457a34cea62a7a9fbf702b8dbb63acf936e059e5", price: 21500, sale: 16500, stock: 12 }),
  mp({ id: "p4351139", slug: "a58-plus-watch-gift-set", name: "A58 Plus Smartwatch Gift Set", brand: "A58", category: "audio", img: "ea92e2aa757cb78cb70c903418841f824ae04e99", price: 20500, sale: 16500, stock: 5 }),

  // ── POWER ───────────────────────────────────────────────────────────────
  mp({ id: "p4721328", slug: "newage-22500mah-powerbank", name: "Newage 22,500mAh Power Bank", brand: "Newage", category: "power", img: "7d4bc1269e0b194354752531401b88f703f0753a", price: 19000, sale: 15000, stock: 50, short: "High-capacity 22,500mAh power bank with dual USB + LED indicator." }),
  mp({ id: "p4308818", slug: "oraimo-20000mah-20w-powerbank-almubaarak-variety-mall", name: "Oraimo 20,000mAh 20W Power Bank", brand: "Oraimo", category: "power", img: "532de898f79bc375ab3482743ae56191d668af0a", price: 18000, sale: 14500, stock: 35 }),
  mp({ id: "p4308822", slug: "oraimo-27000mah-powerbank-opb-1270-almubaarak-variety-mall", name: "Oraimo 27,000mAh Power Bank", brand: "Oraimo", category: "power", img: "9220d0ea29c5d9cd4b80e4892ce9295f1090c22f", price: 23500, stock: 13 }),
  mp({ id: "p4308826", slug: "oraimo-50000mah-powerbank", name: "Oraimo 50,000mAh Power Bank", brand: "Oraimo", category: "power", img: "27756b025a9c2d6488d67a8ac2991262b7099557", price: 67500, stock: 2, short: "Massive 50K capacity — laptop-grade output, perfect for outages." }),
  mp({ id: "p4308825", slug: "oraimo-40000mah", name: "Oraimo 40,000mAh Power Bank", brand: "Oraimo", category: "power", img: "77d5eafdde3f4a15b66e8659aa093aa635d57a88", price: 44000, stock: 5 }),
  mp({ id: "p4422248", slug: "itel-100000mah-powergo", name: "Itel 100,000mAh Powergo", brand: "Itel", category: "power", img: "0e271b2e9c1a960f241497027f4c6ce5f1d0ee54", price: 113000, stock: 2, short: "The largest Itel Powergo — runs phones, fans, and lamps for days." }),
  mp({ id: "p4422242", slug: "itel-30000mah-powerbank-powerplus-series", name: "Itel 30,000mAh Powerplus", brand: "Itel", category: "power", img: "68be5474939ffa1b0a58e0dadcda22c3de74ab18", price: 32500, sale: 27000, stock: 3 }),
  mp({ id: "p4308488", slug: "itel-27000mah-powerbank-free-charger-almubaarak-variety-mall", name: "Itel 27,000mAh + Free Charger", brand: "Itel", category: "power", img: "532de898f79bc375ab3482743ae56191d668af0a", price: 25500, stock: 10 }),
  mp({ id: "p4308490", slug: "itel-40000mah-225w-powerbank", name: "Itel 40,000mAh 22.5W Power Bank", brand: "Itel", category: "power", img: "7e628397693b1214e3a6e147edad8a6d5365c130", price: 36000, stock: 10 }),
  mp({ id: "p4422215", slug: "linkco-30000mah-powerbank", name: "Linkco 30,000mAh Power Bank", brand: "Linkco", category: "power", img: "0411daa35d6ce5fc3cc3fa54388180a694de3493", price: 27500, sale: 23500, stock: 10 }),
  mp({ id: "p4422182", slug: "linkco-20000mah-powerbank", name: "Linkco 20,000mAh Power Bank", brand: "Linkco", category: "power", img: "5a680d0996c384c7793e42a63a3d22b45e63ad28", price: 18500, sale: 12500, stock: 5 }),
  mp({ id: "p4308194", slug: "chupez-30000mah-powerbank-almubaarak-variety-mall", name: "Chupez 30,000mAh Power Bank", brand: "Chupez", category: "power", img: "6aae1293b127328d79884303979007569e7c4e57", price: 25500, stock: 5 }),
  mp({ id: "p4308191", slug: "chupez-20000mah-horsepower-powerbank-almubaarak-variety-mall", name: "Chupez 20,000mAh Horsepower", brand: "Chupez", category: "power", img: "037647a9f23f69fd105ce08b9963c1a91e93cd4d", price: 14900, stock: 6 }),
  mp({ id: "p4308107", slug: "baseus-20000mah-15w-powerbank", name: "Baseus 20,000mAh 15W Power Bank", brand: "Baseus", category: "power", img: "63bb46696d9a73ded8b59021cf7d55d39dc8df35", price: 17500, stock: 49 }),
  mp({ id: "p4308108", slug: "baseus-30000mah-15w-powerbank", name: "Baseus 30,000mAh 15W Power Bank", brand: "Baseus", category: "power", img: "764831b428618722548122904a2a8b2e592d2eaa", price: 26000, stock: 33 }),
  mp({ id: "p4308785", slug: "new-age-turbo-ultra-3-33000mah-powerbank", name: "Newage Turbo Ultra 3 33,000mAh", brand: "Newage", category: "power", img: "e25e7829d892a55f06c09028bd110145c052d9a4", price: 28000, sale: 21700, stock: 5 }),
  mp({ id: "p4308784", slug: "new-age-turbo-prime-1-22500mah-powerbank", name: "Newage Turbo Prime 1 22,500mAh", brand: "Newage", category: "power", img: "1e76a2ce6ea69b4a3f2e2f30e903c67b60157d78", price: 16000, sale: 12600, stock: 16 }),
  mp({ id: "p4351283", slug: "25w-pd-adapter-usb-c-to-c", name: "25W PD USB-C Adapter", brand: "Avmall", category: "power", img: "a05f5731aa9d69a9f138584e5740387536db952f", price: 7000, sale: 5500, stock: 11 }),
  mp({ id: "p4308466", slug: "iphone-14-promax-charger", name: "iPhone 14 Pro Max Fast Charger", brand: "Avmall", category: "power", img: "1f6a2754617aa53d6279091ae730ced6b9d29283", price: 4500, stock: 41 }),
  mp({ id: "p4522529", slug: "67w-type-c-charger", name: "67W Type-C Super Fast Charger", brand: "Avmall", category: "power", img: "629a2413cf3f42ada95198b82f6e8bec51addd51", price: 12500, sale: 9000, stock: 5 }),
  mp({ id: "p4522465", slug: "45w-aljazira-type-c-to-type-c-super-fast-charger", name: "AlJazira 45W Type-C Charger", brand: "AlJazira", category: "power", img: "32309c66cb384fb76cecece0cc9c21524223d053", price: 11000, sale: 8000, stock: 10 }),
  mp({ id: "p4308504", slug: "itel-isu-1431wl-4-ports-extension-box", name: "Itel 4-Way Extension (ISU-1431WL)", brand: "Itel", category: "power", img: "ecbafecf06009ecd4eb8c2c06f10ee98bb6abb64", price: 4500, stock: 18 }),
  mp({ id: "p4308505", slug: "itel-isu-1521wl-5-ports-extension-box", name: "Itel 5-Way Extension (ISU-1521WL)", brand: "Itel", category: "power", img: "9893fd287fd53b7ed1daf10cd728291be43f51f8", price: 4800, stock: 16 }),
  mp({ id: "p4308503", slug: "itel-isu-1421wu-4usb-extension-box", name: "Itel 4-Way + USB Extension", brand: "Itel", category: "power", img: "43f0df114b513db0480687433ec2a75c7c9ff751", price: 6500, stock: 2 }),
  mp({ id: "p4308146", slug: "c-to-c-fast-cable", name: "USB-C to USB-C Fast Cable", brand: "Avmall", category: "power", img: "47e39d7eb104b95552474a3fe09a622bd91ccc6a", price: 1000, stock: 58 }),

  // ── FANS & COOLING ──────────────────────────────────────────────────────
  mp({ id: "p4544825", slug: "rechargeable-mini-fan", name: "Rechargeable Mini Fan", brand: "Avmall", category: "fans", img: "ed9d1d44944b1db430fee990c5a04b5d6571d8a2", price: 4000, stock: 10, short: "Compact rechargeable desk fan — quiet, 8-hour runtime, USB-C." }),
  mp({ id: "p4549000", slug: "iwin-rotating-fan-8-inches-iw8008", name: "Iwin 8\" Rotating Fan IW8008", brand: "Iwin", category: "fans", img: "320ea2208c5bb9ba051979c76574d957c654c091", price: 19500, sale: 18500, stock: 15 }),
  mp({ id: "p4647204", slug: "iwin-rotating-fan-with-light7", name: "Iwin Rotating Fan With Light", brand: "Iwin", category: "fans", img: "69c8bb9d9e5fc3f3a945801905a36835fd6970b6", price: 17500, stock: 10 }),
  mp({ id: "p4647131", slug: "iwin-rechargeable-desktop-fan-iw8008-1", name: "Iwin Rechargeable Desktop Fan", brand: "Iwin", category: "fans", img: "3c736779944969af26cd91bfb1aa5af3b6bb64fd", price: 17000, stock: 10 }),
  mp({ id: "p4647109", slug: "iwin-eco-s-rotating-8-inches-no-carton", name: "Iwin Eco S 8\" Rotating", brand: "Iwin", category: "fans", img: "365b34411be8e23ad8737a34579d4b21a026c9cf", price: 19500, sale: 16000, stock: 10 }),
  mp({ id: "p4647083", slug: "iwin-rechargeable-fan-iw8038-s", name: "Iwin IW8038-S Rechargeable Fan", brand: "Iwin", category: "fans", img: "3a605d034d42e31275de34f9b860d3d0342dc124", price: 19500, sale: 17500, stock: 20 }),
  mp({ id: "p4647190", slug: "iwin-eco-e-power-desktop-fan", name: "Iwin Eco E Power Desktop Fan", brand: "Iwin", category: "fans", img: "b4659de18c70efca2937f5beb314243e1a4ffb2a", price: 7000, stock: 10 }),
  mp({ id: "p4666625", slug: "eurosonic-6inches-fan-es2632", name: "Eurosonic 6\" Fan ES2632", brand: "Eurosonic", category: "fans", img: "f63b8bd6eb2c3632e684b7c864b51cf6d4271834", price: 17500, sale: 14500, stock: 13 }),
  mp({ id: "p4666617", slug: "eurosonic-8-inches-fan-es2669", name: "Eurosonic 8\" Fan ES2669", brand: "Eurosonic", category: "fans", img: "e8b49552a67c2cfe711d1a9f88190c7f13978467", price: 20500, sale: 18000, stock: 1 }),
  mp({ id: "p4716739", slug: "sonik-fan-with-panel-and-bulb", name: "Sonik Fan With Solar Panel & Bulb", brand: "Sonik", category: "fans", img: "73d90ad2510d39de57a57f3797abdcc5dc2e3c82", price: 27500, sale: 23000, stock: 17 }),
  mp({ id: "p4565821", slug: "iwin-8inches-fan-iw8008-1", name: "Iwin 8\" IW8008-1 Fan", brand: "Iwin", category: "fans", img: "5b7408541b6a57a9f4a21afcf19dc226117f5a2b", price: 18000, stock: 8 }),
  mp({ id: "p4565175", slug: "iwin-4inches-mini-fan", name: "Iwin 4\" Mini Fan", brand: "Iwin", category: "fans", img: "3da371936bd86085b9b3c453d00ebebf688fdd2e", price: 4700, stock: 10 }),
  mp({ id: "p4561939", slug: "iwin-rechargeable-and-wall-mounted-fan-iw8038-b", name: "Iwin IW8038-B Wall-Mounted Fan", brand: "Iwin", category: "fans", img: "5a202f11a9f5142bb5da75c432983db8497b181b", price: 15000, sale: 13000, stock: 6 }),
  mp({ id: "p4309078", slug: "single-solar-fan-almubaarak-variety-mall", name: "Single Solar Fan", brand: "Avmall", category: "fans", img: "fe1023e19b250dda0d0f417564b387468d7c8ecb", price: 15500, sale: 13000, stock: 37, short: "Solar-rechargeable standing fan with panel — runs through power cuts." }),
  mp({ id: "p4308268", slug: "double-solar-fan-almubaarak-variety-mall", name: "Double Solar Fan", brand: "Avmall", category: "fans", img: "be4d795035bf5ba6af108f15f658ea1f2307cf90", price: 21500, stock: 14 }),
  mp({ id: "p4309128", slug: "solar-standing-fan-with-panel", name: "Solar Standing Fan With Panel", brand: "Avmall", category: "fans", img: "f99bf06fb67faa88a6e79ee704423b8a479ed01e", price: 67000, stock: 10 }),
  mp({ id: "p4309130", slug: "solar-table-fan", name: "Solar Table Fan", brand: "Avmall", category: "fans", img: "9d1392a3a68a754e8abb5f1c0f724fc1fd1cc3f6", price: 50000, stock: 20 }),
  mp({ id: "p4550506", slug: "jdjindian-rechargeable-solar-standing-fan", name: "JDJ Indian Solar Standing Fan", brand: "JDJ", category: "fans", img: "f826997da87c5970cdf2b6e79af74ab6a2bd3547", price: 68000, sale: 55000, stock: 3 }),
  mp({ id: "p4377701", slug: "mini-desktop-fan", name: "Mini Desktop Fan", brand: "Avmall", category: "fans", img: "5d79c272dc59530a36261b590549cff00b27a237", price: 5200, sale: 3999, stock: 29 }),
  mp({ id: "p4545377", slug: "rechargeable-rotatory-mini-fan", name: "Rechargeable Rotary Mini Fan", brand: "Avmall", category: "fans", img: "c2e499363c2325754316959ce887d8336a9ef4b8", price: 16500, sale: 15500, stock: 10 }),
  mp({ id: "p4545418", slug: "robot-fan-with-light", name: "Robot Fan With Light", brand: "Avmall", category: "fans", img: "f775a9b349683a2000ce203434d3daf4f8cb7c50", price: 20000, sale: 16500, stock: 10, short: "Foldable rotating robot fan with built-in LED night light." }),
  mp({ id: "p4562846", slug: "iwin-eco-v-power-rechargeable-telescopic-fan", name: "Iwin Eco V Power Telescopic Fan", brand: "Iwin", category: "fans", img: "b8a56e67c32df9a86f4f3a267ec5afaa1f68cf72", price: 21500, sale: 19000, stock: 3 }),
  mp({ id: "p4585471", slug: "laptop-table-with-fan-and-lightav", name: "Laptop Table With Fan & Light", brand: "Avmall", category: "fans", img: "062dc577d701efd171b4825b510f1df52a915e02", price: 15500, sale: 12000, stock: 45 }),
  mp({ id: "p4309313", slug: "x5-led-digital-display-fan", name: "X5 LED Digital Display Fan", brand: "Avmall", category: "fans", img: "19467126d81e11717e063157173e6e878a121167", price: 4500, sale: 2999, stock: 39 }),

  // ── HOME & KITCHEN ──────────────────────────────────────────────────────
  mp({ id: "p4368044", slug: "bardefu-blender-8in1", name: "Bardefu 8-in-1 Blender", brand: "Bardefu", category: "home", img: "16b96bb03741180216280281b97797faecab8958", price: 75000, sale: 62000, stock: 4, short: "Heavy-duty 1500W blender — grinds tomatoes, beans, smoothies in seconds." }),
  mp({ id: "p4368060", slug: "kenwood-8in1-blender", name: "Kenwood 8-in-1 Blender", brand: "Kenwood", category: "home", img: "a39126800162b3ed80acc3d97c5b2e191c23af79", price: 78500, sale: 65000, stock: 2 }),
  mp({ id: "p4367867", slug: "kenwood-commercial-grinder-blender", name: "Kenwood Commercial Grinder Blender", brand: "Kenwood", category: "home", img: "c713636d04069b558996cbe2573d63685eda0027", price: 37500, sale: 30000, stock: 12 }),
  mp({ id: "p4367836", slug: "kenwood-blender-4l-10000w", name: "Kenwood Blender 4L 10000W", brand: "Kenwood", category: "home", img: "f6fad62ae95152d6d0014e133a8e4759e540e85a", price: 48500, sale: 42500, stock: 6 }),
  mp({ id: "p4367677", slug: "2in1-kinelco-blender-kn302", name: "Kinelco 2-in-1 Blender KN302", brand: "Kinelco", category: "home", img: "119ac6a72f72516991e34551820700ef7ee164c9", price: 27500, sale: 21000, stock: 6 }),
  mp({ id: "p4666728", slug: "magic-mug", name: "Magic Color-Changing Mug", brand: "Avmall", category: "home", img: "cead5ee75587e73d117155415f4dcc6e7365b21d", price: 5500, sale: 4200, stock: 10, short: "Pour hot water and the design appears — gift favourite." }),
  mp({ id: "p4666634", slug: "5l-maximus-yam-pounder", name: "Maximus 5L Yam Pounder", brand: "Maximus", category: "home", img: "cbae8ee927bbde8f198ac72c36bfa3a163dd18be", price: 21000, sale: 17500, stock: 4 }),
  mp({ id: "p4404047", slug: "automatic-water-dispenser-2", name: "Automatic Water Dispenser", brand: "Avmall", category: "home", img: "b756d90b8fd659e188db0fec1d6244952a515044", price: 7500, sale: 5500, stock: 11 }),
  mp({ id: "p4666743", slug: "glass-cup-b", name: "Glass Tumbler (Style B)", brand: "Avmall", category: "home", img: "e5e581d32904c374e7ec808a388c4a4d23c4327c", price: 2500, sale: 1800, stock: 6 }),
  mp({ id: "p4666741", slug: "glass-cup-1", name: "Glass Tumbler (Style 1)", brand: "Avmall", category: "home", img: "d71d6bac98666bda6e4078034af81da873be3e24", price: 2500, sale: 1800, stock: 6 }),
  mp({ id: "p4587926", slug: "300w-solar-generator-with-50w-panel", name: "300W Solar Generator + 50W Panel", brand: "Avmall", category: "home", img: "3f6547b9eddd1ce64b55d969943852514d0cb974", price: 230000, sale: 195000, stock: 1, short: "Compact solar power station — runs phones, lamps, and small fans through outages." }),
  mp({ id: "p4497090", slug: "150w-solar-generator", name: "150W Solar Generator", brand: "Avmall", category: "home", img: "6a9e35f203f2bbd7b766d6ea9d40187fb2bfb881", price: 145000, sale: 100000, stock: 2 }),
  mp({ id: "p4497202", slug: "high-vacuum-flask", name: "High Vacuum Flask", brand: "Avmall", category: "home", img: "dea622d9e9c324cea2191c59dccad2116a4ecbff", price: 7500, sale: 5000, stock: 5 }),
  mp({ id: "p4594998", slug: "high-vacuum-thermos-cup-1000ml", name: "High Vacuum Thermos Cup 1000ml", brand: "Avmall", category: "home", img: "03f0712b14468d992f81da7b2e287717daa4be3b", price: 7500, sale: 6000, stock: 5 }),
  mp({ id: "p4617547", slug: "3in1-vacuum-flask-set", name: "3-in-1 Vacuum Flask Set", brand: "Avmall", category: "home", img: "d833c33abc6b5f4796247e612685f38f6a7cfde8", price: 5000, stock: 10 }),
  mp({ id: "p4485129", slug: "center-rug", name: "Center Rug", brand: "Avmall", category: "home", img: "88bb7c6351bc4defc8fea2ee8cf2c045645f30cb", price: 26000, stock: 4 }),
  mp({ id: "p4595031", slug: "long-wallpaper", name: "Long Decorative Wallpaper", brand: "Avmall", category: "home", img: "8dd0182760b8722e91cb35496b2b26a6b58dc697", price: 21500, sale: 20000, stock: 2 }),
  mp({ id: "p4614253", slug: "electric-candle-design", name: "Electric Flameless Candle", brand: "Avmall", category: "home", img: "a0d3eb1885250a2818ae2ea6099a50d9304b2aef", price: 6500, sale: 5200, stock: 11 }),
  mp({ id: "p4497241", slug: "fragrance-candle", name: "Fragrance Candle", brand: "Avmall", category: "home", img: "26e08e4555c7ee963dcdf7f2f9cf2b2ab904bed9", price: 3700, sale: 2500, stock: 9 }),
  mp({ id: "p4617601", slug: "tom-gift-set", name: "Tom Men's Gift Set", brand: "Avmall", category: "home", img: "80f276255594bcf5a43a404c9556dace3106c512", price: 27500, sale: 21500, stock: 3 }),
  mp({ id: "p4617596", slug: "olivia-gift-set", name: "Olivia Women's Gift Set", brand: "Avmall", category: "home", img: "ae29ea44a88dc433431bec42e71cfca6041b622b", price: 14000, sale: 11000, stock: 2 }),
  mp({ id: "p4617589", slug: "evelyn-gift-set", name: "Evelyn Gift Set", brand: "Avmall", category: "home", img: "9fb072e7b28f70ef75d867f8f79960e211f759a7", price: 13500, sale: 9500, stock: 2 }),
  mp({ id: "p4565268", slug: "4pcs-dinner-set", name: "4-Piece Dinner Set", brand: "Avmall", category: "home", img: "7d2150a9b399fb944ceac879c4b5de0a1f91aaff", price: 14500, sale: 11500, stock: 3 }),
  mp({ id: "p4421380", slug: "sokany-professional-hair-dryer-2600w", name: "Sokany 2600W Hair Dryer", brand: "Sokany", category: "home", img: "8ca028d39bcbdba2d20ba467391f95b01cbf3498", price: 21500, sale: 17500, stock: 3 }),
  mp({ id: "p4329377", slug: "360-electric-mirror-turntable", name: "360° Electric Mirror Turntable", brand: "Avmall", category: "home", img: "619defee3487f0ea4fe70739c17c2fb004b04a41", price: 26000, sale: 21000, stock: 5 }),
];

